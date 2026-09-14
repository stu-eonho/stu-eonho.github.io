---
name: design-token-fidelity
description: DESIGN.md의 검증된 디자인 토큰을 CSS @theme 변수로 옮기고 [verified]/[local extension] 출처를 구분해 표기한다. 색상·타이포·간격·radius 토큰 정의, Tailwind v4 CSS-first @theme 블록 작성, 다크 모드 변수 재정의, WCAG AA 대비 계산, FOUC 없는 테마 초기화 스크립트, UI 프리미티브(Button/Card/Badge) 구현 시 반드시 사용할 것. "토큰", "색상 팔레트", "다크 모드", "대비", "디자인 시스템", "테마 토글" 관련 요청에 적용한다.
---

# Design Token Fidelity — 출처를 잃지 않는 토큰 이식

## 이 스킬이 푸는 문제

검증된 디자인 레퍼런스(`DESIGN.md`)에서 토큰을 가져올 때, 실무에서는 항상 **레퍼런스에 없는 값**이 필요해진다. hover 상태, disabled 상태, 레이아웃 스케일, 다크 모드 중립색 — 원본 캡처에 존재하지 않는 것들이다.

이때 그 값들을 검증된 토큰과 섞어버리면, 나중에 누군가 "Apple이 이렇게 한다"며 **네가 지어낸 값을 인용한다.** 이 스킬은 그 오염을 구조적으로 막는다.

## 1. 두 종류의 토큰을 절대 섞지 않는다

| 표기                | 의미                                                      | 예                                                              |
| ------------------- | --------------------------------------------------------- | --------------------------------------------------------------- |
| `[verified]`        | `DESIGN.md`의 `tokens:` 프론트매터에서 **직접** 가져온 값 | Primary `#0071e3`, Canvas `#f5f5f7`, Link `#0066cc`             |
| `[local extension]` | 원본 캡처에 없어 이 프로젝트가 정의한 값                  | hover/focus/disabled 상태, 브레이크포인트, 모션 값, 다크 표면색 |

**모든 토큰 선언 줄에 주석으로 표기한다.** 파일 상단에 한 번 설명하고 마는 것으로는 부족하다 — 나중에 특정 줄만 보는 사람에게 출처가 전달되어야 한다.

```css
@theme {
  --color-primary: #0071e3; /* [verified] 채움 버튼 배경, active 언더라인 */
  --color-link: #0066cc; /* [verified] 라이트 배경 위 링크 텍스트 */
  --color-link-dark: #2997ff; /* [verified] 다크 배경 위 링크 */
  --color-canvas: #f5f5f7; /* [verified] 페이지 바닥면 */
  --color-surface: #ffffff; /* [verified] 카드, 입력 */

  --color-surface-dark: #1d1d1f; /* [local extension] 원본 foreground를 다크 표면으로 전용 */
  --color-overlay: rgb(0 0 0 / 0.32); /* [local extension] 모달 배경 */
  --duration-base: 150ms; /* [local extension] 색/배경/테두리 전환 */
}
```

**원본 레퍼런스 파일을 수정하지 않는다.** 토큰 값을 바꿔야 한다고 판단되면 `global.css`에 `[local extension]` 주석과 함께 **확장 토큰을 추가**한다. 원본을 고치는 순간 검증 이력(`verified: 날짜`)이 거짓이 된다.

**원본 산문에 인코딩 깨짐이 있을 수 있다.** `DESIGN.md`의 경우 산문 영역에 UTF-8 모지바케가 있지만 `tokens:` 프론트매터의 수치·헥스는 온전하다. 수치는 프론트매터에서만 읽고, 산문은 의미 해석용으로만 쓴다.

## 2. Tailwind v4는 CSS-first다

`tailwind.config.js`를 만들지 않는다. 토큰은 `src/styles/global.css`의 `@theme` 블록에 선언한다.

```css
@import 'tailwindcss';

@theme {
  /* 토큰 선언 */
}
```

`@theme`에 선언한 `--color-primary`는 자동으로 `bg-primary` / `text-primary` 유틸리티가 된다. 이름을 지을 때 이 파생을 염두에 둔다.

## 3. 다크 모드는 변수 재정의로만 한다

```css
@theme {
  --color-bg: #f5f5f7;
  --color-fg: #1d1d1f;
  --color-link: #0066cc;
}

[data-theme='dark'] {
  --color-bg: #000000; /* [verified] */
  --color-fg: #f5f5f7; /* [local extension] */
  --color-link: #2997ff; /* [verified] 다크 배경 위 링크 */
}
```

**컴포넌트에 색 리터럴을 쓰지 않는다.** `#0071e3`을 컴포넌트 파일에 직접 쓰는 순간 그 요소만 다크 모드에서 안 바뀐다. 모든 색은 `var(--color-*)` 참조다.

컴포넌트에 `dark:` 변형을 흩뿌리는 것도 피한다. 색 결정이 토큰 레이어에 모여 있어야 팔레트 조정이 한 곳에서 끝난다.

**검증:** `grep -rnE '#[0-9a-fA-F]{6}' src/components/ src/layouts/` 결과가 0이어야 한다.

## 4. FOUC를 막는 것은 스크립트의 위치다

테마 초기화 스크립트는 `<head>` 안, **스타일시트보다 먼저**, **동기 실행**이어야 한다.

```astro
<head>
  <script is:inline>
    (() => {
      const stored = localStorage.getItem('theme');
      const theme = stored ?? 'system';
      const dark =
        theme === 'dark' ||
        (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    })();
  </script>
  <link rel="stylesheet" ... />
</head>
```

