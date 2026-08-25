/**
 * 폼 ↔ JSON 직렬화, dirty 추적, 저장 바, 이탈 경고.
 *
 * 흐름은 하나다.
 *   1. 로드 시 서버 값을 스냅숏으로 잡는다
 *   2. 입력마다 현재 값을 다시 읽어 스냅숏과 비교한다
 *   3. 변경이 0건이면 저장 바가 숨는다
 *   4. 저장에 성공하면 응답의 새 mtime으로 스냅숏을 갱신한다
 *   5. 저장에 실패하면 스냅숏을 갱신하지 않는다 — dirty 상태가 유지된다
 *
 * CRITICAL: 되돌리기는 스냅숏으로 폼을 복원한다. 디스크를 다시 읽지 않는다 —
 * 다시 읽으면 "되돌리기"가 남의 변경까지 끌어온다.
 *
 * CRITICAL: 사이트의 `src/scripts/shortcuts.ts`를 로드하지 않는다. 검색 단축키(`/`, `k`)가
 * 관리자 입력과 겹친다. 여기서 필요한 단축키만 직접 건다.
 */
import { AdminApiError, reportError, toast } from './api';
import { qs, qsa } from './dom';
import { L } from '../labels';

export interface FormOptions<T> {
  /** DOM → 값 */
  read: () => T;
  /** 값 → DOM */
  write: (value: T) => void;
  /** 저장. 새 mtime을 돌려준다 */
  save: (value: T, baseMtime: number | null) => Promise<{ mtime: number | null }>;
  /** 변경 개수 세기. 생략하면 최상위 키 비교 */
  countChanges?: (baseline: T, current: T) => number;
  /** 저장 직전 클라이언트 검증. 문자열을 돌려주면 저장을 막는다 */
  validate?: (value: T) => string | null;
  /** 저장 성공 후 */
  onSaved?: (value: T, mtime: number | null) => void;
}

export interface FormController<T> {
  reset(value: T, mtime: number | null): void;
  refresh(): void;
  save(): Promise<void>;
  baseline(): T;
  mtime(): number | null;
  isDirty(): boolean;
}

function defaultCount(baseline: unknown, current: unknown): number {
  const a = (baseline ?? {}) as Record<string, unknown>;
  const b = (current ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let count = 0;
  for (const key of keys) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) count += 1;
  }
  return count;
}

export function createForm<T>(options: FormOptions<T>): FormController<T> {
  let baseline: T = {} as T;
  let baseMtime: number | null = null;
  let dirty = false;
  let saving = false;

  const bar = qs('[data-savebar]');
  const countNode = qs('[data-savebar-count]');
  const saveButton = qs<HTMLButtonElement>('[data-savebar-save]');
  const revertButton = qs<HTMLButtonElement>('[data-savebar-revert]');

  const count = options.countChanges ?? ((a: T, b: T) => defaultCount(a, b));

  function refresh(): void {
    if (saving) return;
    const current = options.read();
    const changes = count(baseline, current);
    dirty = changes > 0;
    bar?.setAttribute('data-dirty', String(dirty));
    if (countNode) countNode.textContent = L.save.changes(changes);
  }

  function reset(value: T, mtime: number | null): void {
    baseline = structuredClone(value);
    baseMtime = mtime;
    options.write(value);
    refresh();
  }

  async function save(): Promise<void> {
    if (saving) return;
    const current = options.read();

    const problem = options.validate?.(current);
    if (problem) {
      toast('error', problem);
      return;
    }

    saving = true;
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = L.save.saving;
    }

    try {
      const result = await options.save(current, baseMtime);
      // CRITICAL: 성공했을 때만 스냅숏을 갱신한다.
      baseline = structuredClone(current);
      baseMtime = result.mtime;
      toast('success', L.save.saved);
      options.onSaved?.(current, result.mtime);
    } catch (error) {
      // 사용자가 확인 다이얼로그에서 취소한 것은 오류가 아니다 — 조용히 빠진다.
      if ((error as Error)?.name === 'SaveCancelled') return;
      // 실패하면 dirty를 유지한다. 편집 내용은 건드리지 않는다.
      reportError(error);
      if (error instanceof AdminApiError) showFieldErrors(error);
    } finally {
      saving = false;
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = L.save.save;
      }
      refresh();
    }
  }

  saveButton?.addEventListener('click', () => void save());
  revertButton?.addEventListener('click', () => {
    options.write(baseline);
    clearFieldErrors();
    refresh();
  });

  // 입력 변화를 한 곳에서 잡는다. 각 컨트롤이 따로 리스너를 달 필요가 없다.
  document.addEventListener('input', refresh);
  document.addEventListener('change', refresh);
  document.addEventListener('admin:changed', refresh);

  document.addEventListener('keydown', (event) => {
    const meta = event.metaKey || event.ctrlKey;
    if (meta && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void save();
    }
  });

  window.addEventListener('beforeunload', (event) => {
    if (!dirty) return;
    // 최신 브라우저는 preventDefault()만으로 확인 창을 띄운다. 문구는 브라우저가 정한다.
    event.preventDefault();
  });

  return {
    reset,
    refresh,
    save,
    baseline: () => baseline,
    mtime: () => baseMtime,
    isDirty: () => dirty,
  };
}

