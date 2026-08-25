/**
 * 글 편집기 — 프론트매터 폼 + MDX 본문 + 서버 렌더 프리뷰.
 *
 * CRITICAL: 프리뷰를 비웠다 채우지 않는다. 기존 내용을 유지한 채 교체하고, 갱신 중에는
 * 작은 스피너만 켠다 — 비웠다 채우면 타이핑할 때마다 화면이 깜빡인다(사이트 모션 작업에서
 * 이미 겪은 문제와 같은 유형).
 *
 * CRITICAL: 프리뷰 실패는 토스트를 띄우지 않는다. 타이핑 중 토스트가 쌓이면 쓸 수 없는
 * 편집기가 된다. 회색 한 줄로만 알리고 직전 렌더 결과를 유지한다.
 */
import { AdminApiError, get, getSession, post, put, reportError, toast } from './api';
import { clear, el, need, openDialog, qs, qsa } from './dom';
import {
  getChecked,
  getValue,
  initChips,
  optional,
  readChips,
  setValue,
  writeChips,
} from './fields';
import { bindCounters, clearFieldErrors, createForm, notifyChanged } from './forms';
import { initDropZone } from './uploader';
import { L } from '../labels';

interface PostPayload {
  frontmatter: Record<string, any>;
  body: string;
}

interface PostResponse {
  id: string;
  path: string;
  category: string;
  slug: string;
  lang: string;
  frontmatter: Record<string, any>;
  body: string;
  mtime: number | null;
  sibling: { id: string; lang: string; exists: boolean };
}

const PREVIEW_DEBOUNCE_MS = 400;

/** 사용자가 확인 다이얼로그에서 취소했음을 알리는 표식. 오류로 다루지 않는다. */
class SaveCancelled extends Error {
  constructor() {
    super('저장을 취소했습니다.');
    this.name = 'SaveCancelled';
  }
}

