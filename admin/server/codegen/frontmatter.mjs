// @ts-check
/**
 * 프론트매터 직렬화.
 *
 * 목적은 **사람이 쓴 기존 파일과 구분되지 않는 결과**를 내고 diff를 최소화하는 것이다.
 * 규칙은 실측한 기존 글 3편(`attention-is-all-you-need.mdx`, `study-log-site.mdx`,
 * `intl-date-format.md`)의 모양에서 왔다.
 *
 * CRITICAL: 손으로 YAML을 만들지 않는다. 한국어 문장 속 콜론·따옴표·숫자형 문자열
 * (`arxivId: '1706.03762'`) 인용 규칙에서 반드시 사고가 난다. `yaml` 패키지의 판단을 쓴다.
 *
 * 스펙 문구와의 차이 한 곳: 스펙은 `stack`을 블록 스타일로 적었으나 실제
 * `study-log-site.mdx`는 플로우 한 줄(`stack: [Astro, TypeScript, ...]`)이다. 여기서는
 * 실제 파일을 따른다 — 그래야 태그 일괄 수정이 `tags` 줄 외의 줄을 건드리지 않는다.
 */
import YAML from 'yaml';

/**
 * 키 순서. 이 순서 밖의 키는 뒤에 원래 순서대로 붙는다(스키마가 늘어나도 값을 잃지 않게).
 * @type {readonly string[]}
 */
export const KEY_ORDER = [
  'slug',
  'lang',
  'title',
  'description',
  'category',
  'date',
  'updated',
  'tags',
  'draft',
  'cover',
  'coverAlt',
  'math',
  'toc',
  'paper',
  'project',
];

/**
 * 스키마 기본값. 값이 같으면 키째로 생략한다.
 * 근거: 기존 `attention-is-all-you-need.mdx`가 정확히 이 모양이다.
 */
const DEFAULTS = {
  lang: 'ko',
  draft: false,
  math: false,
  toc: true,
};

/**
 * 스키마가 기본값 없이 요구하는 키. 값이 비어도 키를 남긴다.
 * `slug`·`category`는 경로에서 오고 `date`는 날짜 정규화를 거치므로 실질 대상은
 * `title`이지만, 계약을 명시적으로 적어 둔다.
 *
 * CRITICAL: `description`은 여기 없다 — 선택 필드이므로 비면 키째로 사라져야 한다.
 * `description: ''`를 남기면 스키마가 통과시키더라도 "설명 없음"의 표현이 둘로 갈린다.
 */
const REQUIRED_KEYS = new Set(['slug', 'title', 'category', 'date']);

/** 플로우(한 줄) 배열로 낼 키. */
const FLOW_ARRAYS = new Set(['tags', 'stack']);

/** 항상 인용하는 문자열 키. `YYYY-MM`은 인용이 없으면 기존 파일과 모양이 갈린다. */
const FORCE_QUOTED = new Set(['start', 'end']);

/**
 * 날짜만 쓴다. 시각 성분을 남기지 않는다.
 * @param {unknown} value
 * @returns {string | undefined}
 */
