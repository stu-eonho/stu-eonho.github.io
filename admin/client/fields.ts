/**
 * 폼 컨트롤 읽기/쓰기 어댑터.
 *
 * 관리자 화면은 평평한 필드 목록 + 반복 행이 대부분이라 프레임워크 없이 다룬다.
 * 값을 넣고 빼는 규칙을 여기 한 곳에 모아, 각 화면이 같은 방식으로 동작하게 한다.
 */
import { el, qs, qsa } from './dom';
import { notifyChanged } from './forms';

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function getValue(scope: ParentNode, name: string): string {
  const control = qs<Control>(`[data-name="${CSS.escape(name)}"]`, scope);
  return control?.value ?? '';
}

export function setValue(scope: ParentNode, name: string, value: unknown): void {
  const control = qs<Control>(`[data-name="${CSS.escape(name)}"]`, scope);
  if (!control) return;
  if (control instanceof HTMLInputElement && control.type === 'checkbox') {
    control.checked = Boolean(value);
    return;
  }
  control.value = value === null || value === undefined ? '' : String(value);
}

export function getChecked(scope: ParentNode, name: string): boolean {
  const control = qs<HTMLInputElement>(`[data-name="${CSS.escape(name)}"]`, scope);
  return control?.checked ?? false;
}

/** 빈 문자열을 `undefined`로 접는다 — 선택 필드는 키째로 사라져야 한다. */
export function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/* ==========================================================================
   MaybeLocalized 필드
   ========================================================================== */

export type MaybeLocalized = string | { ko: string; en: string };

/** `LocalizedField` 하나의 현재 값. */
export function readLocalized(root: HTMLElement): MaybeLocalized | undefined {
  const split = root.getAttribute('data-split') === 'true';
  if (!split) {
    const value = qs<Control>('[data-input="single"]', root)?.value.trim() ?? '';
    return value === '' ? undefined : value;
  }
  const ko = qs<Control>('[data-input="ko"]', root)?.value.trim() ?? '';
  const en = qs<Control>('[data-input="en"]', root)?.value.trim() ?? '';
  if (ko === '' && en === '') return undefined;
  // CRITICAL: 두 값이 같으면 문자열 하나로 접는다. 서버의 방출 규칙과 같은 판단이다.
  return ko === en ? ko : { ko, en };
}

export function writeLocalized(root: HTMLElement, value: MaybeLocalized | undefined): void {
  const isObject = value !== null && typeof value === 'object';
  setSplit(root, isObject);

  if (isObject) {
    const localized = value as { ko: string; en: string };
    const ko = qs<Control>('[data-input="ko"]', root);
    const en = qs<Control>('[data-input="en"]', root);
    if (ko) ko.value = localized.ko ?? '';
    if (en) en.value = localized.en ?? '';
    markPlaceholder(ko, localized.ko);
    markPlaceholder(en, localized.en);
    return;
  }

  const single = qs<Control>('[data-input="single"]', root);
  if (single) single.value = typeof value === 'string' ? value : '';
  markPlaceholder(single, typeof value === 'string' ? value : '');
}

function setSplit(root: HTMLElement, split: boolean): void {
  root.setAttribute('data-split', String(split));
  qs('[data-localized-single]', root)?.classList.toggle('admin-row-hidden', split);
  qs('[data-localized-split]', root)?.classList.toggle('admin-row-hidden', !split);
  qs('[data-localized-toggle]', root)?.setAttribute('aria-pressed', String(split));
}

/**
 * 자리표시 값(꺾쇠로 시작하는 문자열)을 형태로 알린다.
 *
 * CRITICAL: 값을 숨기지 않는다. 무엇을 채워야 하는지 보이는 편이 낫다 —
 * 숨기면 홈이 비어 보이고 어디를 고쳐야 할지 알 수 없다.
 */
