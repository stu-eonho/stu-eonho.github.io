/**
 * 대시보드 — 통계 타일 4개, 프로필 미기입, 최근 수정, git 워킹 트리 + 커밋·푸시.
 *
 * CRITICAL: 푸시는 곧 공개 배포다. 확인 창을 반드시 거치며 기본 선택은 취소다.
 * 강제 푸시(`--force`)로 가는 경로는 화면에도 서버에도 두지 않는다.
 */
import { get, post, reportError, toast } from './api';
import { clear, copyText, el, openDialog, qs, qsa, relativeTime } from './dom';
import { L } from '../labels';

interface PostItem {
  id: string;
  title: string;
  category: string;
  lang: string;
  draft: boolean;
  valid: boolean;
  mtime: number | null;
  hasTranslation: boolean;
}

interface PostsResponse {
  posts: PostItem[];
  total: number;
  counts: { all: number; drafts: number; invalid: number; missingTranslation: number };
}

interface ProfileResponse {
  placeholders: string[];
}

interface GitResponse {
  available: boolean;
  branch: string | null;
  files: { status: string; path: string }[];
  clean: boolean;
  remote: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  drafts: number;
}

function setTile(key: string, value: number, hint?: string, alert = false): void {
  const tile = qs(`[data-tile="${key}"]`);
  if (!tile) return;
  const valueNode = qs('[data-tile-value]', tile);
  if (valueNode) valueNode.textContent = String(value);
  const hintNode = qs('[data-tile-hint]', tile);
  if (hintNode && hint) hintNode.textContent = hint;
  tile.setAttribute('data-alert', String(alert));
  const icon = qs('[data-tile-alert]', tile);
  if (icon) icon.classList.toggle('admin-row-hidden', !alert);
}

async function loadPosts(): Promise<void> {
  const data = await get<PostsResponse>('/posts');
  const published = data.counts.all - data.counts.drafts;

  setTile('all', data.counts.all, L.dashboard.totalPostsHint(published, data.counts.all));
  setTile('drafts', data.counts.drafts);
  setTile('missing', data.counts.missingTranslation);
  // CRITICAL: 스키마 오류가 0이 아니면 경고 아이콘과 굵은 숫자로 알린다.
  setTile('invalid', data.counts.invalid, undefined, data.counts.invalid > 0);

  const recent = qs('[data-recent]');
  if (!recent) return;
  clear(recent);

  const items = [...data.posts].sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0)).slice(0, 5);
  if (items.length === 0) {
    recent.append(el('li', { class: 'admin-list-item admin-muted', text: L.posts.emptyAll }));
    return;
  }

  for (const post of items) {
    recent.append(
      el('li', { class: 'admin-list-item' }, [
        el('a', {
          class: 'admin-link',
          href: `/admin/posts/edit?id=${encodeURIComponent(post.id)}`,
          text: post.title,
        }),
        el('span', { class: 'admin-muted' }, [
          el('span', { class: 'admin-lang-tag', text: post.category }),
          document.createTextNode(' · '),
          document.createTextNode(relativeTime(post.mtime)),
        ]),
      ]),
    );
  }
}

async function loadPlaceholders(): Promise<void> {
  const list = qs('[data-placeholders]');
  if (!list) return;
  const data = await get<ProfileResponse>('/profile');
  clear(list);

  if (data.placeholders.length === 0) {
    list.append(
      el('li', { class: 'admin-list-item admin-muted', text: L.dashboard.placeholdersEmpty }),
    );
    return;
  }

  for (const field of data.placeholders) {
    list.append(
      el('li', { class: 'admin-list-item' }, [
        el('a', {
          class: 'admin-link admin-mono',
          href: `/admin/profile#field-${encodeURIComponent(field)}`,
          text: field,
        }),
      ]),
    );
  }
}

/* ==========================================================================
   git — 상태 · 커밋 · 푸시
   ========================================================================== */

let gitState: GitResponse | null = null;

/** 체크된 파일 경로. */
function selectedFiles(): string[] {
  return qsa<HTMLInputElement>('[data-git-file]:checked').map((input) => input.value);
}

function syncSelection(): void {
  const total = qsa('[data-git-file]').length;
  const picked = selectedFiles().length;

  const label = qs('[data-git-selected]');
  if (label) label.textContent = total === 0 ? '' : L.dashboard.selectedCount(picked, total);

  const all = qs<HTMLInputElement>('[data-git-all]');
  if (all) {
    all.checked = total > 0 && picked === total;
    all.indeterminate = picked > 0 && picked < total;
  }

  const commit = qs<HTMLButtonElement>('[data-git-commit]');
  if (commit) commit.toggleAttribute('disabled', picked === 0);
}

/** 푸시 버튼과 안내 문구를 업스트림 상태에 맞춘다. */
function syncPushState(data: GitResponse): void {
  let text = L.dashboard.aheadCount(data.ahead);
  let blocked = data.ahead === 0;

  if (!data.upstream) {
    text = L.dashboard.noUpstream;
    blocked = true;
  } else if (data.behind > 0) {
    // CRITICAL: 뒤진 상태에서 푸시를 유도하지 않는다. 강제 푸시 경로를 두지 않으므로
    // 여기서 막고 `git pull`을 안내한다.
    text = L.dashboard.behindWarning(data.behind);
    blocked = true;
  } else if (data.ahead === 0) {
    text = L.dashboard.nothingToPush;
  }

  const ahead = qs('[data-git-ahead]');
  if (ahead) ahead.textContent = text;

  const push = qs<HTMLButtonElement>('[data-git-push]');
  if (push) {
    push.toggleAttribute('disabled', blocked);
    push.setAttribute('aria-disabled', String(blocked));
  }
}

