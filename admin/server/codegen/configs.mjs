// @ts-check
/**
 * `src/config/*.ts`의 편집 대상 선언을 읽고 쓴다.
 *
 * 대상은 이것뿐이다.
 *   profile.ts    → `PROFILE`      초기자 전체 교체 + 최상위 프로퍼티 주석 보존
 *   site.ts       → `SITE`         초기자 전체 교체 + `navOrder` 표현식 보존 + `url` 폴백 보존
 *   categories.ts → `CATEGORIES`   초기자 전체 교체 (`as const satisfies` 꼬리는 범위 밖)
 *   i18n.ts       → `ko` / `en`    문자열 리터럴 단위 교체
 *
 * CRITICAL: 쓰기 직전 재파싱 검증(0 diagnostics)을 통과해야 디스크에 남는다.
 */
import path from 'node:path';
import { assertFresh, mtimeOf, readText, writeTextAtomic } from '../fsx.mjs';
import { assertInsideAllowedRoot, dirs } from '../paths.mjs';
import {
  assertParses,
  readPropertyComments,
  readPropertyText,
  replaceInitializer,
  replaceStringLiterals,
  rewriteFallbackString,
} from './ts-edit.mjs';
import { emit, raw } from './ts-emit.mjs';

/**
 * @param {string} projectRoot
 * @param {string} name
 */
export function configFile(projectRoot, name) {
  return path.join(dirs(projectRoot).config, `${name}.ts`);
}

/**
 * 선언 하나의 초기자를 새 값으로 교체하고 원자적으로 쓴다.
 *
 * @param {object} input
 * @param {string} input.projectRoot
 * @param {string} input.file
 * @param {string} input.declName
 * @param {any} input.value
 * @param {number | null | undefined} input.baseMtime
 * @param {string[]} [input.preserveExpressions] 원본 표현식을 그대로 옮겨 심을 프로퍼티
 * @param {string[]} [input.fallbackStrings] `x ?? '문자열'` 형태를 지키며 문자열만 바꿀 프로퍼티
 * @param {boolean} [input.preserveComments]
 * @param {any} [input.logger]
 * @returns {Promise<{ mtime: number, changed: boolean }>}
 */
export async function writeDeclaration({
  projectRoot,
  file,
  declName,
  value,
  baseMtime,
  preserveExpressions = [],
  fallbackStrings = [],
  preserveComments = false,
  logger,
}) {
  await assertInsideAllowedRoot(projectRoot, file);
  await assertFresh(file, baseMtime);

  const source = await readText(file);

  let emitted = value;
  if (!Array.isArray(value)) {
    emitted = { ...value };
    // 계산식 프로퍼티는 재생성하지 않고 원문 텍스트를 그대로 옮겨 심는다.
    for (const property of preserveExpressions) {
      const text = readPropertyText(source, declName, property);
      if (text !== null) emitted[property] = raw(text);
    }
    for (const property of fallbackStrings) {
      if (value[property] === undefined) continue;
      emitted[property] = raw(
        rewriteFallbackString(source, declName, property, String(value[property])),
      );
    }
  }

  const comments = preserveComments ? readPropertyComments(source, declName) : undefined;
  const literal = emit(emitted, { comments });
  const next = replaceInitializer(source, declName, literal);

  assertParses(next, path.basename(file), logger);

  if (next === source) {
    return { mtime: (await mtimeOf(file)) ?? Date.now(), changed: false };
  }
  const mtime = await writeTextAtomic(file, next);
  return { mtime, changed: true };
}

/**
 * `i18n.ts`의 문자열 리터럴 여러 개를 한 번에 교체한다.
 *
 * @param {object} input
 * @param {string} input.projectRoot
 * @param {string} input.file
 * @param {{ ko: { path: string, value: string }[], en: { path: string, value: string }[] }} input.changes
 * @param {number | null | undefined} input.baseMtime
 * @param {any} [input.logger]
 */
export async function writeStringLiterals({ projectRoot, file, changes, baseMtime, logger }) {
  await assertInsideAllowedRoot(projectRoot, file);
  await assertFresh(file, baseMtime);

  const source = await readText(file);
  let next = source;
  for (const decl of /** @type {const} */ (['ko', 'en'])) {
    const list = changes[decl] ?? [];
    if (list.length === 0) continue;
    next = replaceStringLiterals(next, decl, list);
  }

  assertParses(next, path.basename(file), logger);

  if (next === source) {
    return { mtime: (await mtimeOf(file)) ?? Date.now(), changed: false };
  }
  const mtime = await writeTextAtomic(file, next);
  return { mtime, changed: true };
}
