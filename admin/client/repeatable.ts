/**
 * 반복 행 추가·삭제·순서 이동.
 *
 * UI 프레임워크를 쓰지 않는 대가로 반복 행 렌더링 코드를 손으로 써야 한다 —
 * 그 코드를 이 파일 한 곳에 모은다. 각 화면은 "행 하나를 값으로 채우는 함수"와
 * "행 하나에서 값을 읽는 함수"만 넘긴다.
 */
import { qs, qsa } from './dom';
import { bindLocalizedToggles } from './fields';
import { bindCounters, notifyChanged } from './forms';
import { L } from '../labels';

export interface RepeatableOptions<T> {
  /** 행 DOM에 값을 채운다 */
  fill: (row: HTMLElement, value: T, index: number) => void;
  /** 행 DOM에서 값을 읽는다. `undefined`를 돌려주면 그 행은 버려진다 */
  read: (row: HTMLElement, index: number) => T | undefined;
  /** 새 행의 기본값 */
  create: () => T;
  /** 행을 처음 붙일 때 한 번 실행 (칩 초기화 등) */
  onMount?: (row: HTMLElement, index: number) => void;
}

export interface RepeatableController<T> {
  read(): T[];
  write(values: readonly T[]): void;
  root: HTMLElement;
}

export function initRepeatable<T>(
  root: HTMLElement,
  options: RepeatableOptions<T>,
): RepeatableController<T> {
  const rowsHost = qs<HTMLElement>('[data-rows]', root);
  const template = qs<HTMLTemplateElement>('[data-row-template]', root);
  const addButton = qs<HTMLButtonElement>('[data-repeat-add]', root);
  const emptyNote = qs<HTMLElement>('[data-empty-note]', root);
  const max = Number(root.dataset.max ?? '0') || Infinity;
  let rowCounter = 0;

  if (!rowsHost || !template) {
    throw new Error('[admin] RepeatableList 구조가 올바르지 않습니다.');
  }

  function rows(): HTMLElement[] {
    return qsa<HTMLElement>('[data-row]', rowsHost!);
  }

  function syncState(): void {
    const list = rows();
    // 배열이 비면 "이 섹션은 사이트에서 통째로 사라집니다"를 알린다.
    emptyNote?.classList.toggle('admin-row-hidden', list.length > 0);
    if (addButton) {
      const full = list.length >= max;
      addButton.setAttribute('aria-disabled', String(full));
      addButton.toggleAttribute('disabled', full);
    }
    list.forEach((row, index) => {
      qs<HTMLButtonElement>('[data-row-up]', row)?.toggleAttribute('disabled', index === 0);
      qs<HTMLButtonElement>('[data-row-down]', row)?.toggleAttribute(
        'disabled',
        index === list.length - 1,
      );
    });
  }

  /**
   * 템플릿을 복제하면 id가 중복된다. `label[for]`가 첫 행만 가리키게 되므로
   * 행마다 접미를 붙여 짝을 다시 맺는다.
   */
  function uniquifyIds(row: HTMLElement): void {
    const suffix = `r${(rowCounter += 1)}`;
    for (const node of qsa<HTMLElement>('[id]', row)) {
      const oldId = node.id;
      const newId = `${oldId}--${suffix}`;
      node.id = newId;
      for (const label of qsa<HTMLLabelElement>(`label[for="${CSS.escape(oldId)}"]`, row)) {
        label.htmlFor = newId;
      }
    }
  }

  function bindRow(row: HTMLElement, index: number): void {
    uniquifyIds(row);
    qs<HTMLButtonElement>('[data-row-remove]', row)?.addEventListener('click', () => {
      row.remove();
      syncState();
      notifyChanged();
    });
    qs<HTMLButtonElement>('[data-row-up]', row)?.addEventListener('click', () => {
      const previous = row.previousElementSibling;
      if (previous) previous.before(row);
      syncState();
      notifyChanged();
    });
    qs<HTMLButtonElement>('[data-row-down]', row)?.addEventListener('click', () => {
      const next = row.nextElementSibling;
      if (next) next.after(row);
      syncState();
      notifyChanged();
    });

    bindLocalizedToggles(row);
    bindCounters(row);
    options.onMount?.(row, index);
  }

  function addRow(value: T, index: number): HTMLElement {
    const fragment = template!.content.cloneNode(true) as DocumentFragment;
    const row = fragment.querySelector<HTMLElement>('[data-row]');
    if (!row) throw new Error('[admin] 행 템플릿에 [data-row]가 없습니다.');
    rowsHost!.append(fragment);
    bindRow(row, index);
    options.fill(row, value, index);
    return row;
  }

  addButton?.addEventListener('click', () => {
    if (rows().length >= max) return;
    addRow(options.create(), rows().length);
    syncState();
    notifyChanged();
    // 새 행의 첫 입력으로 포커스를 옮긴다.
    const last = rows()[rows().length - 1];
    qs<HTMLElement>('input, textarea, select', last)?.focus();
  });

  return {
    root,
    read(): T[] {
      return rows()
        .map((row, index) => options.read(row, index))
        .filter((value): value is T => value !== undefined);
    },
    write(values: readonly T[]): void {
      rowsHost.replaceChildren();
      values.forEach((value, index) => addRow(value, index));
      syncState();
    },
  };
}

/** 상한 안내 문구. 화면들이 같은 문구를 쓰도록 모아 둔다. */
export const LIMITS = {
  interests: L.profile.interestLimit,
  links: L.profile.linkLimit,
};
