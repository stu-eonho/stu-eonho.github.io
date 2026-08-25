/**
 * 태그 관리 — 이름 변경 / 병합 / 삭제.
 *
 * CRITICAL: 모든 동작은 `dryRun` → 영향 목록 확인 → 실제 쓰기 순서다. 확인하기 전에는
 * 파일이 바뀌지 않는다.
 *
 * CRITICAL: 부분 성공을 "전부 성공"으로 뭉뚱그리지 않는다. 응답의 `succeeded`/`failed`를
 * 그대로 보여 준다.
 */
import { get, post, reportError, toast } from './api';
import { clear, el, need, openDialog, qs, qsa } from './dom';
import { L } from '../labels';

interface TagPost {
  id: string;
  title: string;
  lang: string;
}

interface Tag {
  slug: string;
  label: string;
  variants: { raw: string; count: number }[];
  total: number;
  posts: TagPost[];
}

interface DryRunResult {
  affected: { id: string; path: string; before: string[]; after: string[] }[];
  succeeded: string[];
  failed: { id: string; message: string }[];
  dryRun: boolean;
}

export async function initTags(): Promise<void> {
  const list = need('[data-tag-list]');
  const emptyHost = need('[data-tag-empty]');
  const template = need<HTMLTemplateElement>('[data-tag-template]');
  const diffDialog = need<HTMLDialogElement>('#tag-diff');
  const renameDialog = need<HTMLDialogElement>('[data-rename-dialog]');
  const mergeButton = need<HTMLButtonElement>('[data-merge-selected]');

  let tags: Tag[] = [];
  let sort: 'count' | 'name' = 'count';

  function selected(): string[] {
    return qsa<HTMLInputElement>('[data-tag-select]:checked').map(
      (input) => input.closest('[data-tag-slug]')?.getAttribute('data-tag-slug') ?? '',
    );
  }

  function syncMergeButton(): void {
    mergeButton.disabled = selected().length < 2;
  }

  /**
   * dryRun 결과를 보여 주고 확인되면 실제로 적용한다.
   * `title`은 다이얼로그 제목, `payload`는 dryRun 없이 보낼 본문이다.
   */
  async function confirmAndApply(
    endpoint: string,
    payload: Record<string, unknown>,
    title: string,
  ): Promise<void> {
    let preview: DryRunResult;
    try {
      preview = await post<DryRunResult>(endpoint, { ...payload, dryRun: true });
    } catch (error) {
      reportError(error);
      return;
    }

    const titleNode = qs('[data-diff-title]', diffDialog);
    if (titleNode) titleNode.textContent = `${title} — ${L.tags.affected(preview.affected.length)}`;

    const diffList = qs('[data-diff-list]', diffDialog);
    if (diffList) {
      clear(diffList);
      if (preview.affected.length === 0) {
        diffList.append(el('p', { class: 'admin-hint', text: '바뀌는 글이 없습니다.' }));
      }
      for (const item of preview.affected) {
        diffList.append(
          el('div', { class: 'admin-diff-row' }, [
            el('span', { class: 'admin-path', text: item.path }),
            el('span', { class: 'admin-diff-before', text: `[${item.before.join(', ')}]` }),
            el('span', { class: 'admin-diff-after', text: `[${item.after.join(', ')}]` }),
          ]),
        );
      }
    }

    const confirmed = await openDialog(diffDialog, '[data-diff-confirm]', '[data-diff-cancel]');
    if (!confirmed || preview.affected.length === 0) return;

    try {
      const result = await post<DryRunResult>(endpoint, { ...payload, dryRun: false });
      if (result.failed.length > 0) {
        // CRITICAL: 부분 성공을 명확히 표시한다.
        toast('error', L.tags.partial(result.succeeded.length, result.failed.length));
      } else {
        toast('success', `글 ${result.succeeded.length}편의 태그를 수정했습니다`);
      }
      await load();
    } catch (error) {
      reportError(error);
    }
  }

  async function askNewName(current: string): Promise<string | null> {
    const input = qs<HTMLInputElement>('[data-rename-input]', renameDialog);
    if (input) input.value = current;
    const ok = await openDialog(renameDialog);
    const value = input?.value.trim() ?? '';
    return ok && value !== '' ? value : null;
  }

  function render(): void {
    clear(list);
    clear(emptyHost);

    if (tags.length === 0) {
      emptyHost.append(el('p', { class: 'admin-empty-note', text: L.tags.emptyHint }));
      return;
    }

    const sorted = [...tags].sort((a, b) =>
      sort === 'count'
        ? b.total - a.total || a.label.localeCompare(b.label)
        : a.label.localeCompare(b.label),
    );

    for (const tag of sorted) {
      const fragment = template.content.cloneNode(true) as DocumentFragment;
      const card = fragment.querySelector<HTMLElement>('.card');
      if (!card) continue;
      card.setAttribute('data-tag-slug', tag.slug);

      const label = qs('[data-tag-label]', card);
      if (label) label.textContent = tag.label;

      const count = qs('[data-tag-count]', card);
      if (count) count.textContent = L.tags.usedIn(tag.total);

      // 표기가 둘 이상이면 정규화 대상이다.
      if (tag.variants.length > 1) {
        const badge = qs('[data-tag-variants]', card);
        if (badge) {
          badge.textContent = L.tags.variants(tag.variants.length);
          badge.classList.remove('admin-row-hidden');
        }
        const normalize = qs<HTMLButtonElement>('[data-tag-normalize]', card);
        normalize?.classList.remove('admin-row-hidden');
        normalize?.addEventListener('click', () =>
          confirmAndApply(
            '/tags/merge',
            { sources: tag.variants.map((v) => v.raw), target: tag.label },
            `${L.tags.normalize}: ${tag.label}`,
          ),
        );
      }

      const variantList = qs('[data-tag-variant-list]', card);
      for (const variant of tag.variants) {
        variantList?.append(
          el('span', { class: 'admin-chip' }, [
            el('span', { text: `${variant.raw} (${variant.count})` }),
          ]),
        );
      }

      const posts = qs('[data-tag-posts]', card);
      for (const item of tag.posts) {
        posts?.append(
          el('li', { class: 'admin-list-item' }, [
            el('a', {
              class: 'admin-link',
              href: `/admin/posts/edit?id=${encodeURIComponent(item.id)}`,
              text: item.title,
            }),
            el('span', { class: 'admin-lang-tag', text: item.lang.toUpperCase() }),
          ]),
        );
      }

      qs('[data-tag-rename]', card)?.addEventListener('click', async () => {
        const next = await askNewName(tag.label);
        if (!next) return;
        await confirmAndApply(
          '/tags/rename',
          { from: tag.label, to: next },
          `${L.tags.rename}: ${tag.label} → ${next}`,
        );
      });

      qs('[data-tag-delete]', card)?.addEventListener('click', () =>
        confirmAndApply('/tags/delete', { tag: tag.label }, `${L.tags.delete}: ${tag.label}`),
      );

      qs('[data-tag-select]', card)?.addEventListener('change', syncMergeButton);

      list.append(fragment);
    }

    syncMergeButton();
  }

  mergeButton.addEventListener('click', async () => {
    const sources = selected();
    if (sources.length < 2) return;
    const labels = sources.map((slug) => tags.find((tag) => tag.slug === slug)?.label ?? slug);
    const target = await askNewName(labels[0]);
    if (!target) return;
    await confirmAndApply(
      '/tags/merge',
      { sources: labels, target },
      `${L.tags.merge}: ${labels.join(', ')} → ${target}`,
    );
  });

  for (const button of qsa<HTMLButtonElement>('[data-sort]')) {
    button.addEventListener('click', () => {
      sort = (button.dataset.sort as 'count' | 'name') ?? 'count';
      for (const other of qsa('[data-sort]')) {
        other.setAttribute('aria-pressed', String(other === button));
      }
      render();
    });
  }

  async function load(): Promise<void> {
    const data = await get<{ tags: Tag[] }>('/tags');
    tags = data.tags;
    render();
  }

  try {
    await load();
  } catch (error) {
    reportError(error);
  }
}