- `is:inline`이 필수다. 없으면 Astro가 번들로 옮겨 실행이 늦어진다
- `defer`나 `type="module"`을 붙이지 않는다 — 둘 다 실행을 지연시켜 흰 화면 깜빡임이 생긴다
- body 끝으로 옮기면 확실히 깜빡인다

**이 회귀는 눈에 잘 안 띈다.** 빠른 기기에서는 거의 안 보이고, 느린 기기와 다크 모드 사용자에게만 나타난다. 위치를 바꿀 이유가 생기면 그 이유를 의심하라.

## 5. 3상태 테마 토글의 접근성

시스템 / 라이트 / 다크 3상태다. `aria-pressed`는 boolean이라 부적절하다.

```astro
<button aria-label={`테마: ${labels[current]}`}></button>
```

상태가 바뀌면 `aria-label`도 갱신한다. 스크린리더 사용자가 현재 상태를 알 방법이 이것뿐이다.

## 6. 대비는 계산하지 눈으로 판단하지 않는다

이 팔레트에서 이미 확인된 조합:

| 전경          | 배경          | 비율       | 판정             |
| ------------- | ------------- | ---------- | ---------------- |
| `#1d1d1f`     | `#ffffff`     | 15.9:1     | 통과             |
| `#1d1d1f`     | `#f5f5f7`     | 14.6:1     | 통과             |
| `#515154`     | `#ffffff`     | 7.9:1      | 통과             |
| `#6e6e73`     | `#ffffff`     | 5.1:1      | 통과             |
| `#6e6e73`     | `#f5f5f7`     | 4.7:1      | 통과 (겨우 넘음) |
| `#0066cc`     | `#ffffff`     | 5.6:1      | 통과             |
| `#ffffff`     | `#0071e3`     | 4.7:1      | 통과             |
| `#2997ff`     | `#000000`     | 7.0:1      | 통과             |
| `#86868b`     | `#000000`     | 5.8:1      | 통과             |
| **`#0071e3`** | **`#000000`** | **4.47:1** | **AA 미달**      |

**마지막 줄이 이 팔레트의 함정이다.** Primary 색을 다크 배경 위 텍스트로 쓰면 AA에 미달한다. 다크 배경 위 파란 텍스트에는 반드시 `#2997ff`를 쓴다. Primary는 다크에서도 **채움 배경**으로만 쓴다.

`#6e6e73` on `#f5f5f7`이 4.7:1로 겨우 넘는다는 것은, **이보다 옅은 회색을 추가할 여지가 없다**는 뜻이다. "조금 더 연한 보조 텍스트"가 필요해 보이면 그건 위계를 색이 아닌 다른 수단(크기, 여백, 굵기)으로 만들라는 신호다.

**색만으로 정보를 전달하지 않는다.** 카테고리는 배지 텍스트, 내비 선택은 언더라인, 상태는 라벨 텍스트를 함께 제공한다.

## 7. 프리미티브 구현 시 지킬 것

| 항목            | 규칙                                                          | 이유                                                            |
| --------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| 그림자          | 쓰지 않는다                                                   | 이 디자인 언어는 깊이를 배경 대비와 1px 헤어라인으로만 표현한다 |
| 버튼 press      | 배경색 변경만. `transform: scale()` 금지                      | pill 형태에서 왜곡이 눈에 띈다                                  |
| focus-visible   | `2px solid` primary(다크: link-dark), `outline-offset: 2px`   | `outline: none`을 대체 표시 없이 쓰는 것은 접근성 위반          |
| 터치 타깃       | 최소 44×44px                                                  | WCAG 2.5.8. 시각 크기가 작아도 패딩으로 히트 영역 확보          |
| hover 전용 정보 | 만들지 않는다                                                 | 터치 기기에서 도달 불가. `@media (hover: none)`에서 항상 표시   |
| 탭 하이라이트   | `-webkit-tap-highlight-color: transparent` + 명시적 `:active` | 기본 하이라이트는 디자인과 충돌                                 |
| 아이콘          | `stroke-width: 1.5`, `currentColor` 상속                      | 아이콘에 색을 직접 지정하면 다크 모드와 상태 변화에서 어긋난다  |

## 8. reduced-motion 오버라이드

전역 CSS에 한 번 선언해두면 이후 추가되는 모든 전환에 자동 적용된다.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}
```

`0`이 아니라 `0.01ms`인 이유: 일부 브라우저에서 `0`은 `transitionend` 이벤트를 발화시키지 않아, 그 이벤트에 의존하는 코드가 멈춘다.

## 흔한 함정

| 증상                               | 원인                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------- |
| 페이지 로드 시 흰 화면 깜빡임      | 테마 스크립트가 `is:inline`이 아니거나 스타일시트 뒤에 있음            |
| 특정 요소만 다크 모드에서 안 바뀜  | 컴포넌트에 색 리터럴 하드코딩                                          |
| 스타일이 조용히 무시됨             | `var(--color-...)` 변수명 오타. CSS는 오타를 에러로 알리지 않는다      |
| 다크 모드 파란 텍스트가 흐릿함     | `#0071e3`을 텍스트로 사용 (4.47:1). `#2997ff`로 교체                   |
| 모바일에서 버튼이 안 눌림          | 터치 타깃 44px 미만                                                    |
| `@theme` 토큰이 유틸리티로 안 생김 | Tailwind v4 명명 규칙 불일치 (`--color-*`, `--spacing-*` 등 접두 확인) |
