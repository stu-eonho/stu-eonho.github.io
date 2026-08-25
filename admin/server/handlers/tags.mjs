// @ts-check
/**
 * 태그 사용 현황과 일괄 수정.
 *
 * CRITICAL: 태그 정규화는 `src/lib/tags.ts`의 `slugifyTag()`를 그대로 쓴다. 관리자에서
 * 소문자화 로직을 다시 쓰면 사이트가 접는 태그와 관리자가 접는 태그가 갈린다.
 *
 * CRITICAL: 어떤 동작이든 `dryRun`으로 영향 파일 목록을 먼저 돌려주고, 확인된 요청에서만
 * 실제로 쓴다.
 *
 * CRITICAL: 실패 격리 — 파일 N개 중 하나가 실패해도 나머지는 이미 쓰였다.
 * `{ succeeded[], failed[] }`를 모두 담고 "전부 성공"으로 뭉뚱그리지 않는다.
 */
import path from 'node:path';
import { fail } from '../errors.mjs';
import { writeTextAtomic } from '../fsx.mjs';
import { assertInsideAllowedRoot } from '../paths.mjs';
import { loadTagLib } from '../project.mjs';
import { composeFile } from '../codegen/frontmatter.mjs';
import { idFromParts, readPostFile, scanPostFiles } from '../content.mjs';

const MAX_TAG_LENGTH = 24;

/** @param {any} server */
async function getSlugify(server) {
  const mod = await loadTagLib(server);
  return mod.slugifyTag;
}

/**
 * 모든 글의 태그를 읽는다.
 * @param {string} projectRoot
 *
 * @param {(raw: string) => string} slugifyTag
 */
async function collectTagUsage(projectRoot, slugifyTag) {
  const files = await scanPostFiles(projectRoot);

  /** @type {Map<string, { slug: string, variants: Map<string, number>, posts: { id: string, title: string, lang: string, file: string }[] }>} */
  const map = new Map();

  for (const entry of files) {
    const { frontmatter } = await readPostFile(entry.file);
    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
    for (const raw of tags) {
      if (typeof raw !== 'string') continue;
      const slug = slugifyTag(raw);
      if (!slug) continue;
      const bucket = map.get(slug) ?? {
        slug,
        variants: /** @type {Map<string, number>} */ (new Map()),
        posts: /** @type {{ id: string, title: string, lang: string, file: string }[]} */ ([]),
      };
      bucket.variants.set(raw, (bucket.variants.get(raw) ?? 0) + 1);
      bucket.posts.push({
        id: idFromParts(entry.category, entry.base),
        title: frontmatter.title ?? '(제목 없음)',
        lang: entry.base.endsWith('.en') ? 'en' : 'ko',
        file: entry.file,
      });
      map.set(slug, bucket);
    }
  }

  return map;
}

/** @param {{ projectRoot: string, server: any }} ctx */
export async function listTags({ projectRoot, server }) {
  const slugifyTag = await getSlugify(server);
  const map = await collectTagUsage(projectRoot, slugifyTag);

  const tags = [...map.values()]
    .map((bucket) => {
      const variants = [...bucket.variants.entries()]
        .map(([raw, count]) => ({ raw, count }))
        .sort((a, b) => b.count - a.count || a.raw.localeCompare(b.raw));
      return {
        slug: bucket.slug,
        // 가장 많이 쓰인 표기를 대표로 둔다. "정규화"는 이 값으로 병합한다.
        label: variants[0]?.raw ?? bucket.slug,
        variants,
        total: bucket.posts.length,
        posts: bucket.posts.map(({ id, title, lang }) => ({ id, title, lang })),
      };
    })
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

  return { tags };
}

/**
 * 태그 배열 변환을 전 글에 적용한다.
 *
 * @param {string} projectRoot
 * @param {(tags: string[]) => string[]} transform
 * @param {boolean} dryRun
 */
