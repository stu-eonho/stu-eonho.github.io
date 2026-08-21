---
name: study-log-build
description: STUDY_LOG_SPEC.md 스펙대로 Study Log 블로그(Astro 7 정적 사이트 + anime.js 모션)를 에이전트 팀으로 구축한다. "스펙대로 진행", "블로그 만들어줘", "사이트 구축", "구현 시작", "STUDY_LOG_SPEC" 언급 시 반드시 사용할 것. 후속 작업에도 사용한다 — "다시 실행", "재실행", "이어서", "업데이트", "수정해줘", "보완", "홈만 다시", "애니메이션만 조정", "검색 부분 고쳐줘", "이전 결과 개선", "카테고리 추가", "새 글 템플릿", "배포 설정" 등 이 블로그와 관련된 모든 구현·수정 요청에 적용한다. 단순 질문(스펙 내용 확인, 파일 위치 문의)은 이 스킬 없이 직접 답해도 된다.
---

# Study Log Build — 오케스트레이터

`STUDY_LOG_SPEC.md`(1554줄)와 `DESIGN.md`를 근거로 Astro 7 정적 블로그를 구축한다. 사용자 요청에 따라 anime.js v4 기반의 **잔잔한 모션 레이어**가 추가된다.

**실행 모드: 에이전트 팀** (전 Phase 동일). 6명이 `SendMessage`로 직접 조율하며, 산출물은 `_workspace/`에 파일로 남긴다.

## 팀 편성과 스킬 배치

| 에이전트                | 담당                              | 사용 스킬                         |
| ----------------------- | --------------------------------- | --------------------------------- |
| `spec-navigator`        | 스펙 해석·슬라이싱, CRITICAL 감시 | (없음 — 스펙 원문이 곧 지침)      |
| `astro-architect`       | 스캐폴딩·스키마·설정·lib·라우트   | `astro-content-architecture`      |
| `design-system-builder` | 토큰·프리미티브·레이아웃 셸       | `design-token-fidelity`           |
| `content-ux-builder`    | 글 상세·홈·탐색 화면·RSS/SEO      | `design-token-fidelity` (소비 측) |
| `motion-designer`       | anime.js 모션 레이어              | `subtle-motion-anime`             |
| `integration-qa`        | 빌드·경계면·a11y·성능 검증        | `static-build-qa`                 |

각 에이전트를 호출할 때 담당 스킬을 함께 지정한다. 스킬은 "어떻게 하는가", 에이전트 정의는 "누가 무엇을 책임지는가"다.

## Phase 0: 컨텍스트 확인 — 항상 먼저

무엇을 하기 전에 현재 상태를 판별한다.

```bash
ls -d _workspace src node_modules 2>/dev/null
ls _workspace/ 2>/dev/null
```

| 상태                                                         | 실행 모드       | 동작                                                                                          |
| ------------------------------------------------------------ | --------------- | --------------------------------------------------------------------------------------------- |
| `_workspace/` 없음, `src/` 없음                              | **초기 실행**   | Phase 1부터 전체                                                                              |
| `_workspace/` 있음 + 부분 수정 요청 ("홈만", "애니메이션만") | **부분 재실행** | 해당 에이전트만 재호출. 팀 전체를 다시 만들지 않는다                                          |
| `_workspace/` 있음 + 광범위 재작업 요청                      | **새 실행**     | 기존 `_workspace/`를 `_workspace_prev/`로 이동 후 Phase 1부터                                 |
| `src/` 있음, `_workspace/` 없음                              | **복구 실행**   | `spec-navigator`가 슬라이스를 재생성하고, 각 에이전트가 기존 소스를 읽어 계약 파일을 역산한다 |

부분 재실행일 때도 `_workspace/`의 계약 파일들은 **읽는다**. 계약을 모르는 채 한 조각만 고치면 경계면이 깨진다.

## Phase 1: 팀 구성과 스펙 슬라이싱

```
TeamCreate("study-log-build", members=[
  spec-navigator, astro-architect, design-system-builder,
  content-ux-builder, motion-designer, integration-qa
])
```

모든 Agent 호출에 `model: "opus"`를 명시한다.

**첫 작업은 `spec-navigator` 단독이다.** 스펙이 126KB라 전원이 각자 읽으면 컨텍스트가 고갈된다. `spec-navigator`가 다음을 만들 때까지 나머지는 대기한다:

- `_workspace/00_spec_slices/{agent-name}.md` × 5
- `_workspace/00_spec_slices/CRITICAL_REGISTRY.md`

슬라이스가 나오면 각 에이전트에게 **자기 슬라이스 경로만** 전달한다. 스펙 원문 경로를 주면 통째로 읽는다.

### 이 시점에 팀에 공지할 결정 사항

사용자 요청(애니메이션 추가)과 스펙 `<animations>` 섹션이 부분 충돌한다. **해석은 아래로 확정하고 팀 전원에게 알린다:**

- 추가되는 것은 **진입 리빌 레이어 하나**뿐이다 (페이드 + 8px 이내 상승, 스태거)
- 스펙의 CRITICAL은 전부 유지된다: 페이지 전환 애니메이션 없음(View Transitions 미사용), 버튼 press에 `scale()` 없음, 무한 루프는 검색 스켈레톤이 유일, reduced-motion에서 전면 정지
- anime.js는 **reduced-motion이 아니고 + 해당 페이지에 리빌 대상이 있을 때만** 동적 import 한다. 예산 gzip 12KB
- CSS로 되는 것(hover, focus, press)은 CSS로 둔다

## Phase 2: 구조 코어 (선행 필수)

**`astro-architect` 단독.** 다른 에이전트는 이 계약 없이 시작할 수 없다.

산출: 스캐폴딩, `astro.config.mjs`, `content.config.ts`, `config/*.ts`, `lib/*.ts`, 라우트 골격, `_workspace/01_architect_contracts.md`.

**완료 게이트:** 빈 페이지로 `npm run build` 성공. 실패하면 다음 Phase로 넘어가지 않는다 — 깨진 빌드 위에 컴포넌트를 쌓으면 원인 추적이 불가능해진다.

계약 파일이 나오면 `integration-qa`가 **즉시** 시나리오 2·3을 실행한다(스펙 구현 순서 8번·7번이 이를 명시한다). 아키텍처가 굳기 전에 잡아야 고치는 비용이 작다.

## Phase 3: 디자인 시스템 + 화면 (병렬)

두 에이전트가 동시에 진행한다.

- **`design-system-builder`**: 토큰 → 프리미티브 → 레이아웃 셸 → `_workspace/02_design_tokens.md`
- **`content-ux-builder`**: 글 상세 → 홈 → 탐색 화면 → `_workspace/03_ux_surfaces.md`

**순서 의존:** `content-ux-builder`는 프리미티브가 나오기 전에 화면을 조립할 수 없다. `design-system-builder`가 토큰과 Button/Card/Badge를 먼저 내보내고 `SendMessage`로 알린 뒤, 나머지를 병렬로 진행한다.

**파일 충돌 주의:** `src/pages/**`는 `astro-architect`(데이터·`getStaticPaths`)와 `content-ux-builder`(마크업)가 함께 만진다. 편집 전 `SendMessage`로 합의한다.

`integration-qa`는 각 모듈 완성 알림마다 경계면을 검증한다. 마지막에 몰지 않는다.

## Phase 4: 모션 레이어

**`motion-designer`.** 입력은 `_workspace/02_design_tokens.md`와 `03_ux_surfaces.md`의 "훅" 섹션이다.

화면이 안정된 뒤에 붙인다. 마크업이 계속 바뀌는 중에 셀렉터를 붙이면 계속 깨진다.

산출: `src/scripts/motion.ts`, `motion-presets.ts`, `src/styles/motion.css`, `_workspace/04_motion_inventory.md`.

**완료 게이트:** `integration-qa`가 실측한다 — JS 비활성 상태에서 전 페이지 콘텐츠가 보이는가, reduced-motion에서 anime.js가 요청되지 않는가, gzip ≤ 12KB, CLS 0.

## Phase 5: 통합·배포·문서

- `astro-architect`: `scripts/check-links.mjs`, `.github/workflows/deploy.yml`, `public/.nojekyll`
- `content-ux-builder`: GoatCounter 스크립트 + 푸터 고지, README(프로필 채우는 법 + 글 쓰는 법 + 로컬 실행 + 배포)
- `integration-qa`: 전체 시나리오 10종 + Lighthouse(라이트/다크 양쪽) → `_workspace/05_qa_report.md`

**BLOCKER가 하나라도 남으면 완료 보고를 하지 않는다.** MAJOR/MINOR는 남은 채로 보고하되 목록을 명시한다.

## 데이터 전달

