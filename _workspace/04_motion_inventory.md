# 04 — 모션 인벤토리

## 구성

| 파일 | 내용 |
|---|---|
| `src/scripts/motion.ts` | 게이트 4단계 + IntersectionObserver 트리거 + 재생 |
| `src/scripts/motion-presets.ts` | `REVEAL.onLoad / onEnter / onEnterStagger`, `START_STATE`, 상한 상수 |
| `src/styles/motion.css` | 리빌 기본값(최종 상태) + 스켈레톤 펄스 + 시트 진입 |

## 리빌 두 갈래 — 섞으면 깜빡인다

| 속성 | 담당 | 대상 |
|---|---|---|
| `data-reveal-onload` | **CSS** (`@keyframes reveal-in`) | 처음부터 화면에 보이는 블록 — 히어로 텍스트, 목록 헤더, 글 헤더, 메타 패널 |
| `data-reveal` / `data-reveal-group` | **anime.js** | 스크롤로 들어오는 블록 |

`data-reveal-onload`는 렌더 차단 스타일시트에 들어 있어 첫 페인트와 함께 재생된다. JS를 기다리지 않으므로 "보였다가 사라졌다 나타나는" 구간이 없다. `animation-delay: calc(var(--reveal-i, 0) * 60ms)`로 블록 간 시차를 주며, JS가 없거나 실패해도 애니메이션은 끝까지 재생돼 최종 상태로 남는다.

**2026-08-21 수정 이력:** 초기 구현은 히어로를 포함한 모든 리빌을 anime.js에 맡겼다. 이미 그려진 요소를 라이브러리 도착 후 `opacity:0`으로 되돌렸다가 페이드인하는 구조라 화면 상단에서 깜빡임이 발생했다. 위 두 갈래 분리 + 아래 게이트 2로 해소했다. 동시에 히어로의 줄 단위 리빌(6개)을 텍스트 블록 하나로 묶었다 — "개별 텍스트 줄까지 리빌하면 화면이 들썩인다"는 상한을 지키기 위해서다.

## 로드 게이트 (순서 고정)

1. `prefers-reduced-motion: reduce` → 즉시 반환. **import보다 먼저**
2. `getBoundingClientRect()`로 **스크립트 시작 시점에 화면 밖인 대상만** 남긴다.
   이미 보이는 요소를 숨겼다 보여주면 깜빡임이 되므로 여기서 제외한다
3. 남은 대상이 0개면 반환
4. 대상이 뷰포트에 접근할 때 → `import('animejs')`.
   라이브러리 도착이 늦어 그사이 요소가 화면 깊숙이 들어왔다면(상단 90% 안쪽) 재생을 건너뛴다

게이트 4는 스펙의 초기 JS 예산(홈 5KB / 상세 8KB gzip)을 지키기 위해 있다. 스크롤이 리빌 대상에 닿기 전에는 라이브러리를 내려받지 않는다.

## 수치 (전부 [local extension])

| 파라미터 | 값 | 상한 |
|---|---|---|
| 이동 거리 | 8px | 8px |
| duration | 320ms (onEnter/stagger), 360ms (onLoad) | 240–420ms |
| stagger | `stagger([0, 400])` — 개수 무관 총 400ms | 400ms |
| ease | `outQuad` | outQuad / outCubic |
| 속성 | `opacity`, `translateY`만 | scale·rotate·blur 금지 |
| 반복 | 없음 (`unobserve` 후 재생) | once |

## 리빌 대상

| 화면 | CSS onload | JS 단독 | JS 그룹 |
|---|---|---|---|
| 홈 | 프로필 카드 전체 | — | 학적·경력 타임라인, 스킬 그룹, 관심 분야 칩, 최근 글 그리드 |
| 목록 | `ListHeader` | — | 카드 그리드 |
| 상세 | `PostMetaHeader`, 메타 패널 | — | — |
| 아카이브 | `ListHeader` | — | 연도별 행 목록 |
| 태그 | `ListHeader` | — | 태그 칩 클라우드, 카드 그리드 |

프로필 사진(LCP 요소)에는 리빌을 걸지 않는다. 홈은 CV 카드 한 장이 통째로 들어오고, 카드 안의 목록은 스크롤로 닿을 때만 시차 리빌된다.

## CSS에 남긴 것 (JS 예산 0)

hover 색/배경/테두리 전환, focus-visible 링, `:active` 배경, 코드 복사 버튼 opacity, 검색 스켈레톤 펄스, 모바일 시트 진입.

## 예산 실측

```
modules.*.js          14,908 B gzip   (animejs 엔진 — 스크롤 진입 시에만 전송)
BaseLayout script      1,046 B gzip   (모션 진입점 + 단축키)
SearchPanel script     1,147 B gzip
preload-helper           757 B gzip
```

초기 전송량: 홈 약 2.2KB gzip, 글 상세 약 3.0KB gzip (인라인 module 스크립트 포함). 스펙 기준 5KB / 8KB 이내.
첫 화면 리빌은 CSS가 담당하므로 JS를 전혀 쓰지 않는다.

**미해결 — MAJOR:** anime.js 청크가 gzip 14.9KB로 스킬 예산 12KB를 2.9KB 초과한다.
축소 시도와 결과:

| 조합 | gzip |
|---|---|
| `animate + stagger + onScroll + utils` (초기안) | 20,239 B |
| `animate + stagger + utils` + 직접 IntersectionObserver (**채택**) | 15,939 B |
| `animate + utils`만 | 15,938 B |

`onScroll`을 걷어내 4.3KB를 줄였지만, anime.js v4 애니메이션 엔진 자체의 하한이 약 15.9KB다. 12KB로 내리는 방법은 anime.js를 쓰지 않는 것뿐이다. 사용자 판단이 필요한 지점이며, 대안은 동일한 시각 결과를 내는 CSS 클래스 토글 + IntersectionObserver 구현(약 0.6KB gzip)이다.