function renderGit(data: GitResponse): void {
  gitState = data;

  const files = qs('[data-git-files]');
  if (!files) return;
  clear(files);

  qs('[data-git-clean]')?.classList.toggle('admin-row-hidden', !data.clean);

  for (const file of data.files) {
    const checkbox = el('input', {
      class: 'admin-check-input',
      type: 'checkbox',
      value: file.path,
      'data-git-file': '',
    }) as HTMLInputElement;
    checkbox.checked = true;
    checkbox.addEventListener('change', syncSelection);

    files.append(
      el('li', { class: 'admin-list-item' }, [
        el('label', { class: 'admin-check' }, [
          checkbox,
          el('span', { class: 'admin-path', text: file.path }),
        ]),
        el('span', { class: 'admin-lang-tag', text: file.status }),
      ]),
    );
  }

  syncSelection();
  syncPushState(data);
}

async function refreshGit(): Promise<void> {
  renderGit(await get<GitResponse>('/git/status'));
}

async function doCommit(): Promise<void> {
  const button = qs<HTMLButtonElement>('[data-git-commit]');
  const input = qs<HTMLInputElement>('[data-git-message]');
  const message = (input?.value ?? '').trim();
  const files = selectedFiles();

  if (message === '') {
    toast('error', L.dashboard.commitMessagePlaceholder);
    input?.focus();
    return;
  }
  if (files.length === 0) return;

  if (button) {
    button.disabled = true;
    button.textContent = L.dashboard.committing;
  }
  try {
    const result = await post<{ hash: string | null }>('/git/commit', { message, files });
    toast('success', L.dashboard.committed(result.hash ?? '', files.length));
    if (input) input.value = '';
    await refreshGit();
  } catch (error) {
    reportError(error);
  } finally {
    if (button) button.textContent = L.dashboard.commit;
    syncSelection();
  }
}

/**
 * 푸시.
 *
 * CRITICAL: 확인 창을 반드시 거친다. 푸시는 곧 공개 배포이며 되돌리기 어렵다.
 * 기본 포커스는 취소에 있고(`openDialog`), 초안 글이 있으면 그 사실을 함께 알린다 —
 * 초안은 사이트에 안 나오지만 **파일은 공개 리포지토리로 올라간다.**
 */
async function doPush(): Promise<void> {
  const dialog = qs<HTMLDialogElement>('[data-push-dialog]');
  const data = gitState;
  if (!dialog || !data) return;

  const summary = qs('[data-push-summary]', dialog);
  if (summary) {
    clear(summary);
    const rows: [string, string][] = [
      ['브랜치', data.branch ?? '—'],
      ['원격', data.remote ?? '—'],
      ['보낼 커밋', String(data.ahead)],
    ];
    for (const [name, value] of rows) {
      summary.append(
        el('li', { class: 'admin-list-item' }, [
          el('span', { class: 'admin-label', text: name }),
          el('span', { class: 'admin-path', text: value }),
        ]),
      );
    }
  }

  const draftWrap = qs('[data-push-draft-warning]', dialog);
  const draftText = qs('[data-push-draft-text]', dialog);
  draftWrap?.classList.toggle('admin-row-hidden', data.drafts === 0);
  if (draftText) draftText.textContent = L.dashboard.pushDraftWarning(data.drafts);

  const confirmed = await openDialog(dialog);
  if (!confirmed) return;

  const button = qs<HTMLButtonElement>('[data-git-push]');
  if (button) {
    button.disabled = true;
    button.textContent = L.dashboard.pushing;
  }
  try {
    const result = await post<{ pushed: number }>('/git/push');
    toast('success', L.dashboard.pushed(result.pushed));
    await refreshGit();
  } catch (error) {
    reportError(error);
  } finally {
    if (button) button.textContent = L.dashboard.push;
    if (gitState) syncPushState(gitState);
  }
}

async function loadGit(): Promise<void> {
  const card = qs('[data-git-card]');
  if (!card) return;

  const data = await get<GitResponse>('/git/status');
  // git이 없으면 카드 전체를 숨긴다.
  if (!data.available) return;
  card.classList.remove('admin-row-hidden');

  const command = qs('[data-git-command]');
  if (command) command.textContent = 'git add -A && git commit -m "..." && git push';

  const copy = qs<HTMLButtonElement>('[data-git-copy]');
  copy?.addEventListener('click', async () => {
    // 복사만 한다. 실행은 버튼이 따로 맡는다.
    const ok = await copyText(command?.textContent ?? '');
    copy.textContent = ok ? L.dashboard.gitCopied : L.dashboard.gitCopy;
    window.setTimeout(() => {
      copy.textContent = L.dashboard.gitCopy;
    }, 2000);
  });

  qs<HTMLInputElement>('[data-git-all]')?.addEventListener('change', (event) => {
    const checked = (event.target as HTMLInputElement).checked;
    for (const box of qsa<HTMLInputElement>('[data-git-file]')) box.checked = checked;
    syncSelection();
  });

  qs('[data-git-commit]')?.addEventListener('click', () => void doCommit());
  qs('[data-git-push]')?.addEventListener('click', () => void doPush());

  renderGit(data);
}

export async function initDashboard(): Promise<void> {
  // 세 요청을 병렬로 보내되, 하나가 실패해도 나머지 카드는 채운다.
  const results = await Promise.allSettled([loadPosts(), loadPlaceholders(), loadGit()]);
  for (const result of results) {
    if (result.status === 'rejected') reportError(result.reason);
  }
  // 아직 값이 채워지지 않은 타일은 0으로 둔다(— 로 남기면 로딩 실패와 구분되지 않는다).
  for (const tile of qsa('[data-tile-value]')) {
    if (tile.textContent === '—') tile.textContent = '0';
  }
}
