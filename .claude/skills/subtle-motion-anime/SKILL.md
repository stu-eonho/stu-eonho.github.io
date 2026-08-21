---
name: subtle-motion-anime
description: anime.js v4로 잔잔한(subtle) 진입 리빌·스태거·스크롤 트리거 모션을 구현한다. 애니메이션/모션/전환 효과 추가, "부드럽게 나타나게", "페이드인", "스크롤하면 나타나게", "너무 과하지 않게", anime.js·animejs 사용, 모션이 과하다/밋밋하다는 피드백 반영, reduced-motion 대응, 모션 JS 예산 산정 요청 시 반드시 이 스킬을 사용할 것. 정적 사이트(Astro/HTML)에서 JS 예산을 지키며 애니메이션을 붙일 때 특히 적합하다. CSS transition만으로 충분한 hover/focus 마이크로 인터랙션에는 사용하지 않는다.
---

# Subtle Motion with anime.js v4

## 이 스킬이 푸는 문제

정적 사이트에 애니메이션을 붙일 때 두 가지가 동시에 망가진다. (1) 모션이 과해져 콘텐츠보다 애니메이션이 주목받고, (2) 애니메이션 라이브러리가 "클라이언트 JS 0바이트" 원칙을 조용히 무너뜨린다.

이 스킬은 두 문제를 **수치 상한**과 **로드 게이트**로 푼다. 잔잔함을 취향이 아니라 검증 가능한 숫자로 만들고, 라이브러리가 실제로 필요한 사용자에게만 전달되게 한다.

## 1단계: 무엇을 CSS로 두고 무엇을 anime.js로 할지 가른다

anime.js를 쓰기 전에 이 판단을 먼저 한다. 잘못 가르면 얻는 것 없이 JS 예산만 태운다.

| 상황                               | 도구                    | 이유                                                                                  |
| ---------------------------------- | ----------------------- | ------------------------------------------------------------------------------------- |
| hover 색·배경·테두리 전환          | CSS `transition`        | 상태 기반 전환은 CSS가 더 빠르고 JS가 없어도 동작한다                                 |
| focus 링, `:active` 피드백         | CSS                     | 접근성 필수 요소가 JS에 의존하면 안 된다                                              |
| 코드 복사 버튼 opacity             | CSS                     | 단일 요소 단일 속성                                                                   |
| 스켈레톤 펄스                      | CSS `@keyframes`        | 무한 루프는 JS 타이머보다 CSS가 효율적                                                |
| **여러 요소의 시차 진입(stagger)** | **anime.js**            | CSS로 하려면 요소마다 `transition-delay`를 손으로 넣어야 하고, 개수가 동적이면 불가능 |
| **스크롤 진입 시점 트리거 + 시차** | **anime.js `onScroll`** | IntersectionObserver + 수동 시차 계산을 직접 짜는 것보다 정확하고 짧다                |
| 단일 요소 단순 페이드인            | CSS                     | anime.js를 부를 이유가 없다                                                           |

**판단 규칙: 요소가 2개 이상이고 시차가 필요하면 anime.js, 아니면 CSS.**

## 2단계: 잔잔함의 수치 상한

"잔잔하게"는 주관어처럼 보이지만 지킬 수 있는 숫자가 있다. 이 표를 넘으면 잔잔하지 않다.

| 파라미터          | 상한                       | 초과 시 나타나는 증상                                                         |
| ----------------- | -------------------------- | ----------------------------------------------------------------------------- |
| 이동 거리         | **8px**                    | 12px를 넘으면 "슬라이드 인"으로 읽히고 시선이 끌린다                          |
| duration          | **240–420ms**              | 500ms를 넘으면 스크롤이 애니메이션을 기다리는 느낌이 된다                     |
| stagger 간격      | **40–70ms**                | 100ms를 넘으면 요소가 하나씩 "도착"하는 게 보인다                             |
| stagger 총 지연   | **400ms**                  | 카드 12장 × 70ms = 840ms — 마지막 카드가 늦게 온다. `stagger`에 상한을 걸어라 |
| ease              | `outQuad` / `outCubic`     | bounce·elastic·spring은 성격이 강해 학술 콘텐츠와 충돌한다                    |
| 애니메이션 속성   | `opacity` + `translateY`만 | scale·rotate·blur·filter는 전부 과하다. blur는 성능도 나쁘다                  |
| 동시 리빌 요소 수 | 의미 단위 블록             | 개별 텍스트 줄·아이콘까지 리빌하면 화면이 들썩인다                            |

**총 지연 상한을 지키는 방법:** 요소 수가 가변이면 고정 간격 대신 `stagger`의 total 파라미터나 `Math.min(60, 400 / count)`로 간격을 계산한다.

## 3단계: 로드 게이트 — 순서가 전부다

```js
// src/scripts/motion.ts
export async function initMotion() {
  // 1. reduced-motion 검사가 import보다 먼저다.
  //    순서가 뒤집히면 접근성 설정을 켠 사용자가 쓰지도 않을 라이브러리를 받는다.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // 2. 이 페이지에 애니메이션 대상이 있는지 확인한다.
  //    대상이 없는 페이지에서 라이브러리를 받을 이유가 없다.
  const targets = document.querySelectorAll('[data-reveal]');
  if (targets.length === 0) return;

  // 3. 여기서야 동적 import. 필요한 export만 가져와 트리셰이킹을 살린다.
  try {
    const { animate, stagger, onScroll } = await import('animejs');
    // ...
  } catch {
    // 실패해도 조용히 넘어간다. 콘텐츠는 이미 최종 상태로 보이고 있다(4단계 참조).
  }
}
```

