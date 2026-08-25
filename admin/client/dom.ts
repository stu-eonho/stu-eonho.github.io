/**
 * 관리자 화면 공통 DOM 헬퍼.
 *
 * CRITICAL: 사용자 입력을 `innerHTML`로 넣지 않는다. 관리자는 자기 리포지토리의 내용을
 * 다루지만, 글 제목·태그는 결국 파일에서 온 문자열이며 그것을 날것으로 삽입할 이유가 없다.
 * 예외는 서버가 렌더한 프리뷰 HTML 하나이며, 그 값은 `preview.mjs`가 만든 것이다.
 */

export function qs<T extends Element = HTMLElement>(
  selector: string,
  scope: ParentNode = document,
): T | null {
  return scope.querySelector<T>(selector);
}

export function qsa<T extends Element = HTMLElement>(
  selector: string,
  scope: ParentNode = document,
): T[] {
  return Array.from(scope.querySelectorAll<T>(selector));
}

/** 반드시 있어야 하는 요소. 없으면 개발 중 실수이므로 조용히 넘기지 않는다. */
export function need<T extends Element = HTMLElement>(
  selector: string,
  scope: ParentNode = document,
): T {
  const found = scope.querySelector<T>(selector);
  if (!found) throw new Error(`[admin] 필요한 요소를 찾지 못했습니다: ${selector}`);
  return found;
}

type Attrs = Record<string, string | number | boolean | null | undefined>;

/** 요소 생성 — 텍스트는 언제나 `textContent`로 들어간다. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = String(value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** 상대 시간 표기. 관리자 전용이므로 사이트의 date.ts를 끌어오지 않는다. */
export function relativeTime(mtime: number | null): string {
  if (!mtime) return '';
  const diff = Date.now() - mtime;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(mtime).toISOString().slice(0, 10);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 클립보드 복사. 실패해도 던지지 않는다 — 호출부가 라벨만 바꾼다. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * `<dialog>`를 열고 확인/취소 결과를 돌려준다.
 * CRITICAL: 파괴적 동작의 기본 선택은 언제나 취소다.
 */
export function openDialog(
  dialog: HTMLDialogElement,
  confirmSelector = '[data-dialog-confirm]',
  cancelSelector = '[data-dialog-cancel]',
): Promise<boolean> {
  return new Promise((resolve) => {
    const confirm = qs<HTMLElement>(confirmSelector, dialog);
    const cancel = qs<HTMLElement>(cancelSelector, dialog);

    const finish = (result: boolean) => {
      confirm?.removeEventListener('click', onConfirm);
      cancel?.removeEventListener('click', onCancel);
      dialog.removeEventListener('close', onClose);
      if (dialog.open) dialog.close();
      resolve(result);
    };
    const onConfirm = () => finish(true);
    const onCancel = () => finish(false);
    const onClose = () => finish(false);

    confirm?.addEventListener('click', onConfirm);
    cancel?.addEventListener('click', onCancel);
    dialog.addEventListener('close', onClose);
    dialog.showModal();
    // 기본 포커스는 취소 쪽에 둔다.
    cancel?.focus();
  });
}
