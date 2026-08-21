/**
 * 글 조회·정렬·페이지네이션 헬퍼.
 * CRITICAL: 전부 빌드 타임 배열 연산이다. 런타임 데이터 접근이 없다.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { SITE } from '@/config/site';
import { DEFAULT_LANG, LANG_META, withLang, type Lang } from '@/config/i18n';

export type Post = CollectionEntry<'posts'>;

/**
 * 정렬 비교에 쓰는 고정 로케일.
 * 언어별로 바꾸지 않는다 — 같은 글 목록이 언어에 따라 다른 순서로 나오면
 * 언어 토글을 눌렀을 때 화면이 재배열되어 보인다.
 */
const COLLATION = LANG_META[DEFAULT_LANG].intlLocale;

/**
 * 게시 대상 글 전체. date 내림차순, 동일 날짜면 title 오름차순(안정 정렬).
 * CRITICAL: 프로덕션 빌드에서 draft 글은 여기서 제외되며, 이 함수를 거치지 않는
 * 목록·경로 생성 지점을 만들지 않는다. dev에서만 draft가 보인다.
 */
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) =>
    import.meta.env.DEV ? true : data.draft !== true,
  );
  return sortByDate(posts);
}

/** date 내림차순, 동일 날짜면 title 오름차순 */
export function sortByDate(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => {
    const diff = b.data.date.getTime() - a.data.date.getTime();
    if (diff !== 0) return diff;
    return a.data.title.localeCompare(b.data.title, COLLATION);
  });
}

export function filterByCategory(posts: Post[], categoryId: string): Post[] {
  return posts.filter((post) => post.data.category === categoryId);
}

/** `category/slug` — 언어가 다른 번역본끼리 묶는 키. */
function translationKey(post: Post): string {
  return `${post.data.category}/${post.data.slug}`;
}

/**
 * 한 언어의 화면에 실제로 실릴 글 목록.
 *
 * 같은 `category` + `slug`를 가진 파일들을 번역본 한 묶음으로 보고, 요청한 언어의 것을
 * 고른다. 없으면 기본 언어의 원문으로 떨어진다 — 번역이 없다고 글이 목록에서 사라지면
 * 영어 사이트가 텅 비어 보이고, 그건 번역이 없는 것보다 나쁘다.
 *
 * CRITICAL: 목록·아카이브·태그·RSS·경로 생성이 전부 이 함수를 거친다. 이걸 건너뛰고
 * `getPublishedPosts()`를 그대로 쓰면 같은 글이 언어별로 두 번 나온다.
 */
export function postsForLang(posts: Post[], lang: Lang): Post[] {
  const groups = new Map<string, Partial<Record<Lang, Post>>>();

  for (const post of posts) {
    const key = translationKey(post);
    const group = groups.get(key) ?? {};
    const existing = group[post.data.lang];
    if (existing) {
      // 같은 언어의 같은 slug가 둘이면 어느 쪽이 이길지 알 수 없다 — 조용히 넘기지 않는다.
      throw new Error(
        `[posts] 같은 언어의 글이 중복됩니다: ${key} (lang: ${post.data.lang}) — "${existing.id}", "${post.id}"`,
      );
    }
    group[post.data.lang] = post;
    groups.set(key, group);
  }

  const picked: Post[] = [];
  for (const group of groups.values()) {
    const chosen = group[lang] ?? group[DEFAULT_LANG] ?? Object.values(group)[0];
    if (chosen) picked.push(chosen);
  }
  return sortByDate(picked);
}

/** 이 글이 요청한 언어의 번역본이 아니라 폴백으로 실린 것인가. */
export function isFallback(post: Post, lang: Lang): boolean {
  return post.data.lang !== lang;
}

/** 글 상세 URL. 내부 링크는 후행 슬래시 없이 통일한다. */
export function postHref(post: Post, lang: Lang): string {
  return withLang(`/${post.data.category}/${post.data.slug}`, lang);
}

/** 카테고리 목록 URL. CRITICAL: 1페이지는 `page/1`이 아니라 `/{category}`다. */
export function categoryHref(categoryId: string, lang: Lang, page = 1): string {
  return withLang(page <= 1 ? `/${categoryId}` : `/${categoryId}/page/${page}`, lang);
}

export interface PageSlice<T> {
  items: T[];
  current: number;
  total: number;
  prevUrl: string | null;
  nextUrl: string | null;
}

export function pageCount(totalItems: number, perPage: number = SITE.postsPerPage): number {
  return Math.max(1, Math.ceil(totalItems / perPage));
}

/** 1-based 페이지 슬라이스. */
export function paginate(
  posts: Post[],
  current: number,
  categoryId: string,
  lang: Lang,
  perPage: number = SITE.postsPerPage,
): PageSlice<Post> {
  const total = pageCount(posts.length, perPage);
  const page = Math.min(Math.max(current, 1), total);
  const start = (page - 1) * perPage;
  return {
    items: posts.slice(start, start + perPage),
    current: page,
    total,
    prevUrl: page > 1 ? categoryHref(categoryId, lang, page - 1) : null,
    nextUrl: page < total ? categoryHref(categoryId, lang, page + 1) : null,
  };
}

export interface Siblings {
  prev: Post | null;
  next: Post | null;
}

/**
 * 같은 카테고리 내 인접 글.
 * 목록이 date 내림차순이므로 "이전 글"은 배열의 뒤쪽(더 오래된 글)이다.
 */
export function getSiblings(post: Post, allPosts: Post[]): Siblings {
  const sameCategory = filterByCategory(allPosts, post.data.category);
  const index = sameCategory.findIndex((p) => p.id === post.id);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: sameCategory[index + 1] ?? null,
    next: sameCategory[index - 1] ?? null,
  };
}

export interface YearGroup {
  year: number;
  posts: Post[];
}

/** 아카이브용 연도 그룹. 최신 연도가 앞, 각 그룹 내부는 date 내림차순. */
export function groupByYear(posts: Post[]): YearGroup[] {
  const map = new Map<number, Post[]>();
  for (const post of sortByDate(posts)) {
    const year = post.data.date.getFullYear();
    const bucket = map.get(year);
    if (bucket) bucket.push(post);
    else map.set(year, [post]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, grouped]) => ({ year, posts: grouped }));
}
