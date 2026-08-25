// @ts-check
/**
 * 허용 루트 화이트리스트와 트래버설 차단.
 *
 * CRITICAL: 관리자가 쓸 수 있는 곳은 정확히 3개다.
 *   <projectRoot>/src/content/posts
 *   <projectRoot>/src/assets
 *   <projectRoot>/src/config
 * 이 밖의 경로는 어떤 경로로도 도달할 수 없어야 한다.
 */
import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fail } from './errors.mjs';

/**
 * 프로젝트 루트 URL을 절대 경로 문자열로.
 * @param {URL | string} root
 * @returns {string}
 */
export function toProjectRoot(root) {
  return typeof root === 'string' ? path.resolve(root) : path.resolve(fileURLToPath(root));
}

/**
 * 허용 루트 3개. 순서는 의미 없다.
 * @param {string} projectRoot
 * @returns {string[]}
 */
export function allowedRoots(projectRoot) {
  return [
    path.join(projectRoot, 'src', 'content', 'posts'),
    path.join(projectRoot, 'src', 'assets'),
    path.join(projectRoot, 'src', 'config'),
  ];
}

/**
 * 편의 접근자 — 자주 쓰는 디렉터리 경로.
 * @param {string} projectRoot
 */
export function dirs(projectRoot) {
  return {
    projectRoot,
    posts: path.join(projectRoot, 'src', 'content', 'posts'),
    assets: path.join(projectRoot, 'src', 'assets'),
    config: path.join(projectRoot, 'src', 'config'),
    contentConfig: path.join(projectRoot, 'src', 'content', 'schema.ts'),
  };
}

/**
 * 경로가 허용 루트 안인지 확인한다.
 *
 * CRITICAL: 문자열 `startsWith` 비교로 끝내지 않는다 — `src/assets-evil`이 `src/assets`로
 * 시작한다. `path.relative`가 `..`로 시작하지 않고 절대 경로도 아닌지 본다.
 *
 * CRITICAL: `realpath`를 쓰는 이유는 심볼릭 링크로 루트 밖을 가리키는 경우를 잡기
 * 위해서다. 아직 존재하지 않는 새 파일은 가장 가까운 존재하는 조상을 realpath 한다.
 *
 * @param {string} projectRoot
 * @param {string} target 절대 또는 프로젝트 루트 기준 상대 경로
 * @returns {Promise<string>} 정규화된 절대 경로
 */
export async function assertInsideAllowedRoot(projectRoot, target) {
  const absolute = path.resolve(projectRoot, target);

  // 존재하는 가장 가까운 조상까지 realpath 해서 심볼릭 링크를 편다.
  const resolved = await realpathNearest(absolute);

  const roots = await Promise.all(allowedRoots(projectRoot).map((root) => realpathNearest(root)));
  const inside = roots.some((root) => {
    const relative = path.relative(root, resolved);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  });

  if (!inside) {
    // CRITICAL: 응답에 경로를 되비추지 않는다. 터미널 경고는 미들웨어가 남긴다.
    throw fail('E-PATH-ESCAPE', '잘못된 경로입니다.', { detail: { attempted: absolute } });
  }
  return resolved;
}

/**
 * 존재하는 가장 가까운 조상까지 realpath 한 뒤 나머지 세그먼트를 다시 붙인다.
 * @param {string} absolute
 * @returns {Promise<string>}
 */
async function realpathNearest(absolute) {
  /** @type {string[]} */
  const tail = [];
  let current = absolute;
  for (;;) {
    try {
      const real = await realpath(current);
      return tail.length ? path.join(real, ...tail.reverse()) : real;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return absolute; // 루트까지 갔는데도 없다 — 원본을 그대로
      tail.push(path.basename(current));
      current = parent;
    }
  }
}

/** 파일명 안전 검사. `..`을 포함할 수 없고 소문자·숫자로 시작한다. */
const SAFE_FILENAME = /^[a-z0-9][a-z0-9.-]*$/;

/**
 * @param {string} name
 * @param {string} [field]
 */
export function assertSafeFilename(name, field = 'filename') {
  if (typeof name !== 'string' || name.includes('..') || !SAFE_FILENAME.test(name)) {
    throw fail('E-PATH-ESCAPE', '잘못된 경로입니다.', { field });
  }
  return name;
}

/** 글 슬러그 규칙. 스키마의 정규식과 같아야 한다. */
export const SLUG_PATTERN = /^[a-z0-9-]+$/;

/**
 * 컬렉션 id(`paper-review/attention.en`)를 안전하게 파일 경로 조각으로 푼다.
 * @param {string} id
 * @returns {{ category: string, base: string, lang: 'ko' | 'en', slug: string }}
 */
export function parsePostId(id) {
  if (typeof id !== 'string' || id.includes('..') || id.includes('\\')) {
    throw fail('E-PATH-ESCAPE', '잘못된 경로입니다.', { field: 'id' });
  }
  const segments = id.split('/').filter(Boolean);
  if (segments.length !== 2) {
    throw fail('E-NOT-FOUND', `글 id 형식이 올바르지 않습니다: ${id}`, { field: 'id' });
  }
  const [category, base] = segments;
  if (!SLUG_PATTERN.test(category)) {
    throw fail('E-PATH-ESCAPE', '잘못된 경로입니다.', { field: 'id' });
  }
  const lang = base.endsWith('.en') ? 'en' : 'ko';
  const slug = lang === 'en' ? base.slice(0, -3) : base;
  if (!SLUG_PATTERN.test(slug)) {
    throw fail('E-PATH-ESCAPE', '잘못된 경로입니다.', { field: 'id' });
  }
  return { category, base, lang, slug };
}

/**
 * `category` + `slug` + `lang`에서 컬렉션 id를 만든다.
 * CRITICAL: `src/content.config.ts`의 `generateId`(확장자만 제거)와 같은 규칙이어야 한다.
 * @param {string} category
 * @param {string} slug
 * @param {'ko' | 'en'} lang
 */
export function buildPostId(category, slug, lang) {
  return `${category}/${slug}${lang === 'ko' ? '' : `.${lang}`}`;
}
