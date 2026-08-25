# 05 — QA 리포트

실행일: 2026-08-21 · 대상: 클린 빌드 `dist/` (19 페이지, 2.0MB)

## 게이트

| 게이트 | 결과 |
|---|---|
| `astro check` | 0 errors / 0 warnings / 0 hints (53 파일) |
| `astro build` | 성공, 19 페이지, 3.4초 |
| `scripts/check-links.mjs` | 19개 파일 내부 링크 493건 — 깨진 링크 0건 |
| Pagefind 인덱스 | 3 fragment (published 글 3편만) |

## 통합 테스트 시나리오 10종

| # | 시나리오 | 결과 | 근거 |
|---|---|---|---|
| 1 | 홈 → 논문 리뷰 진입 | **부분** | 마크업·링크·메타 패널·`rel="noopener noreferrer"`·`aria-current`를 정적으로 확인. 실제 클릭 흐름과 sticky 시각 확인은 브라우저 필요 |
| 2 | 코드 수정 없이 카테고리 추가 | **통과** | `seminar` 추가 → 내비·`/seminar`·상세·아카이브·RSS·sitemap 전부 자동 생성, `metaPanel:'none'`이라 패널 미렌더, `src/pages/` 무수정. 검증 후 롤백 |
| 3 | 잘못된 프론트매터가 빌드를 실패시키는가 | **통과** | 6개 하위 케이스 전부 non-zero 종료 + 파일 경로·필드명·한국어 힌트 포함 (아래 표) |
| 4 | 다크 모드와 FOUC 부재 | **부분** | 테마 인라인 스크립트가 첫 스타일시트보다 앞(offset 1582 < 4127), 다크 토큰 재정의 3중 셀렉터, Shiki `shiki-dark` 변수 출력 확인. 실제 번쩍임·토글 순환은 브라우저 필요 |
| 5 | 모바일 내비와 반응형 | **부분** | 폴백 `<details>` 내비·포커스 트랩·Escape·스크롤 잠금 코드 확인, 히트 영역 44px CSS 확인. 375px 실측은 브라우저 필요 |
| 6 | 검색 동작과 빈 결과 | **통과(인덱스 범위)** | fragment 3개가 본문만 담고 헤더·푸터·내비·메타 패널을 담지 않음. draft 글은 인덱스에 없음. UI 동작은 `npm run preview` 후 브라우저 필요 |
| 7 | 수식·코드·목차 | **부분** | KaTeX 렌더 확인(`class="katex"` 3건, 원본 LaTeX는 `<annotation>` 안에만), `math:true` 글에만 CSS 링크(1 vs 0 vs 0). TOC active·복사 버튼·부드러운 스크롤은 브라우저 필요 |
| 8 | 페이지네이션·태그·아카이브 | **통과** | 15편 투입 시 1페이지 12장 / 2페이지 3장, "1 / 2" 인디케이터, 이전 `aria-disabled="true"`, `page/1` 미생성, 2페이지의 이전 링크가 `/paper-review`. 검증 후 임시 글 제거 |
| 9 | GitHub Pages 배포 | **미실행** | 워크플로·`.nojekyll`·권한·concurrency 작성 완료. 실제 배포는 리포지토리 생성과 Pages 설정 후 |
| 10 | 접근성·성능 | **부분** | 정적 a11y 감사 위반 0건, 대비 38조합 전부 AA 통과, 초기 JS 실측. Lighthouse·CLS·axe는 브라우저 필요 |

### 시나리오 3 상세

| 조작 | 종료 코드 | 메시지 |
|---|---|---|
| `paper` 블록 삭제 | 비정상 | `paper: category: "paper-review" 글에는 paper 블록이 필요합니다` |
| `category: unknown-category` | 비정상 | `category는 다음 중 하나여야 합니다: paper-review, project, notes` |
| `title` 삭제 | 비정상 | `title: Required` |
| `slug: my/nested/post` | 비정상 | `slug는 소문자·숫자·하이픈만 허용하며 슬래시를 포함할 수 없습니다` |
| `cover`만 두고 `coverAlt` 없음 | 비정상 | `cover를 지정했으면 coverAlt(스크린리더용 설명)가 필요합니다` |
| 전부 복원 | 0 | — |

## 접근성 정적 감사 (19개 HTML)

위반 0건. 검사 항목: 페이지당 h1 정확히 1개 · `html lang="ko"` · 랜드마크 4종(header / `main#main` / footer / `nav[aria-label="주요"]`) · 스킵 링크 · 모든 `img`에 `alt` · 아이콘 전용 버튼/링크에 `aria-label` · 헤딩 위계 건너뜀 없음 · `target="_blank"`에 `rel="noopener"` · 활성 내비에 `aria-current="page"`.

**수정한 결함 1건 (MAJOR):** `PostCard`가 제목을 h3로 고정해 목록 페이지에서 h1 → h3 건너뜀이 11개 페이지에서 발생했다. `headingLevel` prop(목록 2, 홈 3)을 추가해 해소.

## 대비 (WCAG AA 4.5:1)

라이트 20조합 · 다크 18조합 = 38조합 전부 통과. 계산기는 sRGB 상대휘도 기준이며 알파 배경은 실제 캔버스/카드 색과 합성해 측정했다.

