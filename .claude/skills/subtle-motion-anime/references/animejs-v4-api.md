# anime.js v4 API 레퍼런스

출처: https://animejs.com/documentation (2026-08-21 확인)

## 목차

- [v3 → v4 변경점](#v3--v4-변경점)
- [설치와 import](#설치와-import)
- [animate()](#animate)
- [ease 이름](#ease-이름)
- [stagger()](#stagger)
- [onScroll()](#onscroll)
- [utils](#utils)
- [이 프로젝트에서 쓰지 않는 API](#이-프로젝트에서-쓰지-않는-api)
- [완성 코드 예시](#완성-코드-예시)

## v3 → v4 변경점

**이 차이를 놓치면 코드가 조용히 동작하지 않는다.**

|             | v3                                             | v4                                                  |
| ----------- | ---------------------------------------------- | --------------------------------------------------- |
| 진입점      | `import anime from 'animejs'` (default export) | `import { animate } from 'animejs'` (named export)  |
| 호출        | `anime({ targets: '.el', ... })`               | `animate('.el', { ... })` — 타깃이 **첫 번째 인자** |
| 이징 속성명 | `easing: 'easeOutQuad'`                        | `ease: 'outQuad'` — 속성명과 값 이름 **둘 다** 바뀜 |
| 스크롤      | 별도 플러그인/수동 IO                          | `autoplay: onScroll({...})` 내장                    |
| 타임라인    | `anime.timeline()`                             | `createTimeline()`                                  |

## 설치와 import

```bash
npm install animejs
```

```js
import { animate, stagger, onScroll, utils, eases } from 'animejs';
```

named export이므로 번들러가 트리셰이킹한다. 쓰는 것만 import 한다.

## animate()

```js
const animation = animate(targets, parameters);
```

- `targets`: CSS 셀렉터 문자열, DOM 요소, NodeList, 배열
- 반환값: 재생 제어가 가능한 animation 인스턴스

```js
animate('[data-reveal]', {
  translateY: [8, 0], // [시작, 끝] 배열로 from-to 지정
  opacity: [0, 1],
  duration: 320, // ms
  ease: 'outQuad',
  delay: stagger(60),
});
```

**키프레임 배열** — 한 속성에 여러 구간을 줄 수 있다. (이 프로젝트에서는 잔잔함 상한상 거의 쓰지 않는다.)

```js
animate(el, {
  y: [
    { to: '-2.75rem', ease: 'outExpo', duration: 600 },
    { to: 0, ease: 'outBounce', duration: 800, delay: 100 },
  ],
  ease: 'inOutCirc', // 전체 기본 ease
});
```

## ease 이름

v4는 `in`/`out`/`inOut` 접두 + 곡선 이름 형식이다. v3의 `easeOutQuad`가 아니라 **`outQuad`**다.

문서에서 확인된 예: `outExpo`, `outBounce`, `inOutCirc`, `inOutQuad`.

일반 형식: `{in|out|inOut}{Quad|Cubic|Quart|Quint|Sine|Expo|Circ|Back|Elastic|Bounce}`, 그리고 `linear`.

그 외 카테고리: Cubic Bézier, Linear, Steps, Irregular, Spring. `eases` export로 프로그래밍 방식 접근이 가능하다.

**이 프로젝트에서 허용되는 ease: `outQuad`, `outCubic`.** bounce·elastic·back·spring 계열은 성격이 강해 학술 콘텐츠 톤과 충돌한다.

## stagger()

```js
import { stagger } from 'animejs';

delay: stagger(60); // 요소당 60ms씩 누적
delay: stagger(60, { start: 100 }); // 100ms 후 시작
delay: stagger(60, { from: 'center' }); // 중앙에서 바깥으로
delay: stagger([0, 400]); // 범위 값 — 전체를 400ms에 나눠 분배
```

**총 지연 상한을 지키는 가장 안전한 방법은 범위 값이다.** `stagger([0, 400])`은 요소가 몇 개든 총 400ms 안에 끝난다. 요소 수가 가변인 카드 그리드·아카이브 목록에 이 형태를 쓴다.

주요 파라미터: `start`, `from`, `reversed`, `ease`, `grid`, `axis`, `modifier`, `use`, `total`, `jitter`.

`delay` 외에 값 자체(translateY 등)도 stagger 할 수 있지만, 이 프로젝트에서는 시차만 준다.

## onScroll()

**animate()의 `autoplay` 속성에 넣는다.** 별도 호출이 아니다.

```js
import { animate, onScroll } from 'animejs';

animate('.card', {
  translateY: [8, 0],
  opacity: [0, 1],
  duration: 320,
  ease: 'outQuad',
  autoplay: onScroll({
    enter: 'bottom top', // 임계 위치
    once: true, // 한 번만 재생 — 이 프로젝트에서 필수
  }),
});
```

### 임계값(threshold) 문법

`enter`/`leave`는 두 개의 위치 shorthand를 공백으로 이어 쓴다: `'{타깃 기준점} {컨테이너 기준점}'`.

| 키워드   | 의미                            |
| -------- | ------------------------------- |
| `top`    | 상단 y 값                       |
| `bottom` | 하단 y 값                       |
| `left`   | 좌측 x 값                       |
| `right`  | 우측 x 값                       |
| `center` | 중앙 x 또는 y                   |
| `start`  | 축에 따라 `top` 또는 `left`     |
| `end`    | 축에 따라 `bottom` 또는 `right` |

```js
autoplay: onScroll({
  container: '.scroll-container',
  enter: 'center top',
  leave: 'center bottom',
  debug: true, // 개발 중 임계선을 화면에 그려준다. 배포 전 반드시 제거
});
```

수치 값과 `'bottom-=100'` 같은 상대 오프셋도 지원한다.

### 주요 설정

- `container` — 스크롤 컨테이너 (기본: 뷰포트)
- `target` — 관찰할 요소 (기본: 애니메이션 타깃)
- `axis` — `'x'` / `'y'`
- `repeat` / `once` — 반복 재생 여부. **이 프로젝트는 `once: true` 고정**
- `sync` — 스크롤 진행률과 재생을 동기화. **이 프로젝트에서는 쓰지 않는다** (스크롤 연동 스크러빙은 "잔잔함"의 반대다)
- `debug` — 임계선 시각화. 배포 전 제거

### 콜백

`onEnter`, `onEnterForward`, `onEnterBackward`, `onLeave`, `onLeaveForward`, `onLeaveBackward`, `onUpdate`, `onSyncComplete`, `onResize`.

메서드: `link()`, `refresh()`, `revert()`.

**`refresh()`가 필요한 경우:** 이미지 lazy load나 폰트 로드로 레이아웃이 바뀌면 임계 위치가 어긋난다. `window.load` 이후 한 번 `refresh()`를 부르면 해결된다.

## utils

`import { utils } from 'animejs'`

이 프로젝트에서 쓰는 것:

- `utils.$(selector)` — 요소 선택. 배열을 반환하므로 구조분해가 가능하다: `const [container] = utils.$('.scroll-container')`
- `utils.set(targets, props)` — 애니메이션 없이 즉시 값 설정. **시작 상태를 세팅할 때 쓴다**
- `utils.cleanInlineStyles(animation)` — 애니메이션이 남긴 인라인 스타일 제거. 완료 후 DOM을 깨끗하게 유지한다
- `utils.remove(targets)` — 진행 중인 애니메이션 중단

그 외: `get`, `sync`, `random`, `shuffle`, `round`, `clamp`, `snap`, `wrap`, `mapRange`, `lerp`, `damp`, `padStart`, `degToRad` 등. 대부분 체이닝 가능하다.

## 이 프로젝트에서 쓰지 않는 API

import 목록에 아래가 보이면 요구사항을 재검토하라. 전부 번들 크기를 키우고, 이 사이트의 모션 상한과 충돌한다.

- `createTimeline()` — 복합 시퀀스용. 진입 리빌에는 과하다
- `Draggable` — 드래그 인터랙션 없음
- `splitText()`, `scrambleText()` — 텍스트 단위 애니메이션은 학술 본문에 부적합
- `morphTo()`, `createDrawable()`, `createMotionPath()` — SVG 모션 없음
- `createScope()` — 프레임워크 컴포넌트 생명주기 연동용. Astro 정적 페이지에는 불필요
- `createSpring()` — spring ease 금지
- `sync` 모드 스크롤 스크러빙

## 완성 코드 예시

이 프로젝트의 `src/scripts/motion.ts`가 지향하는 형태다.

```ts
const REVEAL_BASE = {
  translateY: [8, 0] as [number, number],
  opacity: [0, 1] as [number, number],
  duration: 320,
  ease: 'outQuad',
};

export async function initMotion() {
  // 게이트 1: 접근성 설정 — import보다 먼저
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // 게이트 2: 이 페이지에 대상이 있는가
  const groups = document.querySelectorAll<HTMLElement>('[data-reveal-group]');
  const singles = document.querySelectorAll<HTMLElement>(
    '[data-reveal]:not([data-reveal-group] *)',
  );
  if (groups.length === 0 && singles.length === 0) return;

  // 게이트 3: 여기서야 로드
  try {
    const { animate, stagger, onScroll, utils } = await import('animejs');

    for (const group of groups) {
      const items = group.querySelectorAll<HTMLElement>('[data-reveal]');
      if (!items.length) continue;
      utils.set(items, { opacity: 0, translateY: 8 }); // 시작 상태
      animate(items, {
        ...REVEAL_BASE,
        delay: stagger([0, 400]), // 개수와 무관하게 총 400ms
        autoplay: onScroll({ enter: 'bottom-=40 top', once: true }),
      });
    }

    for (const el of singles) {
      utils.set(el, { opacity: 0, translateY: 8 });
      animate(el, {
        ...REVEAL_BASE,
        autoplay: onScroll({ enter: 'bottom-=40 top', once: true }),
      });
    }
  } catch {
    // 조용히 실패. CSS 기본값이 이미 최종 상태이므로 콘텐츠는 보인다.
  }
}
```

대응하는 CSS — **최종 상태가 기본값이어야 한다**:

```css
[data-reveal] {
  opacity: 1;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  [data-reveal] {
    opacity: 1 !important;
    transform: none !important;
  }
}
```