export function toDateString(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

/**
 * `undefined`이거나 빈 문자열인 선택 필드를 없앤다.
 *
 * CRITICAL: 빈 문자열을 남기면 `z.url()`이 실패한다. 값이 없으면 키째로 사라져야 한다.
 * `null`은 남긴다 — `project.period.end: null`이 "진행 중"을 뜻하기 때문이다.
 *
 * @param {any} value
 * @returns {any}
 */
function prune(value) {
  if (Array.isArray(value)) {
    const items = value.map(prune).filter((/** @type {any} */ item) => item !== undefined);
    return items;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      const cleaned = prune(child);
      if (cleaned === undefined) continue;
      if (typeof cleaned === 'string' && cleaned.trim() === '') continue;
      if (Array.isArray(cleaned) && cleaned.length === 0) continue;
      out[key] = cleaned;
    }
    return Object.keys(out).length === 0 ? undefined : out;
  }
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

/**
 * 직렬화 대상 객체를 규칙에 맞게 정리한다(순서·기본값·빈 값).
 * @param {Record<string, any>} frontmatter
 * @returns {Record<string, any>}
 */
export function normalizeFrontmatter(frontmatter) {
  /** @type {Record<string, any>} */
  const source = { ...frontmatter };

  // 날짜 3종은 언제나 YYYY-MM-DD 문자열로.
  for (const key of ['date', 'updated']) {
    const formatted = toDateString(source[key]);
    if (formatted === undefined) delete source[key];
    else source[key] = formatted;
  }
  if (source.paper && typeof source.paper === 'object') {
    const readDate = toDateString(source.paper.readDate);
    if (readDate === undefined) delete source.paper.readDate;
    else source.paper.readDate = readDate;
  }

  /** @type {Record<string, any>} */
  const ordered = {};
  const keys = [...KEY_ORDER, ...Object.keys(source).filter((k) => !KEY_ORDER.includes(k))];

  for (const key of keys) {
    if (!(key in source)) continue;
    const raw = source[key];

    // 기본값과 같으면 생략
    if (key in DEFAULTS && raw === DEFAULTS[/** @type {keyof typeof DEFAULTS} */ (key)]) continue;
    // 빈 태그 배열은 기본값이므로 키째로 생략
    if (key === 'tags' && (!Array.isArray(raw) || raw.length === 0)) continue;

    /*
      CRITICAL: 스키마가 요구하는 키는 값이 비어도 **생략하지 않는다.**
      생략하면 "빈 값"이 "키 없음"으로 바뀌고, 다시 읽을 때 `Required`로 실패해
      dev 서버와 빌드가 함께 죽는다 — 고칠 도구(관리자)마저 못 여는 교착이 된다.
      스키마의 `.min(1)`이 먼저 막지만, 그 앞을 어떤 경로로 지나오더라도 여기서
      파일이 깨지지는 않게 둔다.
    */
    if (REQUIRED_KEYS.has(key)) {
      ordered[key] = typeof raw === 'string' ? raw : (prune(raw) ?? '');
      continue;
    }

    const cleaned = prune(raw);
    if (cleaned === undefined) continue;
    if (typeof cleaned === 'string' && cleaned.trim() === '') continue;

    ordered[key] = cleaned;
  }

  return ordered;
}

/**
 * 프론트매터 블록 문자열(구분자 제외)을 만든다.
 * @param {Record<string, any>} frontmatter
 * @returns {string}
 */
export function stringifyFrontmatter(frontmatter) {
  const ordered = normalizeFrontmatter(frontmatter);
  const doc = new YAML.Document(ordered);

  YAML.visit(doc, {
    Pair(_, pair) {
      const key = /** @type {any} */ (pair.key)?.value;
      if (FLOW_ARRAYS.has(key) && YAML.isSeq(pair.value)) {
        pair.value.flow = true;
      }
      if (
        FORCE_QUOTED.has(key) &&
        YAML.isScalar(pair.value) &&
        typeof pair.value.value === 'string'
      ) {
        pair.value.type = 'QUOTE_SINGLE';
      }
    },
  });

  return doc.toString({
    lineWidth: 0, // 긴 한국어 설명을 접지 않는다
    singleQuote: true,
    flowCollectionPadding: false, // `[a, b]` — 기존 파일과 같은 모양
    nullStr: 'null',
  });
}

/**
 * 프론트매터 + 본문으로 파일 전체를 만든다.
 *
 * 본문은 종료 구분자 뒤에 빈 줄 하나를 두고 시작하며, 파일은 개행 하나로 끝난다.
 *
 * @param {Record<string, any>} frontmatter
 * @param {string} body
 * @returns {string}
 */
export function composeFile(frontmatter, body) {
  const yamlBlock = stringifyFrontmatter(frontmatter).replace(/\n+$/, '');
  const trimmedBody = String(body ?? '')
    .replace(/^\n+/, '')
    .replace(/\s+$/, '');
  return `---\n${yamlBlock}\n---\n\n${trimmedBody}\n`;
}
