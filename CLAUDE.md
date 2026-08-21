# CLAUDE.md

## 하네스: Study Log 블로그 구축 (Astro 7 정적 사이트 + 잔잔한 모션)

**목표:** `STUDY_LOG_SPEC.md`와 `DESIGN.md`를 근거로 개인 연구·학습 기록 블로그를 구축하고, anime.js v4로 과하지 않은 진입 모션을 입힌다.

**트리거:** 이 블로그의 구현·수정·검증 관련 요청 시 `study-log-build` 스킬을 사용하라. 초기 구축과 후속 작업(부분 수정, 재실행, 모션 조정) 모두 이 스킬을 거친다. 스펙 내용 확인이나 파일 위치 문의 같은 단순 질문은 직접 응답 가능.

**참조 전용 파일:** `DESIGN.md`는 수정하지 않는다. 토큰을 바꿔야 하면 `src/styles/global.css`에 `[local extension]` 주석과 함께 확장 토큰을 추가한다.

**다국어:** 사이트는 한국어(`/`)와 영어(`/en/`) 두 벌로 빌드된다. 화면 문자열을 컴포넌트에 직접 쓰지 않는다 — 전부 `src/config/i18n.ts`의 `UI` 사전을 거친다. 내부 링크는 `i18n(Astro.url).href()`를 거친다. 계약은 `_workspace/06_i18n_contract.md`.

**배포:** `stu-eonho.github.io` (GitHub Pages 사용자 사이트, Actions 배포).

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-08-21 | 초기 구성 — 에이전트 6종, 스킬 5종 | 전체 | - |
| 2026-08-21 | 모션 레이어 추가 | agents/motion-designer.md, skills/subtle-motion-anime | 사용자 요청: anime.js 기반 잔잔한 애니메이션. 스펙 `<animations>`의 CRITICAL 제약(페이지 전환 없음, reduced-motion, JS 0바이트 기본값)은 유지하고 진입 리빌 레이어만 추가 |
| 2026-08-21 | 초기 구축 완료 | 프로젝트 전체 (`src/`, `scripts/`, `.github/`, `README.md`, `_workspace/`) | 스펙 전 범위 구현. `astro check` 0오류/0경고, 19페이지 빌드, 내부 링크 493건 이상 없음, 대비 38조합 AA 통과 |
| 2026-08-21 | 토큰 5건 조정 | `src/styles/global.css` | WCAG AA 미달 해소. `--accent-hover` `#0077ed`→`#006edb`, `--accent-active` `#006edb`→`#0064c8`, `--accent-tint` 0.10→0.07, `--interest-tint` 0.08→0.05, `--disabled-fg` 신규. 전부 `[local extension]`이며 `[verified]` 값은 무변경 |
| 2026-08-21 | 모션 트리거 방식 변경 | `src/scripts/motion.ts` | anime.js `onScroll` 대신 IntersectionObserver 직접 사용. 청크 gzip 20.2KB→14.9KB. 스킬 예산 12KB는 여전히 미달성 — anime.js v4 엔진 하한이 약 15.9KB이며 12KB 이하는 라이브러리 미사용으로만 가능 (`_workspace/04_motion_inventory.md` 참조) |
| 2026-08-21 | 모션 깜빡임 수정 | `src/styles/motion.css`, `src/scripts/motion.ts`, `ProfileHero`, `ListHeader`, `PostMetaHeader`, 메타 패널 2종 | 사용자 피드백: 진입 애니메이션이 뒤늦게 걸려 깜빡임. 원인은 이미 그려진 요소를 anime.js 도착 후 숨겼다 다시 보여준 것. 리빌을 CSS(`data-reveal-onload`, 첫 페인트)와 JS(`data-reveal`, 스크롤 진입) 두 갈래로 분리하고, 스크립트 시작 시점에 화면에 보이는 요소는 JS 대상에서 제외 |
| 2026-08-21 | 홈 상단 여백 축소 | `src/components/home/ProfileHero.astro` | 사용자 피드백: 위쪽 공백 과다. 히어로 padding-top 56→32px(모바일) / 80→56px(데스크톱). 하단과 섹션 리듬은 유지 |
| 2026-08-21 | 홈을 CV 형식으로 재구성 | `ProfileCard`(신규), `TimelineList`(신규), `CareerList`(신규), `EducationList`·`SkillGroups`·`InterestList`·`index.astro` 수정, `ProfileHero` 삭제 | 사용자 피드백: 홈이 흩어져 보임. 프로필 관련 요소를 Card 하나에 모으고 hairline으로만 구분. "Paper Review 보기" CTA 제거. 스펙 `home_page`의 히어로+분리 섹션 레이아웃을 대체하되 토큰(색·radius·폰트 스케일·44px 히트 영역)은 그대로 준수 |
| 2026-08-21 | 프로필에 경력 필드 추가 | `src/config/profile.ts`, `CareerList.astro`, `src/lib/seo.ts`, README | 사용자 요청. `CareerEntry`(company/role/team/employment/startDate/endDate/description) 추가, Person JSON-LD에 `worksFor`·`jobTitle` 반영 |
| 2026-08-21 | 플레이스홀더 표시 정책 변경 | `ProfileCard.astro` | 기존에는 꺾쇠 플레이스홀더를 화면에서 숨겨 홈이 비어 보였다. 이제 텍스트 플레이스홀더는 그대로 노출하고(무엇을 채울지 보이게) URL만 계속 필터링한다 |
| 2026-08-21 | 한국어/영어 이중 언어 도입 | `src/config/i18n.ts`(신규), `src/components/views/*`(신규 8종), `src/components/layout/LangToggle.astro`(신규), `src/components/post/TranslationNotice.astro`(신규), `src/lib/feed.ts`(신규), `src/pages/en/**`(신규 10종), `site.ts`·`categories.ts`·`profile.ts`·`content.config.ts`·`posts.ts`·`tags.ts`·`date.ts`·`seo.ts`·레이아웃·컴포넌트 다수 수정 | 사용자 요청: 해외 포트폴리오용 EN/KO 전환. URL 분리(`/` = ko, `/en/` = en) 방식으로 확정 — 클라이언트 토글은 검색엔진이 영어 페이지를 색인하지 못해 포트폴리오 목적을 달성하지 못한다. 전환 UI는 헤더 우측(검색·테마 토글 옆) 링크 1개이며 **JS 0바이트**. UI·프로필은 완전 이중언어, 글 본문은 `<slug>.en.mdx` 번역본이 있으면 영어·없으면 원문 + 안내 배너(canonical은 원문 URL로). 계약은 `_workspace/06_i18n_contract.md` |
| 2026-08-21 | 배포 대상 확정 | `astro.config.mjs`, `src/config/site.ts`, README §7 | 사용자가 `stu-eonho.github.io` 리포지토리를 생성. `site`/`url` 기본값을 `https://stu-eonho.github.io`로 변경. `base`는 `/` 유지(사용자 사이트) |
