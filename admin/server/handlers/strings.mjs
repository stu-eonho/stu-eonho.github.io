// @ts-check
/**
 * `src/config/i18n.ts`의 `ko`/`en` UI 문자열 편집.
 *
 * CRITICAL: 구조를 바꾸지 않는다. 개별 문자열 리터럴 노드의 바이트 범위만 교체하므로
 * 23개 섹션 주석과 18개 함수형 값이 전부 그대로 남는다.
 *
 * CRITICAL: 키 추가·삭제 요청은 받지 않는다. `ko`와 `en`의 키 집합이 갈리는 순간
 * `astro check`가 실패하고(`UIStrings` 파리티), 그 복구를 관리자가 해 줄 수 없다.
 *
 * CRITICAL: 함수형 값 변경 요청은 `E-READONLY-STRING`으로 거절한다.
 */
import { fail } from '../errors.mjs';
import { mtimeOf, readText } from '../fsx.mjs';
import { configFile, writeStringLiterals } from '../codegen/configs.mjs';
import { flattenDictionary } from '../codegen/ts-edit.mjs';

/** @param {{ projectRoot: string }} ctx */
export async function readStrings({ projectRoot }) {
  const file = configFile(projectRoot, 'i18n');
  const source = await readText(file);
  const mtime = await mtimeOf(file);

  const ko = flattenDictionary(source, 'ko');
  const en = flattenDictionary(source, 'en');
  /** @type {Map<string, any>} */
  const enMap = new Map(en.map((entry) => [entry.path, entry]));

  const tree = ko.map((entry) => {
    const pair = enMap.get(entry.path);
    return {
      path: entry.path,
      ko: entry.value,
      en: pair?.value ?? null,
      // 한쪽이라도 함수형이면 편집 불가로 다룬다.
      kind: entry.kind === 'string' && pair?.kind === 'string' ? 'string' : 'function',
      /** 섹션 그룹(경로 첫 세그먼트). 화면이 접이식 섹션으로 묶는다 */
      group: entry.path.split('.')[0],
      /** ko와 en이 같으면 아직 번역되지 않았을 가능성이 크다 */
      untranslated: entry.value !== null && entry.value === (pair?.value ?? null),
    };
  });

  return {
    tree,
    mtime,
    counts: { total: tree.length, readonly: tree.filter((e) => e.kind === 'function').length },
  };
}

/** @param {{ body: any, projectRoot: string, logger: any }} ctx */
export async function writeStrings({ body, projectRoot, logger }) {
  const file = configFile(projectRoot, 'i18n');
  const source = await readText(file);

  const incoming = Array.isArray(body.changes) ? body.changes : [];
  if (incoming.length === 0) return { mtime: await mtimeOf(file), changed: false };

  const editable = new Map();
  for (const decl of ['ko', 'en']) {
    for (const entry of flattenDictionary(source, decl)) {
      editable.set(`${decl}:${entry.path}`, entry.kind);
    }
  }

  /** @type {{ ko: { path: string, value: string }[], en: { path: string, value: string }[] }} */
  const changes = { ko: [], en: [] };

  for (const change of incoming) {
    const lang = String(change.lang ?? '');
    const path = String(change.path ?? '');
    if (lang !== 'ko' && lang !== 'en') {
      throw fail('E-VALIDATION', `알 수 없는 언어입니다: ${lang}`, { field: path });
    }
    const kind = editable.get(`${lang}:${path}`);
    if (kind === undefined) {
      // 키 추가는 받지 않는다.
      throw fail('E-VALIDATION', `존재하지 않는 문자열 경로입니다: ${path}`, { field: path });
    }
    if (kind !== 'string') {
      throw fail('E-READONLY-STRING', `이 값은 코드에서만 수정할 수 있습니다: ${path}`, {
        field: path,
      });
    }
    if (typeof change.value !== 'string') {
      throw fail('E-VALIDATION', `문자열 값이 필요합니다: ${path}`, { field: path });
    }
    changes[lang].push({ path, value: change.value });
  }

  const { mtime, changed } = await writeStringLiterals({
    projectRoot,
    file,
    changes,
    baseMtime: body.baseMtime,
    logger,
  });

  return { mtime, changed, applied: incoming.length };
}
