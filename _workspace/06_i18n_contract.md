# 06 — 다국어(ko/en) 계약

2026-08-21 추가. 사용자 요청: 해외 포트폴리오로 쓸 수 있게 한국어/영어를 껐다 켤 수 있게 할 것.
전환 UI는 헤더 우측, 검색·다크모드 토글 옆.

## 확정된 해석

| 결정 | 값 | 이유 |
|---|---|---|
| 전환 방식 | **URL 분리** (`/` = ko, `/en/` = en) | 클라이언트 토글은 검색엔진이 영어 페이지를 못 본다. 포트폴리오 목적에서 그건 기능 없음과 같다 |
| 전환 UI | `<a>` 링크 1개, JS 0바이트 | 스펙의 "JS 0바이트 기본값" 유지. 깜빡임 없음, JS 꺼도 동작 |
| 번역 범위 | UI + 프로필 = 완전 이중언어 / 글 본문 = 번역본 있으면 영어, 없으면 원문 + 배너 | 번역 강제는 글 3편을 지금 번역해야 하고 앞으로 글마다 두 번 써야 한다 |

## 단일 진실 공급원 — `src/config/i18n.ts`

```ts
export const LOCALES = ['ko', 'en'] as const;
export type Lang = (typeof LOCALES)[number];
export const LANG_IDS: [Lang, ...Lang[]];   // Zod z.enum()용
export const DEFAULT_LANG: Lang = 'ko';     // 접두사 없는 언어
export const LANG_META: Record<Lang, LangMeta>;  // htmlLang/intlLocale/ogLocale/rssLanguage/code/nativeName

export type Localized<T = string> = { readonly [K in Lang]: T };
export type MaybeLocalized<T = string> = T | Localized<T>;
export function text(value: MaybeLocalized | undefined, lang: Lang): string | undefined;
export function textList(values: readonly MaybeLocalized[], lang: Lang): string[];

export function langFromPath(pathname: string): Lang;
export function stripLang(pathname: string): string;   // '/en/archive' → '/archive'
export function withLang(path: string, lang: Lang): string;
export function alternatePath(pathname: string, lang: Lang): string;
export function otherLang(lang: Lang): Lang;

export type UIStrings = typeof ko;          // en은 이 타입을 만족해야 한다
export function t(lang: Lang): UIStrings;
export function i18n(url: URL): { lang; t; href; meta };   // 컴포넌트 진입점
```

**번역 누락을 막는 유일한 자동 장치는 `const en: UIStrings`다.** 한쪽 사전에만 키를 추가하면
`astro check`가 실패한다.

## 언어를 컴포넌트에 전달하는 방법

**props로 나르지 않는다.** 모든 `.astro`가 `Astro.url`을 갖고 있으므로 각자 파생한다.

```ts
const { lang, t, href } = i18n(Astro.url);
```

이 결정이 `lang` prop을 20개 넘는 컴포넌트에 꿰는 작업을 없앴다. `.ts` 헬퍼(date/posts/tags/seo)만
lang을 인자로 받는다 — 거기엔 `Astro.url`이 없다.

## 변경된 시그니처 (01_architect_contracts.md 갱신분)

| 모듈 | 변경 |
|---|---|
| `config/site.ts` | `description: Localized<string>`. **`locale` 제거** — 사이트가 2개 언어로 빌드되므로 "사이트의 로케일" 하나가 성립하지 않는다 |
| `config/categories.ts` | `description: Localized<string>`. `categoryName(c, lang)`, `categorySubtitle(c, lang)` 추가. `label`/`labelKo`는 유지 |
| `config/profile.ts` | 텍스트 필드 전부 `MaybeLocalized`. 고유명사는 문자열 하나로 둘 수 있다 |
| `content.config.ts` | `lang: z.enum(LANG_IDS).default('ko')` 추가. **`generateId` 지정** (아래 참조) |
| `lib/posts.ts` | `postsForLang(posts, lang)`, `isFallback(post, lang)` 신규. `postHref(post, lang)`, `categoryHref(id, lang, page?)`, `paginate(posts, current, categoryId, lang, perPage?)` |
| `lib/tags.ts` | `tagHref(slug, lang)` |
| `lib/date.ts` | 전 포맷 함수가 `lang`을 받는다. (언어 × 스타일) 포맷터 캐시 |
| `lib/seo.ts` | `SeoInput`에 `lang` 필수 + `canonicalLang?` 추가. `SeoMeta`에 `alternates`/`ogLocale`/`htmlLang`. `personJsonLd(lang)`, `articleJsonLd({..., lang, contentLang})` |
| `lib/feed.ts` | **신규** — `buildFeed(context, lang)` |
| `BaseLayout` / `ListLayout` | Props가 `Omit<SeoInput, 'lang'>`. lang은 Astro.url에서 파생. **`path`는 언어 접두사 없는 정규 경로** |

## 라우트

`src/pages/en/**`가 한국어 라우트를 1:1 미러한다. 두 벌 모두 `src/components/views/*`의
뷰 컴포넌트 하나를 부르는 얇은 파일이다 — 마크업이 중복되지 않는다.

