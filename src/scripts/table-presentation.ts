/**
 * 표 렌더링의 클라이언트 보정.
 *
 * 관리자 API는 Node ESM 캐시를 쓰므로 dev 서버를 재시작하기 전까지 예전 마크다운
 * 프로세서가 남을 수 있다. 그 경우 `table-config`가 평문 코드 블록으로 렌더된다. 이미
 * 정상 변환된 HTML에는 손대지 않고, 그 구형 출력만 복구한다.
 */

const TABLE_CONFIG =
  /^align=(left|center|right)\s+width=(full|fit)\s+tint=(none|gray|red|orange|yellow|green|blue|purple)\s+tint-scope=(header|body|all)(?:\s+header=(true|false))?$/;

/** 표 속성을 스크롤 래퍼에도 동기화한다. */
function wrapTable(table: HTMLTableElement): void {
  const parent = table.parentElement;
  const wrapper = parent?.classList.contains('table-scroll')
    ? parent
    : document.createElement('div');

  wrapper.classList.add('table-scroll');
  wrapper.dataset.tableAlign = table.dataset.tableAlign ?? 'left';
  wrapper.dataset.tableWidth = table.dataset.tableWidth ?? 'full';

  if (wrapper !== parent) {
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  }
}

export function enhanceTables(root: ParentNode): void {
  // 구형 프리뷰 출력: 설정 pre 바로 다음에 원본 table이 온다.
  for (const pre of root.querySelectorAll<HTMLPreElement>('pre')) {
    const config = (pre.textContent ?? '').trim().match(TABLE_CONFIG);
    const next = pre.nextElementSibling;
    if (!config || !(next instanceof HTMLTableElement)) continue;

    const [, align, width, tint, tintScope, header = 'true'] = config;
    next.dataset.tableAlign = align;
    next.dataset.tableWidth = width;
    next.dataset.tableTint = tint;
    next.dataset.tableTintScope = tintScope;
    next.dataset.tableHeader = header;
    if (header === 'false') next.tHead?.remove();
    pre.remove();
  }

  for (const table of root.querySelectorAll<HTMLTableElement>('table')) wrapTable(table);
}
