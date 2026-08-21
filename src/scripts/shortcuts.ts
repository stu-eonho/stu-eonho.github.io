/**
 * 키보드 단축키.
 *
 * CRITICAL: `/` 하나만 둔다. 그 외의 단일 키 단축키를 추가하지 않는다 —
 * 스크린리더 사용자의 탐색 키와 충돌한다.
 * (Escape는 모바일 시트와 검색 입력이 각자 처리한다.)
 */
export function initShortcuts(): void {
  /**
   * 검색 페이지 경로는 현재 언어를 따라간다.
   * CRITICAL: `/search`로 고정하면 영어 화면에서 `/`를 누른 순간 한국어 사이트로 튄다.
   * i18n 모듈을 import 하지 않고 경로만 읽는다 — 이 스크립트는 전 페이지에 실리므로
   * 사전을 끌어오면 그만큼 초기 번들이 커진다.
   */
  const searchPath = (): string => {
    const first = window.location.pathname.replace(/^\/+/, '').split('/')[0];
    return first === 'en' ? '/en/search' : '/search';
  };

  document.addEventListener('keydown', (event) => {
    if (event.key !== '/') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    // 입력 요소에 포커스가 있을 때는 동작하지 않는다.
    const active = document.activeElement;
    if (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      active instanceof HTMLSelectElement ||
      (active instanceof HTMLElement && active.isContentEditable)
    ) {
      return;
    }

    event.preventDefault();

    const input = document.getElementById('search-input');
    if (input instanceof HTMLInputElement) {
      // 이미 검색 페이지에 있으면 포커스만 옮긴다.
      input.focus();
    } else {
      window.location.href = searchPath();
    }
  });
}