async function applyToPosts(projectRoot, transform, dryRun) {
  const files = await scanPostFiles(projectRoot);

  /** @type {{ id: string, path: string, before: string[], after: string[] }[]} */
  const affected = [];
  /** @type {{ id: string, message: string }[]} */
  const failed = [];
  /** @type {string[]} */
  const succeeded = [];

  for (const entry of files) {
    const id = idFromParts(entry.category, entry.base);
    const relative = path.relative(projectRoot, entry.file).split(path.sep).join('/');

    let record;
    try {
      record = await readPostFile(entry.file);
    } catch (error) {
      failed.push({ id, message: `파일을 읽지 못했습니다: ${String(error)}` });
      continue;
    }

    const before = Array.isArray(record.frontmatter.tags)
      ? record.frontmatter.tags.filter((/** @type {any} */ t) => typeof t === 'string')
      : [];
    const after = transform(before);

    if (before.length === after.length && before.every((tag, index) => tag === after[index])) {
      continue;
    }

    affected.push({ id, path: relative, before, after });
    if (dryRun) continue;

    try {
      await assertInsideAllowedRoot(projectRoot, entry.file);
      const frontmatter = { ...record.frontmatter, tags: after };
      // 결과적으로 빈 배열이면 직렬화 규칙이 키째로 생략한다(기본값이 []이므로).
      await writeTextAtomic(entry.file, composeFile(frontmatter, record.body));
      succeeded.push(id);
    } catch (error) {
      const message = /** @type {any} */ (error)?.message ?? String(error);
      failed.push({ id, message });
    }
  }

  return { affected, succeeded, failed, dryRun };
}

/**
 * `from`이 원문 표기이거나 슬러그일 수 있다. 둘 다 받는다.
 * @param {string} from
 * @param {(raw: string) => string} slugifyTag
 * @returns {(tag: string) => boolean}
 */
function matcher(from, slugifyTag) {
  const fromSlug = slugifyTag(from);
  return (/** @type {string} */ tag) => tag === from || slugifyTag(tag) === fromSlug;
}

/** @param {unknown} tag */
function assertTagLength(tag) {
  if (typeof tag !== 'string' || tag.trim() === '') {
    throw fail('E-VALIDATION', '태그를 비울 수 없습니다.', { field: 'to' });
  }
  if (tag.length > MAX_TAG_LENGTH) {
    throw fail('E-TAG-TOO-LONG', '태그는 항목당 24자 이내여야 합니다', { field: 'to' });
  }
}

/**
 * 중복을 제거하되 원래 순서를 유지한다.
 * @param {string[]} tags
 * @returns {string[]}
 */
function dedupe(tags) {
  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (const tag of tags) {
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/** @param {{ body: any, projectRoot: string, server: any }} ctx */
export async function renameTag({ body, projectRoot, server }) {
  const from = String(body.from ?? '');
  const to = String(body.to ?? '');
  assertTagLength(to);

  const slugifyTag = await getSlugify(server);
  const matches = matcher(from, slugifyTag);

  return applyToPosts(
    projectRoot,
    (tags) => dedupe(tags.map((tag) => (matches(tag) ? to : tag))),
    body.dryRun !== false,
  );
}

/** @param {{ body: any, projectRoot: string, server: any }} ctx */
export async function mergeTags({ body, projectRoot, server }) {
  const sources = Array.isArray(body.sources) ? body.sources.map(String) : [];
  const target = String(body.target ?? '');
  assertTagLength(target);
  if (sources.length === 0) {
    throw fail('E-VALIDATION', '병합할 태그를 하나 이상 고르세요.', { field: 'sources' });
  }

  const slugifyTag = await getSlugify(server);
  const matchers = sources.map((/** @type {string} */ source) => matcher(source, slugifyTag));

  return applyToPosts(
    projectRoot,
    (tags) =>
      dedupe(
        tags.map((tag) =>
          matchers.some((/** @type {(t: string) => boolean} */ m) => m(tag)) ? target : tag,
        ),
      ),
    body.dryRun !== false,
  );
}

/** @param {{ body: any, projectRoot: string, server: any }} ctx */
export async function deleteTag({ body, projectRoot, server }) {
  const tag = String(body.tag ?? '');
  if (tag === '') {
    throw fail('E-VALIDATION', '삭제할 태그를 지정하세요.', { field: 'tag' });
  }

  const slugifyTag = await getSlugify(server);
  const matches = matcher(tag, slugifyTag);

  return applyToPosts(
    projectRoot,
    (tags) => tags.filter((item) => !matches(item)),
    body.dryRun !== false,
  );
}
