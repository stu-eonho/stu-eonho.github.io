// @ts-check
/**
 * 글 CRUD.
 *
 * 저장 요청 하나가 통과해야 하는 관문 5개. 순서를 지킨다 — 뒤 단계가 앞 단계의 통과를
 * 전제한다.
 *   1. 경로 안전     — 대상 경로가 허용 루트 안인가
 *   2. 형태          — slug 정규식, category/lang이 설정에 있는가
 *   3. 스키마        — `postSchema()`로 파싱
 *   4. 참조 무결성   — cover 파일 존재, 태그 길이
 *   5. 충돌          — baseMtime 일치, 대상 경로 중복 없음
 */
import path from 'node:path';
import { fail } from '../errors.mjs';
import { assertFresh, ensureDir, exists, removeFile, writeTextAtomic } from '../fsx.mjs';
import { assertInsideAllowedRoot, buildPostId, parsePostId } from '../paths.mjs';
import { loadCategories, loadI18n } from '../project.mjs';
import { composeFile } from '../codegen/frontmatter.mjs';
import {
  assertReferences,
  assertSchema,
  assertShape,
  describePost,
  findPostFile,
  findPostFileById,
  getValidator,
  NEW_POST_EXTENSION,
  otherLang,
  pairTranslations,
  postFilePath,
  readPostFile,
  scanPostFiles,
} from '../content.mjs';

/**
 * 설정에서 카테고리·언어 id 목록을 얻는다.
 * @param {any} server
 */
async function loadIds(server) {
  const [categories, i18n] = await Promise.all([loadCategories(server), loadI18n(server)]);
  return {
    categoryIds: categories.CATEGORIES.map((/** @type {any} */ c) => c.id),
    langIds: [...i18n.LOCALES],
    defaultLang: i18n.DEFAULT_LANG,
  };
}

/* ==========================================================================
   읽기
   ========================================================================== */

