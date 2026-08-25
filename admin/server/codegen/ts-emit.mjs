// @ts-check
/**
 * JS 값 → TypeScript 리터럴 문자열.
 *
 * 출력 포맷은 리포지토리의 기존 소스와 같아야 한다. 실측한 규칙:
 *   - 들여쓰기 2칸, 문자열은 홑따옴표, 여러 줄 리터럴에는 후행 콤마
 *   - 한 줄에 담기면(들여쓰기 포함 100칸 이내) 인라인, 넘치면 여러 줄
 *     근거: `profile.ts`의 `name: { ko: '<이름>', en: '<Name>' }`는 인라인이고
 *     `bio: { ... }`는 여러 줄이다. 이 규칙 하나가 두 모양을 모두 재현한다
 *
 * CRITICAL: 저장 후 `prettier --write`를 호출하지 않는다. 호출하면 관리자가 건드리지
 * 않은 부분까지 포맷이 바뀌어 diff가 오염된다.
 */

const MAX_LINE = 100;
const INDENT = '  ';

/** 원본 표현식 텍스트를 그대로 옮겨 심기 위한 표식. */
export class RawExpression {
  /** @param {string} text */
  constructor(text) {
    this.text = text;
  }
}

/** @param {string} text */
export function raw(text) {
  return new RawExpression(text);
}

/** 식별자로 쓸 수 있는 프로퍼티 이름인가. 아니면 따옴표로 감싼다. */
const BARE_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * 문자열 리터럴.
 *
 * 홑따옴표를 기본으로 하되, 값에 홑따옴표가 있고 겹따옴표가 없으면 겹따옴표를 쓴다
 * (이스케이프가 줄어드는 쪽). prettier의 판단과 같다.
 *
 * @param {string} value
 */
