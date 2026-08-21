# 01 — 구조 코어 계약

이 파일은 다른 모듈이 의존하는 경계면을 고정한다. 여기 있는 시그니처가 바뀌면 소비자 전원에게 통지해야 한다.

> **2026-08-21 — 다국어(ko/en) 도입으로 아래 시그니처 상당수가 바뀌었다.**
> 변경분과 새 계약은 `06_i18n_contract.md`에 있다. 두 문서가 어긋나면 06이 최신이다.
> 주요 변경: `site.locale` 제거 · `categories.description`이 `Localized` · profile 텍스트 필드가
> `MaybeLocalized` · posts/tags/date/seo 헬퍼가 `lang`을 받는다 · 라우트가 `src/pages/en/**`로 미러링.

## 설정 파일

### `src/config/categories.ts` — 카테고리 단일 진실 공급원
```ts
interface Category { id; label; labelKo; description; icon; order; metaPanel: 'paper'|'project'|'none' }
export const CATEGORIES          // as const satisfies readonly Category[]
export type CategoryId           // (typeof CATEGORIES)[number]['id']
export const CATEGORY_IDS        // Zod z.enum()에 그대로 넘길 튜플
export const SORTED_CATEGORIES   // order 오름차순
export function getCategory(id: string): Category   // 없는 id면 throw (빌드 실패)
export function isCategoryId(id: string): id is CategoryId
```
파생 흐름: `CATEGORIES` → `CategoryId` → `CATEGORY_IDS` → Zod enum → `getStaticPaths` → 내비 항목.
**카테고리 추가는 이 배열 + `src/content/posts/<id>/` 폴더로 끝난다. `src/pages/`를 만지지 않는다.**

### `src/config/site.ts`
`SITE: SiteConfig` (title / description / url / base / locale / navOrder / postsPerPage / recentPostsOnHome / rssItemLimit / defaultOgImage), `GOATCOUNTER_CODE: string`.
`navOrder`는 `SORTED_CATEGORIES`에서 파생되며 예약어 `'archive'`가 뒤에 붙는다.

### `src/config/profile.ts`
`PROFILE: Profile`, `PROFILE_PHOTO: ImageMetadata | null`, `isPlaceholder(v): boolean`, `collectPlaceholderFields(): string[]`.
타입: `Degree`, `EducationEntry`, `Employment`, `CareerEntry`, `SkillGroup`, `SocialType`, `SocialLink`, `Profile`.
`Profile.career: CareerEntry[]`는 2026-08-21 추가분이다 — 홈이 CV 형식이 되면서 학적과 나란히 놓인다.
사진은 `import.meta.glob('../assets/profile.{jpg,jpeg,png,webp}')`로 잡는다 — 사용자가 파일만 넣으면 되고 코드를 편집할 필요가 없다.

## 콘텐츠 스키마 — `src/content.config.ts`

`posts` 컬렉션. loader glob 패턴 `['**/*.{md,mdx}', '!**/_*']`, base `./src/content/posts`.
`superRefine`이 강제하는 것:
- `metaPanel === 'paper'` → `paper` 블록 필수
- `metaPanel === 'project'` → `project` 블록 필수
- `cover` 있으면 `coverAlt` 필수

zod는 `astro/zod`에서 import 한다 (`astro:content`의 `z` 재export는 deprecated). URL 필드는 `z.url()` (`z.string().url()`은 deprecated).

## lib 시그니처

| 모듈 | export |
|---|---|
| `lib/posts.ts` | `Post`, `getPublishedPosts()`, `sortByDate()`, `filterByCategory()`, `postHref()`, `categoryHref(id, page?)`, `pageCount()`, `paginate(): PageSlice<Post>`, `getSiblings(): Siblings`, `groupByYear(): YearGroup[]` |
| `lib/tags.ts` | `Tag`, `slugifyTag()`, `collectTags()`, `tagSizeStep(): 1\|2\|3`, `tagHref()` |
| `lib/date.ts` | `formatLong()`, `formatMonthDay()`, `formatYearMonth()`, `formatYearMonthString()`, `toISODate()`, `getYear()` |
| `lib/reading-time.ts` | `estimateReadingTime(body?: string): number` (한글 500자/분 + 영문 200단어/분) |
| `lib/seo.ts` | `buildSeo(SeoInput): SeoMeta`, `personJsonLd()`, `articleJsonLd()`, `arxivUrl()`, `doiUrl()` |

## 라우트

| 파일 | 경로 | getStaticPaths 출처 |
|---|---|---|
| `pages/index.astro` | `/` | — |
| `pages/[category]/index.astro` | `/:category` | `CATEGORIES` |
| `pages/[category]/page/[page].astro` | `/:category/page/:n` (n ≥ 2) | `CATEGORIES` × `pageCount` |
| `pages/[category]/[slug].astro` | `/:category/:slug` | `getPublishedPosts()` |
| `pages/archive.astro` | `/archive` | — |
| `pages/tags/index.astro` | `/tags` | — |
| `pages/tags/[tag].astro` | `/tags/:tag` | `collectTags()` |
| `pages/search.astro` | `/search` | — |
| `pages/404.astro` | `/404` | — |
| `pages/rss.xml.ts` | `/rss.xml` | `getPublishedPosts()` (최대 50건) |

`[slug]`는 **단일 세그먼트**다. `page/1`은 생성하지 않는다.

## 레이아웃 props

```ts
BaseLayout: SeoInput & { katex?: boolean; jsonLd?: string; bodyClass?: string }
  SeoInput = { path: string; title?; description?; ogImage?; type?: 'website'|'article';
               publishedTime?: Date; modifiedTime?: Date; tags?: string[] }
ListLayout: SeoInput
PostLayout: { post: Post; headings: MarkdownHeading[]; readingTime: number; siblings: Siblings }
```

## 빌드 설정 고정값

- `output: 'static'`, `trailingSlash: 'ignore'`, `base`는 미설정(사용자 사이트)
- `markdown.processor: unified({ remarkPlugins: [remarkMath], rehypePlugins: [[rehypeKatex, {strict:false}]] })`
  — Astro 7에서 `markdown.remarkPlugins` 직접 지정은 deprecated
- `shikiConfig.themes = { light: 'github-light', dark: 'github-dark' }`
- `npm run build` = `astro check && astro build`