/** @param {{ query: URLSearchParams, projectRoot: string, server: any }} ctx */
export async function listPosts({ query, projectRoot, server }) {
  const validator = await getValidator(server);
  const files = await scanPostFiles(projectRoot);
  const items = await Promise.all(
    files.map((entry) => describePost(projectRoot, entry, validator)),
  );

  const pairs = pairTranslations(items);
  const enriched = items.map((item) => {
    const group = pairs.get(`${item.category}/${item.slug}`) ?? {};
    const other = otherLang(item.lang);
    return {
      ...item,
      hasTranslation: Boolean(group[other]),
      translationId: group[other] ?? null,
    };
  });

  // ---- 필터 ----
  const category = query.get('category');
  const lang = query.get('lang');
  const draft = query.get('draft') ?? 'all';
  const q = (query.get('q') ?? '').trim().toLowerCase();

  const filtered = enriched.filter((item) => {
    if (category && item.category !== category) return false;
    if (lang && item.lang !== lang) return false;
    if (draft === 'only' && !item.draft) return false;
    if (draft === 'exclude' && item.draft) return false;
    if (q) {
      const haystack = [item.title, item.description, ...item.tags].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // 기본 정렬: date 내림차순
  filtered.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));

  return {
    posts: filtered,
    total: enriched.length,
    counts: {
      all: enriched.length,
      drafts: enriched.filter((item) => item.draft).length,
      invalid: enriched.filter((item) => !item.valid).length,
      // 번역 누락 — 짝이 없는 글. 원문/번역 어느 쪽이든 센다.
      // CRITICAL: 번역본이 없어도 사이트는 정상이다(원문 + 안내 배너로 폴백).
      // 오류가 아니라 정보로 표시한다.
      missingTranslation: enriched.filter((item) => !item.hasTranslation).length,
    },
  };
}

/** @param {{ params: Record<string, string>, projectRoot: string, server: any }} ctx */
export async function readPost({ params, projectRoot, server }) {
  const { category, slug, lang } = parsePostId(params.id);
  const file = await findPostFileById(projectRoot, params.id);
  if (!file) throw fail('E-NOT-FOUND', '이 글은 더 이상 존재하지 않습니다.', { field: 'id' });
  await assertInsideAllowedRoot(projectRoot, file);

  const { raw, frontmatter, body, mtime } = await readPostFile(file);
  const validator = await getValidator(server);
  const result = validator.safeParse(frontmatter);

  const other = otherLang(lang);
  const siblingFile = await findPostFile(projectRoot, category, slug, other);

  return {
    id: params.id,
    path: path.relative(projectRoot, file).split(path.sep).join('/'),
    category,
    slug,
    lang,
    frontmatter,
    body,
    raw,
    mtime,
    valid: result.success,
    issues: result.success ? [] : result.error.issues.map(toIssue),
    sibling: {
      id: buildPostId(category, slug, other),
      lang: other,
      exists: Boolean(siblingFile),
    },
  };
}

/** @param {any} issue */
function toIssue(issue) {
  return { field: (issue.path ?? []).join('.') || '(root)', message: issue.message };
}

/* ==========================================================================
   쓰기
   ========================================================================== */

/**
 * 관문 1~4를 한 번에 통과시키고 정규화된 프론트매터를 돌려준다.
 *
 * @param {{ projectRoot: string, server: any, category: string, slug: string, lang: string, frontmatter: Record<string, any>, file: string, body?: string }} input
 */
async function validateForWrite({
  projectRoot,
  server,
  category,
  slug,
  lang,
  frontmatter,
  file,
  body = '',
}) {
  // 1. 경로 안전
  await assertInsideAllowedRoot(projectRoot, file);

  // 2. 형태
  const { categoryIds, langIds } = await loadIds(server);
  assertShape({ category, slug, lang, categoryIds, langIds });

  // 3. 스키마
  const validator = await getValidator(server);
  const merged = { ...frontmatter, category, slug, lang };
  assertSchema(validator, merged);

  // 4. 참조 무결성
  await assertReferences(file, merged, body);

  return merged;
}

/** @param {{ body: any, projectRoot: string, server: any }} ctx */
export async function createPost({ body, projectRoot, server }) {
  const category = String(body.category ?? '');
  const slug = String(body.slug ?? '');
  const lang = String(body.lang ?? 'ko');
  const frontmatter = body.frontmatter ?? {};

  const file = postFilePath(projectRoot, category, slug, /** @type {any} */ (lang));

  const merged = await validateForWrite({
    projectRoot,
    server,
    category,
    slug,
    lang,
    frontmatter,
    file,
    body: body.body ?? '',
  });

  // 5. 충돌 — CRITICAL: 이미 있으면 덮어쓰지 않는다
  const existing = await findPostFile(projectRoot, category, slug, /** @type {any} */ (lang));
  if (existing) {
    throw fail('E-DUPLICATE-SLUG', '같은 카테고리에 같은 슬러그의 글이 이미 있습니다.', {
      field: 'slug',
      detail: { id: buildPostId(category, slug, /** @type {any} */ (lang)) },
    });
  }

  // 카테고리 폴더가 없으면 만든다
  await ensureDir(path.dirname(file));

  const mtime = await writeTextAtomic(file, composeFile(merged, body.body ?? ''));

  return {
    id: buildPostId(category, slug, /** @type {any} */ (lang)),
    path: path.relative(projectRoot, file).split(path.sep).join('/'),
    mtime,
  };
}

/** @param {{ params: Record<string, string>, body: any, projectRoot: string, server: any }} ctx */
export async function updatePost({ params, body, projectRoot, server }) {
  const current = parsePostId(params.id);
  const file = await findPostFileById(projectRoot, params.id);
  if (!file) throw fail('E-NOT-FOUND', '이 글은 더 이상 존재하지 않습니다.', { field: 'id' });
  await assertInsideAllowedRoot(projectRoot, file);

  const frontmatter = body.frontmatter ?? {};
  const nextCategory = String(frontmatter.category ?? current.category);
  const nextSlug = String(frontmatter.slug ?? current.slug);
  const nextLang = String(frontmatter.lang ?? current.lang);
  const extension = path.extname(file);

  const nextFile = postFilePath(
    projectRoot,
    nextCategory,
    nextSlug,
    /** @type {any} */ (nextLang),
    extension,
  );

  const merged = await validateForWrite({
    projectRoot,
    server,
    category: nextCategory,
    slug: nextSlug,
    lang: nextLang,
    frontmatter,
    file: nextFile,
    body: body.body ?? '',
  });

  // 5. 충돌 — 낙관적 락
  await assertFresh(file, body.baseMtime, async () => {
    const disk = await readPostFile(file);
    return { frontmatter: disk.frontmatter, body: disk.body, mtime: disk.mtime };
  });

  const moved = path.resolve(nextFile) !== path.resolve(file);
  if (moved && (await exists(nextFile))) {
    throw fail('E-DUPLICATE-SLUG', '이동하려는 위치에 같은 이름의 글이 이미 있습니다.', {
      field: 'slug',
      detail: { id: buildPostId(nextCategory, nextSlug, /** @type {any} */ (nextLang)) },
    });
  }

  /** @type {{ from: string, to: string }[]} */
  const renamed = [];

  await ensureDir(path.dirname(nextFile));
  const mtime = await writeTextAtomic(nextFile, composeFile(merged, body.body ?? ''));

  if (moved) {
    await removeFile(file);
    renamed.push({
      from: path.relative(projectRoot, file).split(path.sep).join('/'),
      to: path.relative(projectRoot, nextFile).split(path.sep).join('/'),
    });

    /**
     * CRITICAL: 번역본이 있으면 짝도 함께 rename 한다. 한쪽만 바뀌면 `category`+`slug`
     * 짝짓기가 끊겨 번역본이 독립된 글로 노출된다.
     */
    const other = otherLang(current.lang);
    const siblingFile = await findPostFile(projectRoot, current.category, current.slug, other);
    if (siblingFile) {
      const siblingExtension = path.extname(siblingFile);
      const nextSiblingFile = postFilePath(
        projectRoot,
        nextCategory,
        nextSlug,
        other,
        siblingExtension,
      );
      if (path.resolve(nextSiblingFile) !== path.resolve(siblingFile)) {
        await assertInsideAllowedRoot(projectRoot, nextSiblingFile);
        if (await exists(nextSiblingFile)) {
          throw fail(
            'E-DUPLICATE-SLUG',
            '번역본을 옮기려는 위치에 같은 이름의 글이 이미 있습니다.',
            { field: 'slug' },
          );
        }
        const sibling = await readPostFile(siblingFile);
        const siblingFrontmatter = {
          ...sibling.frontmatter,
          slug: nextSlug,
          category: nextCategory,
        };
        await ensureDir(path.dirname(nextSiblingFile));
        await writeTextAtomic(nextSiblingFile, composeFile(siblingFrontmatter, sibling.body));
        await removeFile(siblingFile);
        renamed.push({
          from: path.relative(projectRoot, siblingFile).split(path.sep).join('/'),
          to: path.relative(projectRoot, nextSiblingFile).split(path.sep).join('/'),
        });
      }
    }
  }

  return {
    id: buildPostId(nextCategory, nextSlug, /** @type {any} */ (nextLang)),
    path: path.relative(projectRoot, nextFile).split(path.sep).join('/'),
    mtime,
    renamed,
  };
}

/** @param {{ params: Record<string, string>, query: URLSearchParams, projectRoot: string }} ctx */
export async function deletePost({ params, query, projectRoot }) {
  const { category, slug, lang } = parsePostId(params.id);
  const file = await findPostFileById(projectRoot, params.id);
  if (!file) throw fail('E-NOT-FOUND', '이 글은 더 이상 존재하지 않습니다.', { field: 'id' });
  await assertInsideAllowedRoot(projectRoot, file);

  /** @type {string[]} */
  const deleted = [];

  // CRITICAL: 휴지통으로 옮기지 않고 즉시 삭제한다. 복구 수단은 git이다.
  await removeFile(file);
  deleted.push(path.relative(projectRoot, file).split(path.sep).join('/'));

  if (query.get('withTranslation') === '1') {
    const siblingFile = await findPostFile(projectRoot, category, slug, otherLang(lang));
    if (siblingFile) {
      await assertInsideAllowedRoot(projectRoot, siblingFile);
      await removeFile(siblingFile);
      deleted.push(path.relative(projectRoot, siblingFile).split(path.sep).join('/'));
    }
  }

  return { deleted };
}

/**
 * 반대 언어 스텁 생성.
 *
 * CRITICAL: `slug`·`category`·`date`·`tags`·`paper`·`project`를 원문과 동일하게 복사한다.
 * `slug`가 갈리면 짝짓기가 깨진다.
 *
 * @param {{ params: Record<string, string>, projectRoot: string }} ctx
 */
export async function createTranslation({ params, projectRoot }) {
  const { category, slug, lang } = parsePostId(params.id);
  const file = await findPostFileById(projectRoot, params.id);
  if (!file) throw fail('E-NOT-FOUND', '원문 글을 찾을 수 없습니다.', { field: 'id' });

  const target = otherLang(lang);
  const existing = await findPostFile(projectRoot, category, slug, target);
  if (existing) {
    throw fail('E-DUPLICATE-SLUG', '이 언어의 번역본이 이미 있습니다.', {
      detail: { id: buildPostId(category, slug, target) },
    });
  }

  const source = await readPostFile(file);
  const nextFile = postFilePath(projectRoot, category, slug, target, NEW_POST_EXTENSION);
  await assertInsideAllowedRoot(projectRoot, nextFile);

  const frontmatter = {
    ...source.frontmatter,
    slug,
    category,
    // CRITICAL: 영어 번역본은 `lang: en`을 반드시 쓴다. 한국어 원문은 lang 키를 쓰지 않는다
    // (기본값이 ko이며 직렬화 규칙이 기본값을 생략한다).
    lang: target,
  };

  const notice = target === 'en' ? '> (translation needed)' : '> (번역 필요)';
  const body = `${notice}\n\n${source.body.trim()}`;

  await ensureDir(path.dirname(nextFile));
  const mtime = await writeTextAtomic(nextFile, composeFile(frontmatter, body));

  return {
    id: buildPostId(category, slug, target),
    path: path.relative(projectRoot, nextFile).split(path.sep).join('/'),
    lang: target,
    mtime,
  };
}

/**
 * 대시보드가 쓰는 최근 수정 목록.
 * @param {string} projectRoot
 * @param {any} server
 * @param {number} [limit]
 */
export async function recentPosts(projectRoot, server, limit = 5) {
  const validator = await getValidator(server);
  const files = await scanPostFiles(projectRoot);
  const items = await Promise.all(
    files.map((entry) => describePost(projectRoot, entry, validator)),
  );
  return items.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0)).slice(0, limit);
}