/**
 * 슬러그 자동 생성.
 *
 * CRITICAL: 한글을 로마자로 음역하지 않는다. 음역 규칙이 여러 벌이라 결과가 예측 불가능하고,
 * URL은 한 번 정하면 바꾸기 어렵다. 결과가 비면 사용자가 직접 입력하게 한다.
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

/** `Date`나 ISO 문자열을 `<input type="date">` 값으로. */
function toDateInput(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  const text = String(value);
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export async function initEditor(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const presetCategory = params.get('category');
  const isNew = !id;

  const bodyInput = need<HTMLTextAreaElement>('[data-body]');
  const previewBox = need('[data-preview]');
  const previewHtml = need('[data-preview-html]');
  const tocChips = need('[data-toc-chips]');
  const readingTime = need('[data-reading-time]');
  const staleNote = need('[data-preview-stale]');
  const metaSection = need('[data-meta-section]');
  const categorySelect = need<HTMLSelectElement>('[data-name="category"]');
  const coverSelect = need<HTMLSelectElement>('[data-name="cover"]');
  const slugInput = need<HTMLInputElement>('[data-name="slug"]');
  const slugHint = need('[data-slug-hint]');
  const slugLock = need<HTMLButtonElement>('[data-slug-lock]');

  let metaPanels: Record<string, 'paper' | 'project' | 'none'> = {};
  let currentId = id;
  let currentLang = 'ko';
  let sibling: PostResponse['sibling'] | null = null;
  /** 카테고리를 바꿔도 이전 메타 값을 즉시 버리지 않는다. 되돌리면 살아난다. */
  let metaRetained = false;

  initChips(need('[data-chips="tags"]'), { maxLength: 24 });
  initChips(need('[data-chips="authors"]'));
  initChips(need('[data-chips="stack"]'));
  bindCounters();

  /* ---------- 카테고리 메타 전환 ---------- */

  function syncMetaPanels(): void {
    const category = categorySelect.value;
    const panel = metaPanels[category] ?? 'none';
    metaSection.classList.toggle('admin-row-hidden', panel === 'none');

    for (const node of qsa<HTMLElement>('[data-meta]', metaSection)) {
      const kind = node.dataset.meta;
      const active = kind === panel;
      node.classList.toggle('admin-row-hidden', !active && !metaRetained);
      // 버려질 값은 회색으로 남긴다 — 즉시 지우지 않는다.
      node.classList.toggle('admin-discarded', !active);
    }

    const anyOther =
      qsa('[data-meta]:not(.admin-row-hidden).admin-discarded', metaSection).length > 0;
    qs('[data-meta-discard]')?.classList.toggle('admin-row-hidden', !anyOther);
  }

  categorySelect.addEventListener('change', () => {
    metaRetained = true;
    syncMetaPanels();
    notifyChanged();
  });

  /* ---------- 슬러그 ---------- */

  let slugLocked = false;
  slugLock.addEventListener('click', () => {
    slugLocked = !slugLocked;
    slugLock.setAttribute('aria-pressed', String(slugLocked));
    if (!slugLocked) syncSlugFromTitle();
  });
  slugInput.addEventListener('input', () => {
    slugLocked = true;
    slugLock.setAttribute('aria-pressed', 'true');
  });

  function syncSlugFromTitle(): void {
    if (slugLocked || !isNew) return;
    const title = getValue(document, 'title');
    const generated = slugify(title);
    if (generated === '') {
      slugHint.textContent = title.trim() === '' ? '' : L.editor.slugManual;
      return;
    }
    slugInput.value = generated;
    slugHint.textContent = '';
  }

  qs('[data-name="title"]')?.addEventListener('input', () => {
    syncSlugFromTitle();
    void checkDuplicate();
  });

  let duplicateTimer: number | undefined;
  async function checkDuplicate(): Promise<void> {
    window.clearTimeout(duplicateTimer);
    duplicateTimer = window.setTimeout(async () => {
      const slug = slugInput.value.trim();
      const category = categorySelect.value;
      if (slug === '' || category === '') return;
      try {
        const data = await get<{
          posts: { slug: string; category: string; lang: string; id: string }[];
        }>(`/posts?category=${encodeURIComponent(category)}`);
        const clash = data.posts.find(
          (item) => item.slug === slug && item.lang === currentLang && item.id !== currentId,
        );
        slugHint.textContent = clash ? L.editor.slugDuplicate : '';
      } catch {
        /* 표시용 검사다. 실패해도 저장을 막지 않는다 */
      }
    }, 300);
  }
  slugInput.addEventListener('input', () => void checkDuplicate());

  /* ---------- 본문 도구 줄 · Tab 들여쓰기 ---------- */

  function surround(before: string, after = before): void {
    const start = bodyInput.selectionStart;
    const end = bodyInput.selectionEnd;
    const value = bodyInput.value;
    const selected = value.slice(start, end);
    bodyInput.value = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    bodyInput.focus();
    bodyInput.setSelectionRange(start + before.length, start + before.length + selected.length);
    notifyChanged();
    schedulePreview();
  }

  function insertLine(prefix: string): void {
    const start = bodyInput.selectionStart;
    const value = bodyInput.value;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    bodyInput.value = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`;
    bodyInput.focus();
    bodyInput.setSelectionRange(start + prefix.length, start + prefix.length);
    notifyChanged();
    schedulePreview();
  }

  /** 커서 위치에 문자열을 그대로 넣는다. */
  function insertAtCursor(text: string): void {
    const start = bodyInput.selectionStart;
    const end = bodyInput.selectionEnd;
    const value = bodyInput.value;
    bodyInput.value = `${value.slice(0, start)}${text}${value.slice(end)}`;
    bodyInput.focus();
    bodyInput.setSelectionRange(start + text.length, start + text.length);
    notifyChanged();
    schedulePreview();
  }

  const TOOL_ACTIONS: Record<string, () => void> = {
    bold: () => surround('**'),
    italic: () => surround('_'),
    // CRITICAL: `](url)` 자리표시를 넣지 않는다. 그대로 저장되면 죽은 링크가 배포된다.
    link: () => void openLinkPicker(),
    code: () => surround('`'),
    quote: () => insertLine('> '),
    math: () => surround('\n$$\n', '\n$$\n'),
    // CRITICAL: 자리표시 경로를 넣지 않는다. 없는 파일을 참조하면 Vite가 모듈을 해석하지
    // 못해 dev 서버와 빌드가 함께 죽는다. 실제로 올라간 파일 중에서만 고르게 한다.
    image: () => void openImagePicker(),
    h2: () => insertLine('## '),
    h3: () => insertLine('### '),
  };

  for (const button of qsa<HTMLButtonElement>('[data-tool]')) {
    button.addEventListener('click', () => TOOL_ACTIONS[button.dataset.tool ?? '']?.());
  }

  bodyInput.addEventListener('keydown', (event) => {
    // Tab은 두 칸 삽입. 포커스 이동이 필요하면 Esc를 먼저 누른다.
    if (event.key === 'Tab' && !escapedTab) {
      event.preventDefault();
      surround('  ', '');
      return;
    }
    if (event.key === 'Escape') escapedTab = true;
    else if (event.key !== 'Tab') escapedTab = false;

    const meta = event.metaKey || event.ctrlKey;
    if (!meta) return;
    const key = event.key.toLowerCase();
    if (key === 'b') {
      event.preventDefault();
      TOOL_ACTIONS.bold();
    } else if (key === 'i') {
      event.preventDefault();
      TOOL_ACTIONS.italic();
    } else if (key === 'k') {
      event.preventDefault();
      TOOL_ACTIONS.link();
    }
  });
  let escapedTab = false;

  /* ---------- 프리뷰 ---------- */

  let previewTimer: number | undefined;
  /** 늦게 도착한 응답이 새 응답을 덮어쓰지 않게 하는 순번. */
  let previewSeq = 0;

  function schedulePreview(): void {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => void renderPreview(), PREVIEW_DEBOUNCE_MS);
  }

  async function renderPreview(): Promise<void> {
    const seq = (previewSeq += 1);
    previewBox.setAttribute('data-pending', 'true');

    try {
      const result = await post<{ html: string; headings: { depth: number; text: string }[] }>(
        '/preview',
        { body: bodyInput.value },
      );
      // 늦게 도착한 응답은 버린다 — 프리뷰가 과거로 돌아가면 안 된다.
      if (seq !== previewSeq) return;
      // CRITICAL: 비우지 않고 통째로 교체한다.
      // 값의 출처는 서버의 `preview.mjs`이며, 사용자 입력은 그 안에서 이스케이프된다.
      previewHtml.innerHTML = result.html;
      staleNote.classList.add('admin-row-hidden');

      clear(tocChips);
      for (const heading of result.headings) {
        tocChips.append(
          el('span', {
            class: 'admin-toc-chip',
            text: `${'·'.repeat(heading.depth - 1)}${heading.text}`,
          }),
        );
      }
      readingTime.textContent = L.editor.readingTime(estimateReadingTime(bodyInput.value));
    } catch {
      // CRITICAL: 토스트를 띄우지 않는다. 직전 결과를 유지한 채 회색 줄만 보여 준다.
      if (seq === previewSeq) staleNote.classList.remove('admin-row-hidden');
    } finally {
      if (seq === previewSeq) previewBox.setAttribute('data-pending', 'false');
    }
  }

  /** `src/lib/reading-time.ts`와 같은 규칙(한글 500자/분, 영문 200단어/분). */
  function estimateReadingTime(body: string): number {
    const text = body
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\$\$[\s\S]*?\$\$/g, '')
      .replace(/`[^`]*`/g, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]+>/g, ' ');
    const korean = (text.match(/[ㄱ-힝]/g) ?? []).length;
    const english = (text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length;
    return Math.max(1, Math.round(korean / 500 + english / 200));
  }

  bodyInput.addEventListener('input', schedulePreview);

  /* ---------- 탭 (1024px 미만) ---------- */

  for (const tab of qsa<HTMLButtonElement>('[data-tab]')) {
    tab.addEventListener('click', () => {
      need('[data-editor]').setAttribute('data-tab', tab.dataset.tab ?? 'edit');
      for (const other of qsa('[data-tab]')) {
        other.setAttribute('aria-pressed', String(other === tab));
      }
    });
  }

  /* ---------- 커버 이미지 ---------- */

  /** 커버 select와 본문 삽입 피커가 같은 목록을 쓴다. */
  let assetNames: string[] = [];

  async function loadAssets(selectedName?: string): Promise<void> {
    try {
      const data = await get<{ assets: { name: string }[] }>('/assets');
      assetNames = data.assets.map((asset) => asset.name);

      const current = selectedName ?? coverSelect.value;
      clear(coverSelect);
      coverSelect.append(el('option', { value: '', text: '(없음)' }));
      for (const name of assetNames) {
        coverSelect.append(el('option', { value: `../../../assets/${name}`, text: name }));
      }
      coverSelect.value = current ?? '';

      const picker = qs<HTMLSelectElement>('[data-image-select]');
      if (picker) {
        const picked = picker.value;
        clear(picker);
        for (const name of assetNames) {
          picker.append(el('option', { value: name, text: name }));
        }
        if (assetNames.includes(picked)) picker.value = picked;
        picker.disabled = assetNames.length === 0;
        qs('[data-image-empty]')?.classList.toggle('admin-row-hidden', assetNames.length > 0);
      }
    } catch {
      /* 이미지 목록은 부가 기능이다 */
    }
  }

  /**
   * 링크 삽입 다이얼로그.
   *
   * 선택한 텍스트가 있으면 그것을 라벨로 채워 둔다. 주소를 비운 채 확인하면 아무것도
   * 넣지 않는다 — 깨진 링크가 남을 여지를 만들지 않는다.
   */
  async function openLinkPicker(): Promise<void> {
    const dialog = qs<HTMLDialogElement>('[data-link-dialog]');
    if (!dialog) return;

    const selected = bodyInput.value.slice(bodyInput.selectionStart, bodyInput.selectionEnd);
    const textInput = qs<HTMLInputElement>('[data-link-text]', dialog);
    const hrefInput = qs<HTMLInputElement>('[data-link-href]', dialog);
    if (textInput) textInput.value = selected;
    if (hrefInput) hrefInput.value = '';

    const confirmed = await openDialog(dialog);
    if (!confirmed) return;

    const href = (hrefInput?.value ?? '').trim();
    if (href === '') {
      toast('error', L.editor.linkHrefRequired);
      return;
    }
    const label = (textInput?.value ?? '').trim() || href;
    insertAtCursor(`[${label}](${href})`);
  }

  /**
   * 본문 이미지 삽입 다이얼로그.
   *
   * 이미지가 하나도 없으면 다이얼로그 안의 드롭 영역으로 바로 올릴 수 있다.
   * 고르지 않고 닫으면 본문은 그대로다 — 깨진 참조가 남지 않는다.
   */
  async function openImagePicker(): Promise<void> {
    const dialog = qs<HTMLDialogElement>('[data-image-dialog]');
    if (!dialog) return;

    await loadAssets();

    const altInput = qs<HTMLInputElement>('[data-image-alt]', dialog);
    if (altInput) altInput.value = '';

    const confirmed = await openDialog(dialog);
    if (!confirmed) return;

    const picker = qs<HTMLSelectElement>('[data-image-select]', dialog);
    const name = picker?.value ?? '';
    if (name === '') {
      toast('error', L.editor.noImages);
      return;
    }
    const alt = (altInput?.value ?? '').trim();
    insertAtCursor(`![${alt}](../../../assets/${name})`);
  }

  qs('[data-cover-clear]')?.addEventListener('click', () => {
    coverSelect.value = '';
    notifyChanged();
  });

  initDropZone(need('[data-cover-drop]'), {
    multiple: false,
    onUploaded: async (result) => {
      await loadAssets(result.relativeFromPost);
      coverSelect.value = result.relativeFromPost;
      notifyChanged();
      toast('success', `커버로 지정했습니다: ${result.name}`);
    },
    onFailed: (error) => reportError(error),
  });

  const imageDrop = qs<HTMLElement>('[data-image-drop]');
  if (imageDrop) {
    initDropZone(imageDrop, {
      multiple: false,
      onUploaded: async (result) => {
        await loadAssets();
        const picker = qs<HTMLSelectElement>('[data-image-select]');
        if (picker) picker.value = result.name;
        toast('success', `올렸습니다: ${result.name}`);
      },
      onFailed: (error) => reportError(error),
    });
  }

  /* ---------- 폼 ---------- */

  function readFrontmatter(): Record<string, any> {
    const category = categorySelect.value;
    const panel = metaPanels[category] ?? 'none';

    const frontmatter: Record<string, any> = {
      slug: slugInput.value.trim(),
      lang: currentLang,
      title: getValue(document, 'title'),
      description: getValue(document, 'description'),
      category,
      date: getValue(document, 'date'),
      updated: optional(getValue(document, 'updated')),
      tags: readChips(need('[data-chips="tags"]')),
      draft: getChecked(document, 'draft'),
      cover: optional(coverSelect.value),
      coverAlt: optional(getValue(document, 'coverAlt')),
      math: getChecked(document, 'math'),
      toc: getChecked(document, 'toc'),
    };

    // CRITICAL: 활성 패널의 값만 저장한다. 다른 카테고리의 메타는 저장 시 제거된다.
    if (panel === 'paper') {
      frontmatter.paper = {
        paperTitle: getValue(document, 'paper.paperTitle'),
        authors: readChips(need('[data-chips="authors"]')),
        venue: getValue(document, 'paper.venue'),
        year: Number(getValue(document, 'paper.year')) || undefined,
        arxivId: optional(getValue(document, 'paper.arxivId')),
        doi: optional(getValue(document, 'paper.doi')),
        pdfUrl: optional(getValue(document, 'paper.pdfUrl')),
        codeUrl: optional(getValue(document, 'paper.codeUrl')),
        readDate: optional(getValue(document, 'paper.readDate')),
      };
    } else if (panel === 'project') {
      const ongoing = getChecked(document, 'project.ongoing');
      frontmatter.project = {
        role: getValue(document, 'project.role'),
        period: {
          start: getValue(document, 'project.period.start').trim(),
          end: ongoing ? null : (optional(getValue(document, 'project.period.end')) ?? null),
        },
        stack: readChips(need('[data-chips="stack"]')),
        status: getValue(document, 'project.status') || 'in-progress',
        repoUrl: optional(getValue(document, 'project.repoUrl')),
        demoUrl: optional(getValue(document, 'project.demoUrl')),
        teamSize: Number(getValue(document, 'project.teamSize')) || undefined,
      };
    }

    return frontmatter;
  }

  function writeFrontmatter(frontmatter: Record<string, any>): void {
    slugInput.value = frontmatter.slug ?? '';
    setValue(document, 'title', frontmatter.title ?? '');
    setValue(document, 'description', frontmatter.description ?? '');
    categorySelect.value = frontmatter.category ?? presetCategory ?? categorySelect.value;
    setValue(document, 'date', toDateInput(frontmatter.date));
    setValue(document, 'updated', toDateInput(frontmatter.updated));
    writeChips(need('[data-chips="tags"]'), frontmatter.tags ?? []);
    setValue(document, 'draft', frontmatter.draft === true);
    setValue(document, 'math', frontmatter.math === true);
    setValue(document, 'toc', frontmatter.toc !== false);
    coverSelect.value = frontmatter.cover ?? '';
    setValue(document, 'coverAlt', frontmatter.coverAlt ?? '');

    const paper = frontmatter.paper ?? {};
    setValue(document, 'paper.paperTitle', paper.paperTitle ?? '');
    writeChips(need('[data-chips="authors"]'), paper.authors ?? []);
    setValue(document, 'paper.venue', paper.venue ?? '');
    setValue(document, 'paper.year', paper.year ?? '');
    setValue(document, 'paper.arxivId', paper.arxivId ?? '');
    setValue(document, 'paper.doi', paper.doi ?? '');
    setValue(document, 'paper.pdfUrl', paper.pdfUrl ?? '');
    setValue(document, 'paper.codeUrl', paper.codeUrl ?? '');
    setValue(document, 'paper.readDate', toDateInput(paper.readDate));

    const project = frontmatter.project ?? {};
    setValue(document, 'project.role', project.role ?? '');
    setValue(document, 'project.period.start', project.period?.start ?? '');
    setValue(document, 'project.period.end', project.period?.end ?? '');
    setValue(document, 'project.ongoing', project.period?.end === null);
    writeChips(need('[data-chips="stack"]'), project.stack ?? []);
    setValue(document, 'project.status', project.status ?? 'in-progress');
    setValue(document, 'project.repoUrl', project.repoUrl ?? '');
    setValue(document, 'project.demoUrl', project.demoUrl ?? '');
    setValue(document, 'project.teamSize', project.teamSize ?? '');

    metaRetained = false;
    syncMetaPanels();
    bindCounters();
  }

  const form = createForm<PostPayload>({
    read: () => ({ frontmatter: readFrontmatter(), body: bodyInput.value }),
    write: (value) => {
      writeFrontmatter(value.frontmatter);
      bodyInput.value = value.body;
      void renderPreview();
    },
    countChanges(baseline, current) {
      let count = 0;
      if (JSON.stringify(baseline.frontmatter) !== JSON.stringify(current.frontmatter)) count += 1;
      if (baseline.body !== current.body) count += 1;
      return count;
    },
    validate(value) {
      // CRITICAL: cover가 있는데 coverAlt가 비면 저장을 막는다 —
      // 스키마의 superRefine 규칙을 폼 단계에서 미리 강제한다.
      if (value.frontmatter.cover && !value.frontmatter.coverAlt) {
        return L.editor.coverAltRequired;
      }
      if (!value.frontmatter.slug) return L.editor.slugManual;
      return null;
    },
    async save(value, baseMtime) {
      clearFieldErrors();

      if (!currentId) {
        const result = await post<{ id: string; path: string; mtime: number }>('/posts', {
          category: value.frontmatter.category,
          slug: value.frontmatter.slug,
          lang: currentLang,
          frontmatter: value.frontmatter,
          body: value.body,
        });
        currentId = result.id;
        // URL을 편집 모드로 바꾼다. 새로고침해도 같은 글이 열린다.
        window.history.replaceState(
          {},
          '',
          `/admin/posts/edit?id=${encodeURIComponent(result.id)}`,
        );
        setPathDisplay(result.path);
        return { mtime: result.mtime };
      }

      // slug나 category가 바뀌면 번역본도 함께 이름이 바뀐다 — 저장 전에 알린다.
      const baseline = form.baseline();
      const moving =
        baseline.frontmatter.slug !== value.frontmatter.slug ||
        baseline.frontmatter.category !== value.frontmatter.category;
      if (moving && sibling?.exists) {
        const dialog = need<HTMLDialogElement>('[data-rename-dialog]');
        const list = qs('[data-rename-list]', dialog);
        if (list) {
          clear(list);
          list.append(
            el('li', {
              class: 'admin-list-item admin-path',
              text: `${currentId} → ${value.frontmatter.category}/${value.frontmatter.slug}`,
            }),
            el('li', {
              class: 'admin-list-item admin-path',
              text: `${sibling.id} → ${value.frontmatter.category}/${value.frontmatter.slug}.${sibling.lang}`,
            }),
          );
        }
        const confirmed = await openDialog(dialog);
        // 사용자가 취소했다. 오류가 아니므로 토스트를 띄우지 않고 조용히 빠진다.
        if (!confirmed) throw new SaveCancelled();
      }

      try {
        const result = await put<{ id: string; path: string; mtime: number; renamed: unknown[] }>(
          `/posts/${encodeURIComponent(currentId)}`,
          { frontmatter: value.frontmatter, body: value.body, baseMtime },
        );
        if (result.id !== currentId) {
          currentId = result.id;
          window.history.replaceState(
            {},
            '',
            `/admin/posts/edit?id=${encodeURIComponent(result.id)}`,
          );
        }
        setPathDisplay(result.path);
        if (result.renamed?.length)
          toast('success', `파일 ${result.renamed.length}개의 이름이 바뀌었습니다`);
        return { mtime: result.mtime };
      } catch (error) {
        if (error instanceof AdminApiError && error.code === 'E-STALE') {
          await handleStale(error, value);
        }
        throw error;
      }
    },
  });

  async function handleStale(error: AdminApiError, mine: PostPayload): Promise<void> {
    const detail = error.detail as {
      diskMtime: number;
      current: { frontmatter: Record<string, any>; body: string } | null;
    } | null;
    const dialog = need<HTMLDialogElement>('[data-stale-dialog]');
    const diskNode = qs('[data-stale-disk]', dialog);
    if (diskNode) diskNode.textContent = detail?.current?.body ?? '(디스크 내용을 읽지 못했습니다)';

    // CRITICAL: 기본 선택은 취소다. 어떤 경우에도 한쪽 변경이 조용히 사라지지 않아야 한다.
    const picked = { value: 'cancel' as 'cancel' | 'load' | 'overwrite' };
    const load = qs('[data-stale-load]', dialog);
    const overwrite = qs('[data-stale-overwrite]', dialog);
    const onLoad = () => {
      picked.value = 'load';
      dialog.close();
    };
    const onOverwrite = () => {
      picked.value = 'overwrite';
      dialog.close();
    };
    load?.addEventListener('click', onLoad);
    overwrite?.addEventListener('click', onOverwrite);
    await openDialog(dialog);
    load?.removeEventListener('click', onLoad);
    overwrite?.removeEventListener('click', onOverwrite);

    if (picked.value === 'load' && detail?.current) {
      form.reset(
        { frontmatter: detail.current.frontmatter, body: detail.current.body },
        detail.diskMtime,
      );
      toast('success', '디스크 내용을 불러왔습니다');
      return;
    }
    if (picked.value === 'overwrite' && detail) {
      try {
        const result = await put<{ mtime: number }>(`/posts/${encodeURIComponent(currentId!)}`, {
          frontmatter: mine.frontmatter,
          body: mine.body,
          baseMtime: detail.diskMtime,
        });
        form.reset(mine, result.mtime);
        toast('success', L.save.saved);
      } catch (retryError) {
        reportError(retryError);
      }
    }
  }

  function setPathDisplay(path: string): void {
    const node = qs('[data-editor-path]');
    if (node) node.textContent = path;
  }

  /* ---------- 번역 대조 ---------- */

  qs('[data-source-toggle]')?.addEventListener('change', async (event) => {
    const on = (event.target as HTMLInputElement).checked;
    const pane = need('[data-source-pane]');
    pane.classList.toggle('admin-row-hidden', !on);
    if (!on || !sibling?.exists) return;
    try {
      const data = await get<PostResponse>(`/posts/${encodeURIComponent(sibling.id)}`);
      const node = qs('[data-source-body]');
      if (node) node.textContent = data.body;
    } catch (error) {
      reportError(error);
    }
  });

  /* ---------- 로드 ---------- */

  try {
    const session = await getSession();
    metaPanels = Object.fromEntries(session.categories.map((c) => [c.id, c.metaPanel]));
    for (const category of session.categories) {
      categorySelect.append(el('option', { value: category.id, text: category.label }));
    }
    await loadAssets();

    if (isNew) {
      categorySelect.value = presetCategory ?? session.categories[0]?.id ?? '';
      currentLang = session.defaultLang;
      const today = new Date().toISOString().slice(0, 10);
      form.reset(
        {
          frontmatter: { category: categorySelect.value, date: today, toc: true, tags: [] },
          body: '',
        },
        null,
      );
      qs<HTMLInputElement>('[data-name="title"]')?.focus();
      setPathDisplay(L.editor.newTitle);
    } else {
      const data = await get<PostResponse>(`/posts/${encodeURIComponent(id!)}`);
      currentLang = data.lang;
      sibling = data.sibling;
      slugLocked = true;
      slugLock.setAttribute('aria-pressed', 'true');
      form.reset({ frontmatter: data.frontmatter, body: data.body }, data.mtime);
      setPathDisplay(data.path);

      const viewLink = qs<HTMLAnchorElement>('[data-view-on-site]');
      if (viewLink) {
        const base = `/${data.category}/${data.slug}`;
        viewLink.href = data.lang === 'ko' ? base : `/${data.lang}${base}`;
      }
      if (data.sibling.exists) {
        qs('[data-source-toggle-wrap]')?.classList.remove('admin-row-hidden');
      }
    }

    const langDisplay = qs('[data-lang-display]');
    if (langDisplay) langDisplay.textContent = `${currentLang} — ${L.editor.langDerived}`;

    syncMetaPanels();
    notifyChanged();
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'E-NOT-FOUND') {
      toast('error', L.errors.notFound, error.code);
      window.setTimeout(() => (window.location.href = '/admin/posts'), 1500);
      return;
    }
    reportError(error);
  }
}