| 뷰 | 쓰는 페이지 |
|---|---|
| `views/HomeView.astro` | `/`, `/en` |
| `views/ArchiveView.astro` | `/archive`, `/en/archive` |
| `views/TagsIndexView.astro` | `/tags`, `/en/tags` |
| `views/TagDetailView.astro` | `/tags/:tag`, `/en/tags/:tag` |
| `views/SearchView.astro` | `/search`, `/en/search` |
| `views/NotFoundView.astro` | `/404`, `/en/404` |
| `views/CategoryPageView.astro` | `/:category`, `/:category/page/:n` 및 각 `/en/` 짝 |
| `views/PostDetailView.astro` | `/:category/:slug`, `/en/:category/:slug` |

**A2(카테고리 = 데이터)는 유지된다.** 카테고리 추가는 여전히 `categories.ts` + 폴더로 끝난다.
`src/pages/en/[category]/`가 한국어 쪽과 동일하게 `CATEGORIES`에서 경로를 파생한다.

**언어 추가**는 `LOCALES`+`LANG_META`+`UI` 항목 추가 후 `src/pages/en/`을 복사한 폴더 하나.

## 번역본 묶기 규칙

같은 `category` + `slug` = 같은 글의 번역본 묶음. 파일명은 `<slug>.en.mdx`.

```
notes/intl-date-format.md      slug: intl-date-format, lang 생략 → ko
notes/intl-date-format.en.md   slug: intl-date-format, lang: en
```

- `postsForLang(all, lang)`이 묶음에서 해당 언어를 고르고, 없으면 `DEFAULT_LANG`으로 떨어진다
- 같은 묶음에 같은 `lang`이 둘이면 **빌드 실패** (어느 쪽이 이길지 알 수 없는 배포를 막는다)
- 목록·아카이브·태그·RSS·경로 생성이 **전부** 이 함수를 거친다. 건너뛰면 같은 글이 두 번 나온다

### 함정 — `glob` 로더의 기본 `generateId`

기본 id 생성기는 `intl-date-format.en.md`와 `intl-date-format.md`를 **같은 id로 접는다**
(디렉터리와 중간 확장자가 함께 사라진다). 그러면 번역본 한쪽이 조용히 다른 쪽을 덮어써
원문이 통째로 사라진다 — **빌드는 성공하고 페이지 수도 그대로**라 알아채기 어렵다.
초기 구현에서 실제로 이 증상이 나왔다(한국어 글 페이지에 영어 본문이 실림).

```ts
generateId: ({ entry }) => entry.replace(/\.mdx?$/, ''),
```

## SEO

| 항목 | 처리 |
|---|---|
| `<html lang>` | 화면 언어 |
| `.article-body`의 `lang` | **본문이 실제로 쓰인 언어.** 폴백 중이면 화면 언어와 다르다 (스크린리더 발음) |
| hreflang | 전 로케일 + `x-default`. `buildSeo`가 한 번에 만들어 상호 참조를 구조적으로 보장 |
| canonical | 자기 자신. **단, 폴백 페이지는 원문 언어 URL** (중복 콘텐츠 방지) |
| sitemap | `@astrojs/sitemap`의 `i18n` 옵션이 `xhtml:link` alternate를 붙인다 |
| RSS | `/rss.xml`(ko) + `/en/rss.xml`(en). 각자 `<language>`와 `<atom:link rel="self">` |
| Pagefind | `<html lang>`을 보고 언어별 인덱스를 자동 분리 (`pagefind.ko_*`, `pagefind.en_*`) |

## 클라이언트 스크립트의 문구

**스크립트에 사전을 두지 않는다.** 서버가 현재 언어로 렌더한 `data-*` 속성에서 읽는다.
사전을 import 하면 두 언어 문자열이 모두 번들에 실리고, 잘못된 언어가 나갈 여지도 생긴다.

| 스크립트 | 읽는 곳 |
|---|---|
| ThemeToggle | `#theme-toggle`의 `data-label-system/light/dark` |
| MobileNavSheet | `#mobile-nav-trigger`의 `data-label-open/close` |
| SearchPanel | `.search-panel`의 `data-msg-*` (복수형은 `{n}`, 검색어는 `{term}` 자리표시자) |
| PostLayout | `.article-body`의 `data-copy/copied/copy-failed/copy-label/anchor-label` |
| shortcuts.ts | 사전 없이 `location.pathname`의 첫 세그먼트만 본다 |

## 실측 (2026-08-21)

- `astro check` 0 오류 / 0 경고 (77 파일)
- 빌드 38페이지 (19 × 2언어), Pagefind 38페이지 색인, ko/en 인덱스 분리 확인
- 내부 링크 1022건 검사 — 깨진 링크 0
- JS gzip: 모션 청크 14.9KB(무변경), BaseLayout 엔트리 1.1KB, SearchPanel 1.0KB
  → **언어 전환이 추가한 JS는 0바이트**
