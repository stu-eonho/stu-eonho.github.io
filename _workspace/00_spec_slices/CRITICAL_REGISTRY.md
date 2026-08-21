# CRITICAL REGISTRY — Study Log

`STUDY_LOG_SPEC.md`에서 CRITICAL로 표시된 제약의 단일 목록. 구현·리뷰·재실행 시 이 목록을 기준으로 검사한다.

## A. 아키텍처
| # | 제약 | 근거(스펙 위치) |
|---|---|---|
| A1 | 서버·DB·런타임 API 없음. `output: 'static'`, 런타임 데이터 페치 금지 | overview, technology_stack.content_layer |
| A2 | 카테고리는 데이터다. 추가 = `categories.ts` 항목 + `src/content/posts/<id>/` 폴더. `src/pages/` 무수정 | overview, core_functionality.category_navigation |
| A3 | `/[category]/[slug].astro`는 단일 세그먼트. rest(`[...slug]`) 금지 — 페이지네이션과 충돌 | route_conflict_rules |
| A4 | `page/1` 경로 생성 금지. 1페이지는 `/{category}` | route_conflict_rules |
| A5 | `getStaticPaths()`는 CATEGORIES에 없는 id를 생성하지 않는다 | route_conflict_rules |
| A6 | `base`는 `/` 유지(사용자 사이트). 설정 시 자산 경로가 어긋난다 | deployment.hosting |
| A7 | React/Vue/Svelte 등 UI 프레임워크 도입 금지 | technology_stack.ui_language |
| A8 | TypeScript 6.0.3 고정. 7.x는 `astro check` peer 충돌로 실패 | tooling.language |
| A9 | `build` 스크립트는 `astro check`를 선행 | build_configuration |
| A10 | `public/.nojekyll` 커밋 (`_astro/` 보호) | build_configuration |

## B. 콘텐츠 스키마
| # | 제약 |
|---|---|
| B1 | 스키마 위반은 경고가 아니라 **빌드 실패** |
| B2 | `category==='paper-review'` → `paper` 블록 required (superRefine) |
| B3 | `category==='project'` → `project` 블록 required (superRefine) |
| B4 | `cover` 있으면 `coverAlt` required |
| B5 | `slug`는 `^[a-z0-9-]+$` — 슬래시 금지 |
| B6 | `_`로 시작하는 템플릿 파일은 glob에서 제외 (`!**/_*`) |
| B7 | `draft: true`는 프로덕션에서 경로 자체가 생성되지 않는다(목록·RSS·sitemap·검색 전부 제외) |
| B8 | 논문 PDF 원문을 리포에 커밋하지 않는다. `pdfUrl` 외부 링크만 |
| B9 | arXiv/DOI는 API 호출 없이 문자열 조합 |

## C. 디자인 토큰
| # | 제약 |
|---|---|
| C1 | 모든 토큰에 `[verified]` / `[local extension]` 출처 주석. 확장값을 Apple 검증값으로 표기 금지 |
| C2 | `#0071e3`를 다크 캔버스 위 **텍스트**로 쓰지 않는다(4.47:1, AA 미달). 다크 링크는 `#2997ff` |
| C3 | `#0066cc`를 채움 배경색으로 쓰지 않는다 |
| C4 | `box-shadow`를 깊이 표현에 쓰지 않는다(focus 신호 제외). 그림자 토큰 없음 |
| C5 | radius는 8 / 18 / 980px + 프로필 사진 50%만 |
| C6 | 폰트 크기는 56/40/28/20/17/14/12px 7종만 |
| C7 | 버튼 높이는 44px / 36px 두 값만. 하나로 합치지 않는다 |
| C8 | 성공/경고/위험용 빨강·초록·주황 도입 금지 |
| C9 | SF Pro를 웹폰트로 재배포하지 않는다(시스템 폰트 스택 참조만). Pretendard는 자체 호스팅 |
| C10 | 색상 리터럴을 컴포넌트에 직접 쓰지 않는다 — 전부 CSS 변수 경유 |
| C11 | placeholder 색 `#6e6e73`보다 옅게 쓰지 않는다 |