export function emitString(value) {
  const escapedBase = value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  const singles = (value.match(/'/g) ?? []).length;
  const doubles = (value.match(/"/g) ?? []).length;
  if (singles > doubles) {
    return `"${escapedBase.replace(/"/g, '\\"')}"`;
  }
  return `'${escapedBase.replace(/'/g, "\\'")}'`;
}

/**
 * `MaybeLocalized` 방출 규칙.
 *
 * CRITICAL: `{ ko, en }`의 두 값이 같으면 문자열 하나로 접는다. 고유명사(예: 'PyTorch')에
 * 불필요한 객체가 쌓이지 않게 하는 것이 이 규칙의 목적이다.
 *
 * @param {unknown} value
 */
export function foldLocalized(value) {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof RawExpression)
  ) {
    const keys = Object.keys(value);
    if (keys.length === 2 && keys.includes('ko') && keys.includes('en')) {
      const record = /** @type {Record<string, unknown>} */ (value);
      if (typeof record.ko === 'string' && record.ko === record.en) return record.ko;
    }
  }
  return value;
}

/**
 * 값을 TS 리터럴로 방출한다.
 *
 * @param {unknown} value
 * @param {object} [options]
 * @param {number} [options.depth] 현재 들여쓰기 깊이
 * @param {Record<string, string>} [options.comments] 프로퍼티 이름 → 앞에 붙일 주석 블록
 * @param {boolean} [options.fold] `MaybeLocalized` 접기를 적용할지
 * @returns {string}
 */
export function emit(value, options = {}) {
  const { depth = 0, comments, fold = true } = options;

  if (value instanceof RawExpression) return value.text;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return emitString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  const folded = fold ? foldLocalized(value) : value;
  if (folded !== value) return emit(folded, { ...options, fold: false });

  if (Array.isArray(value)) return emitArray(value, depth, fold);
  if (typeof value === 'object') {
    return emitObject(/** @type {Record<string, unknown>} */ (value), depth, comments, fold);
  }
  return 'undefined';
}

/**
 * 한 줄로 담기는지 본다. 주석이 붙는 프로퍼티가 있으면 언제나 여러 줄이다.
 * @param {string} inline
 * @param {number} depth
 *
 */
function fits(inline, depth) {
  return !inline.includes('\n') && INDENT.length * depth + inline.length <= MAX_LINE;
}

/**
 * @param {any[]} items
 * @param {number} depth
 * @param {boolean} fold
 * @returns {string}
 */
function emitArray(items, depth, fold) {
  const kept = items.filter((item) => item !== undefined);
  if (kept.length === 0) return '[]';

  const parts = kept.map((/** @type {any} */ item) => emit(item, { depth: depth + 1, fold }));
  const inline = `[${parts.join(', ')}]`;
  if (fits(inline, depth)) return inline;

  const pad = INDENT.repeat(depth + 1);
  const body = kept
    .map((/** @type {any} */ item) => `${pad}${emit(item, { depth: depth + 1, fold })},`)
    .join('\n');
  return `[\n${body}\n${INDENT.repeat(depth)}]`;
}

/**
 * @param {Record<string, unknown>} object
 * @param {number} depth
 * @param {Record<string, string> | undefined} comments
 * @param {boolean} fold
 * @returns {string}
 */
function emitObject(object, depth, comments, fold) {
  /** @type {[string, unknown][]} */
  const entries = Object.entries(object).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '{}';

  const hasComments = Boolean(
    comments &&
      (entries.some(([key]) => comments[key] && comments[key].trim() !== '') ||
        (comments[TRAILING_KEY] ?? '').trim() !== ''),
  );

  if (!hasComments) {
    const parts = entries.map(
      ([key, v]) => `${emitKey(key)}: ${emit(v, { depth: depth + 1, fold })}`,
    );
    const inline = `{ ${parts.join(', ')} }`;
    if (fits(inline, depth)) return inline;
  }

  const pad = INDENT.repeat(depth + 1);
  const lines = [];
  for (const [key, v] of entries) {
    const comment = comments?.[key];
    if (comment && comment.trim() !== '') {
      // 앞의 `\n`은 원본에 빈 줄이 있었다는 표식이다(ts-edit의 readPropertyComments).
      if (comment.startsWith('\n')) lines.push('');
      // 원본 주석 블록을 현재 깊이에 맞춰 다시 들여쓴다.
      lines.push(reindentComment(comment.replace(/^\n/, ''), pad));
    }
    lines.push(`${pad}${emitKey(key)}: ${emit(v, { depth: depth + 1, fold })},`);
  }

  // 닫는 중괄호 앞에 남아 있던 주석.
  const trailing = comments?.[TRAILING_KEY];
  if (trailing && trailing.trim() !== '') lines.push(reindentComment(trailing, pad));

  return `{\n${lines.join('\n')}\n${INDENT.repeat(depth)}}`;
}

/** `ts-edit.mjs`의 `TRAILING_COMMENT_KEY`와 같은 값이어야 한다. */
const TRAILING_KEY = '__trailing__';

/** @param {string} key */
function emitKey(key) {
  return BARE_KEY.test(key) ? key : emitString(key);
}

/**
 * 원본에서 떼어 온 주석 블록의 들여쓰기를 목표 깊이로 맞춘다.
 * @param {string} comment
 * @param {string} pad
 */
function reindentComment(comment, pad) {
  const lines = comment.replace(/\r/g, '').split('\n');
  // 첫 줄 기준 공통 들여쓰기를 벗겨 내고 pad를 새로 붙인다.
  const baseIndent = lines[0].match(/^\s*/)?.[0].length ?? 0;
  return lines
    .map((line, index) => {
      const stripped = line.slice(Math.min(baseIndent, line.match(/^\s*/)?.[0].length ?? 0));
      // JSDoc 이어지는 줄(` * ...`)은 한 칸 더 들여 별을 맞춘다.
      const continuation = index > 0 && /^\s*\*/.test(line);
      return `${pad}${continuation ? ' ' : ''}${stripped.trimStart()}`;
    })
    .join('\n');
}
