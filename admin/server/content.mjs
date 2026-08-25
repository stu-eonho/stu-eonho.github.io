// @ts-check
/**
 * 글 파일 스캔·읽기·검증.
 *
 * CRITICAL: 캐시를 두지 않는다. 매 요청 파일시스템을 훑는다 — 에디터로 직접 고친 변경을
 * 관리자가 놓치면 그 순간 저장이 남의 변경을 덮어쓴다.
 *
 * CRITICAL: 밑줄로 시작하는 파일(`_template.*`)은 제외한다. 콘텐츠 로더의 글로브
 * (`['**\/*.{md,mdx}', '!**\/_*']`)와 같은 규칙이어야 한다.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { fail } from './errors.mjs';
import { exists, mtimeOf } from './fsx.mjs';
import { buildPostId, dirs, parsePostId, SLUG_PATTERN } from './paths.mjs';
import { loadPostSchema, loadProjectModule } from './project.mjs';

const EXTENSIONS = ['.mdx', '.md'];

/** 신규 글의 확장자. 수식·컴포넌트 확장 여지가 있고 기존 3편 중 2편이 이미 mdx다. */
export const NEW_POST_EXTENSION = '.mdx';

/**
 * 글 파일 하나의 절대 경로 후보를 만든다(존재 여부는 보지 않는다).
 * @param {string} projectRoot
 * @param {string} category
 * @param {string} slug
 * @param {'ko' | 'en'} lang
 * @param {string} extension
 */
export function postFilePath(projectRoot, category, slug, lang, extension = NEW_POST_EXTENSION) {
  const base = lang === 'ko' ? slug : `${slug}.${lang}`;
  return path.join(dirs(projectRoot).posts, category, `${base}${extension}`);
}

/**
 * 존재하는 글 파일 경로를 찾는다. `.mdx`를 먼저 본다.
 * @returns {Promise<string | null>}
 *
 * @param {string} projectRoot
 * @param {string} category
 * @param {string} slug
 * @param {'ko' | 'en'} lang
 */
export async function findPostFile(projectRoot, category, slug, lang) {
  for (const extension of EXTENSIONS) {
    const candidate = postFilePath(projectRoot, category, slug, lang, extension);
    if (await exists(candidate)) return candidate;
  }
  return null;
}

/**
 * 컬렉션 id에 해당하는 파일을 찾는다.
 * @param {string} projectRoot
 * @param {string} id
 */
export async function findPostFileById(projectRoot, id) {
  const { category, slug, lang } = parsePostId(id);
  return findPostFile(projectRoot, category, slug, lang);
}

/**
 * `src/content/posts` 아래 글 파일을 전부 모은다.
 * @param {string} projectRoot
 * @returns {Promise<{ file: string, category: string, base: string, extension: string }[]>}
 */