| 방식                        | 용도                                                   |
| --------------------------- | ------------------------------------------------------ |
| `TaskCreate` / `TaskUpdate` | 작업 할당·의존 관계·진행 추적                          |
| `SendMessage`               | 완성 알림, 결함 리포트, 계약 변경 통지, 파일 편집 합의 |
| `_workspace/*.md`           | 계약·인벤토리·리포트 (감사 추적용으로 보존)            |

```
_workspace/
├── 00_spec_slices/{agent}.md, CRITICAL_REGISTRY.md
├── 01_architect_contracts.md
├── 02_design_tokens.md
├── 03_ux_surfaces.md
├── 04_motion_inventory.md
└── 05_qa_report.md
```

`_workspace/`는 삭제하지 않는다. 후속 실행에서 이 파일들이 컨텍스트다.

## 에러 핸들링

| 상황                                  | 처리                                                                                      |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| 에이전트 1회 실패                     | 실패 로그를 붙여 1회 재시도                                                               |
| 재실패                                | 그 산출물 없이 진행하고, **완료 보고에 누락을 명시**한다. 조용히 넘기지 않는다            |
| Phase 2 빌드 실패                     | 다음 Phase로 넘어가지 않는다. 깨진 빌드 위에 쌓으면 원인 추적 불가                        |
| 계약 변경 발생                        | `astro-architect`가 소비자 전원에게 즉시 통지. 조용한 계약 변경이 경계면 버그의 최대 원인 |
| 두 에이전트가 같은 요소를 반대로 수정 | 오케스트레이터가 중재. 스펙 판정이 필요하면 `spec-navigator`에게 질의                     |
| 스펙과 사용자 요청 충돌               | 임의 판단하지 않는다. 충돌 지점과 양립 가능한 해석을 사용자에게 제시                      |
| 의존성 버전 충돌                      | 스펙 명시 버전을 유지한다. 특히 TypeScript는 6.0.3 고정 (7.x는 `astro check` 실패)        |

## 절대 하지 않는 것

`CRITICAL_REGISTRY.md` 전체를 대체하지 않는다. 다음은 그중 가장 자주 위반되는 5개다:

1. 런타임 데이터 접근 코드 추가 (서버·DB·API·`fetch`)
2. 새 카테고리를 위해 라우트 파일 생성 — `categories.ts` + 폴더로 끝나야 한다
3. `[local extension]` 값을 `[verified]` 토큰으로 표기
4. `profile.ts`에 그럴듯한 가짜 이름·학교·스킬 창작
5. 댓글 영역·자리표시자·주석 처리된 댓글 코드 잔존

## 테스트 시나리오

**정상 흐름:** "스펙대로 진행해줘" → Phase 0에서 `_workspace/` 없음 확인 → 팀 생성 → `spec-navigator` 슬라이싱 → `astro-architect` 코어 + 빌드 통과 → 시나리오 2·3 조기 검증 → 디자인/화면 병렬 → 모션 → 전체 QA → 완료 보고 + 미해결 결함 목록.

**에러 흐름:** Phase 3에서 `content-ux-builder`가 `post.data.paper.venue`를 읽는데 `astro-architect`의 스키마에 `venue`가 없음 → `integration-qa`가 경계면 교차 비교에서 발견 → 결함을 `astro-architect`에게 리포트(위치·재현·심각도 MAJOR) → 스키마 수정 후 계약 파일 갱신 → 소비자 전원에게 통지 → 재검증 → 통과 항목으로 이동.

**부분 재실행 흐름:** "애니메이션이 너무 과해" → Phase 0에서 `_workspace/` 존재 + 모션 한정 요청 확인 → `motion-designer`만 재호출 → `04_motion_inventory.md`를 읽고 이동 거리 → duration → 대상 개수 순으로 축소 → `integration-qa`가 예산·CLS 재확인. 다른 에이전트를 부르지 않는다.

## 완료 후

사용자에게 피드백 기회를 제공한다: 결과물 품질, 팀 구성, 워크플로우 순서. 피드백이 오면 대상을 판별해 반영하고, `CLAUDE.md`의 변경 이력에 기록한다.

| 피드백          | 수정 대상                              |
| --------------- | -------------------------------------- |
| 결과물 품질     | 해당 에이전트의 스킬                   |
| 에이전트 역할   | `.claude/agents/{name}.md`             |
| 워크플로우 순서 | 이 파일                                |
| 모션 강도       | `subtle-motion-anime` 스킬의 수치 상한 |