## D. 모션 (사용자 요청 레이어 포함)
| # | 제약 |
|---|---|
| D1 | 페이지 전환 애니메이션 없음. Astro View Transitions 미사용 |
| D2 | 버튼 press에 `transform: scale()` 금지 |
| D3 | 무한 루프 애니메이션은 검색 스켈레톤이 유일 |
| D4 | `prefers-reduced-motion: reduce`에서 transition/animation 0.01ms, `scroll-behavior: auto`, 스켈레톤 정지 |
| D5 | anime.js는 (1) reduced-motion 아님 → (2) 리빌 대상 존재 → (3) 동적 import, 이 **순서** 고정 |
| D6 | 모션 청크 예산 gzip ≤ 12KB. 초과 시 범위를 줄인다(예산을 올리지 않는다) |
| D7 | CSS 기본값 = 애니메이션 **최종 상태**. `opacity:0`을 CSS 기본값으로 두지 않는다 |
| D8 | 이동 8px / duration 240–420ms / stagger 총지연 ≤400ms / ease outQuad·outCubic / opacity+translateY만 |
| D9 | `once: true` 고정. 스크롤 스크러빙(`sync`) 미사용 |
| D10 | LCP 요소(프로필 사진)에 리빌을 걸지 않는다 |

## E. 접근성
| # | 제약 |
|---|---|
| E1 | 선택 상태를 색상만으로 표시하지 않는다(내비: 언더라인 + `aria-current`) |
| E2 | 아이콘 전용 버튼에 `aria-label` 필수, 장식 아이콘에 `aria-hidden="true"` |
| E3 | `outline: none`을 대체 표시 없이 쓰지 않는다. focus-visible 2px `#0071e3` / 다크 `#2997ff` |
| E4 | 최소 탭 타깃 44×44px |
| E5 | 페이지당 h1 1개, 헤딩 위계 건너뛰기 금지 |
| E6 | 검색 결과 개수는 `aria-live="polite"` |
| E7 | 테마 토글은 3상태 → `aria-pressed` 대신 `aria-label`로 상태 전달 |
| E8 | `/` 외 단일 키 단축키 추가 금지 |
| E9 | 375px에서 `body` 가로 스크롤 금지 — 표/코드블록은 자체 컨테이너 스크롤 |

## F. 콘텐츠·보안·운영
| # | 제약 |
|---|---|
| F1 | 글 상세는 `prev_next_nav`에서 끝난다. 댓글 영역·자리표시자·주석 처리된 댓글 코드 금지 |
| F2 | 검색어를 DOM에 넣을 때 `textContent`. Pagefind 하이라이트 마크업만 예외 |
| F3 | `data-pagefind-body`는 본문 컨테이너에만. 헤더/푸터/내비/메타패널 제외 |
| F4 | `profile.ts`에 그럴듯한 가짜 이름·학교·스킬 창작 금지. 꺾쇠 플레이스홀더 |
| F5 | 플레이스홀더 상태로도 **빌드 성공**. 미기입은 경고 1줄(종료 코드 영향 없음) |
| F6 | 빈 값은 해당 요소가 통째로 사라진다(빈 상자·깨진 레이아웃 금지) |
| F7 | GoatCounter 고지 문구는 `PUBLIC_GOATCOUNTER_CODE`가 있을 때만 출력 |
| F8 | 비밀 값을 환경변수/빌드에 넣지 않는다(정적 산출물에 평문으로 남음) |
| F9 | 외부 링크에 `rel="noopener noreferrer"` |
| F10 | 폰트·CSS·JS를 CDN에서 로드하지 않는다(KaTeX·Pretendard 포함 자체 호스팅) |
| F11 | Actions `permissions` 최소 권한: contents:read, pages:write, id-token:write |
| F12 | 빌드 로그에 환경변수 값 출력 금지 |
| F13 | KaTeX CSS는 `math: true` 글에만 |
| F14 | 인덱스는 `/search` 첫 입력 시 동적 import |

## G. 사용자 요청 × 스펙 충돌 해석 (확정)
사용자 요청("잔잔한 anime.js 모션")과 스펙 `<animations>`의 교집합은 다음으로 확정한다.
- 추가되는 것은 **진입 리빌 레이어 하나**뿐 (페이드 + ≤8px 상승 + 스태거)
- D1~D4는 그대로 유지된다 — 페이지 전환·press scale·추가 무한 루프는 여전히 금지
- CSS로 되는 것(hover/focus/press/스켈레톤)은 CSS에 남긴다
