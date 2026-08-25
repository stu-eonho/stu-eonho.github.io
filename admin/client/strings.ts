/**
 * UI 문자열 편집기 — ko/en 병렬, 검색 필터, 변경 표시.
 *
 * CRITICAL: 함수형 값(18개)은 두 입력 모두 읽기 전용이며 값 대신 시그니처를 보여 준다.
 * 서버도 다시 막지만, 화면에서 애초에 편집할 수 없어야 한다.
 */
import { get, put, reportError } from './api';
import { need, qs, qsa } from './dom';
import { createForm, notifyChanged } from './forms';
import { L } from '../labels';

interface StringEntry {
  path: string;
  ko: string | null;
  en: string | null;
  kind: 'string' | 'function';
  group: string;
  untranslated: boolean;
}

type Values = Record<string, { ko: string; en: string }>;

export async function initStrings(): Promise<void> {
  const host = need('[data-string-groups]');
  const groupTemplate = need<HTMLTemplateElement>('[data-group-template]');
  const rowTemplate = need<HTMLTemplateElement>('[data-string-row-template]');

  let entries: StringEntry[] = [];
  let mtime: number | null = null;
  /** path → 행 요소 */
  const rows = new Map<string, HTMLElement>();

  function render(): void {
    host.replaceChildren();
    rows.clear();

    const groups = new Map<string, StringEntry[]>();
    for (const entry of entries) {
      const bucket = groups.get(entry.group) ?? [];
      bucket.push(entry);
      groups.set(entry.group, bucket);
    }

    for (const [group, items] of groups) {
      const fragment = groupTemplate.content.cloneNode(true) as DocumentFragment;
      const name = fragment.querySelector('[data-group-name]');
      if (name) name.textContent = `${group} (${items.length})`;
      const rowHost = fragment.querySelector('[data-group-rows]');

      for (const entry of items) {
        const rowFragment = rowTemplate.content.cloneNode(true) as DocumentFragment;
        const row = rowFragment.querySelector<HTMLElement>('[data-string-row]');
        if (!row || !rowHost) continue;

        const path = qs('[data-row-path]', row);
        if (path) path.textContent = entry.path;

        const ko = qs<HTMLInputElement>('[data-row-input="ko"]', row);
        const en = qs<HTMLInputElement>('[data-row-input="en"]', row);

        if (entry.kind === 'function') {
          // 값 대신 시그니처를 회색으로 보여 준다.
          const badge = qs('[data-row-readonly]', row);
          if (badge) {
            badge.textContent = L.strings.functionBadge;
            badge.classList.remove('admin-row-hidden');
          }
          for (const input of [ko, en]) {
            if (!input) continue;
            input.readOnly = true;
            input.classList.add('admin-mono');
          }
          if (ko) ko.value = entry.ko ?? '';
          if (en) en.value = entry.en ?? '';
        } else {
          if (ko) ko.value = entry.ko ?? '';
          if (en) en.value = entry.en ?? '';
        }

        row.dataset.path = entry.path;
        row.dataset.kind = entry.kind;
        row.dataset.untranslated = String(entry.untranslated);
        rowHost.append(rowFragment);
        rows.set(entry.path, row);
      }

      host.append(fragment);
    }

    applyFilter();
    markChanged();
  }

  function readValues(): Values {
    const values: Values = {};
    for (const [path, row] of rows) {
      if (row.dataset.kind === 'function') continue;
      values[path] = {
        ko: qs<HTMLInputElement>('[data-row-input="ko"]', row)?.value ?? '',
        en: qs<HTMLInputElement>('[data-row-input="en"]', row)?.value ?? '',
      };
    }
    return values;
  }

  function writeValues(values: Values): void {
    for (const [path, value] of Object.entries(values)) {
      const row = rows.get(path);
      if (!row) continue;
      const ko = qs<HTMLInputElement>('[data-row-input="ko"]', row);
      const en = qs<HTMLInputElement>('[data-row-input="en"]', row);
      if (ko) ko.value = value.ko;
      if (en) en.value = value.en;
    }
    markChanged();
  }

  /** 변경된 행은 좌측에 3px 강조 바를 붙인다. */
  function markChanged(): void {
    const baseline = form?.baseline() ?? {};
    for (const [path, row] of rows) {
      const before = baseline[path];
      if (!before) continue;
      const ko = qs<HTMLInputElement>('[data-row-input="ko"]', row)?.value ?? '';
      const en = qs<HTMLInputElement>('[data-row-input="en"]', row)?.value ?? '';
      row.classList.toggle('admin-changed', before.ko !== ko || before.en !== en);
    }
  }

  function diff(baseline: Values, current: Values) {
    const changes: { path: string; lang: 'ko' | 'en'; value: string }[] = [];
    for (const [path, value] of Object.entries(current)) {
      const before = baseline[path];
      if (!before) continue;
      if (before.ko !== value.ko) changes.push({ path, lang: 'ko', value: value.ko });
      if (before.en !== value.en) changes.push({ path, lang: 'en', value: value.en });
    }
    return changes;
  }

  const form = createForm<Values>({
    read: readValues,
    write: writeValues,
    countChanges: (baseline, current) => diff(baseline, current).length,
    async save(value, baseMtime) {
      const changes = diff(form.baseline(), value);
      const result = await put<{ mtime: number }>('/strings', { changes, baseMtime });
      // 저장 후 강조 바를 걷는다.
      window.setTimeout(markChanged, 0);
      return result;
    },
  });

  /* ---------- 필터 ---------- */

  function applyFilter(): void {
    const query = (qs<HTMLInputElement>('[data-string-search]')?.value ?? '').trim().toLowerCase();
    const untranslatedOnly = qs<HTMLInputElement>('[data-untranslated-only]')?.checked ?? false;

    let visible = 0;
    for (const [path, row] of rows) {
      const entry = entries.find((item) => item.path === path);
      const haystack = `${path} ${entry?.ko ?? ''} ${entry?.en ?? ''}`.toLowerCase();
      const matches =
        (query === '' || haystack.includes(query)) &&
        (!untranslatedOnly || row.dataset.untranslated === 'true');
      row.classList.toggle('admin-row-hidden', !matches);
      if (matches) visible += 1;
    }

    // 항목이 하나도 없는 섹션은 접어 둔다.
    for (const details of qsa<HTMLDetailsElement>('.admin-details', host)) {
      const any = qsa('[data-string-row]:not(.admin-row-hidden)', details).length > 0;
      details.classList.toggle('admin-row-hidden', !any);
    }

    const count = qs('[data-string-count]');
    if (count) count.textContent = `${visible} / ${rows.size}`;
  }

  qs('[data-string-search]')?.addEventListener('input', applyFilter);
  qs('[data-untranslated-only]')?.addEventListener('change', applyFilter);
  host.addEventListener('input', markChanged);

  try {
    const data = await get<{ tree: StringEntry[]; mtime: number | null }>('/strings');
    entries = data.tree;
    mtime = data.mtime;
    render();
    form.reset(readValues(), mtime);
    notifyChanged();
  } catch (error) {
    reportError(error);
  }
}