function markPlaceholder(control: Control | null, value: string): void {
  if (!control) return;
  control.setAttribute('data-placeholder', String(value.trimStart().startsWith('<')));
}

/** `LocalizedField`의 "언어별" 토글을 활성화한다. */
export function bindLocalizedToggles(scope: ParentNode = document): void {
  for (const root of qsa<HTMLElement>('[data-localized-field]', scope)) {
    const toggle = qs<HTMLButtonElement>('[data-localized-toggle]', root);
    if (!toggle || toggle.dataset.bound === '1') continue;
    toggle.dataset.bound = '1';

    toggle.addEventListener('click', () => {
      const nowSplit = root.getAttribute('data-split') !== 'true';
      if (nowSplit) {
        // 단일 → 두 칸: 현재 값을 양쪽에 복사한다.
        const value = qs<Control>('[data-input="single"]', root)?.value ?? '';
        const ko = qs<Control>('[data-input="ko"]', root);
        const en = qs<Control>('[data-input="en"]', root);
        if (ko && ko.value === '') ko.value = value;
        if (en && en.value === '') en.value = value;
      } else {
        // 두 칸 → 단일: ko 값을 남긴다(기본 언어).
        const ko = qs<Control>('[data-input="ko"]', root)?.value ?? '';
        const single = qs<Control>('[data-input="single"]', root);
        if (single) single.value = ko;
      }
      setSplit(root, nowSplit);
      notifyChanged();
    });
  }
}

/* ==========================================================================
   칩 입력
   ========================================================================== */

export interface ChipOptions {
  /** 항목당 최대 글자 수 */
  maxLength?: number;
  /** 최대 항목 수 */
  maxItems?: number;
  /** 자동완성 후보 */
  suggestions?: string[];
}

/** 칩 컨테이너 하나를 초기화한다. `data-chips` 요소에 붙는다. */
export function initChips(root: HTMLElement, options: ChipOptions = {}): void {
  if (root.dataset.bound === '1') return;
  root.dataset.bound = '1';

  const input = qs<HTMLInputElement>('.admin-chip-input', root);
  if (!input) return;

  if (options.suggestions?.length) {
    const listId = `chips-${Math.random().toString(36).slice(2, 8)}`;
    const list = el('datalist', { id: listId });
    for (const suggestion of options.suggestions) list.append(el('option', { value: suggestion }));
    root.append(list);
    input.setAttribute('list', listId);
  }

  const commit = () => {
    const raw = input.value.trim().replace(/,$/, '');
    if (raw === '') return;
    if (options.maxLength && raw.length > options.maxLength) return;
    if (options.maxItems && readChips(root).length >= options.maxItems) return;
    if (readChips(root).includes(raw)) {
      input.value = '';
      return;
    }
    input.before(chipNode(raw));
    input.value = '';
    notifyChanged();
  };

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === 'Backspace' && input.value === '') {
      const chips = qsa('.admin-chip', root);
      chips[chips.length - 1]?.remove();
      notifyChanged();
    }
  });
  input.addEventListener('blur', commit);
}

function chipNode(value: string): HTMLElement {
  const remove = el('button', {
    type: 'button',
    class: 'admin-chip-remove',
    'aria-label': `${value} 제거`,
    text: '×',
  });
  const chip = el('span', { class: 'admin-chip', 'data-chip': value }, [
    el('span', { text: value }),
    remove,
  ]);
  remove.addEventListener('click', () => {
    chip.remove();
    notifyChanged();
  });
  return chip;
}

export function readChips(root: HTMLElement): string[] {
  return qsa<HTMLElement>('.admin-chip', root).map((chip) => chip.dataset.chip ?? '');
}

export function writeChips(root: HTMLElement, values: readonly string[]): void {
  for (const chip of qsa('.admin-chip', root)) chip.remove();
  const input = qs<HTMLInputElement>('.admin-chip-input', root);
  if (!input) return;
  input.value = '';
  for (const value of values) input.before(chipNode(value));
}