export async function scanPostFiles(projectRoot) {
  const root = dirs(projectRoot).posts;
  /** @type {{ file: string, category: string, base: string, extension: string }[]} */
  const found = [];

  let categories;
  try {
    categories = await readdir(root, { withFileTypes: true });
  } catch {
    return found;
  }

  for (const categoryEntry of categories) {
    if (!categoryEntry.isDirectory()) continue;
    if (categoryEntry.name.startsWith('_')) continue;
    const categoryDir = path.join(root, categoryEntry.name);
    let files;
    try {
      files = await readdir(categoryDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const fileEntry of files) {
      if (!fileEntry.isFile()) continue;
      // CRITICAL: 템플릿(`_template.*`)과 임시 파일을 제외한다.
      if (fileEntry.name.startsWith('_') || fileEntry.name.startsWith('.')) continue;
      const extension = path.extname(fileEntry.name);
      if (!EXTENSIONS.includes(extension)) continue;
      found.push({
        file: path.join(categoryDir, fileEntry.name),
        category: categoryEntry.name,
        base: fileEntry.name.slice(0, -extension.length),
        extension,
      });
    }
  }

  return found;
}

/**
 * 파일 하나를 읽어 프론트매터·본문·mtime을 돌려준다.
 * @param {string} file
 */
export async function readPostFile(file) {
  const raw = await readFile(file, 'utf8');
  const { frontmatter, content } = parseFrontmatter(raw);
  const mtime = await mtimeOf(file);
  return { raw, frontmatter, body: content, mtime };
}

/**
 * 컬렉션 id 규칙(`generateId`: 확장자만 제거)과 같은 방식으로 id를 만든다.
 * @param {string} category
 * @param {string} base
 */
export function idFromParts(category, base) {
  return `${category}/${base}`;
}

/**
 * 검증기를 만든다.
 *
 * CRITICAL: 스키마를 관리자에 복제하지 않는다. `src/content/schema.ts`의 팩토리를 그대로
 * 부른다 — 복제하는 순간 두 벌이 갈라지고, 관리자가 통과시킨 글이 빌드에서 깨진다.
 *
 * `image` 자리에는 `z.string()`을 넣는다. 반환값이 문자열 경로이므로 `cover`의 실제 파일
 * 존재 여부는 별도 관문(참조 무결성)에서 검사한다.
 *
 * @param {any} server
 */
export async function getValidator(server) {
  const [schemaModule, zodModule] = await Promise.all([
    loadPostSchema(server),
    loadProjectModule(server, 'astro/zod'),
  ]);
  const z = zodModule.z ?? zodModule.default?.z ?? zodModule.default;
  return schemaModule.postSchema({ image: () => z.string() });
}

/**
 * Zod 이슈를 폼 필드 경로 배열로 옮긴다.
 *
 * CRITICAL: 메시지를 관리자에서 다시 쓰지 않는다. 스키마에 이미 한국어로 적혀 있고,
 * 재작성하면 스키마를 고칠 때 두 벌이 갈라진다.
 *
 * @param {any} error
 * @returns {{ field: string, message: string }[]}
 */
export function toFieldIssues(error) {
  const issues = error?.issues ?? [];
  return issues.map((/** @type {any} */ issue) => ({
    field: (issue.path ?? []).join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * 검증 파이프라인의 2번 관문(형태) — slug·category·lang.
 * @param {{ category: string, slug: string, lang: string, categoryIds: string[], langIds: string[] }} input
 */
export function assertShape({ category, slug, lang, categoryIds, langIds }) {
  if (!SLUG_PATTERN.test(slug)) {
    throw fail(
      'E-VALIDATION',
      'slug는 소문자·숫자·하이픈만 허용하며 슬래시를 포함할 수 없습니다 (라우트가 단일 세그먼트입니다)',
      { field: 'slug' },
    );
  }
  if (!categoryIds.includes(category)) {
    throw fail('E-VALIDATION', `category는 다음 중 하나여야 합니다: ${categoryIds.join(', ')}`, {
      field: 'category',
    });
  }
  if (!langIds.includes(lang)) {
    throw fail('E-VALIDATION', `lang은 다음 중 하나여야 합니다: ${langIds.join(', ')}`, {
      field: 'lang',
    });
  }
}

/**
 * 검증 파이프라인의 3번 관문(스키마).
 * @param {any} validator
 * @param {Record<string, any>} frontmatter
 */
export function assertSchema(validator, frontmatter) {
  const result = validator.safeParse(frontmatter);
  if (result.success) return result.data;
  throw fail('E-VALIDATION', '스키마 검증에 실패했습니다.', {
    field: toFieldIssues(result.error)[0]?.field ?? null,
    detail: { issues: toFieldIssues(result.error) },
  });
}

/**
 * 본문에서 상대 경로 이미지 참조를 뽑는다.
 *
 * 마크다운 이미지(`![alt](path)`)와 HTML `<img src="path">` 둘 다 본다.
 * `.`으로 시작하는 상대 경로만 대상이다 — `/foo.png`는 `public/`을 가리키고,
 * `http(s)://`는 외부 자원이라 Vite가 번들 대상으로 삼지 않는다.
 *
 * 코드 펜스 안은 건드리지 않는다. 예제 코드에 이미지 문법이 있는 것이 정상이다.
 *
 * @param {string} body
 * @returns {string[]}
 */
export function collectBodyImageRefs(body) {
  /** @type {string[]} */
  const found = [];
  let inFence = false;

  for (const line of String(body ?? '').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // `\!`로 이스케이프된 것은 이미지가 아니라 글자 그대로다.
    for (const match of line.matchAll(/(^|[^\\])!\[[^\]]*\]\(\s*([^)\s]+)/g)) {
      found.push(match[2]);
    }
    for (const match of line.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/g)) {
      found.push(match[1]);
    }
  }

  return [...new Set(found.filter((ref) => ref.startsWith('.')))];
}

/**
 * 본문에서 링크 목적지를 뽑는다.
 *
 * 이미지(`![...]`)는 별도로 검사하므로 여기서는 제외한다. 코드 펜스 안도 건드리지 않는다.
 *
 * @param {string} body
 * @returns {string[]}
 */
export function collectBodyLinkRefs(body) {
  /** @type {string[]} */
  const found = [];
  let inFence = false;

  for (const line of String(body ?? '').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    // 앞에 `!`(이미지)도 `\`(이스케이프)도 없는 `[텍스트](목적지)`만 링크다.
    for (const match of line.matchAll(/(^|[^!\\])\[[^\]]*\]\(\s*([^)\s]+)/g)) {
      found.push(match[2]);
    }
    for (const match of line.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/g)) {
      found.push(match[1]);
    }
  }

  return [...new Set(found)];
}

/**
 * 사이트가 실제로 해석할 수 있는 링크 목적지인가.
 *
 * 이 사이트의 내부 링크는 전부 루트 기준 절대 경로(`/paper-review/…`)다 — `i18n.href()`가
 * 그렇게 만든다. 스킴도 없고 슬래시로 시작하지도 않는 목적지(`url`, `foo`)는 글이 놓인
 * 디렉터리 기준 상대 경로로 해석되어 **반드시 깨진다.**
 *
 * @param {string} href
 */
function isResolvableHref(href) {
  if (href.startsWith('#')) return true; // 같은 문서 앵커
  if (href.startsWith('/')) return true; // 루트 기준 내부 링크
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) return true; // https:, mailto:, tel: …
  if (href.startsWith('./') || href.startsWith('../')) return true; // 명시적 상대 경로
  return false;
}

