# 03 — 화면 인벤토리

## 페이지

| 경로 | 파일 | h1 | 특이사항 |
|---|---|---|---|
| `/` | `pages/index.astro` | 프로필 이름 | CV 카드 + 최근 글 두 덩어리. Person JSON-LD, 미기입 경고 출력 지점 |
| `/:category` | `pages/[category]/index.astro` | 카테고리 label | 1페이지 |
| `/:category/page/:n` | `pages/[category]/page/[page].astro` | `label — n페이지` | n ≥ 2만 생성 |
| `/:category/:slug` | `pages/[category]/[slug].astro` | 글 제목 | Article JSON-LD, KaTeX 조건부 |
| `/archive` | `pages/archive.astro` | Archive | 연도 그룹, 카드가 아닌 행 목록 |
| `/tags` | `pages/tags/index.astro` | Tags | count 3단계 글자 크기 |
| `/tags/:tag` | `pages/tags/[tag].astro` | `#label` | 페이지네이션 없음 |
| `/search` | `pages/search.astro` | Search | Pagefind, 첫 입력 시 동적 import |
| `/404` | `pages/404.astro` | 404 | GitHub Pages 자동 서빙 |
| `/rss.xml` | `pages/rss.xml.ts` | — | 최대 50건 |

## 컴포넌트 트리

```
BaseLayout
├── head: SEO 메타 · CSP · 테마 인라인 스크립트(최우선) · 조건부 KaTeX · 조건부 GoatCounter · JSON-LD
├── skip-link  (첫 번째 포커스 대상)
├── SiteHeader ── NavLink × n · ThemeToggle · 검색 아이콘 · 햄버거
│   └── MobileNavSheet (+ details 폴백 내비)
├── main#main ── <slot />
└── SiteFooter (소셜 · RSS · 저작권 · Astro/Pages · 조건부 GoatCounter 고지)
```

- 홈: `ProfileCard`(신원 → bio → `EducationList` → `CareerList` → `SkillGroups` → `InterestList`) → `RecentPosts`
  - `EducationList`와 `CareerList`는 `TimelineList`를 공유한다
  - CV 소제목은 페이지 레벨 40px가 아니라 `.cv-heading`(20px)을 쓴다 — 카드 하나로 읽히게 하기 위해서다
- 목록: `ListLayout` → `ListHeader` → `card-grid`(PostCard) → `Pagination` | `EmptyState`
- 상세: `PostLayout` → `PostMetaHeader` → (`PaperMetaPanel` | `ProjectMetaPanel`) → `TableOfContents`(mobile) → `article[data-pagefind-body]` → `PrevNextNav`

## 헤딩 위계

- 홈: h1 이름 → h2 섹션(학적/경력/스킬/관심 분야/최근 글) → h3 카드 제목
- 목록: h1 페이지 제목 → h2 카드 제목
- 상세: h1 글 제목 → h2 본문 섹션 → h3 하위 섹션
- 아카이브: h1 Archive → h2 연도

`PostCard`의 `headingLevel` prop(2 기본, 홈에서 3)이 이 위계를 유지한다.

## 클라이언트 스크립트 목록 (전부 필요 최소)

| 위치 | 하는 일 | JS 없을 때 |
|---|---|---|
| BaseLayout head (인라인) | `localStorage.theme` → `data-theme` | `prefers-color-scheme`만 따름 |
| BaseLayout | `initMotion()` + `initShortcuts()` | 콘텐츠는 최종 상태로 보임 |
| SiteHeader | 햄버거 노출 / 폴백 내비 숨김 | 폴백 `<details>` 내비가 보임 |
| ThemeToggle | 3상태 순환 + `matchMedia` 추종 | 토글 버튼 자체가 렌더링되지 않음 |
| MobileNavSheet | 열고 닫기 · 포커스 트랩 · Escape · 스크롤 잠금 | 폴백 내비 사용 |
| TableOfContents | IntersectionObserver active 하이라이트 | 목차 링크는 그대로 동작 |
| PostLayout | 헤딩 앵커 · 코드 복사 · 표 스크롤 래핑 · 외부 링크 rel | 본문은 그대로 읽힘 |
| SearchPanel | Pagefind 로드 · 디바운스 · 결과 렌더 | `<noscript>` 안내 + 아카이브 링크 |

## 비어 있을 때의 동작 (`graceful_omission`)

`email` / `links` / `cvUrl` / `education` / `career` / `skillGroups` / `interests` / 사진 — 각각 해당 요소 또는 섹션 전체가 사라진다. 네 섹션이 모두 비면 CV 본문 블록 자체를 내지 않는다(구분선만 남은 빈 영역 방지).

플레이스홀더 URL(`<...>`)은 링크로 만들지 않는다. 반면 플레이스홀더 **텍스트**는 화면에 그대로 노출한다 — 무엇을 채워야 하는지 보이는 편이 낫고, 사용자가 지우면 그때 사라진다.

## 의도적으로 두지 않은 것

글 상세는 `PrevNextNav`에서 끝난다. 댓글 영역·자리표시자·주석 처리된 댓글 코드·구독 폼·공유 버튼이 없다.