**수정한 결함 4건 (MAJOR):** `02_design_tokens.md`의 "스펙과 달라진 값" 표 참조. 전부 `[local extension]` 토큰이었고 `[verified]` 값은 건드리지 않았다.

## 성능 실측

| 항목 | 기준 | 실측 |
|---|---|---|
| 홈 초기 JS | < 5KB gzip | 약 2.1KB (인라인 1.2KB + 외부 0.9KB) |
| 글 상세 초기 JS | < 8KB gzip | 약 3.0KB (인라인 2.1KB + 외부 0.9KB) |
| `dist` 총 용량 | < 15MB | 2.0MB |
| 빌드 시간 | < 60초 | 3.4초 (글 3편) |
| 모션 청크 | ≤ 12KB gzip | **14.9KB — 초과** |

## 미해결 결함

| 심각도 | 항목 | 내용 |
|---|---|---|
| MAJOR | 모션 예산 초과 | anime.js 청크 gzip 14.9KB (예산 12KB). `onScroll` 제거로 20.2 → 14.9KB까지 줄였으나 v4 엔진 하한이 약 15.9KB다. 12KB 이하는 anime.js를 쓰지 않아야만 가능. 초기 로드에는 포함되지 않고 리빌 대상에 스크롤이 닿을 때 받는다 |
| MINOR | 브라우저 실측 미완 | Lighthouse(라이트/다크), CLS, axe, 375px 가로 스크롤, 포커스 링 육안 확인, TOC active 추적, 코드 복사 동작. 이 환경에 브라우저 자동화 도구가 없어 실행하지 못했다. `npm run build && npm run preview` 후 수동 실행 필요 |
| MINOR | 배포 미검증 | 시나리오 9. 리포지토리 생성 · `astro.config.mjs`의 `site` 값 교체 · Pages Source를 "GitHub Actions"로 설정한 뒤 확인 필요 |
| INFO | 프로필 미기입 | `profile.ts`에 플레이스홀더 18개. 의도된 상태이며 빌드 경고 1줄로만 알린다 |

## 검증에 쓴 임시 자원 (전부 정리됨)

`seminar` 카테고리 + 글 1편, `pagination-probe-02~15` 14편, `draft-probe` 1편, `second-note` 1편, `.motion-probe/` 번들 측정 디렉터리.

---

## 부록 — 다국어(ko/en) 도입 후 재검증 (2026-08-21)

| 항목 | 결과 |
|---|---|
| `astro check` | 0 오류 / 0 경고 (77 파일) |
| 빌드 | 38페이지 (19 × 2언어) |
| 내부 링크 | 1022건 검사, 깨진 링크 0 |
| Pagefind | 38페이지 색인, `pagefind.ko_*` / `pagefind.en_*` 인덱스 분리 확인 |
| JS gzip | 모션 청크 14.9KB(무변경) · BaseLayout 1.1KB · SearchPanel 1.0KB — **언어 전환 추가분 0바이트** |
| hreflang | 전 페이지에 ko/en/x-default 상호 참조. 사이트맵에 `xhtml:link` alternate |
| canonical | 번역본 없는 `/en/` 페이지는 원문 URL을 가리킴 (중복 콘텐츠 방지) |
| 도메인 | `https://stu-eonho.github.io` 반영 확인 |

### 이 라운드에서 잡은 결함

| 심각도 | 증상 | 원인 | 조치 |
|---|---|---|---|
| BLOCKER | 한국어 글 페이지에 영어 본문이 실림. 빌드는 성공하고 페이지 수도 정상이라 로그로는 보이지 않음 | `glob` 로더 기본 `generateId`가 `x.en.md`와 `x.md`를 같은 id로 접어 한쪽이 덮임 | `content.config.ts`에 `generateId: ({ entry }) => entry.replace(/\.mdx?$/, '')` 명시 |
| MAJOR | `ListLayout` props가 `SeoInput`을 그대로 상속해 `lang` 필수가 됨 → 5개 뷰에서 타입 오류 | 레이아웃은 lang을 `Astro.url`에서 파생하는데 타입만 남아 있었음 | `Omit<SeoInput, 'lang'>`로 변경 |

### 미해결

없음.

### 배포 검증 (2026-08-21)

`stu-eonho.github.io`로 초기 push. Actions build 38초 / deploy 10초 통과.
`/`, `/en`, `/paper-review`, `/en/notes/intl-date-format`, `/en/rss.xml` 전부 200.
라이브에서 확인: ko 홈 `최근 글` + 토글 `English로 보기`, en 홈 `<html lang="en">` + `Recent posts` + 토글 `View in 한국어`.

`.gitattributes` 추가 — 작업은 Windows, 빌드는 Ubuntu 러너다. CRLF가 리포에 섞이면 diff가 파일 전체로 부풀고 셸 스크립트가 깨진다.

### 브라우저 확인

- **375px 헤더 액션 4종(검색·언어·테마·메뉴) — 사용자 실측 완료, 이상 없음.**
  400px 이하 `gap: 0`으로 4 × 44px = 176px + 브랜드가 들어간다.

### 미실행

- Lighthouse 재측정 (다국어 도입 전 수치만 있다).