/**
 * 검증 파이프라인의 4번 관문(참조 무결성).
 *
 * `cover`와 본문 이미지는 글 파일 기준 상대 경로다. 실제 파일이 없으면 Vite가 모듈을
 * 해석하지 못해 **dev 서버와 `astro build`가 함께 죽는다.** 그 실패를 브라우저에서 미리 잡는다.
 *
 * CRITICAL: 본문 검사를 빼면 편집기의 "이미지 삽입"이나 손으로 적은 오타 하나가 사이트
 * 전체를 내린다. 실제로 자리표시 경로(`../../../assets/파일명`)가 저장되어 그렇게 됐다.
 *
 * @param {string} postFile 대상 글 파일의 절대 경로
 * @param {Record<string, any>} frontmatter
 * @param {string} [body]
 */
export async function assertReferences(postFile, frontmatter, body = '') {
  if (typeof frontmatter.cover === 'string' && frontmatter.cover.trim() !== '') {
    const resolved = path.resolve(path.dirname(postFile), frontmatter.cover);
    if (!(await exists(resolved))) {
      throw fail('E-VALIDATION', `커버 이미지 파일을 찾을 수 없습니다: ${frontmatter.cover}`, {
        field: 'cover',
      });
    }
  }

  /** @type {string[]} */
  const missing = [];
  for (const ref of collectBodyImageRefs(body)) {
    const resolved = path.resolve(path.dirname(postFile), ref);
    if (!(await exists(resolved))) missing.push(ref);
  }
  if (missing.length > 0) {
    throw fail(
      'E-VALIDATION',
      `본문이 존재하지 않는 이미지를 참조합니다: ${missing.join(', ')}. ` +
        '이미지를 먼저 올린 뒤 삽입하거나, 해당 줄을 지우세요.',
      { field: 'body', detail: { missing } },
    );
  }

  const badLinks = collectBodyLinkRefs(body).filter((href) => !isResolvableHref(href));
  if (badLinks.length > 0) {
    throw fail(
      'E-VALIDATION',
      `본문에 해석할 수 없는 링크 주소가 있습니다: ${badLinks.join(', ')}. ` +
        '외부는 https://로, 사이트 안은 /로 시작해야 합니다.',
      { field: 'body', detail: { badLinks } },
    );
  }

  for (const tag of frontmatter.tags ?? []) {
    if (typeof tag === 'string' && tag.length > 24) {
      throw fail('E-TAG-TOO-LONG', '태그는 항목당 24자 이내여야 합니다', { field: 'tags' });
    }
  }
}

/**
 * 목록 항목 하나를 만든다.
 * @param {string} projectRoot
 * @param {{ file: string, category: string, base: string, extension: string }} entry
 * @param {any} validator
 */
export async function describePost(projectRoot, entry, validator) {
  const { frontmatter, body, mtime } = await readPostFile(entry.file);
  const result = validator.safeParse(frontmatter);
  const data = result.success ? result.data : frontmatter;

  const lang = entry.base.endsWith('.en') ? 'en' : 'ko';
  const slug = typeof data.slug === 'string' ? data.slug : entry.base.replace(/\.en$/, '');

  return {
    id: idFromParts(entry.category, entry.base),
    path: path.relative(projectRoot, entry.file).split(path.sep).join('/'),
    category: entry.category,
    slug,
    lang: typeof data.lang === 'string' ? data.lang : lang,
    title: data.title ?? '(제목 없음)',
    description: data.description ?? '',
    date: toIsoDate(data.date),
    updated: toIsoDate(data.updated),
    tags: Array.isArray(data.tags) ? data.tags : [],
    draft: data.draft === true,
    mtime,
    bodyLength: body.length,
    valid: result.success,
    issues: result.success ? [] : toFieldIssues(result.error),
  };
}

/** @param {unknown} value */
function toIsoDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
}

/**
 * 번역본 짝짓기.
 *
 * CRITICAL: 짝짓기 키는 `category` + `slug`다. `src/lib/posts.ts`의
 * `translationKey`와 같은 규칙이어야 한다 — 갈리면 사이트가 같은 글을 두 번 싣거나
 * 번역본을 독립된 글로 노출한다.
 *
 * @param {{ category: string, slug: string, lang: string, id: string }[]} items
 */
export function pairTranslations(items) {
  /** @type {Map<string, Record<string, string>>} */
  const groups = new Map();
  for (const item of items) {
    const key = `${item.category}/${item.slug}`;
    const group = groups.get(key) ?? {};
    group[item.lang] = item.id;
    groups.set(key, group);
  }
  return groups;
}

/**
 * 반대 언어. 2개 언어 전제다.
 * @param {string} lang
 */
export function otherLang(lang) {
  return lang === 'ko' ? 'en' : 'ko';
}

/**
 * 짝 파일의 컬렉션 id.
 * @param {string} category
 * @param {string} slug
 * @param {'ko' | 'en'} lang
 */
export function siblingId(category, slug, lang) {
  return buildPostId(category, slug, otherLang(lang));
}