/* ==========================================================================
   필드 오류 표시
   ========================================================================== */

export function clearFieldErrors(): void {
  for (const field of qsa('[data-field], [data-localized-field]')) {
    field.setAttribute('data-invalid', 'false');
    const text = qs('[data-error-text]', field);
    if (text) text.textContent = '';
  }
}

/**
 * Zod 이슈를 해당 입력 아래에 붙이고 첫 오류 필드로 스크롤·포커스한다.
 *
 * CRITICAL: 오류 메시지를 관리자에서 다시 쓰지 않는다. 스키마에 이미 한국어로 적혀 있다.
 */
export function showFieldErrors(error: AdminApiError): void {
  clearFieldErrors();

  const detail = error.detail as { issues?: { field: string; message: string }[] } | null;
  const issues =
    detail?.issues ?? (error.field ? [{ field: error.field, message: error.message }] : []);
  if (issues.length === 0) return;

  let first: HTMLElement | null = null;

  for (const issue of issues) {
    const field = findField(issue.field);
    if (!field) continue;
    field.setAttribute('data-invalid', 'true');
    const text = qs('[data-error-text]', field);
    if (text) text.textContent = issue.message;
    if (!first) first = field;
  }

  if (first) {
    first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    qs<HTMLElement>('input, textarea, select', first)?.focus();
  }
}

function findField(path: string): HTMLElement | null {
  return (
    qs(`[data-field="${CSS.escape(path)}"]`) ??
    qs(`[data-localized-field="${CSS.escape(path)}"]`) ??
    // `paper.authors.0` 같은 하위 경로는 가장 가까운 조상 필드에 붙인다.
    (path.includes('.') ? findField(path.slice(0, path.lastIndexOf('.'))) : null)
  );
}

/* ==========================================================================
   글자 수 카운터
   ========================================================================== */

/** `data-counter="N"`이 있는 필드에 입력 길이를 표시한다. */
export function bindCounters(scope: ParentNode = document): void {
  for (const counter of qsa<HTMLElement>('[data-counter]', scope)) {
    const field = counter.closest('[data-field], [data-localized-field]');
    const input = field
      ? qs<HTMLInputElement | HTMLTextAreaElement>('input, textarea', field)
      : null;
    if (!input) continue;
    const max = Number(counter.dataset.counter ?? '0');
    const update = () => {
      const length = input.value.length;
      counter.textContent = `${length} / ${max}`;
      counter.setAttribute('data-over', String(max > 0 && length > max));
    };
    input.addEventListener('input', update);
    update();
  }
}

/** 값이 바뀌었음을 폼에 알린다(프로그램적으로 DOM을 고쳤을 때). */
export function notifyChanged(): void {
  document.dispatchEvent(new CustomEvent('admin:changed'));
}
