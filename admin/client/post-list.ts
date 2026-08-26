/**
 * 글 목록 — 필터·정렬·번역 스텁 생성·삭제.
 */
import { del, get, getSession, post, reportError, toast } from './api';
import { clear, el, openDialog, qs, qsa } from './dom';
import { L } from '../labels';

interface PostItem {
  id: string;
  path: string;
  category: string;
  slug: string;
  lang: string;
  title: string;
  description: string;
  date: string | null;
  tags: string[];
  draft: boolean;
  mtime: number | null;
  valid: boolean;
  issues: { field: string; message: string }[];
  hasTranslation: boolean;
  translationId: string | null;
}

interface PostsResponse {
  posts: PostItem[];
  total: number;
  counts: { all: number; drafts: number; invalid: number; missingTranslation: number };
}

type SortKey = 'date' | 'title' | 'mtime';

const state = {
  q: '',
  category: '',
  lang: '',
  draft: 'all',
  /** URL 쿼리에서만 오는 보조 필터 */
  translation: '',
  valid: '',
  sort: 'date' as SortKey,
  direction: -1,
  items: [] as PostItem[],
};

function editorHref(id: string): string {
  return `/admin/posts/edit?id=${encodeURIComponent(id)}`;
}

function siteHref(item: PostItem): string {
  const base = `/${item.category}/${item.slug}`;
  return item.lang === 'ko' ? base : `/${item.lang}${base}`;
}

function applyLocalFilters(items: PostItem[]): PostItem[] {
  let out = items;
  if (state.translation === 'missing') out = out.filter((item) => !item.hasTranslation);
  if (state.valid === 'invalid') out = out.filter((item) => !item.valid);
  return out;
}

function sortItems(items: PostItem[]): PostItem[] {
  const key = state.sort;
  return [...items].sort((a, b) => {
    if (key === 'mtime') return ((a.mtime ?? 0) - (b.mtime ?? 0)) * state.direction;
    if (key === 'title') return a.title.localeCompare(b.title, 'ko-KR') * state.direction;
    return String(a.date ?? '').localeCompare(String(b.date ?? '')) * state.direction;
  });
}

function renderRows(): void {
  const body = qs('[data-post-rows]');
  const empty = qs('[data-post-empty]');
  if (!body || !empty) return;

  clear(body);
  clear(empty);

  const items = sortItems(applyLocalFilters(state.items));

  if (items.length === 0) {
    const filtering =
      state.q !== '' ||
      state.category !== '' ||
      state.lang !== '' ||
      state.draft !== 'all' ||
      state.translation !== '' ||
      state.valid !== '';
    empty.append(
      el('p', {
        class: 'admin-empty-note',
        text: filtering ? L.posts.emptyFilteredHint : L.posts.emptyAllHint,
      }),
    );
    return;
  }

  for (const item of items) {
    const status = el('td', { class: 'admin-td' });
    if (item.draft)
      status.append(el('span', { class: 'badge badge-neutral', text: L.posts.draftBadge }));
    if (!item.valid) {
      status.append(
        el('span', {
          class: 'badge badge-accent',
          text: L.posts.errorBadge,
          title: item.issues[0]?.message ?? '',
        }),
      );
    }

    const titleCell = el('div', { class: 'admin-cell-title' }, [
      el('a', { class: 'admin-link', href: editorHref(item.id), text: item.title }),
      el('span', { class: 'admin-path', text: item.path }),
    ]);

    /*
      CRITICAL: 오류 내용을 툴팁에만 두지 않는다. 스키마가 깨진 글은 dev 서버와 빌드를
      함께 죽이는데, 무엇이 잘못됐는지 화면에서 바로 읽을 수 없으면 고칠 수가 없다.
    */
    for (const issue of item.issues) {
      titleCell.append(
        el('span', { class: 'admin-error-inline' }, [
          el('span', { class: 'admin-mono', text: `${issue.field}: ` }),
          el('span', { text: issue.message }),
        ]),
      );
    }

    const title = el('td', { class: 'admin-td' }, [titleCell]);

    const translation = el('td', { class: 'admin-td' });
    if (item.hasTranslation && item.translationId) {
      translation.append(
        el('a', {
          class: 'badge badge-accent admin-link',
          href: editorHref(item.translationId),
          text: item.lang === 'ko' ? 'EN' : 'KO',
        }),
      );
    } else {
      const button = el('button', {
        type: 'button',
        class: 'admin-textbutton',
        text: item.lang === 'ko' ? L.posts.addTranslation : L.posts.addTranslationKo,
      });
      button.addEventListener('click', () => void createTranslation(item, button));
      translation.append(button);
    }

    const actions = el('td', { class: 'admin-td' });
    const view = el('a', {
      class: 'admin-textbutton',
      href: siteHref(item),
      target: '_blank',
      rel: 'noopener noreferrer',
      text: L.posts.viewOnSite,
    });
    if (item.draft) {
      // 초안은 프로덕션에 없다. dev에서는 열리지만 "사이트에서 보기"의 의미가 흐려지므로
      // 비활성으로 둔다.
      view.removeAttribute('href');
      view.setAttribute('aria-disabled', 'true');
      view.classList.add('admin-muted');
    }
    const remove = el('button', {
      type: 'button',
      class: 'admin-textbutton',
      text: L.posts.delete,
    });
    remove.addEventListener('click', () => void confirmDelete(item));
    actions.append(view, remove);

    body.append(
      el('tr', { class: 'admin-tr' }, [
        status,
        title,
        el('td', { class: 'admin-td', text: item.category }),
        el('td', { class: 'admin-td', text: item.tags.join(', ') }),
        el('td', { class: 'admin-td admin-mono', text: item.date ?? '' }),
        translation,
        actions,
      ]),
    );
  }
}

