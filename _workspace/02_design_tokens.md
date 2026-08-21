# 02 — 디자인 토큰 인벤토리

정의 위치: `src/styles/global.css`. 모든 토큰에 `[verified]` / `[local extension]` 출처 주석이 달려 있다.

## 구조

1. `@theme` 블록 — 테마와 무관한 스케일 (원색 팔레트, 폰트, 타이포, 간격, radius, 브레이크포인트, 모션)
2. `:root` — 시맨틱 역할 변수 (라이트)
3. `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }` — system 상태의 다크
4. `:root[data-theme='dark']` — 명시적 다크 선택

컴포넌트는 2~4의 시맨틱 변수만 참조한다. **색상 리터럴 0건** (`src/` 전체 grep 확인).

## 스펙과 달라진 값 3건 — 전부 WCAG AA 때문

| 토큰 | 스펙 제안 | 실제 채택 | 이유 |
|---|---|---|---|
| `--accent-hover` | `#0077ed` | `#006edb` | 흰 텍스트 대비 4.32:1 → AA 미달. 채택값은 4.94:1 |
| `--accent-active` | `#006edb` | `#0064c8` | hover가 내려오면서 press가 더 어두워야 위계가 유지된다. 5.74:1 |
| `--accent-tint` | `rgba(0,113,227,0.10)` | `0.07` | 카테고리 배지가 캔버스(`#f5f5f7`) 위에 놓일 때 4.49:1 → 미달. 채택값 4.67:1 |
| `--interest-tint` | `rgba(0,113,227,0.08)` | `0.05` | accent tint보다 약하다는 관계를 유지하기 위해 함께 하향 |
| `--disabled-fg` (신규) | `#6e6e73` | 라이트 `#515154` / 다크 `#a1a1a6` | 비활성 배경 위에서 각각 4.26:1, 3.90:1로 미달이었다 |

전부 `[local extension]` 값이므로 조정 가능한 범위였다. `[verified]` 값은 하나도 바꾸지 않았다.

## 프리미티브

| 컴포넌트 | 변형 | 지오메트리 |
|---|---|---|
| `ui/Button.astro` | primary / outline / compact / compact-outline | 44px(앞 둘), 36px(뒤 둘) |
| `ui/Card.astro` | `href`, `interactive`, `flush` | radius 18px, hairline, 그림자 없음 |
| `ui/Badge.astro` | accent / neutral / chip / interest | 24px(앞 둘), 32px(뒤 둘) |
| `ui/Pagination.astro` | — | compact-outline 2개 + 인디케이터 |
| `ui/EmptyState.astro` | — | 48px 아이콘 + 문구 + CTA |
| `tag/TagChip.astro` | step 1/2/3 (14/17/20px) | 최소 히트 44px |

## 모션 훅 (다른 모듈이 붙이는 지점)

| 속성 | 의미 |
|---|---|
| `data-reveal` | 리빌 대상 하나 |
| `data-reveal-group` | 자식 `[data-reveal]`을 시차로 묶는 컨테이너 |

CSS 기본값은 최종 상태(`opacity:1; transform:none`)다. 시작 상태는 스크립트가 라이브러리를 실제로 받은 뒤에만 세팅한다.

## 준수 확인

- radius: 8 / 18 / 980px + 프로필 사진 50% 외 0건
- font-size: 56/40/28/20/17/14/12px 외 0건 (`inherit` 제외)
- `box-shadow`: 깊이 표현 용도 0건 (주석 언급 1건뿐)
- 대비: 라이트·다크 38개 조합 전부 4.5:1 이상