세 개의 게이트를 순서대로 통과해야 라이브러리가 로드된다. 이 순서를 바꾸지 않는다.

## 4단계: 실패해도 콘텐츠가 보이는 구조

**정적 사이트에서 가장 심각한 실패 모드는 JS 오류로 인한 백지다.** 이걸 구조로 막는다.

```css
/* CSS 기본값 = 애니메이션의 최종 상태. JS가 없으면 그냥 이 상태로 보인다. */
[data-reveal] {
  opacity: 1;
  transform: none;
}
```

```js
// 스크립트가 시작 상태를 세팅한 뒤 되돌린다.
utils.set(targets, { opacity: 0, translateY: 8 });
animate(targets, { opacity: 1, translateY: 0 /* ... */ });
```

**절대 하지 말 것:** CSS에 `[data-reveal] { opacity: 0 }`을 두고 JS가 켜주기를 기다리는 것. JS가 느리게 로드되면 그동안 백지이고, 실패하면 영영 백지다. 검색 엔진과 JS 비활성 사용자에게도 빈 페이지다.

## 5단계: 프리셋으로 통일한다

프리셋이 늘어날수록 사이트의 모션 언어가 흐려진다. **3개를 넘기지 않는다.**

```js
// src/scripts/motion-presets.ts
export const REVEAL = {
  // 페이지 로드 직후 화면 안에 있는 블록 (홈 히어로 텍스트 등)
  onLoad: { translateY: [8, 0], opacity: [0, 1], duration: 360, ease: 'outQuad' },
  // 스크롤로 진입하는 단일 블록 (메타 패널, 섹션 헤더)
  onEnter: { translateY: [8, 0], opacity: [0, 1], duration: 320, ease: 'outQuad' },
  // 스크롤로 진입하는 목록 (카드 그리드, 아카이브 행)
  onEnterStagger: (count) => ({
    translateY: [8, 0],
    opacity: [0, 1],
    duration: 320,
    ease: 'outQuad',
    delay: stagger(Math.min(60, 400 / Math.max(count, 1))),
  }),
};
```

새 모션 요구가 들어오면 먼저 기존 프리셋으로 되는지 확인한다. 대개 된다.

## 6단계: 예산 실측

자기 보고를 믿지 않는다. 빌드 후 실제로 잰다.

```bash
# 모션 관련 청크의 gzip 실측
find dist/_astro -name "*.js" -exec sh -c 'echo "$(gzip -c "$1" | wc -c)  $1"' _ {} \; | sort -rn | head
```

**예산: gzip 12KB.** 초과하면 라이브러리 사용 범위를 줄여 맞춘다. 예산을 올리지 않는다 — 12KB를 넘겨야만 되는 모션이라면 그건 이 사이트에 과한 모션이다.

`createTimeline`, `Draggable`, `splitText`, `scrambleText`, `morphTo`, `createDrawable`, `createMotionPath`는 이 종류의 사이트에 필요 없다. import 목록에 이것들이 있으면 요구사항을 다시 검토한다.

## 7단계: 검증

빌드 후 반드시 확인한다:

1. **JS 비활성 상태에서 모든 콘텐츠가 보이는가** — DevTools에서 JS를 끄고 각 페이지를 연다. 하나라도 안 보이면 4단계 구조가 깨진 것이다.
2. **reduced-motion에서 anime.js가 요청되지 않는가** — DevTools > Rendering > `prefers-reduced-motion: reduce` 후 Network 탭에서 확인. 요청이 뜨면 3단계 게이트 순서가 잘못됐다.
3. **CLS가 0인가** — 리빌이 레이아웃을 밀면 안 된다. `translateY`는 레이아웃에 영향이 없으므로, CLS가 뜬다면 `height`/`margin`을 애니메이션했거나 리빌 전 요소가 공간을 차지하지 않는 것이다.
4. **LCP 요소가 애니메이션되지 않는가** — 히어로 이미지에 페이드인이 걸려 있으면 LCP 측정값이 그대로 나빠진다.
5. **스크롤을 오르내려도 재생이 반복되지 않는가** — 반복 재생은 잔잔함의 정반대다.

## 피드백 대응

| 피드백            | 조정 순서                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| "너무 과하다"     | 이동 거리 ↓ → duration ↓ → 리빌 대상 개수 ↓. 이 순서로 줄인다                                                                         |
| "너무 밋밋하다"   | duration을 +40~60ms. **이동 거리 8px 상한은 유지한다.** 거리를 늘리는 순간 잔잔함이 깨진다                                            |
| "느리게 느껴진다" | stagger 간격 ↓, 총 지연 ↓. duration은 마지막에 건드린다                                                                               |
| "일부만 움직인다" | 의도된 동작이다. 전부 움직이면 아무것도 안 움직이는 것과 같다. 그래도 원하면 대상 블록을 하나씩 추가하되 화면당 3블록을 넘기지 않는다 |

새 애니메이션을 **추가해서** 균형을 맞추려 하지 않는다. 조정은 항상 줄이는 방향이다.

## anime.js v4 API

정확한 import 경로, 함수 시그니처, `onScroll` 옵션, `stagger` 파라미터, ease 이름 목록은 `references/animejs-v4-api.md`를 읽어라. **v3와 v4의 API가 다르다** — v3의 `anime({ targets: ... , easing: ... })` 형식을 쓰면 동작하지 않는다.