async function load(): Promise<void> {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('category', state.category);
  if (state.lang) params.set('lang', state.lang);
  if (state.draft !== 'all') params.set('draft', state.draft);

  const query = params.toString();
  const data = await get<PostsResponse>(`/posts${query ? `?${query}` : ''}`);
  state.items = data.posts;
  renderRows();
}

async function createTranslation(item: PostItem, button: HTMLElement): Promise<void> {
  button.setAttribute('disabled', '');
  try {
    const result = await post<{ id: string }>(`/posts/${encodeURIComponent(item.id)}/translation`);
    window.location.href = editorHref(result.id);
  } catch (error) {
    button.removeAttribute('disabled');
    reportError(error);
  }
}

async function confirmDelete(item: PostItem): Promise<void> {
  const dialog = qs<HTMLDialogElement>('[data-delete-dialog]');
  if (!dialog) return;

  const pathNode = qs('[data-delete-path]', dialog);
  if (pathNode) pathNode.textContent = item.path;

  const wrap = qs('[data-delete-translation-wrap]', dialog);
  const checkbox = qs<HTMLInputElement>('[data-delete-translation]', dialog);
  if (wrap) wrap.classList.toggle('admin-row-hidden', !item.hasTranslation);
  if (checkbox) checkbox.checked = false;

  const confirmed = await openDialog(dialog);
  if (!confirmed) return;

  try {
    const withTranslation = item.hasTranslation && checkbox?.checked ? '?withTranslation=1' : '';
    const result = await del<{ deleted: string[] }>(
      `/posts/${encodeURIComponent(item.id)}${withTranslation}`,
    );
    toast('success', `삭제했습니다 (${result.deleted.length}개 파일)`);
    await load();
  } catch (error) {
    reportError(error);
  }
}

function readUrlFilters(): void {
  const params = new URLSearchParams(window.location.search);
  state.draft = params.get('draft') ?? 'all';
  state.translation = params.get('translation') ?? '';
  state.valid = params.get('valid') ?? '';
  state.category = params.get('category') ?? '';
  state.lang = params.get('lang') ?? '';
}

function bind(): void {
  let timer: number | undefined;
  const search = qs<HTMLInputElement>('[data-filter="q"]');
  search?.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      state.q = search.value.trim();
      void load().catch(reportError);
    }, 250);
  });

  for (const select of qsa<HTMLSelectElement>('select[data-filter]')) {
    select.addEventListener('change', () => {
      const key = select.dataset.filter as 'category' | 'lang';
      state[key] = select.value;
      void load().catch(reportError);
    });
  }

  for (const button of qsa<HTMLButtonElement>('[data-draft]')) {
    button.addEventListener('click', () => {
      state.draft = button.dataset.draft ?? 'all';
      for (const other of qsa('[data-draft]')) {
        other.setAttribute('aria-pressed', String(other === button));
      }
      void load().catch(reportError);
    });
  }

  for (const header of qsa<HTMLButtonElement>('[data-sort]')) {
    header.addEventListener('click', () => {
      const key = header.dataset.sort as SortKey;
      if (state.sort === key) state.direction *= -1;
      else {
        state.sort = key;
        state.direction = key === 'title' ? 1 : -1;
      }
      renderRows();
    });
  }
}

export async function initPostList(): Promise<void> {
  readUrlFilters();

  try {
    const session = await getSession();

    const categorySelect = qs<HTMLSelectElement>('[data-filter="category"]');
    for (const category of session.categories) {
      categorySelect?.append(el('option', { value: category.id, text: category.label }));
    }
    if (categorySelect) categorySelect.value = state.category;

    const langSelect = qs<HTMLSelectElement>('[data-filter="lang"]');
    for (const lang of session.languages) {
      langSelect?.append(el('option', { value: lang.id, text: lang.nativeName }));
    }
    if (langSelect) langSelect.value = state.lang;

    for (const button of qsa('[data-draft]')) {
      button.setAttribute(
        'aria-pressed',
        String(button.getAttribute('data-draft') === state.draft),
      );
    }

    bind();
    await load();
  } catch (error) {
    reportError(error);
  }
}
