<feature_specification>

<feature_name>Admin Console — Study Log 로컬 전용 관리자 콘솔 (`astro dev` 한정 `/admin`)</feature_name>

<overview>
Study Log는 서버가 없는 100% 정적 사이트다. 지금 운영자가 글을 쓰려면 에디터에서 MDX 파일을 만들고 프론트매터를 손으로 채운 뒤 커밋해야 하며, 프로필·경력·카테고리·UI 문자열은 `src/config/*.ts`를 직접 편집해야 한다. 이 방식은 Zod 스키마 위반(예: `paper-review` 글에 `paper` 블록 누락)이나 번역본 누락을 **빌드가 실패한 뒤에야** 알려 준다.

이 기능은 `npm run dev`로 개발 서버를 띄웠을 때만 열리는 관리자 콘솔 `/admin`을 추가한다. 브라우저 폼에서 글을 쓰고, 프로필과 사이트 설정을 고치고, 태그를 정리하고, 이미지를 올리면 관리자 서버가 리포지토리의 **실제 소스 파일**을 고쳐 쓴다. 저장 전에 실제 콘텐츠 스키마로 검증하므로 스키마 위반이 브라우저에서 즉시 잡힌다. 저장 결과는 곧 git 워킹 트리의 변경이며, 운영자가 커밋·푸시하면 기존 GitHub Actions가 배포한다.

핵심 사용자 흐름은 네 가지다. (1) `/admin/posts`에서 글 목록을 훑고 새 글을 만들어 프론트매터 폼 + MDX 본문을 채우면 우측에 KaTeX·Shiki가 적용된 실시간 프리뷰가 뜬다. (2) 한국어 원문 옆의 "EN 번역 만들기"로 `<slug>.en.mdx` 스텁을 생성하고 원문과 나란히 번역한다. (3) `/admin/profile`에서 이름·학적·경력·스킬·링크를 ko/en 두 벌로 채우면 `src/config/profile.ts`의 `PROFILE` 선언만 갱신된다. (4) `/admin/tags`에서 표기가 갈린 태그(`NLP` / `nlp`)를 병합하면 해당 글들의 프론트매터가 일괄 수정된다.

CRITICAL: 관리자 콘솔은 **프로덕션 빌드 산출물(`dist/`)에 한 바이트도 포함되지 않는다.** 라우트·미들웨어·클라이언트 스크립트 모두 `command === 'dev'`일 때만 등록되며, `astro:build:done` 훅에서 `dist/` 내 `/admin` 경로와 `__admin` 문자열의 부재를 검사해 하나라도 발견되면 빌드를 실패시킨다. 기존 스펙 `STUDY_LOG_SPEC.md`의 CRITICAL 제약("서버·데이터베이스·런타임 API가 존재하지 않는다")은 **배포되는 사이트에 대해 그대로 유효**하다.

CRITICAL: 관리자 콘솔은 방문자용 기능이 아니다. 인증·권한 개념이 없으며, 대신 "로컬 루프백에서만 접근 가능"을 보안 경계로 삼는다. 접근 제어의 실체는 `security_considerations`에 정의된 루프백 검사 + Origin 검사 + 세션 토큰 3중 게이트다.

CRITICAL: 관리자가 소스 파일을 쓸 때는 **편집 대상 선언의 바이트 범위만 교체한다.** 파일을 통째로 재생성하지 않는다. import·타입 선언·헬퍼 함수·문서 주석은 언제나 원본 그대로 남는다.
</overview>

<assumptions>
- 실행 위치: 사용자가 "로컬 전용 `/admin`"으로 확정했다. 배포된 사이트에 Git 기반 CMS(Sveltia/Decap)를 얹는 경로는 채택하지 않았다 — OAuth 중개 서버가 별도로 필요하고 `/admin`이 공개 URL이 되기 때문이다. 나중에 전환하려면 이 스펙의 데이터 계약(프론트매터 키 순서, 파일 배치)은 그대로 재사용 가능하다.
- 편집 범위: 사용자가 네 영역(글 CRUD / EN 번역본 / 프로필·경력·학력·스킬 / 카테고리·태그·사이트 설정·UI 문자열)을 모두 선택했다.
- 편집기 수준: 사용자가 "프리뷰 + 이미지 업로드"를 선택했다. 좌우 분할 편집기와 `src/assets/` 드래그앤드롭 업로드가 포함된다.
- UI 프레임워크 없음: 관리자 UI를 바닐라 TypeScript로 만든다. 근거 — (a) React/Preact 인테그레이션을 `astro.config.mjs`에 추가하면 프로덕션 빌드 경로에도 영향이 가는데, 이 사이트의 zero-JS 기본값을 흔들 이유가 없다. (b) 관리자 화면은 평평한 필드 목록 + 반복 행이 대부분이라 `<template>` 복제로 충분하다. (c) 기존 `src/scripts/*.ts`가 이미 바닐라 패턴이다. 대가: 반복 행(경력·학력·스킬 그룹) 렌더링 코드를 손으로 써야 한다 — `admin/client/repeatable.ts` 한 곳에 모은다.
- 코드 편집기 위젯 없음: CodeMirror·Monaco를 도입하지 않는다. 본문은 `textarea` + 모노스페이스 + Tab 들여쓰기 처리로 다룬다. 근거: 새 의존성 없이 요구를 충족하며, 문법 하이라이트는 우측 프리뷰가 대신한다.
- TS 소스 편집 엔진: 새 파서를 도입하지 않고 이미 직접 의존성인 `typescript` 6.0.3의 컴파일러 API(`ts.createSourceFile`)로 노드 위치를 얻어 바이트 스플라이스한다. 근거: ts-morph/recast를 새로 넣지 않아도 되고, 교체 범위 밖의 주석이 자동으로 보존된다.
- 마크다운 프리뷰 엔진: `@astrojs/markdown-remark` 7.2.4의 `createMarkdownProcessor`를 쓴다. 이 패키지는 이미 `astro.config.mjs`가 `unified`를 가져오는 곳이라 별도 설치가 필요 없다.
- MDX의 JSX 표현식은 프리뷰에서 렌더링하지 않는다. 근거: MDX 컴파일 + 컴포넌트 해석을 요청마다 돌리는 비용이 프리뷰의 가치보다 크다. JSX·`import`·`export` 줄은 프리뷰에서 회색 자리표시 블록으로 표시하고 "실제 렌더는 dev 서버 페이지에서 확인" 링크를 붙인다.
- git 커밋·푸시는 이번 범위 밖이다 (`scope_boundaries` 참조). 관리자는 `git status`를 **읽기만** 한다. 근거: 푸시는 곧 공개 배포라 되돌리기 어려운 외부 행위이며, 사용자가 명시적으로 요청하지 않았다.
- 새 npm 의존성은 `yaml` 하나뿐이며 `devDependencies`에 넣는다. 현재 `node_modules`에 2.9.0이 Astro의 전이 의존성으로 존재하지만, 호이스팅에 기대는 것은 취약하므로 명시 선언한다. 프론트매터 **읽기**는 `@astrojs/markdown-remark`의 `parseFrontmatter`가, **쓰기**는 `yaml`의 `stringify`가 담당한다. 손으로 YAML을 만들면 한국어 문장 속 콜론·따옴표·숫자형 문자열(`arxivId: '1706.03762'`) 인용 규칙에서 반드시 사고가 난다.
- 동시 편집을 가정하지 않는다. 1인 운영이고 dev 서버는 한 대다. 다만 "에디터에서 파일을 직접 고쳤는데 관리자 탭이 옛 내용을 들고 있는" 상황은 실재하므로, 저장 시 mtime 기반 충돌 검사를 넣는다 (`error_handling` 참조).
</assumptions>

<open_questions>
- Q1. git 커밋·푸시 버튼을 2단계로 추가할 것인가? 추가하면 "저장 → 커밋 → 푸시 → 자동 배포"가 관리자 화면 안에서 끝나지만, 실수로 초안을 공개 배포할 위험이 생긴다. 이번 스펙의 기본값은 **읽기 전용 git status + 복사 가능한 명령어 문자열**이다. 답에 따라 `api_changes`의 `/__admin/api/git/*`에 커밋·푸시 엔드포인트가 추가된다.
- Q2. `src/config/i18n.ts`의 UI 문자열 편집에서 **키 추가·삭제**를 허용할 것인가? 이번 스펙의 기본값은 **기존 키의 문자열 값만 편집**이다(키 추가는 컴포넌트 수정과 짝이라 관리자 화면에서 단독으로 할 일이 아니다). 함수형 값 18개(예: `language.switchTo`)는 읽기 전용으로 표시한다.
- Q3. 이미지 최적화를 관리자가 할 것인가? 업로드된 원본을 그대로 `src/assets/`에 두면 Astro의 이미지 파이프라인이 빌드 시 최적화하지만, 20MB짜리 원본이 git에 들어간다. 이번 스펙의 기본값은 **8MB 상한 + 초과 시 거부**이며 리사이즈는 하지 않는다. `sharp` 0.35.3이 이미 설치되어 있어 "긴 변 2400px로 축소 후 저장"을 넣는 것은 어렵지 않다 — 필요 여부만 결정하면 된다.
- Q4. 관리자 화면의 언어를 한국어 고정으로 둘 것인가? 이번 스펙의 기본값은 **한국어 고정**이다(운영자 1인, 한국어 사용자). 관리자 UI 문자열은 `src/config/i18n.ts`의 `UI` 사전을 거치지 않고 `admin/` 안에 별도로 둔다 — 사이트 UI 사전에 관리자 전용 키가 섞이면 두 언어 모두에 불필요한 번역 부담이 생긴다.
</open_questions>

<existing_codebase_context>
  <stack>
    Astro 7.2.4 (`output: 'static'`, `trailingSlash: 'ignore'`) + TypeScript 6.0.3 + Tailwind CSS 4.3.3(`@tailwindcss/vite`, CSS-first `@theme`) + MDX 7.0.7. Node 22.12.0 이상(`.nvmrc`, 로컬 실측 v24.14.1). 패키지 매니저 npm. `package.json` 실측 기준이며 이 스펙은 여기 적힌 버전만 참조한다.
    관련 기설치 패키지: `@astrojs/markdown-remark` 7.2.4(전이), `yaml` 2.9.0(전이), `sharp` 0.35.3, `shiki` 4.4.3, `katex` 0.18.4, `astro-pagefind` 2.0.1, `astro-icon` 1.2.0 + `@iconify-json/lucide` 1.2.124.
    빌드 게이트: `npm run build` = `astro check && astro build`, 이후 CI에서 `node scripts/check-links.mjs dist`.
  </stack>
  <conventions>
    - 경로 별칭: `@/*` → `src/*` (`tsconfig.json`의 `paths`). Astro가 자동 적용한다.
    - 설정의 단일 진실 공급원: `src/config/site.ts`(사이트 상수), `src/config/categories.ts`(카테고리 = 데이터), `src/config/i18n.ts`(언어·UI 문자열), `src/config/profile.ts`(홈 CV 데이터).
    - CRITICAL: 화면 문자열을 컴포넌트에 직접 쓰지 않는다. 사이트 컴포넌트는 전부 `i18n(Astro.url)`의 `t`를 거친다. 내부 링크는 `href()`를 거친다.
    - 콘텐츠: `src/content/posts/<category>/<slug>.mdx`(한국어) / `<slug>.en.mdx`(영어). 컬렉션 id는 확장자만 뗀 경로(`notes/intl-date-format.en`)다 — `content.config.ts`의 커스텀 `generateId` 때문이며, 언어 접미사가 id에 남는 것이 번역본 구분의 근거다.
    - 밑줄로 시작하는 파일은 글로브에서 제외된다(`_template.paper-review.mdx` 등).
    - 순수 함수 헬퍼는 `src/lib/*.ts`: `posts.ts`(정렬·필터·언어별 선별·페이지네이션), `tags.ts`(`slugifyTag`, `collectTags`), `date.ts`, `seo.ts`, `feed.ts`, `reading-time.ts`.
    - UI 프리미티브는 `src/components/ui/`: `Button.astro`(variant: primary / outline / compact / compact-outline), `Card.astro`, `Badge.astro`, `EmptyState.astro`, `Pagination.astro`.
    - 스타일: `src/styles/global.css`가 `@theme` 토큰과 시맨틱 변수(`--canvas`, `--surface`, `--fg`, `--hairline`, `--accent` 등)를 정의하고, 다크는 `@media (prefers-color-scheme: dark)`와 `:root[data-theme='dark']` 두 곳에서 재정의한다. 본문 타이포는 `src/styles/prose.css`의 `.prose-body`.
    - CRITICAL: 색상 리터럴을 컴포넌트에 쓰지 않는다. 전부 `global.css`의 CSS 변수를 경유한다. `DESIGN.md`는 수정 금지이며, 새 값이 필요하면 `global.css`에 `[local extension]` 주석과 함께 추가한다.
    - 클라이언트 스크립트는 `src/scripts/*.ts` 바닐라 TS(`motion.ts`, `shortcuts.ts`).
  </conventions>
  <relevant_modules>
    - `astro.config.mjs` — 인테그레이션 배열에 관리자 인테그레이션 한 줄을 추가한다. `markdown` 블록은 공용 모듈로 추출된다.
    - `src/content.config.ts` — Zod 스키마 보유. 관리자 검증이 같은 스키마를 쓰도록 팩토리로 추출한다.
    - `src/config/profile.ts` — `PROFILE` 선언이 관리자 쓰기 대상. `collectPlaceholderFields()`는 대시보드의 "미기입 항목" 위젯이 재사용한다.
    - `src/config/site.ts` — `SITE` 선언이 쓰기 대상. 단 `navOrder`는 `SORTED_CATEGORIES`에서 파생되는 계산식이라 읽기 전용이다.
    - `src/config/categories.ts` — `CATEGORIES` 배열이 쓰기 대상. `as const satisfies readonly Category[]` 꼬리를 반드시 보존해야 한다.
    - `src/config/i18n.ts` — `ko` / `en` 사전의 문자열 리터럴이 쓰기 대상. 18개 함수형 값은 읽기 전용.
    - `src/lib/tags.ts`의 `slugifyTag`, `collectTags` — 태그 관리 화면이 그대로 재사용한다.
    - `src/lib/posts.ts`의 번역본 짝짓기 규칙(비공개 `translationKey`) — 관리자도 같은 규칙(`category` + `slug`)을 써야 한다.
    - `scripts/check-links.mjs` — 빌드 후 링크 검사. 관리자는 이 파일을 수정하지 않는다.
    - `_workspace/06_i18n_contract.md` — 다국어 계약 문서. 관리자 EN 번역 흐름은 이 계약을 위반하면 안 된다.
  </relevant_modules>
  <reuse_do_not_reinvent>
    - 버튼·카드·배지·빈 상태: `src/components/ui/*.astro`를 그대로 쓴다. 관리자용 버튼을 새로 만들지 않는다.
    - 색·간격·radius·폰트: `src/styles/global.css`의 시맨틱 변수만 쓴다. 관리자 전용 색을 하드코딩하지 않는다. 관리자에만 필요한 값(예: 폼 필드 높이)은 `admin/styles/admin.css`에서 기존 변수를 조합해 정의한다.
    - 본문 프리뷰 타이포: `src/styles/prose.css`의 `.prose-body`를 프리뷰 컨테이너에 그대로 붙인다. 프리뷰용 타이포를 새로 쓰지 않는다.
    - 태그 정규화: `slugifyTag()`를 쓴다. 관리자에서 소문자화 로직을 다시 쓰지 않는다.
    - 프론트매터 파싱: `@astrojs/markdown-remark`의 `parseFrontmatter`를 쓴다. 정규식으로 구분자 블록을 잘라 내지 않는다.
    - 스키마 검증: 추출된 `postSchema()` 팩토리를 쓴다. 관리자에 검증 규칙을 복제하지 않는다 — 복제하는 순간 두 벌이 갈라진다.
    - 날짜 표기: 화면 표기가 필요하면 `src/lib/date.ts`를 쓴다.
  </reuse_do_not_reinvent>
</existing_codebase_context>

<scope_boundaries>
  <in_scope>
    - `astro dev`에서만 열리는 `/admin` 라우트 8종(대시보드·글 목록·글 편집·프로필·설정·문자열·태그·에셋)
    - 개발 서버 전용 JSON API(`/__admin/api/*`) — 루프백 + Origin + 세션 토큰 3중 게이트
    - 글 CRUD: 생성·수정·삭제·초안 토글·슬러그 변경(파일 rename 포함)
    - 카테고리별 조건부 프론트매터 폼: `paper` 블록(paper-review), `project` 블록(project)
    - 저장 전 실제 Zod 스키마 검증 및 필드별 오류 표시
    - MDX 본문 편집기와 서버 렌더 실시간 프리뷰(KaTeX 수식, Shiki 코드 하이라이트, 목차 추출)
    - EN 번역본 생성·편집, 원문/번역 좌우 대조, 번역 누락 목록
    - `src/config/profile.ts`의 `PROFILE` 편집 — 이름·소개·이메일·위치·학적·경력·스킬 그룹·관심 분야·링크·CV, ko/en 양쪽
    - `src/config/site.ts`의 `SITE` 편집(파생 필드 `navOrder` 제외), `src/config/categories.ts`의 `CATEGORIES` 편집(추가·수정·순서 변경)
    - `src/config/i18n.ts`의 `ko`/`en` UI 문자열 값 편집(키 구조 불변)
    - 태그 관리: 사용 현황, 이름 변경, 병합, 삭제 — 대상 글 프론트매터 일괄 수정
    - 이미지 업로드(`src/assets/`), 목록, 삭제, 사용처 검색, 프로필 사진 교체, 커버 이미지 상대 경로 자동 삽입
    - 대시보드: 글·초안·번역 누락 수, 프로필 미기입 항목, git 워킹 트리 변경 파일 목록(읽기 전용)
    - 프로덕션 빌드에서 관리자 코드가 완전히 배제되는지 검사하는 빌드 훅
  </in_scope>
  <out_of_scope>
    - 배포된 사이트에서의 관리자 접근 — `stu-eonho.github.io/admin`은 404여야 한다. 이것이 이 기능의 가장 중요한 부정 요구사항이다.
    - 사용자 계정·로그인·비밀번호·역할 — 로컬 루프백 접근이 곧 권한이다
    - git 커밋·푸시·브랜치 조작 (Q1 참조). `git status --porcelain` 읽기만 한다
    - 서버·데이터베이스·서버리스 함수 — 관리자 API는 dev 서버 프로세스 안에서만 산다
    - `src/pages/**`, `src/components/**`, `src/lib/**`, `src/styles/**` 편집 — 코드는 에디터에서 고친다
    - `src/config/i18n.ts`의 UI 문자열 **키 추가·삭제**, 새 언어 추가
    - 카테고리 폴더 자동 생성 이외의 라우트 생성 — 카테고리는 여전히 데이터이며 페이지 파일을 만들지 않는다
    - WYSIWYG 리치 텍스트 편집 — 본문은 언제나 MDX 소스로 다룬다
    - MDX의 JSX 컴포넌트 실제 렌더링 프리뷰
    - 이미지 리사이즈·포맷 변환·EXIF 제거 (Q3 참조)
    - 되돌리기 히스토리·자동 저장 버전 관리 — git이 그 역할을 한다
    - 관리자 화면의 다국어(영어) 지원 (Q4 참조)
    - 관리자 화면의 모션 — `src/scripts/motion.ts`와 anime.js는 관리자에서 쓰지 않는다
  </out_of_scope>
</scope_boundaries>

<file_structure>
관리자 코드는 **전부 리포지토리 루트의 `admin/` 아래에 산다.** `src/` 안에는 관리자 파일을 만들지 않는다.

CRITICAL: 관리자 `.astro` 페이지를 `src/pages/` 아래 두면 안 된다. Astro의 파일 기반 라우터가 프로덕션 빌드에서 그대로 집어 `dist/admin/`을 만든다. `admin/pages/`에 두고 dev일 때만 `injectRoute()`로 주입하는 것이 배제를 보장하는 유일한 구조다.

```
admin/
  integration.mjs              # Astro 인테그레이션 진입점. command === 'dev'에서만 라우트+미들웨어 등록
  build-guard.mjs              # astro:build:done 훅 — dist에 관리자 흔적이 있으면 빌드 실패
  server/
    middleware.mjs             # Connect 미들웨어. /__admin/api/* 라우팅, JSON 파싱, 에러 봉투
    guard.mjs                  # 루프백 검사 + Origin 검사 + 세션 토큰 검증
    paths.mjs                  # 허용 루트 화이트리스트, realpath 기반 트래버설 차단
    fsx.mjs                    # 원자적 쓰기(임시 파일 → rename), mtime 스탬프 읽기/검증
    handlers/
      session.mjs              # GET /session
      posts.mjs                # 글 목록/읽기/생성/수정/삭제/번역 스텁
      preview.mjs              # POST /preview — 마크다운 렌더
      profile.mjs              # GET/PUT /profile
      config.mjs               # GET/PUT /config/site, /config/categories
      strings.mjs              # GET/PUT /strings
      tags.mjs                 # GET /tags, POST /tags/rename, /tags/merge, /tags/delete
      assets.mjs               # GET/POST/DELETE /assets
      git.mjs                  # GET /git/status (읽기 전용)
    codegen/
      frontmatter.mjs          # 프론트매터 직렬화(yaml.stringify) + 키 순서·기본값 생략 규칙
      ts-edit.mjs              # typescript 컴파일러 API 기반 바이트 스플라이스 엔진
      ts-emit.mjs              # JS 값 → TS 리터럴 문자열 (들여쓰기·따옴표 규칙)
  pages/
    index.astro                # /admin
    posts.astro                # /admin/posts
    editor.astro               # /admin/posts/edit
    profile.astro              # /admin/profile
    settings.astro             # /admin/settings
    strings.astro              # /admin/strings
    tags.astro                 # /admin/tags
    assets.astro               # /admin/assets
  components/
    AdminLayout.astro          # 관리자 셸 — 사이드바 + 저장 바 + 토스트 영역
    AdminNav.astro
    Field.astro                # label + input + 힌트 + 오류 슬롯
    LocalizedField.astro       # ko/en 두 칸 + "두 언어 동일" 토글
    RepeatableList.astro       # 반복 행 컨테이너 + template
    SaveBar.astro              # 하단 고정 저장 바 (변경 개수·저장·되돌리기)
    DiffPreview.astro          # 일괄 수정 전 영향 파일 목록
  client/
    api.ts                     # fetch 래퍼 — 세션 토큰 주입, 에러 봉투 해석, 토스트
    editor.ts                  # 글 편집기 상태·프리뷰 디바운스·단축키
    forms.ts                   # 폼 ↔ JSON 직렬화, dirty 추적, 이탈 경고
    repeatable.ts              # 반복 행 추가·삭제·순서 이동
    uploader.ts                # 드래그앤드롭 + base64 인코딩 + 진행 표시
    strings.ts                 # 문자열 편집기 (ko/en 병렬, 검색 필터)
  styles/
    admin.css                  # 관리자 전용 레이아웃·폼 스타일. global.css 변수만 사용
  labels.ts                    # 관리자 화면 한국어 문자열 (사이트 UI 사전과 분리)
```

기존 파일 중 수정되는 것은 다음 6개뿐이다.

```
astro.config.mjs               # markdown 설정 추출 + adminConsole() 인테그레이션 추가
markdown.config.mjs            # (신규) 빌드와 프리뷰가 공유하는 마크다운 옵션 팩토리
src/content.config.ts          # 스키마를 src/content/schema.ts 팩토리 호출로 대체
src/content/schema.ts          # (신규) postSchema({ image }) 팩토리 — 규칙 원본
src/config/i18n.ts             # ko/en 사전을 관리자가 스플라이스한다 (구조 변경 없음)
package.json                   # devDependencies에 yaml 추가, scripts에 admin 안내 한 줄
```
</file_structure>

<environment_variables>
관리자는 비밀 값을 쓰지 않는다. 아래 변수는 모두 선택이며 dev 서버 프로세스에서만 읽힌다. CRITICAL: 이 값들은 `PUBLIC_` 접두사를 붙이지 않는다 — 붙이는 순간 Vite가 클라이언트 번들에 인라인할 수 있게 되고, 그것이 곧 프로덕션 유출 경로다.

  <variable>
    <name>ADMIN_ALLOW_REMOTE</name>
    <purpose>`1`이면 루프백이 아닌 출발지의 관리자 API 요청을 허용한다. `astro dev --host`로 다른 기기(태블릿 등)에서 관리자에 접속할 때만 켠다.</purpose>
    <default>미설정(= 차단). 기본 동작은 `127.0.0.1`·`::1` 이외의 원격 주소를 403으로 거절하는 것이다.</default>
    <risk>CRITICAL: 켜면 같은 네트워크의 누구나 리포지토리 파일을 고쳐 쓸 수 있다. 켠 상태에서는 관리자 상단에 빨간 경고 배너를 상시 노출한다.</risk>
  </variable>
  <variable>
    <name>ADMIN_DISABLED</name>
    <purpose>`1`이면 dev 서버에서도 관리자 라우트와 API를 등록하지 않는다. 관리자 없이 사이트만 확인하고 싶을 때 쓴다.</purpose>
    <default>미설정(= 활성)</default>
  </variable>
  <variable>
    <name>PUBLIC_SITE_URL</name>
    <purpose>기존 변수. `astro.config.mjs`와 `src/config/site.ts`가 읽는다. 관리자는 이 값을 표시만 하고 편집하지 않는다 — 환경변수가 우선하므로 `SITE.url`을 고쳐도 덮어써진다는 안내 문구를 설정 화면에 띄운다.</purpose>
    <default>`https://stu-eonho.github.io`</default>
  </variable>
  <variable>
    <name>PUBLIC_GOATCOUNTER_CODE</name>
    <purpose>기존 변수. 관리자 설정 화면에서 현재 설정 여부만 읽기 전용으로 표시한다.</purpose>
    <default>빈 문자열(= 분석 스크립트·푸터 고지 모두 미출력)</default>
  </variable>
</environment_variables>

<data_model_changes>
데이터베이스가 없으므로 "데이터 모델"은 리포지토리의 파일 형태와 스키마 정의를 뜻한다. 콘텐츠 스키마 자체는 **한 필드도 바뀌지 않는다.** 바뀌는 것은 스키마가 사는 위치뿐이다.

  <change entity="post schema (src/content.config.ts)">
    - MOVE: `defineCollection`에 인라인되어 있던 Zod 스키마를 `src/content/schema.ts`의 팩토리로 옮긴다.

    ```ts
    // src/content/schema.ts (신규)
    import { z } from 'astro/zod';
    import { CATEGORY_IDS, getCategory } from '../config/categories';
    import { DEFAULT_LANG, LANG_IDS } from '../config/i18n';

    /**
     * 글 프론트매터 스키마의 유일한 정의.
     *
     * CRITICAL: `image`를 주입받는 이유는 Astro의 content loader가 넘겨주는 `image()`와
     * 관리자 검증기가 넘기는 대체 검증기를 같은 스키마로 쓰기 위해서다. 관리자에 규칙을
     * 복제하면 두 벌이 조용히 갈라진다.
     */
    export function postSchema({ image }: { image: () => z.ZodTypeAny }) {
      return z.object({ /* 기존 필드 정의를 한 글자도 바꾸지 않고 이동 */ })
        .superRefine((data, ctx) => { /* 기존 superRefine 그대로 이동 */ });
    }
    ```

    - `src/content.config.ts`는 `schema: ({ image }) => postSchema({ image })` 한 줄로 줄어든다. `loader`·`generateId`·`pattern`은 **손대지 않는다.**
    - 관리자는 `postSchema({ image: () => z.string() })`로 호출하고, 반환된 문자열 경로가 실제 파일로 존재하는지는 별도로 검사한다(`core_functionality`의 검증 파이프라인 4단계 참조).
    - 기존 콘텐츠 파일: 영향 없음. 마이그레이션 불필요.
    - CRITICAL: 이동 후 `astro check`와 `astro build`가 이동 전과 **동일한 오류/경고 수(0/0)** 를 내야 한다. 이것이 리팩터링 무해성의 증거다.
  </change>

  <change entity="markdown config (astro.config.mjs)">
    - MOVE: `markdown` 블록을 루트 `markdown.config.mjs`의 팩토리로 옮긴다.

    ```js
    // markdown.config.mjs (신규)
    import { unified } from '@astrojs/markdown-remark';
    import remarkMath from 'remark-math';
    import rehypeKatex from 'rehype-katex';

    /**
     * CRITICAL: 팩토리다. 상수 객체로 두고 재사용하면 unified 프로세서 인스턴스가
     * 빌드와 프리뷰 요청 사이에 공유되어 상태가 섞인다.
     */
    export function createMarkdownOptions() {
      return {
        processor: unified({
          remarkPlugins: [remarkMath],
          rehypePlugins: [[rehypeKatex, { strict: false }]],
        }),
        shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
      };
    }
    ```

    - `astro.config.mjs`는 `markdown: createMarkdownOptions()`가 된다. 출력물은 바이트 단위로 동일해야 한다.
    - 관리자 프리뷰는 `createMarkdownProcessor(createMarkdownOptions())`를 dev 서버 기동 시 한 번 만들어 재사용한다.
  </change>

  <change entity="i18n dictionaries (src/config/i18n.ts)">
    - 구조 변경 **없음.** `ko`/`en` 선언은 그 자리에 그대로 있고, 관리자는 개별 문자열 리터럴 노드의 바이트 범위만 교체한다.
    - 근거: 이 사전에는 함수형 값이 18개 있고(`language.switchTo` 등) 섹션 주석이 23개 있다. 통째로 재생성하면 둘 다 잃는다.
  </change>

  <change entity="파일 배치 규약 (변경 없음, 관리자가 지켜야 할 계약)">
    - 한국어 원문: `src/content/posts/<category>/<slug>.mdx` — 프론트매터에 `lang` 키를 쓰지 않는다(기본값 `ko`).
    - 영어 번역본: `src/content/posts/<category>/<slug>.en.mdx` — 프론트매터에 `lang: en`을 **반드시** 쓴다.
    - 두 파일의 `slug`와 `category`는 반드시 같아야 한다. 이것이 `src/lib/posts.ts`의 번역본 짝짓기 키다.
    - 확장자: 신규 글은 `.mdx`로 만든다(기존 `.md` 파일은 그대로 둔다). 근거: 수식·컴포넌트 확장 여지가 있고 기존 3개 중 2개가 이미 `.mdx`다.
    - 이미지: `src/assets/<name>.<ext>`. 글에서의 참조는 항상 `../../../assets/<name>.<ext>` (엔트리가 `src/content/posts/<category>/` 깊이에 있으므로 세 단계 상위다).
    - 프로필 사진: `src/assets/profile.{jpg,jpeg,png,webp}` 중 **정확히 하나.** `src/config/profile.ts`의 `import.meta.glob`이 매칭 결과의 첫 항목을 쓰므로 둘 이상 있으면 어느 쪽이 잡힐지 보장되지 않는다.
  </change>

  <migration>
    - 스키마·마크다운 설정 이동은 순수 리팩터링이라 데이터 백필이 없다.
    - 배포 순서 제약 없음. 관리자 코드는 배포물에 포함되지 않으므로 GitHub Actions 워크플로(`.github/workflows/deploy.yml`)를 **수정하지 않는다.**
  </migration>
</data_model_changes>

<api_changes>
전부 신규다. 기존 엔드포인트가 없으므로 수정 항목도 없다.

  <transport>
    - 마운트 접두사: `/__admin/api`. CRITICAL: 이 접두사는 Astro 라우터가 아니라 Vite dev 서버의 Connect 미들웨어가 처리한다. `src/pages/api/`에 엔드포인트를 만들면 `output: 'static'`에서 프리렌더 대상이 되어 POST가 동작하지 않고, 프로덕션 빌드 산출물에도 흔적이 남는다.
    - 요청·응답 모두 `application/json; charset=utf-8`. 유일한 예외는 이미지 업로드이며, 이 역시 JSON 본문에 base64 문자열로 싣는다(멀티파트 파서 의존성을 피한다).
    - 본문 상한 12MB. 초과 시 즉시 413으로 끊고 스트림을 파기한다.
    - 모든 변경 요청(POST/PUT/DELETE)은 `X-Admin-Token` 헤더를 요구한다.
    - 성공 응답: `{ "ok": true, "data": <payload> }`
    - 실패 응답: `{ "ok": false, "error": { "code": "E-...", "message": "한국어 설명", "field": "폼 필드 경로 또는 null", "detail": <추가 정보 또는 null> } }`
    - CRITICAL: 모든 실패는 이 봉투를 지킨다. 미들웨어가 처리되지 않은 예외를 잡아 `E-INTERNAL`로 감싸며, 스택 트레이스는 터미널에만 찍고 응답 본문에 넣지 않는다.
  </transport>

  <endpoint method="GET" path="/__admin/api/session">
    세션 토큰을 발급한다. 관리자 페이지가 로드될 때 가장 먼저 호출한다.
    - 응답: `{ token, projectRoot, siteTitle, siteUrl, gitBranch, allowRemote, categories[], languages[] }`
    - `token`은 32바이트 난수의 hex 문자열이며 dev 서버 프로세스 메모리에만 산다. 서버 재시작 시 무효.
    - CRITICAL: 이 엔드포인트만 토큰 없이 호출 가능하다. 대신 루프백·Origin 게이트는 여기에도 동일하게 적용된다.
  </endpoint>

  <endpoint method="GET" path="/__admin/api/posts">
    글 목록. 파일시스템을 매 요청 스캔한다(캐시 없음 — 에디터로 직접 고친 변경을 놓치지 않기 위해).
    - 쿼리: `category`, `lang`, `draft`(`all` | `only` | `exclude`), `q`(제목·설명·태그 부분 일치)
    - 응답 항목: `{ id, path, category, slug, lang, title, description, date, updated, tags[], draft, hasTranslation, translationId, mtime, valid, issues[] }`
    - `id`는 콘텐츠 컬렉션 id와 동일한 규칙(확장자만 제거한 상대 경로, 예: `notes/intl-date-format.en`)
    - `valid`/`issues`는 각 파일을 `postSchema()`로 돌린 결과다. 목록에서 스키마가 깨진 글이 바로 보인다.
    - CRITICAL: 밑줄로 시작하는 파일(`_template.*`)은 목록에서 제외한다 — 콘텐츠 로더와 동일한 규칙.
  </endpoint>

  <endpoint method="GET" path="/__admin/api/posts/:id">
    단일 글 원문. `:id`는 URL 인코딩된 컬렉션 id.
    - 응답: `{ id, path, frontmatter, body, raw, mtime, sibling }`
    - `frontmatter`는 파싱된 객체, `body`는 프론트매터를 뺀 본문 문자열, `raw`는 파일 전체
    - `sibling`은 반대 언어 파일의 `{ id, exists }`
    - 404 조건: 파일 없음 → `E-NOT-FOUND`
  </endpoint>

  <endpoint method="POST" path="/__admin/api/posts">
    새 글 생성.
    - 요청: `{ category, slug, lang, frontmatter, body }`
    - 처리 순서: (1) slug 정규식 `^[a-z0-9-]+$` 검사 → (2) 대상 경로 계산 → (3) 중복 검사 → (4) `postSchema()` 검증 → (5) 카테고리 폴더 없으면 생성 → (6) 원자적 쓰기
    - 응답: `{ id, path, mtime }`
    - CRITICAL: 같은 `category`+`slug`+`lang` 파일이 이미 있으면 덮어쓰지 않고 409 `E-DUPLICATE-SLUG`를 낸다.
  </endpoint>

  <endpoint method="PUT" path="/__admin/api/posts/:id">
    글 수정. slug·category·lang 변경 시 파일 이동을 포함한다.
    - 요청: `{ frontmatter, body, baseMtime }`
    - `baseMtime`이 디스크의 현재 mtime과 다르면 409 `E-STALE`을 내고 저장하지 않는다. 응답 `detail`에 디스크 현재 내용을 실어 클라이언트가 비교 화면을 띄운다.
    - slug 변경 시: 새 경로에 쓰고 옛 파일을 지운다. CRITICAL: 번역본이 있으면 **짝도 함께 rename** 한다 — 한쪽만 바뀌면 짝짓기가 끊겨 번역본이 독립된 글로 노출된다. 이 동작은 응답 `data.renamed[]`에 명시하고 저장 전 확인 다이얼로그로 알린다.
    - 응답: `{ id, path, mtime, renamed[] }`
  </endpoint>

  <endpoint method="DELETE" path="/__admin/api/posts/:id">
    글 삭제.
    - 쿼리: `withTranslation=1`이면 번역본도 함께 삭제
    - CRITICAL: 휴지통으로 옮기지 않고 즉시 삭제한다. 복구 수단은 git이다 — 클라이언트는 삭제 확인 다이얼로그에 "커밋되지 않은 변경은 되돌릴 수 없습니다"를 반드시 표시한다.
    - 응답: `{ deleted[] }`
  </endpoint>

  <endpoint method="POST" path="/__admin/api/posts/:id/translation">
    반대 언어 스텁 생성.
    - 원문의 프론트매터를 복사하되 `lang`을 반대 언어로 바꾸고, `title`·`description`은 원문 값을 그대로 넣은 뒤 본문 맨 위에 `> (번역 필요)` 인용 한 줄과 원문 본문을 넣는다.
    - `slug`·`category`·`date`·`tags`·`paper`·`project`는 원문과 동일하게 복사한다. CRITICAL: `slug`가 갈리면 짝짓기가 깨진다.
    - 이미 존재하면 409 `E-DUPLICATE-SLUG`
    - 응답: `{ id, path }`
  </endpoint>

  <endpoint method="POST" path="/__admin/api/preview">
    본문 렌더링.
    - 요청: `{ body, math }`
    - 처리: JSX·`import`·`export` 줄을 자리표시 마커로 치환 → `createMarkdownProcessor(createMarkdownOptions())`로 렌더 → `{ html, headings[], strippedBlocks }`
    - `headings`는 `{ depth, slug, text }` 배열이며 편집기의 목차 미리보기가 쓴다.
    - 성능 목표: 3,000자 본문 기준 200ms 이내. 클라이언트는 400ms 디바운스로 호출하고, 응답이 늦으면 직전 요청을 `AbortController`로 취소한다.
    - CRITICAL: 프로세서 인스턴스를 요청마다 새로 만들지 않는다(Shiki 하이라이터 초기화가 수백 ms다). dev 서버 기동 시 한 번 만들어 재사용한다.
  </endpoint>

  <endpoint method="GET,PUT" path="/__admin/api/profile">
    - GET 응답: `{ profile, placeholders[], photo, mtime }` — `profile`은 `PROFILE` 객체를 JSON으로 직렬화한 값, `placeholders`는 `collectPlaceholderFields()` 결과, `photo`는 `src/assets/profile.*` 파일명 또는 null
    - PUT 요청: `{ profile, baseMtime }`
    - PUT 처리: `admin/server/codegen/ts-edit.mjs`가 `src/config/profile.ts`에서 `PROFILE` 초기자의 범위를 찾아 재생성한 리터럴로 교체한다. 파일의 나머지(문서 주석 블록, 인터페이스, `isPlaceholder`, `collectPlaceholderFields`, `PROFILE_PHOTO` glob)는 바이트 그대로 남는다.
    - CRITICAL: `PROFILE` 리터럴 **내부**의 줄 주석(예: `// 재학 중이면 null → "현재"로 표시됩니다`)은 재생성 시 사라진다. 같은 설명이 파일 상단 인터페이스의 JSDoc에 이미 있으므로 정보 손실은 아니다. 관리자는 이 화면 첫 저장 시 이 사실을 한 번 고지한다.
  </endpoint>

  <endpoint method="GET,PUT" path="/__admin/api/config/site">
    - GET 응답: `{ site, editable[], derived[], envOverrides, mtime }`
    - 편집 가능: `title`, `description.ko`, `description.en`, `postsPerPage`, `recentPostsOnHome`, `rssItemLimit`, `defaultOgImage`, `url`
    - CRITICAL 읽기 전용: `base`(사용자 사이트에서 `/` 고정), `navOrder`(`SORTED_CATEGORIES`에서 파생되는 스프레드 표현식). `navOrder`를 리터럴 배열로 펴 쓰면 카테고리를 추가해도 내비게이션이 따라오지 않는다 — 이 표현식은 원문 그대로 보존한다.
    - `url`은 환경변수 `PUBLIC_SITE_URL`이 우선하므로, 그 변수가 설정된 상태면 UI에 "환경변수가 이 값을 덮어씁니다" 경고를 띄운다.
  </endpoint>

  <endpoint method="GET,PUT" path="/__admin/api/config/categories">
    - GET 응답: `{ categories[], postCounts, mtime }`
    - PUT 요청: `{ categories[], baseMtime }` — `CATEGORIES` 배열 전체를 새 리터럴로 교체
    - 처리: 저장 시 각 카테고리의 `src/content/posts/<id>/` 폴더가 없으면 만든다.
    - CRITICAL: `as const satisfies readonly Category[]` 꼬리를 보존한다. 이 꼬리가 없으면 `CategoryId` 유니온이 `string`으로 넓어지고 Zod enum과 라우트 타입이 동시에 무너진다.
    - CRITICAL: 글이 남아 있는 카테고리는 삭제를 거부한다(409 `E-CATEGORY-IN-USE`). `postCounts`로 UI가 미리 삭제 버튼을 비활성화한다.
    - `icon`은 lucide 이름 문자열이며, 저장 시 `@iconify-json/lucide`에 존재하는 이름인지 검사해 없으면 422 `E-UNKNOWN-ICON`.
  </endpoint>

  <endpoint method="GET,PUT" path="/__admin/api/strings">
    - GET 응답: `{ tree, mtime }` — `tree`는 `{ path: 'nav.archive', ko: 'Archive', en: 'Archive', kind: 'string' | 'function' }` 배열(점 표기 경로 기준 평탄화)
    - PUT 요청: `{ changes: [{ path, lang, value }], baseMtime }`
    - 처리: `ts-edit.mjs`가 `ko`/`en` 선언 안에서 해당 경로의 `StringLiteral` 노드를 찾아 그 노드만 교체한다. 다른 모든 바이트(23개 섹션 주석, 18개 함수형 값 포함)는 불변이다.
    - CRITICAL: `kind: 'function'` 항목에 대한 변경 요청은 422 `E-READONLY-STRING`으로 거절한다.
    - CRITICAL: 키 추가·삭제 요청은 받지 않는다. `ko`와 `en`의 키 집합이 갈리는 순간 `astro check`가 실패하고, 그 복구를 관리자가 해 줄 수 없다.
  </endpoint>

  <endpoint method="GET" path="/__admin/api/tags">
    - 응답: `{ tags: [{ slug, variants: [{ raw, count }], total, posts: [{ id, title, lang }] }] }`
    - `slug`는 `src/lib/tags.ts`의 `slugifyTag()` 결과다. 같은 슬러그로 접히는 서로 다른 원문 표기(`NLP` / `nlp`)가 `variants`에 모여 정규화 대상이 드러난다.
  </endpoint>

  <endpoint method="POST" path="/__admin/api/tags/rename">
    - 요청: `{ from, to, dryRun }` — `from`은 원문 표기 또는 슬러그, `to`는 새 원문 표기
    - `dryRun: true`면 파일을 쓰지 않고 `{ affected: [{ id, before[], after[] }] }`만 돌려준다. UI는 항상 dryRun을 먼저 호출해 영향 범위를 보여 준 뒤 확정 요청을 보낸다.
    - 처리: 대상 파일의 프론트매터 `tags` 배열만 바꿔 다시 직렬화한다. 본문은 손대지 않는다.
    - CRITICAL: `to`가 24자를 넘으면 422 `E-TAG-TOO-LONG`(스키마의 항목당 24자 제한).
  </endpoint>

  <endpoint method="POST" path="/__admin/api/tags/merge">
    - 요청: `{ sources[], target, dryRun }` — 여러 표기를 하나로 접는다. 중복 제거 후 원래 순서를 유지한다.
  </endpoint>

  <endpoint method="POST" path="/__admin/api/tags/delete">
    - 요청: `{ tag, dryRun }` — 모든 글의 `tags`에서 제거한다. 결과적으로 `tags: []`가 되는 글은 프론트매터에서 `tags` 키 자체를 생략한다(기본값이 `[]`이므로).
  </endpoint>

  <endpoint method="GET" path="/__admin/api/assets">
    - 응답: `{ assets: [{ name, ext, bytes, width, height, mtime, usedBy: [{ id, field }] }] }`
    - `width`/`height`는 `sharp`로 읽는다(이미 설치됨). `usedBy`는 모든 글의 프론트매터 `cover`와 본문 텍스트에서 파일명을 검색한 결과다.
  </endpoint>

  <endpoint method="POST" path="/__admin/api/assets">
    - 요청: `{ filename, dataBase64, purpose }` — `purpose`는 `content` 또는 `profile-photo`
    - 파일명 정규화: 소문자화 → 공백·언더바를 하이픈으로 → `[a-z0-9.-]` 이외 제거 → 중복이면 `-2`, `-3` 접미
    - 허용 확장자: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, `.gif`. CRITICAL: `.svg`는 거부한다(422 `E-ASSET-TYPE`) — 프리뷰 iframe에서 스크립트가 실행될 수 있는 유일한 이미지 포맷이다.
    - 매직 바이트 검사: 확장자와 실제 시그니처가 다르면 422 `E-ASSET-TYPE`. 확장자만 믿지 않는다.
    - 상한 8MB. 초과 시 413 `E-ASSET-TOO-LARGE`.
    - `purpose: 'profile-photo'`면 `profile.<ext>`로 저장하고 **기존 `profile.*` 파일을 모두 지운다.** CRITICAL: 둘 이상 남으면 `import.meta.glob` 결과의 첫 항목이 무엇인지 보장되지 않는다.
    - 응답: `{ name, path, relativeFromPost, width, height, bytes }` — `relativeFromPost`는 글에 붙여 넣을 `../../../assets/<name>` 문자열
  </endpoint>

  <endpoint method="DELETE" path="/__admin/api/assets/:name">
    - `usedBy`가 비어 있지 않으면 409 `E-ASSET-IN-USE`. 강제 삭제 옵션을 두지 않는다 — 참조가 남은 채 파일이 사라지면 `astro build`가 실패한다.
  </endpoint>

  <endpoint method="GET" path="/__admin/api/git/status">
    - `execFile('git', ['status', '--porcelain=v1', '-z'])`로 읽는다. CRITICAL: 셸을 경유하지 않는다(`exec` 금지) — 인자에 사용자 입력이 섞이지 않더라도 셸 호출 자체를 두지 않는 편이 안전하다.
    - 응답: `{ branch, files: [{ status, path }], clean }`
    - git 리포지토리가 아니거나 git이 없으면 오류가 아니라 `{ available: false }`로 응답한다. 관리자의 다른 기능은 git 없이도 전부 동작해야 한다.
  </endpoint>
</api_changes>

<ui_changes>
  <modified>
    사이트 화면은 **하나도 바뀌지 않는다.** 헤더·푸터·홈·목록·상세·검색·404 모두 현재 렌더 결과가 그대로 유지되어야 한다. 관리자 화면에서 사이트 화면으로 가는 링크는 있지만 그 반대는 없다 — 사이트 어디에도 `/admin` 링크를 넣지 않는다.

    CRITICAL: `src/components/ui/*.astro`를 관리자 요구에 맞춰 수정하지 않는다. 관리자에만 필요한 변형(예: 폭 100% 입력형 버튼)은 `admin/styles/admin.css`에서 클래스를 덧붙여 해결한다. 프리미티브를 건드리면 사이트 38개 대비 조합을 다시 검증해야 한다.
  </modified>

  <added>
    <routes>
      아래 8개는 전부 `admin/integration.mjs`가 dev에서만 `injectRoute()`로 주입한다. 프로덕션 라우트 표에는 존재하지 않는다.

      | 패턴 | entrypoint | 화면 |
      |------|-----------|------|
      | `/admin` | `admin/pages/index.astro` | 대시보드 |
      | `/admin/posts` | `admin/pages/posts.astro` | 글 목록 |
      | `/admin/posts/edit` | `admin/pages/editor.astro` | 글 편집기 (쿼리 `?id=` 없으면 새 글) |
      | `/admin/profile` | `admin/pages/profile.astro` | 프로필·경력·학력·스킬 |
      | `/admin/settings` | `admin/pages/settings.astro` | 사이트 설정 + 카테고리 |
      | `/admin/strings` | `admin/pages/strings.astro` | UI 문자열 |
      | `/admin/tags` | `admin/pages/tags.astro` | 태그 관리 |
      | `/admin/assets` | `admin/pages/assets.astro` | 이미지 |
    </routes>

    <shell name="AdminLayout">
      - 구조: 좌측 고정 사이드바 240px + 우측 본문. 1024px 미만에서 사이드바가 상단 가로 탭으로 접힌다.
      - 사이드바: 상단에 사이트 제목(`SITE.title`)과 "dev 전용" 배지, 그 아래 8개 내비게이션 항목(lucide 아이콘 + 라벨), 하단에 "사이트 열기 →"(새 탭으로 `/`)와 git 브랜치 표기.
      - 배경 `var(--canvas)`, 사이드바 `var(--surface)`, 구분선 `var(--hairline)`. 폰트 `var(--font-text)`, 본문 크기 `var(--text-body)`.
      - 현재 항목: 배경 `var(--accent-tint)`, 텍스트 `var(--link)`, 좌측 3px `var(--accent)` 바.
      - 하단 고정 저장 바(`SaveBar`): 변경이 있을 때만 나타난다. 높이 64px, 배경 `var(--surface)`, 상단 `var(--hairline-strong)` 경계, 좌측에 "변경 N건", 우측에 `Button variant="outline"`(되돌리기) + `Button variant="primary"`(저장). 단축키 `Cmd/Ctrl+S`.
      - 토스트: 우측 하단, 성공은 `var(--accent-tint)` 배경 + `var(--link)` 텍스트, 실패는 `var(--surface)` 배경 + 2px `var(--accent)` 좌측 바 + 오류 코드 표기. 4초 후 자동 소멸, 실패 토스트는 수동 닫기 전까지 유지.
      - 다크 모드: 사이트와 동일하게 `prefers-color-scheme`을 따르고 `data-theme` 속성도 존중한다. 관리자에는 테마 토글을 두지 않는다 — 사이트에서 고른 값을 `localStorage`에서 그대로 읽는다.
      - CRITICAL: 원격 접근이 허용된 상태(`ADMIN_ALLOW_REMOTE`)면 화면 최상단에 높이 40px 경고 배너를 상시 고정한다. 문구: "원격 접근이 허용되어 있습니다. 같은 네트워크의 누구나 이 리포지토리를 수정할 수 있습니다."
      - 접근성: 사이드바는 `nav` + `aria-current="page"`. 저장 바의 상태 변화는 `aria-live="polite"`. 모든 히트 영역 최소 44px. 포커스 링은 `var(--focus-ring)` 2px + 2px 오프셋 — 사이트와 동일.
    </shell>

    <page name="Dashboard" route="/admin">
      - 상단: 인사 없이 바로 통계 타일 4개를 2×2(모바일) / 1×4(데스크톱) 그리드로. 각 타일은 `Card`를 쓰고 큰 숫자(`var(--text-tile)`) + 라벨(`var(--text-small)`, `var(--fg-muted)`).
        1. 전체 글 (초안 제외 / 초안 포함 병기)
        2. 초안 — 클릭 시 `/admin/posts?draft=only`
        3. 번역 누락 — EN 번역본이 없는 한국어 글 수. 클릭 시 목록 필터로 이동
        4. 스키마 오류 — `postSchema()` 검증에 실패한 글 수. 0이 아니면 숫자를 `var(--link)` 대신 굵게 표시하고 타일 좌측에 경고 아이콘
      - 중단 좌측: "프로필 미기입 항목" 카드. `collectPlaceholderFields()` 결과를 점 표기 경로 목록으로 보여 주고 각 항목이 `/admin/profile`의 해당 필드로 앵커 이동한다. 비어 있으면 `EmptyState`로 "모든 프로필 항목이 채워졌습니다".
      - 중단 우측: "최근 수정" 카드 — mtime 내림차순 글 5개, 제목 + 상대 시간 + 카테고리 `Badge`.
      - 하단: "커밋되지 않은 변경" 카드. `git status` 결과를 파일 경로 목록으로. 상단에 복사 버튼이 달린 코드 블록으로 `git add -A && git commit -m "..." && git push` 문자열을 제공한다(실행하지 않는다). git이 없으면 카드 전체를 숨긴다.
      - 빈 상태: 글이 0건이면 통계 타일 대신 `EmptyState` + "첫 글 쓰기" `Button`.
    </page>

    <page name="PostList" route="/admin/posts">
      - 상단 도구 줄: 검색 입력(제목·설명·태그), 카테고리 `select`, 언어 `select`, 초안 3상태 세그먼트(전체/초안만/공개만), 우측에 "새 글" `Button variant="primary"`.
      - 표: 열 순서 — 상태 / 제목 / 카테고리 / 태그 / 날짜 / 번역 / 동작.
        - 상태: 초안이면 `Badge`("초안"), 스키마 오류면 `Badge`("오류") + `title` 툴팁에 첫 오류 메시지
        - 제목: 클릭 시 편집기로. 아래 줄에 `var(--text-caption)` `var(--fg-muted)`로 파일 경로
        - 번역: EN이 있으면 "EN" `Badge`, 없으면 "+ EN" 텍스트 버튼(클릭 시 스텁 생성 후 편집기로 이동)
        - 동작: "사이트에서 보기"(새 탭, 초안이면 비활성), "삭제"
      - 정렬: 기본 `date` 내림차순. 열 머리글 클릭으로 date / title / mtime 정렬 전환.
      - 행 높이 52px, 구분선 `var(--hairline)`, hover 배경 `var(--surface-hover)`.
      - 삭제: 확인 다이얼로그에 파일 경로, "번역본도 함께 삭제" 체크박스(번역본이 있을 때만), 그리고 "커밋되지 않은 변경은 되돌릴 수 없습니다" 경고. 확인 버튼은 3초간 비활성 후 활성화하지 않는다 — 대신 슬러그를 타이핑해 확인하는 방식도 쓰지 않는다. 단순 확인 1회면 충분하다(로컬 파일이고 git이 뒤를 받친다).
      - 빈 상태: 필터 결과 0건과 글 0건을 다른 문구로 구분한다.
    </page>

    <page name="PostEditor" route="/admin/posts/edit">
      - 레이아웃: 좌 55% 편집 / 우 45% 프리뷰. 1024px 미만에서는 "편집 / 프리뷰" 탭 전환. 분할 비율은 드래그로 조절하고 `localStorage`에 저장.
      - 좌측 상단 프론트매터 폼 — 접을 수 있는 `details` 섹션 3개:
        1. **기본** (항상 펼침): title(120자 카운터), description(200자 카운터), category `select`, slug(자동 생성 + 수동 잠금 해제), date, updated, tags(칩 입력 + 기존 태그 자동완성), lang(읽기 전용 표시, 파일명에서 파생), draft 토글, math 토글, toc 토글
        2. **커버 이미지**: 드롭 영역 + `/admin/assets`에서 고르기. 선택 시 `cover` 상대 경로와 `coverAlt` 입력이 함께 나타난다. CRITICAL: `cover`가 있는데 `coverAlt`가 비면 저장 버튼을 비활성화한다(스키마의 `superRefine` 규칙을 폼 단계에서 미리 강제).
        3. **카테고리 메타** (카테고리에 따라 내용이 통째로 바뀜):
           - `paper-review` → paperTitle, authors(반복 행), venue, year(number), arxivId, doi, pdfUrl, codeUrl, readDate
           - `project` → role, period.start(YYYY-MM), period.end(YYYY-MM 또는 "진행 중" 토글 → null), stack(칩 입력, 최소 1), status `select`(in-progress / completed / archived), repoUrl, demoUrl, teamSize
           - `notes` → 섹션 자체를 숨긴다
           - CRITICAL: 카테고리를 바꾸면 이전 카테고리의 메타 블록 값을 즉시 버리지 않고 "이 값들은 저장 시 제거됩니다" 안내와 함께 회색으로 남긴다. 되돌리면 값이 살아난다.
      - 좌측 하단 본문 편집기: `textarea`, `var(--font-mono)`, 14px/22px, 최소 높이 400px, `spellcheck="false"`, `Tab`은 두 칸 삽입(포커스 이동은 `Esc` 후 `Tab`).
        - 도구 줄: 굵게 / 기울임 / 링크 / 코드 / 인용 / 수식(`$$`) / 이미지 삽입 / H2 / H3. 각 버튼은 선택 영역을 감싸는 단순 텍스트 삽입이며, 단축키는 `Cmd/Ctrl+B`, `+I`, `+K`.
      - 우측 프리뷰: `.prose-body` 클래스 그대로. 상단에 목차 칩 줄(`headings`), 하단에 예상 읽기 시간(`src/lib/reading-time.ts` 규칙 재사용). 400ms 디바운스로 `/__admin/api/preview` 호출. 갱신 중에는 기존 내용을 유지하고 우측 상단에 작은 스피너만 표시한다 — CRITICAL: 프리뷰를 비웠다 채우면 화면이 깜빡인다(사이트 모션 작업에서 이미 겪은 문제와 같은 유형).
        - JSX·import·export 줄은 `var(--chip-fill)` 배경의 점선 테두리 블록으로 "MDX 컴포넌트 — 프리뷰에서 렌더링하지 않습니다"라고 표시한다.
      - 검증 표시: 저장 시도 시 스키마 오류를 해당 필드 아래 `var(--text-small)`로 붙이고, 첫 오류 필드로 스크롤 + 포커스한다. 필드 테두리는 `var(--hairline-strong)`에서 2px `var(--accent)`로 바뀐다. CRITICAL: 오류 표시를 색에만 의존하지 않는다 — 아이콘과 텍스트를 함께 쓴다.
      - 번역 대조: 상단 우측 "원문 보기" 토글. 켜면 프리뷰 영역이 상하로 갈라져 위에 반대 언어 원문 본문(읽기 전용), 아래에 현재 프리뷰가 온다.
      - 이탈 경고: dirty 상태에서 페이지를 떠나면 `beforeunload` 확인.
      - 새 글 모드: `?id=` 없이 진입하면 `?category=` 값으로 카테고리를 선점하고, title 입력에 포커스가 간다. slug는 title에서 자동 생성(한글은 음역하지 않고 사용자가 직접 입력해야 하므로, 한글만 있으면 slug 입력에 "직접 입력해 주세요" 힌트를 띄운다).
    </page>

    <page name="Profile" route="/admin/profile">
      - 상단: 프로필 사진 카드 — 현재 사진 원형 미리보기(120px) 또는 이니셜 자리표시, "사진 교체" 드롭 영역, "정사각형 640×640 이상 권장" 힌트. 교체 시 기존 `profile.*`가 삭제된다는 안내를 명시.
      - 이후 섹션 6개를 `Card`로 하나씩:
        1. **기본**: name, nameEn, photoAlt, tagline(80자), bio(400자, `textarea`), email, location, cvUrl
        2. **학적** (`education`): 반복 행 — degree `select`(BS/MS/PhD/Exchange/Other), school, department, lab, advisor, startDate(YYYY-MM), endDate(YYYY-MM 또는 "재학 중" 토글), note
        3. **경력** (`career`): 반복 행 — company, role, team, employment `select`(Full-time/Intern/Contract/Freelance/Other), startDate, endDate("재직 중" 토글), description
        4. **스킬** (`skillGroups`): 그룹 반복 행 — name + items 칩 입력(항목당 24자)
        5. **관심 분야** (`interests`): 칩 입력, 최대 8개(초과 시 입력 비활성 + 안내)
        6. **링크** (`links`): 반복 행 — type `select`(github/scholar/linkedin/x/email/orcid/homepage), url, label. 최대 6개.
      - **ko/en 입력 방식** (`LocalizedField`): 모든 텍스트 필드는 기본적으로 한 칸이며 우측에 "언어별" 토글이 있다. 끄면 문자열 하나로 저장되고(`'PyTorch'`), 켜면 ko/en 두 칸으로 갈라져 `{ ko, en }`으로 저장된다. CRITICAL: 이 토글이 `MaybeLocalized` 타입의 두 형태를 그대로 반영한다. 고유명사에 불필요한 `{ ko, en }`을 강제하지 않는 것이 이 설계의 목적이다.
      - 자리표시 값(꺾쇠로 시작하는 문자열)은 입력에 실제 값으로 들어가되, 필드 테두리를 점선으로 하고 라벨 옆에 "미기입" `Badge`를 붙인다.
      - 반복 행 조작: 각 행 우측에 위/아래 이동, 삭제. 배열이 비면 "이 섹션은 사이트에서 통째로 사라집니다" 안내를 표시한다(현재 컴포넌트 동작 그대로).
      - 미리보기 링크: 상단 우측 "홈에서 확인" — 새 탭으로 `/`와 `/en/`를 각각 연다.
    </page>

    <page name="Settings" route="/admin/settings">
      - **사이트** `Card`: title(40자), description ko/en(각 160자), url, postsPerPage, recentPostsOnHome, rssItemLimit, defaultOgImage.
        - `base`와 `navOrder`는 읽기 전용 행으로 보여 주고 자물쇠 아이콘 + 사유 문구를 붙인다. `navOrder`의 사유: "카테고리 순서에서 자동으로 계산됩니다".
        - `PUBLIC_SITE_URL`이 설정되어 있으면 url 필드 아래에 경고 줄.
      - **카테고리** `Card`: 반복 행 — id(신규 행에서만 편집 가능, `^[a-z0-9-]+$`), label, labelKo, description ko/en(각 120자), icon(lucide 이름 + 미리보기 아이콘), metaPanel `select`(paper/project/none). 순서는 드래그가 아니라 위/아래 버튼으로 바꾸며, 저장 시 `order`를 1부터 다시 매긴다.
        - 각 행에 글 수 `Badge`. 글이 있으면 삭제 버튼 비활성 + "글 N편이 이 카테고리를 사용 중입니다".
        - id 변경은 허용하지 않는다(기존 행의 id 입력은 읽기 전용). 근거: id가 URL 세그먼트이자 폴더명이자 프론트매터 값이라, 바꾸면 파일 이동 + 전 글 프론트매터 수정 + 외부 링크 파손이 동시에 일어난다. 필요하면 새 카테고리를 만들고 글을 옮기는 편이 안전하다.
        - 새 카테고리 저장 시 `src/content/posts/<id>/` 폴더가 생기고, 성공 토스트에 "새 카테고리는 dev 서버 재시작 후 라우트에 반영됩니다"를 덧붙인다.
      - **분석** 읽기 전용 행: `PUBLIC_GOATCOUNTER_CODE` 설정 여부.
    </page>

    <page name="Strings" route="/admin/strings">
      - 상단: 검색 입력(경로·ko·en 전체 대상) + "미번역만"(ko와 en이 동일한 항목) 필터 토글.
      - 본문: 경로 그룹(`nav`, `theme`, `footer`, `home`, `profile`, `post`, `list`, `search`, `notFound` 등)별 접이식 섹션. 각 행은 3열 — 경로(모노스페이스 `var(--text-caption)`) / ko 입력 / en 입력.
      - 함수형 값 행: 두 입력 모두 읽기 전용이며 값 대신 시그니처를 회색으로 표시하고 "코드에서만 수정" `Badge`를 붙인다.
      - 변경된 행은 좌측에 3px `var(--accent)` 바로 표시. 저장 바가 "변경 N건"을 센다.
      - CRITICAL: 키 추가·삭제 UI를 두지 않는다. 하단에 "새 키가 필요하면 `src/config/i18n.ts`를 직접 편집하세요"라는 안내 한 줄만 둔다.
    </page>

    <page name="Tags" route="/admin/tags">
      - 목록: 슬러그별 카드. 제목은 대표 표기, 우측에 사용 글 수. 표기가 둘 이상이면 각 표기를 `Badge`로 나열하고 카드 상단에 "표기 N종" 경고 표시 + "정규화" 버튼(가장 많이 쓰인 표기로 병합).
      - 카드를 펼치면 사용 중인 글 목록(제목 + 언어 `Badge` + 편집기 링크).
      - 동작: 이름 변경 / 병합(체크박스로 여러 태그 선택 후 대상 지정) / 삭제.
      - CRITICAL: 어떤 동작이든 실행 전 `dryRun`으로 영향 파일 목록을 받아 `DiffPreview`에 "글 N편의 tags가 다음과 같이 바뀝니다"로 before/after를 보여 주고, 확인해야 실제 쓰기가 일어난다.
      - 정렬: 사용 수 내림차순 기본, 이름순 전환 가능.
    </page>

    <page name="Assets" route="/admin/assets">
      - 상단: 큰 드롭 영역(높이 160px, 점선 `var(--hairline-strong)`, 드래그 중 `var(--accent-tint)` 배경). "여러 장을 한 번에 놓을 수 있습니다".
      - 격자: 200px 카드 그리드. 각 카드에 썸네일(`object-fit: cover`, 4:3), 파일명, 치수·용량, 사용처 수.
      - 카드 동작: "경로 복사"(`../../../assets/<name>` 문자열), "사용처 보기", "삭제".
      - 사용 중인 파일의 삭제 버튼은 비활성이며 툴팁에 사용 글 목록을 넣는다.
      - 업로드 중 카드: 진행률 바 + 파일명. 실패 시 카드가 오류 상태로 남고 사유(용량 초과·확장자 거부·시그니처 불일치)를 표시한다.
      - 빈 상태: `EmptyState` + "글에 넣을 이미지를 여기에 올려 두면 편집기의 커버·본문 삽입에서 바로 고를 수 있습니다".
    </page>
  </added>
</ui_changes>

<integration_points>
  <point file="astro.config.mjs">
    - 변경 1: `markdown` 인라인 설정을 `createMarkdownOptions()` 호출로 교체.
    - 변경 2: `integrations` 배열 맨 뒤에 `adminConsole()` 추가. CRITICAL: `pagefind()` 뒤에 둔다 — 앞에 두면 관리자가 주입한 라우트가 Pagefind 인덱싱 대상 판단에 끼어들 여지가 생긴다.
    - 계약: `adminConsole()`은 `command !== 'dev'`이거나 `ADMIN_DISABLED`가 켜져 있으면 `astro:config:setup`에서 **아무것도 하지 않고 반환한다.** 라우트도, Vite 플러그인도, 미들웨어도 등록하지 않는다.
    - 계약: 프로덕션 경로에서 유일하게 남는 것은 `astro:build:done` 훅 하나이며, 이 훅은 검사만 하고 산출물을 만들지 않는다.
  </point>

  <point file="admin/integration.mjs">
    ```js
    export default function adminConsole() {
      return {
        name: 'admin-console',
        hooks: {
          'astro:config:setup': ({ command, injectRoute, updateConfig, logger }) => {
            if (command !== 'dev') return;          // CRITICAL: 유일한 배제 지점
            if (process.env.ADMIN_DISABLED === '1') return;
            for (const [pattern, entrypoint] of ADMIN_ROUTES) injectRoute({ pattern, entrypoint });
            updateConfig({ vite: { plugins: [adminApiPlugin(logger)] } });
            logger.info('관리자 콘솔: http://localhost:4321/admin');
          },
          'astro:build:done': buildGuard,           // 프로덕션에서도 도는 유일한 훅
        },
      };
    }
    ```
    - `adminApiPlugin`은 `configureServer(server)` 훅에서 `server.middlewares.use('/__admin/api', handler)`만 한다. `transform`·`resolveId` 등 빌드 훅을 갖지 않는다.
  </point>

  <point file="admin/build-guard.mjs">
    - `astro:build:done({ dir, pages, logger })`에서:
      1. `pages`에 `admin`으로 시작하는 경로가 있으면 즉시 throw
      2. `dir` 아래 모든 `.html`·`.js`·`.css` 파일에서 `__admin` 문자열을 검색해 하나라도 나오면 throw
      3. `dist/admin` 디렉터리가 존재하면 throw
    - 오류 메시지는 "관리자 코드가 프로덕션 빌드에 유출되었습니다"로 시작하고 발견된 경로를 나열한다.
    - CRITICAL: 이 검사는 CI에서도 돈다(`npm run build`가 곧 `astro build`). 유출은 배포 전에 반드시 빌드를 깨야 한다.
  </point>

  <point file="src/content.config.ts ↔ admin/server/handlers/posts.mjs">
    - 이음매: 관리자가 `src/content/schema.ts`의 `postSchema()`를 import해 검증한다.
    - 계약: 관리자는 `image` 자리에 `z.string()`을 넣는다. 반환값이 문자열 경로이므로 `cover`의 실제 파일 존재 여부는 관리자가 별도로 검사한다.
    - CRITICAL: 관리자가 검증에 통과시킨 프론트매터는 `astro build`에서도 반드시 통과해야 한다. 두 결과가 갈리면 그것은 스키마가 두 벌로 갈라졌다는 뜻이며 버그다.
  </point>

  <point file="src/config/*.ts ↔ admin/server/codegen/ts-edit.mjs">
    - 이음매: `typescript` 컴파일러 API로 소스를 파싱해 대상 노드의 `getStart()`/`getEnd()`를 얻고, 그 범위만 새 텍스트로 바꾼 뒤 파일 전체를 다시 쓴다.
    - 지원 연산 3종. CRITICAL: 이 밖의 편집을 하지 않는다.
      1. `replaceInitializer(declName, text)` — `PROFILE` / `SITE` / `CATEGORIES`의 초기자 전체 교체. `as const satisfies ...` 같은 꼬리는 초기자 범위 밖이므로 자동 보존된다.
      2. `replaceStringLiteral(declName, dottedPath, value)` — `ko`/`en` 사전의 단일 문자열 리터럴 교체. 주변 주석·함수형 값 전부 불변.
      3. `preserveExpression(propertyName)` — 재생성 시 특정 프로퍼티의 원본 표현식 텍스트를 그대로 옮겨 심는다. `SITE.navOrder`의 스프레드 표현식이 유일한 사용처다.
    - 출력 포맷: 들여쓰기 2칸, 문자열은 홑따옴표, 후행 콤마 있음, 최대 줄 길이 100. 저장 후 `prettier --write`를 호출하지 않는다 — 호출하면 관리자가 건드리지 않은 부분까지 포맷이 바뀌어 diff가 오염된다.
    - 검증: 쓰기 직전 새 소스를 `ts.createSourceFile`로 다시 파싱해 구문 오류(`parseDiagnostics`)가 0인지 확인한다. 하나라도 있으면 쓰지 않고 500 `E-CODEGEN`으로 실패한다. CRITICAL: 설정 파일이 깨지면 dev 서버와 빌드가 동시에 죽는다 — 절대 깨진 파일을 디스크에 남기지 않는다.
  </point>

  <point file="admin/server/fsx.mjs">
    - 모든 쓰기는 같은 디렉터리의 임시 파일에 쓴 뒤 `fs.rename`으로 교체한다. 부분 기록된 파일이 남으면 dev 서버의 HMR이 깨진 파일을 읽는다.
    - `mtime`은 밀리초 정수(`stat.mtimeMs`)로 주고받는다. 저장 시 `baseMtime`과 비교해 다르면 `E-STALE`.
    - CRITICAL: Windows에서 `rename`은 대상이 열려 있으면 실패할 수 있다. 실패 시 50ms 간격 3회 재시도 후 오류를 낸다.
  </point>

  <point file="Vite HMR ↔ 관리자 저장">
    - 관리자가 `src/content/**`나 `src/config/**`를 쓰면 Vite가 변경을 감지해 dev 서버가 해당 모듈을 다시 로드한다. 이것은 의도된 부수효과이며, 사이트 탭이 열려 있으면 자동으로 갱신된다.
    - CRITICAL: 관리자 페이지 자신은 리로드되면 안 된다. 편집 중인 내용이 날아간다. `admin/pages/*.astro`가 `src/config/*`를 import하지 않도록 하고(필요한 값은 전부 API로 가져온다), 관리자 클라이언트는 `import.meta.hot`이 있으면 `hot.decline()`을 호출한다.
  </point>

  <point file="package.json">
    - `devDependencies`에 `"yaml": "2.9.0"` 추가.
    - `scripts`에 `"admin": "astro dev --open /admin"` 추가 — 기존 `dev`·`build`·`preview`·`check-links`·`format` 스크립트는 손대지 않는다.
    - CRITICAL: `build` 스크립트(`astro check && astro build`)를 바꾸지 않는다. 이 게이트가 관리자가 만든 잘못된 파일을 잡는 마지막 방어선이다.
  </point>
</integration_points>

<core_functionality>
  <feature name="프론트매터 직렬화 규칙">
    관리자가 쓰는 모든 프론트매터는 아래 규칙을 따른다. 규칙의 목적은 **사람이 쓴 기존 파일과 구분되지 않는 결과**를 내고 diff를 최소화하는 것이다.
    - 키 순서 고정: `slug` → `lang` → `title` → `description` → `category` → `date` → `updated` → `tags` → `draft` → `cover` → `coverAlt` → `math` → `toc` → `paper` → `project`
    - 스키마 기본값과 같은 값은 **생략한다**: `lang: 'ko'`, `draft: false`, `math: false`, `toc: true`, `tags: []`. 근거: 기존 `attention-is-all-you-need.mdx`가 정확히 이 모양이다.
    - 날짜는 `YYYY-MM-DD` (따옴표 없음). 시각 성분을 쓰지 않는다.
    - `tags`는 플로우 스타일 한 줄(`tags: [transformer, attention, nlp]`), `authors`·`stack`은 블록 스타일 여러 줄. 근거: 기존 파일의 모양과 일치한다.
    - 문자열 인용은 `yaml` 패키지의 기본 판단을 따른다. 숫자로 읽힐 문자열(`arxivId: '1706.03762'`)은 자동으로 인용된다.
    - 값이 `undefined`이거나 빈 문자열인 선택 필드는 키째로 생략한다. 빈 문자열을 남기면 `z.url()`이 실패한다.
    - 본문은 프론트매터 종료 구분자 뒤에 빈 줄 하나를 두고 시작하며, 파일은 개행 하나로 끝난다.
  </feature>

  <feature name="슬러그 자동 생성">
    - 입력: title. 처리: 소문자화 → 라틴 문자·숫자만 남기고 나머지를 하이픈으로 → 연속 하이픈 축약 → 앞뒤 하이픈 제거.
    - 결과가 빈 문자열이면(제목이 전부 한글인 흔한 경우) 자동 생성을 포기하고 slug 입력에 포커스를 주며 "영문 슬러그를 직접 입력해 주세요" 힌트를 띄운다. CRITICAL: 한글을 로마자로 음역하지 않는다 — 음역 규칙이 여러 벌이라 결과가 예측 불가능하고, URL은 한 번 정하면 바꾸기 어렵다.
    - 사용자가 slug를 한 번이라도 손으로 고치면 자동 생성이 잠긴다(자물쇠 아이콘 표시, 클릭으로 해제).
    - 중복 검사는 입력 중 300ms 디바운스로 `/__admin/api/posts` 목록과 대조해 즉시 표시한다.
  </feature>

  <feature name="번역본 짝짓기">
    - 짝짓기 키는 `category` + `slug`다. `src/lib/posts.ts`가 쓰는 규칙과 같아야 한다.
    - 관리자가 이 키를 깨뜨릴 수 있는 경로는 둘뿐이며 둘 다 막는다.
      1. 한쪽만 slug 변경 → 저장 시 짝을 함께 rename (`PUT /posts/:id`의 `renamed[]`)
      2. 한쪽만 category 변경 → 저장 시 짝도 같은 카테고리 폴더로 이동
    - 목록 화면의 "번역 누락"은 `lang: ko` 글 중 짝이 없는 것을 센다. 영어 원문 글(`lang: en`인데 한국어 짝이 없는 경우)도 같은 방식으로 센다.
    - CRITICAL: 번역본이 없어도 사이트는 정상이다(원문 + 안내 배너로 폴백). 관리자는 이것을 오류가 아니라 정보로 표시한다.
  </feature>

  <feature name="스키마 검증 파이프라인">
    저장 요청 하나가 통과해야 하는 관문 5개. 순서를 지킨다 — 뒤 단계가 앞 단계의 통과를 전제한다.
    1. **경로 안전** — 대상 경로가 허용 루트 안인가 (`security_considerations` 참조)
    2. **형태** — slug 정규식, category가 `CATEGORY_IDS`에 있는가, lang이 `LANG_IDS`에 있는가
    3. **스키마** — `postSchema({ image: () => z.string() })`로 파싱. 실패 시 Zod 이슈를 `{ field, message }` 배열로 변환해 반환
    4. **참조 무결성** — `cover` 경로가 실제 파일로 존재하는가, 태그가 항목당 24자 이내인가
    5. **충돌** — `baseMtime` 일치, 대상 경로 중복 없음
    - CRITICAL: 3번의 오류 메시지는 스키마에 이미 한국어로 적혀 있다. 관리자가 메시지를 다시 쓰지 않고 그대로 화면에 노출한다. 메시지를 관리자에서 재작성하면 스키마 수정 시 두 벌이 갈라진다.
  </feature>

  <feature name="TS 설정 파일 쓰기">
    - 대상은 4개 선언뿐: `profile.ts`의 `PROFILE`, `site.ts`의 `SITE`, `categories.ts`의 `CATEGORIES`, `i18n.ts`의 `ko`/`en`.
    - `PROFILE`·`SITE`·`CATEGORIES`는 초기자 전체 교체, `ko`/`en`은 문자열 리터럴 단위 교체.
    - `MaybeLocalized` 방출 규칙: 값이 `{ ko, en }`이고 두 값이 **같으면** 문자열 하나로 접는다. 다르면 객체로 방출한다. 근거: 고유명사에 불필요한 객체가 쌓이지 않게 한다.
    - `undefined`인 선택 프로퍼티는 방출하지 않는다. `null`(진행 중을 뜻하는 `endDate`)은 그대로 `null`로 방출한다 — 이 둘을 섞으면 "재직 중"이 사라진다.
    - `SITE.navOrder`는 `preserveExpression`으로 원본 텍스트를 옮겨 심는다.
    - `CATEGORIES`는 `order`를 배열 순서대로 1부터 다시 매긴 뒤 방출한다.
    - 쓰기 후 재파싱 검증(0 diagnostics)을 통과해야 디스크에 남는다.
  </feature>

  <feature name="태그 일괄 수정">
    - 대상 파일 선별: 모든 글의 프론트매터 `tags`를 읽어 `slugifyTag()` 결과가 일치하는 것.
    - 수정 방식: 프론트매터 전체를 다시 직렬화한다(본문은 바이트 그대로). CRITICAL: 그 결과 손으로 쓴 프론트매터의 키 순서·인용 스타일이 관리자 규칙으로 정규화될 수 있다. `dryRun` 결과 화면에 "프론트매터 형식이 정규화됩니다"를 명시한다.
    - 삭제 후 `tags`가 빈 배열이 되면 키를 생략한다.
    - 병합 시 중복은 제거하고 남은 태그의 원래 순서를 유지한다.
    - 실패 격리: 파일 N개 중 하나가 실패해도 나머지는 이미 쓰였다. 응답에 `{ succeeded[], failed[] }`를 모두 담고, UI는 부분 성공을 명확히 표시한다. CRITICAL: "전부 성공"으로 뭉뚱그리지 않는다.
  </feature>

  <feature name="이미지 업로드">
    - 클라이언트: `FileReader.readAsDataURL` → base64 추출 → JSON POST. 8MB 초과 파일은 요청을 보내기 전에 클라이언트에서 먼저 막는다(서버도 다시 막는다).
    - 서버: 매직 바이트 검사 → 파일명 정규화 → 중복 시 접미 → `src/assets/`에 원자적 쓰기 → `sharp`로 치수 읽기.
    - 편집기에서의 삽입: 커버는 프론트매터 `cover`에 `../../../assets/<name>` 문자열을, 본문은 커서 위치에 `![alt](../../../assets/<name>)`를 넣는다.
    - CRITICAL: 상대 경로의 상위 단계 수는 글 파일이 `src/content/posts/<category>/` 깊이에 있다는 전제에서 나온다. 경로 문자열을 하드코딩하지 말고 대상 파일 경로와 `src/assets`의 상대 경로를 `path.relative`로 계산한다.
  </feature>

  <feature name="dirty 추적과 저장">
    - 폼 로드 시 초기 JSON을 스냅숏으로 잡고, 입력마다 현재 JSON과 비교해 변경 필드 집합을 만든다.
    - 저장 바는 변경이 0건이면 숨는다. 되돌리기는 스냅숏으로 폼을 복원한다(디스크를 다시 읽지 않는다).
    - 저장 성공 시 응답의 새 `mtime`으로 스냅숏을 갱신한다.
    - `Cmd/Ctrl+S`는 저장, `Esc`는 열린 다이얼로그 닫기. CRITICAL: 사이트의 `src/scripts/shortcuts.ts`를 관리자에서 로드하지 않는다 — 검색 단축키가 겹친다.
  </feature>
</core_functionality>

<error_handling>
  <principle>
    - 모든 오류는 `E-` 접두 코드 + 한국어 문장 + (가능하면) 폼 필드 경로를 갖는다. 코드는 토스트 우측에 작게 표기해 사용자가 그대로 옮겨 적을 수 있게 한다.
    - CRITICAL: 파일을 쓰지 못한 오류와 쓰다 만 오류를 구분해 알린다. 후자는 원자적 쓰기로 구조적으로 발생하지 않아야 하지만, 발생했다면 어떤 파일이 어떤 상태인지 반드시 말한다.
    - 서버 스택 트레이스는 터미널에만 출력한다. 응답 본문에 넣지 않는다.
  </principle>

  | 코드 | HTTP | 상황 | 처리 |
  |------|------|------|------|
  | `E-FORBIDDEN-ORIGIN` | 403 | 루프백이 아닌 출발지 또는 Origin 불일치 | 요청을 즉시 끊고 터미널에 출발지 주소를 경고로 남긴다. 클라이언트는 안내 화면으로 대체된다 |
  | `E-BAD-TOKEN` | 401 | `X-Admin-Token` 누락·불일치 | 클라이언트가 `/session`을 한 번 다시 호출해 토큰을 갱신한 뒤 원 요청을 1회 재시도한다. 두 번째도 실패하면 "dev 서버가 재시작되었습니다. 새로고침하세요" 안내 |
  | `E-NOT-FOUND` | 404 | 파일 없음 | 목록으로 돌아가고 "이 글은 더 이상 존재하지 않습니다(에디터에서 지웠을 수 있습니다)" |
  | `E-STALE` | 409 | `baseMtime` 불일치 | 저장을 막고 좌우 비교 화면을 띄운다. 선택지 3개: 디스크 내용 불러오기 / 내 내용으로 덮어쓰기 / 취소. CRITICAL: 기본 선택은 "취소"다 |
  | `E-DUPLICATE-SLUG` | 409 | 같은 category+slug+lang 파일 존재 | slug 필드에 오류를 붙이고 기존 글로 가는 링크를 함께 준다 |
  | `E-VALIDATION` | 422 | Zod 검증 실패 | `detail.issues[]`의 각 `{ field, message }`를 해당 입력 아래에 붙이고 첫 필드로 스크롤 |
  | `E-PATH-ESCAPE` | 403 | 허용 루트 밖 경로 | 요청 거절 + 터미널 경고. UI에는 "잘못된 경로입니다"만 노출한다(경로를 그대로 되비추지 않는다) |
  | `E-CATEGORY-IN-USE` | 409 | 글이 남은 카테고리 삭제 시도 | 사용 중인 글 목록을 응답에 실어 UI가 링크로 보여 준다 |
  | `E-UNKNOWN-ICON` | 422 | lucide에 없는 아이콘 이름 | 아이콘 입력 아래에 오류 + 비슷한 이름 3개 제안 |
  | `E-READONLY-STRING` | 422 | 함수형 UI 문자열 변경 시도 | 정상 흐름에서는 UI가 막으므로 발생하면 버그다. 토스트로 코드와 함께 노출 |
  | `E-TAG-TOO-LONG` | 422 | 태그 24자 초과 | 입력 옆 카운터를 빨간 상태로 |
  | `E-ASSET-TYPE` | 422 | 확장자 거부 또는 시그니처 불일치 | 업로드 카드가 오류 상태로 남고 사유 표시 |
  | `E-ASSET-TOO-LARGE` | 413 | 8MB 초과 | 같음. 현재 용량과 상한을 함께 표시 |
  | `E-ASSET-IN-USE` | 409 | 참조가 남은 이미지 삭제 시도 | 사용 글 목록을 보여 주고 삭제를 막는다 |
  | `E-CODEGEN` | 500 | 생성된 TS가 구문 오류 | **파일을 쓰지 않는다.** "설정 파일을 안전하게 수정할 수 없었습니다. 변경 사항이 저장되지 않았습니다"를 명시하고 터미널에 생성된 소스를 덤프한다 |
  | `E-WRITE-FAILED` | 500 | rename 3회 재시도 실패 | 어떤 파일이 어떤 상태인지 명시. Windows에서 파일이 다른 프로그램에 잡혀 있을 가능성을 안내 |
  | `E-INTERNAL` | 500 | 미처리 예외 | 미들웨어가 감싼다. "예상치 못한 오류입니다. 터미널 로그를 확인하세요" |

  <client_behavior>
    - 네트워크 실패(dev 서버 종료)는 오류 코드가 없다. "개발 서버와 연결이 끊어졌습니다"를 상단 고정 배너로 띄우고, 5초 간격으로 `/session`을 폴링해 복구되면 배너를 걷는다. 편집 중 내용은 절대 지우지 않는다.
    - 프리뷰 요청 실패는 토스트를 띄우지 않는다. 프리뷰 영역 상단에 작은 회색 줄로 "프리뷰를 갱신하지 못했습니다"만 표시하고 직전 렌더 결과를 유지한다. CRITICAL: 타이핑 중 토스트가 쌓이면 쓸 수 없는 편집기가 된다.
    - 저장 실패 시 dirty 상태를 유지한다. 스냅숏을 갱신하지 않는다.
  </client_behavior>
</error_handling>

<security_considerations>
  <threat name="브라우저를 경유한 크로스 오리진 공격">
    운영자가 dev 서버를 켠 채로 아무 웹사이트나 방문하면, 그 사이트의 스크립트가 `http://localhost:4321/__admin/api/...`로 요청을 보낼 수 있다. 응답은 CORS가 막지만 **요청 자체는 서버에 도달하며, 부작용(파일 쓰기)은 이미 일어난다.** 이것이 로컬 개발 도구의 가장 현실적인 위협이다.
    방어 3중:
    1. **루프백 검사** — `req.socket.remoteAddress`가 `127.0.0.1`·`::1`·`::ffff:127.0.0.1`이 아니면 403. `ADMIN_ALLOW_REMOTE`로만 해제된다.
    2. **Origin 검사** — 변경 요청에 `Origin` 헤더가 있고 그 값이 dev 서버 자신의 오리진(`http://localhost:<port>` 또는 `http://127.0.0.1:<port>`)이 아니면 403. `Origin`이 아예 없는 요청도 변경 메서드에서는 거절한다(브라우저는 항상 붙인다).
    3. **세션 토큰** — 변경 요청은 `X-Admin-Token`을 요구한다. 토큰은 `/session` 응답으로만 얻을 수 있고, 크로스 오리진 페이지는 CORS 때문에 그 응답을 읽지 못한다. CRITICAL: `/session` 응답에 `Access-Control-Allow-Origin`을 절대 붙이지 않는다.
    추가: 응답에 `Vary: Origin`과 `Cache-Control: no-store`를 붙인다.
  </threat>

  <threat name="DNS 리바인딩">
    공격자 도메인이 `127.0.0.1`로 리바인딩되면 Origin 검사가 그 도메인 이름으로 통과할 여지가 있다. 방어: `Host` 헤더가 `localhost`·`127.0.0.1`·`[::1]` 중 하나(포트 포함 허용)가 아니면 403. Origin 검사와 함께 두 겹으로 둔다.
  </threat>

  <threat name="경로 탈출">
    - 허용 루트는 정확히 3개: `<projectRoot>/src/content/posts`, `<projectRoot>/src/assets`, `<projectRoot>/src/config`.
    - 검사 절차: 입력 경로를 `path.resolve` → `fs.realpath`(존재하면) → 허용 루트 각각에 대해 `path.relative(root, target)`가 `..`로 시작하지 않고 절대 경로가 아닌지 확인. 하나라도 만족하면 통과, 아니면 `E-PATH-ESCAPE`.
    - CRITICAL: 문자열 `startsWith` 비교로 끝내지 않는다. `src/assets-evil`이 `src/assets`로 시작한다.
    - CRITICAL: `realpath`를 쓰는 이유는 심볼릭 링크로 루트 밖을 가리키는 경우를 잡기 위해서다. 새 파일(아직 없음)은 부모 디렉터리를 `realpath`한다.
    - 파일명은 별도로 `^[a-z0-9][a-z0-9.-]*$`를 통과해야 하며 `..`를 포함할 수 없다.
  </threat>

  <threat name="업로드된 파일의 실행 가능성">
    - `.svg` 거부(스크립트 실행 가능). `.html`·`.js`·`.mjs`·`.json` 등 이미지가 아닌 확장자는 애초에 화이트리스트 밖이다.
    - 매직 바이트로 실제 포맷을 확인해 확장자 위조를 막는다.
    - 프리뷰의 이미지는 관리자 페이지에 직접 렌더링되지 않고 dev 서버가 서빙하는 정적 자원이다. 관리자 페이지의 CSP `img-src`는 `'self' data: blob:`로 제한한다.
  </threat>

  <threat name="명령 실행">
    - 관리자가 실행하는 외부 프로세스는 `git status`뿐이며 `execFile`로 고정 인자를 넘긴다. 셸을 경유하지 않고, 사용자 입력을 인자로 넣지 않는다.
    - CRITICAL: 향후 커밋 기능을 추가하더라도 커밋 메시지를 셸 문자열로 조립하지 않는다(`execFile`의 인자 배열로만 전달).
  </threat>

  <threat name="비밀 값 유출">
    - 관리자는 `.env` 파일을 읽지도 쓰지도 않는다. 환경변수는 설정 여부(boolean)만 노출하고 값은 노출하지 않는다.
    - `ADMIN_ALLOW_REMOTE`·`ADMIN_DISABLED`에 `PUBLIC_` 접두사를 붙이지 않는다 — 붙이면 Vite가 클라이언트 번들에 인라인할 수 있다.
    - CRITICAL: 관리자 API 응답에 절대 경로(`projectRoot`)가 포함되는데, 이 값은 루프백 요청에만 나가므로 허용한다. 다만 오류 메시지를 통해 경로가 새 나가지 않도록 `E-PATH-ESCAPE`는 경로를 되비추지 않는다.
  </threat>

  <threat name="프로덕션 유출">
    이 기능에서 가장 큰 손해를 낼 수 있는 실패는 관리자 코드가 배포되는 것이다. 방어는 4겹이다.
    1. 관리자 파일이 `src/pages/` 밖에 있어 파일 기반 라우터의 시야에 없다
    2. `injectRoute`가 `command === 'dev'` 안에서만 호출된다
    3. Vite 플러그인이 `configureServer`만 갖는다(빌드 훅 없음)
    4. `astro:build:done` 가드가 `dist`를 검사해 흔적이 있으면 빌드를 실패시킨다
    CRITICAL: 4번은 앞의 셋이 모두 실패했을 때를 위한 것이다. 앞의 셋을 믿고 4번을 생략하지 않는다.
  </threat>
</security_considerations>

<regression_risks>
  - **스키마 추출로 콘텐츠 검증이 달라질 위험** — `src/content/schema.ts`로 옮기면서 `image()` 주입 방식이 바뀐다. 검증: 추출 전후로 `npm run build`를 돌려 페이지 수(현재 19)와 `astro check` 결과(0 오류 / 0 경고)가 동일한지 확인한다. 기존 글 4편(`.md` 1 + `.en.md` 1 + `.mdx` 2)이 모두 전과 같이 통과해야 한다.
  - **마크다운 설정 추출로 렌더 결과가 달라질 위험** — `unified()` 프로세서를 팩토리로 감싸면서 플러그인 순서나 옵션이 미묘하게 바뀔 수 있다. 검증: 추출 전 `dist`를 보관해 두고 추출 후 `dist`와 비교해 HTML이 바이트 동일한지 확인한다. 특히 KaTeX 수식이 있는 `attention-is-all-you-need`와 코드 블록이 있는 글을 눈으로 확인한다.
  - **관리자 저장이 기존 파일의 형식을 뭉갤 위험** — 태그 일괄 수정은 프론트매터를 재직렬화한다. 손으로 쓴 파일의 키 순서·주석·인용 스타일이 바뀔 수 있다. 검증: 기존 글 4편에 태그 이름 변경을 적용한 뒤 `git diff`를 읽어 `tags` 줄 외에 바뀐 줄이 없는지 확인한다. 바뀐 줄이 있다면 직렬화 규칙을 기존 파일 모양에 맞춘다.
  - **`src/config/*.ts` 재생성이 타입 계약을 깰 위험** — `CATEGORIES`의 `as const satisfies` 꼬리, `SITE.navOrder`의 파생 표현식, `UIStrings` 키 파리티가 각각 사이트 전체를 무너뜨릴 수 있는 지점이다. 검증: 각 화면에서 저장을 한 번씩 한 뒤 `astro check`가 여전히 0 오류인지 확인한다. `git diff src/config/`가 의도한 줄만 담고 있는지도 함께 읽는다.
  - **HMR이 관리자 편집 내용을 날릴 위험** — 관리자가 `src/config/*`를 쓰면 Vite가 모듈 갱신을 트리거한다. 관리자 페이지가 그 모듈에 의존하면 리로드가 걸려 폼 입력이 사라진다. 검증: 프로필 화면에서 값을 고친 뒤(저장하지 않고) 다른 탭에서 사이트 파일을 저장해 HMR을 유발하고, 관리자 폼이 그대로인지 확인한다.
  - **관리자용 CSS가 사이트로 새어 나갈 위험** — `admin.css`가 `src/styles/global.css`를 import하는 구조라 전역 셀렉터를 쓰면 사이트에도 영향이 갈 수 있다. 방어: 관리자 전용 규칙은 전부 `.admin-*` 접두 클래스 또는 `[data-admin]` 스코프 안에 둔다. 검증: `admin.css`에 요소 셀렉터 단독 규칙(`input { ... }` 같은)이 없는지 확인한다.
  - **번들 예산 회귀** — 사이트의 JS 예산은 기존 실측(`_workspace/04_motion_inventory.md`: 모션 청크 gzip 14.9KB)이 기준이다. 관리자가 배포물에 들어가지 않으므로 이 값은 변하면 안 된다. 검증: 빌드 후 `dist/_astro/*.js`의 gzip 합이 관리자 도입 전과 동일한지 확인한다.
  - **`check-links.mjs` 오탐** — 관리자가 만든 초안 글이나 새 카테고리 폴더가 링크 검사에 영향을 줄 수 있다. 검증: 관리자로 새 카테고리와 새 글을 만든 뒤 `npm run build && npm run check-links`가 통과하는지 확인한다.
  - **Pagefind 인덱스** — 초안 글은 `getPublishedPosts()`가 걸러 내므로 인덱스에 들어가지 않아야 한다. 검증: 초안 글을 만들고 빌드한 뒤 `/search`에서 그 제목으로 검색해 결과가 없는지 확인한다.
</regression_risks>

<migration_plan>
  이 기능은 데이터 마이그레이션이 없다. 기존 콘텐츠 파일·설정 파일의 내용은 한 글자도 자동으로 바뀌지 않으며, 변경은 사용자가 관리자 화면에서 저장할 때만 일어난다.

  구조 변경 2건(`postSchema` 추출, `createMarkdownOptions` 추출)은 순수 리팩터링이며 다음 순서로 적용한다.
  1. `src/content/schema.ts`와 `markdown.config.mjs`를 새로 만들고 기존 정의를 **복사**한다(아직 원본을 지우지 않는다)
  2. `src/content.config.ts`와 `astro.config.mjs`가 새 모듈을 쓰도록 바꾼다
  3. `npm run build`로 페이지 수·`astro check` 결과·`dist` HTML이 이전과 동일한지 확인한다
  4. 확인된 뒤에야 원본 정의를 지운다

  롤백: 두 파일을 되돌리고 `astro.config.mjs`에서 `adminConsole()` 한 줄을 지우면 관리자 기능 전체가 사라진다. `admin/` 디렉터리는 남아 있어도 프로덕션에 아무 영향이 없다.

  배포 순서 제약 없음. `.github/workflows/deploy.yml`은 수정하지 않는다.
</migration_plan>

<final_integration_test>
  아래 12개 시나리오는 구현 완료의 판정 기준이다. 전부 로컬에서 손으로 수행하며, 각 시나리오는 **git 워킹 트리가 깨끗한 상태**에서 시작해 끝나면 `git diff`로 결과를 확인하고 `git checkout -- .`로 되돌린다.

  <scenario id="1" name="프로덕션 배제 — 가장 중요한 검사">
    1. `npm run build` 실행
    2. `dist/admin`이 존재하지 않음을 확인
    3. `grep -r "__admin" dist` 결과가 0건임을 확인
    4. `grep -ri "admin" dist --include=*.html` 결과에 관리자 흔적이 없음을 확인
    5. `npm run preview`로 띄운 뒤 `/admin`이 사이트의 404 페이지를 반환하는지 확인
    6. `admin/build-guard.mjs`가 실제로 동작하는지 역검증: `admin/pages/index.astro`를 일시적으로 `src/pages/admin.astro`로 복사한 뒤 `npm run build`가 **실패**하는지 확인하고, 복사본을 지운다
    합격 기준: 1~5 전부 통과 + 6에서 빌드가 명시적 오류 메시지와 함께 실패
  </scenario>

  <scenario id="2" name="새 논문 리뷰 글 작성 (조건부 스키마 포함)">
    1. `npm run admin`으로 dev 서버 기동, `/admin/posts`에서 "새 글" 클릭
    2. 카테고리를 `paper-review`로 선택 → "논문 메타" 섹션이 나타나는지 확인
    3. title에 "Test Paper 읽기" 입력 → slug가 `test-paper`로 자동 생성되는지 확인
    4. 논문 메타를 비운 채 저장 시도 → `E-VALIDATION`으로 막히고 `paper` 필드에 스키마의 한국어 메시지가 그대로 표시되는지 확인
    5. paperTitle·authors 1명·venue·year를 채우고 저장
    6. `src/content/posts/paper-review/test-paper.mdx`가 생기고, 프론트매터 키 순서가 직렬화 규칙과 일치하며 `draft`·`toc`·`lang` 키가 없는지 확인
    7. 새 탭에서 `/paper-review`에 새 글이 보이는지 확인
    합격 기준: 4에서 브라우저가 오류를 잡고, 6의 파일이 기존 `attention-is-all-you-need.mdx`와 형식상 구분되지 않음
  </scenario>

  <scenario id="3" name="수식·코드 프리뷰">
    1. 시나리오 2의 글을 편집기에서 열고 `math` 토글을 켠다
    2. 본문에 인라인 수식, 디스플레이 수식(`$$` 블록), 그리고 언어 지정 코드 블록을 넣는다
    3. 400ms 뒤 우측 프리뷰에 KaTeX가 렌더된 수식과 Shiki 하이라이트가 적용된 코드가 나타나는지 확인
    4. 타이핑을 이어 가는 동안 프리뷰가 비었다가 채워지지 않고(깜빡임 없음) 내용만 교체되는지 확인
    5. 본문에 JSX 태그 한 줄을 넣고, 프리뷰에서 점선 자리표시 블록으로 표시되는지 확인
    6. 저장 후 실제 사이트 페이지에서 수식과 코드가 프리뷰와 같게 렌더되는지 확인
    합격 기준: 3·5·6 통과 + 4에서 깜빡임 없음
  </scenario>

  <scenario id="4" name="EN 번역본 생성과 짝짓기">
    1. 글 목록에서 시나리오 2의 글 행의 "+ EN" 클릭
    2. `test-paper.en.mdx`가 생기고 프론트매터에 `lang: en`이 있으며 `slug`·`category`·`date`·`paper`가 원문과 동일한지 확인
    3. 편집기에서 영어 title·description·본문으로 바꾸고 저장
    4. `/en/paper-review`에 영어 글이, `/paper-review`에 한국어 글이 각각 보이는지 확인
    5. 한국어 글의 slug를 `test-paper-2`로 바꾸고 저장 → 확인 다이얼로그가 "번역본도 함께 이름이 바뀝니다"를 알리고, 두 파일이 모두 rename되는지 확인
    6. 두 언어 페이지가 여전히 서로의 대체 링크(hreflang)로 연결되는지 확인
    합격 기준: 2·5 통과 + 6에서 짝짓기 유지
  </scenario>

  <scenario id="5" name="충돌 감지">
    1. 편집기에서 글을 열어 둔 채, 코드 에디터로 같은 파일의 본문을 고쳐 저장한다
    2. 관리자 탭으로 돌아와 다른 내용을 입력하고 저장 시도
    3. `E-STALE`로 막히고 좌우 비교 화면이 뜨는지 확인
    4. 기본 선택이 "취소"인지 확인
    5. "디스크 내용 불러오기"를 고르면 에디터의 변경이 폼에 반영되는지 확인
    합격 기준: 3·4·5 전부 통과. 어떤 경우에도 한쪽 변경이 조용히 사라지지 않을 것
  </scenario>

  <scenario id="6" name="프로필 편집과 주석 보존">
    1. `git diff src/config/profile.ts`가 비어 있는 상태에서 시작
    2. `/admin/profile`에서 name의 "언어별" 토글을 켜고 ko/en을 각각 입력, 경력 행 1개 추가, 스킬 그룹 1개 추가 후 저장
    3. `git diff src/config/profile.ts`를 읽어 **`PROFILE` 선언 범위 밖의 줄이 하나도 바뀌지 않았는지** 확인 — 파일 상단 문서 주석 블록, `Degree`·`EducationEntry`·`CareerEntry`·`SkillGroup`·`SocialLink`·`Profile` 인터페이스, `PROFILE_PHOTO` glob, `isPlaceholder`, `collectPlaceholderFields`가 전부 원본 그대로여야 한다
    4. `PROFILE`의 각 프로퍼티 앞 JSDoc 주석(`/** 표기명. ... */` 등)이 남아 있는지 확인
    5. `astro check`가 0 오류인지 확인
    6. `/`와 `/en/` 홈에서 입력한 값이 각 언어로 보이는지 확인
    7. 두 언어에서 같은 값(예: 스킬 `PyTorch`)이 객체가 아니라 문자열 하나로 방출되었는지 확인
    합격 기준: 3·4·5·7 전부 통과
  </scenario>

  <scenario id="7" name="카테고리 추가">
    1. `/admin/settings`에서 카테고리 행을 추가한다 — id `seminar`, label `Seminar`, labelKo `세미나`, description ko/en, icon `lucide:presentation`, metaPanel `none`
    2. 저장 후 `src/content/posts/seminar/` 폴더가 생겼는지 확인
    3. `git diff src/config/categories.ts`에서 `as const satisfies readonly Category[]` 꼬리가 유지되고 `order`가 1·2·3·4로 다시 매겨졌는지 확인
    4. dev 서버를 재시작하고 상단 내비게이션에 `Seminar`가 나타나는지, `/seminar`와 `/en/seminar`가 열리는지 확인
    5. 존재하지 않는 아이콘 이름으로 저장 시도 → `E-UNKNOWN-ICON`으로 막히는지 확인
    6. 기존 `notes` 카테고리 삭제 시도 → 글이 있으므로 버튼이 비활성이고 글 수가 표시되는지 확인
    7. `npm run build`가 통과하고 페이지 수가 늘어난 만큼 정확히 증가하는지 확인
    합격 기준: 2·3·4·5·6·7 전부 통과. CRITICAL: `src/pages/` 아래 어떤 파일도 생기지 않았을 것
  </scenario>

  <scenario id="8" name="UI 문자열 편집">
    1. `/admin/strings`에서 `home.recentTitle`의 ko 값을 "최근 기록"으로 바꾸고 저장
    2. `git diff src/config/i18n.ts`가 **정확히 한 줄**만 바꿨는지 확인
    3. 23개 섹션 주석과 18개 함수형 값이 전부 그대로인지 확인
    4. `language.switchTo` 행이 읽기 전용으로 표시되고 편집이 불가능한지 확인
    5. `astro check`가 0 오류이고 홈에 "최근 기록"이 보이는지 확인
    6. 영어 홈(`/en/`)의 문자열은 바뀌지 않았는지 확인
    합격 기준: 2가 정확히 한 줄 + 3·4·5·6 통과
  </scenario>

  <scenario id="9" name="태그 병합">
    1. 두 글에 각각 `NLP`와 `nlp` 태그를 넣는다
    2. `/admin/tags`에서 해당 슬러그 카드가 "표기 2종" 경고와 함께 나타나는지 확인
    3. "정규화"를 누르면 `dryRun` 결과로 영향 글 2편의 before/after가 표시되는지 확인
    4. 확인 후 두 파일의 `tags`가 하나의 표기로 통일되는지 확인
    5. `git diff`에서 두 파일 모두 `tags` 줄 외에 바뀐 줄이 없는지 확인
    6. `/tags`와 태그 상세 페이지에서 표기가 하나로 합쳐졌는지 확인
    합격 기준: 3에서 확인 없이는 파일이 바뀌지 않고, 5에서 부수 변경이 없을 것
  </scenario>

  <scenario id="10" name="이미지 업로드와 삭제 보호">
    1. `/admin/assets`에 JPG 한 장을 드롭 → 파일명이 정규화되어 `src/assets/`에 저장되고 치수·용량이 표시되는지 확인
    2. 확장자를 `.png`로 바꾼 JPG를 업로드 → `E-ASSET-TYPE`으로 거부되는지 확인
    3. SVG 업로드 → 거부되는지 확인
    4. 9MB 파일 업로드 → 요청 전에 클라이언트가 막는지 확인
    5. 편집기에서 1번 이미지를 커버로 지정 → `cover`에 `../../../assets/<name>`이 들어가고 `coverAlt`가 비면 저장 버튼이 비활성인지 확인
    6. `coverAlt`를 채우고 저장 → 글 상세에 커버가 렌더되는지 확인
    7. `/admin/assets`에서 그 이미지 삭제 시도 → `E-ASSET-IN-USE`로 막히고 사용 글이 표시되는지 확인
    8. 프로필 사진을 업로드 → 기존 `profile.*`가 지워지고 새 파일 하나만 남는지, 홈의 원형 사진이 바뀌는지 확인
    합격 기준: 2·3·4·5·7 전부 차단 동작 + 6·8 정상 반영
  </scenario>

  <scenario id="11" name="보안 게이트">
    1. 다른 오리진을 흉내 내 변경 요청을 보낸다:
       `curl -X PUT http://localhost:4321/__admin/api/profile -H "Origin: https://evil.example" -H "Content-Type: application/json" -d '{}'`
       → 403 `E-FORBIDDEN-ORIGIN`이고 파일이 바뀌지 않았는지 확인
    2. 토큰 없이 변경 요청 → 401 `E-BAD-TOKEN` 확인
    3. `Host` 헤더를 임의 도메인으로 바꿔 요청 → 403 확인
    4. 경로 탈출 시도: `curl "http://localhost:4321/__admin/api/posts/..%2F..%2F..%2Fpackage.json"` → `E-PATH-ESCAPE` 또는 `E-NOT-FOUND`이고 `package.json`이 읽히지 않는지 확인
    5. `astro dev --host`로 기동 후 다른 기기에서 `/__admin/api/session` 호출 → 403 확인
    6. `ADMIN_ALLOW_REMOTE=1`로 기동하면 5가 통과하고 관리자 상단에 빨간 경고 배너가 상시 표시되는지 확인
    7. `ADMIN_DISABLED=1`로 기동하면 `/admin`이 404이고 `/__admin/api/session`도 404인지 확인
    합격 기준: 1~5·7 전부 차단, 6에서 배너 노출
  </scenario>

  <scenario id="12" name="회귀 — 기존 사이트 무변경">
    1. 관리자 도입 전 커밋에서 `npm run build` 후 `dist`를 `dist-before/`로 복사
    2. 관리자 도입 후 `npm run build` 실행
    3. `diff -r dist-before dist`가 **차이 없음**을 보고하는지 확인 (Pagefind 인덱스처럼 해시가 달라지는 파일이 있으면 그 목록을 명시적으로 예외 처리하고 나머지가 동일한지 확인)
    4. `astro check` 결과가 0 오류 / 0 경고인지 확인
    5. `node scripts/check-links.mjs dist`가 통과하는지 확인
    6. `dist/_astro/*.js`의 gzip 합이 도입 전과 같은지 확인
    7. 라이트·다크 모두에서 홈·목록·상세·검색·404를 눈으로 확인
    8. **HMR 격리** — `/admin/profile`에서 값을 고치고 저장하지 않은 채, 다른 창에서 `src/components/home/ProfileCard.astro`를 저장해 HMR을 유발한다. 관리자 폼의 입력이 그대로 남아 있는지 확인
    9. **CSS 누출** — `admin/styles/admin.css`에 요소 셀렉터 단독 규칙(`input { ... }`, `button { ... }` 같은)이 없는지 확인하고, 관리자 탭을 연 상태에서 사이트 탭의 폼·버튼 스타일이 변하지 않는지 확인
    10. **초안 비노출** — 초안 글을 하나 만든 뒤 빌드해 `/search`에서 그 제목이 검색되지 않고, 목록·아카이브·RSS·사이트맵 어디에도 나타나지 않는지 확인
    합격 기준: 3에서 예외 목록이 비었거나 설명 가능하고, 4·5·6·8·9·10 통과
  </scenario>
</final_integration_test>

<success_criteria>
  - `dist/`에 관리자 코드가 0바이트 포함된다. 배포된 `/admin`은 404다. 빌드 가드가 유출을 실제로 잡는 것이 역검증으로 확인된다.
  - `astro check`가 0 오류 / 0 경고를 유지한다. 관리자가 저장한 뒤에도 그렇다.
  - 관리자 도입 전후로 `dist`의 HTML·CSS·JS가 동일하다(설명 가능한 예외 제외).
  - 관리자가 저장한 글 파일이 손으로 쓴 기존 글 파일과 형식상 구분되지 않는다.
  - `src/config/*.ts` 저장 후 `git diff`가 의도한 데이터 줄만 담는다. 파일 상단 문서 주석·인터페이스·헬퍼 함수가 그대로다.
  - 조건부 스키마 위반(paper/project 블록 누락, cover 있는데 coverAlt 없음)이 **브라우저에서** 잡힌다. 빌드까지 가지 않는다.
  - 관리자가 통과시킨 콘텐츠는 `npm run build`도 통과한다. 두 검증 결과가 갈리는 경우가 없다.
  - 번역본 짝짓기가 관리자 조작으로 깨지지 않는다. slug·category 변경이 항상 짝을 동반한다.
  - 프리뷰가 3,000자 본문에서 200ms 이내에 갱신되고, 타이핑 중 깜빡이지 않는다.
  - 크로스 오리진 변경 요청, 원격 주소 요청, 경로 탈출 시도가 전부 차단된다.
  - 새 npm 의존성이 `yaml` 하나뿐이며 `devDependencies`에 있다. 프로덕션 `dependencies`는 변하지 않는다.
  - 관리자 화면이 라이트·다크 양쪽에서 WCAG 2.1 AA 대비를 만족한다(사이트와 같은 토큰만 쓰므로 기존 감사 결과를 승계한다).
  - `.github/workflows/deploy.yml`이 수정되지 않는다.
</success_criteria>

<implementation_order>
  1. **리팩터링 기반 — 스키마·마크다운 추출**
     - `src/content/schema.ts`, `markdown.config.mjs` 신규
     - `src/content.config.ts`, `astro.config.mjs` 수정
     - 게이트: `npm run build` 결과가 이전과 동일 (시나리오 12의 1~5)
     - CRITICAL: 여기서 회귀가 나면 다음 단계로 넘어가지 않는다. 이후 모든 작업이 이 기반 위에 쌓인다.

  2. **인테그레이션 골격과 빌드 가드**
     - `admin/integration.mjs`(빈 라우트 목록), `admin/build-guard.mjs`
     - `astro.config.mjs`에 `adminConsole()` 추가, `package.json`에 `yaml`·`admin` 스크립트
     - 게이트: 시나리오 1 전체. 가드 역검증까지 통과해야 한다.
     - CRITICAL: 화면을 하나도 만들기 전에 배제 보장을 먼저 세운다. 나중에 붙이면 이미 유출된 상태로 개발이 진행된다.

  3. **보안 게이트와 미들웨어 봉투**
     - `admin/server/guard.mjs`, `middleware.mjs`, `paths.mjs`, `fsx.mjs`, `handlers/session.mjs`
     - 게이트: 시나리오 11 전체. 이 시점에 실제 핸들러는 `/session` 하나뿐이어도 된다.
     - CRITICAL: 쓰기 핸들러를 만들기 전에 게이트를 완성한다.

  4. **관리자 셸과 첫 화면**
     - `admin/components/AdminLayout.astro`, `AdminNav.astro`, `SaveBar.astro`, `admin/styles/admin.css`, `admin/labels.ts`, `admin/client/api.ts`
     - `admin/pages/index.astro`(통계 없이 골격만) + 8개 라우트 주입
     - 게이트: `/admin`이 열리고 사이드바 이동이 되며, 라이트·다크가 모두 정상

  5. **읽기 전용 데이터 계층**
     - `handlers/posts.mjs`의 GET 2종, `handlers/git.mjs`, 대시보드 통계, `/admin/posts` 목록·필터·정렬
     - 게이트: 기존 글 4편이 목록에 정확히 뜨고, `_template.*`가 제외되고, 스키마 검증 결과가 표시된다

  6. **프론트매터 직렬화와 글 쓰기**
     - `codegen/frontmatter.mjs`, `handlers/posts.mjs`의 POST/PUT/DELETE, 검증 파이프라인 5관문
     - 게이트: 시나리오 2, 시나리오 5
     - CRITICAL: 시나리오 2의 6번(형식이 기존 파일과 구분되지 않음)을 통과할 때까지 직렬화 규칙을 다듬는다

  7. **편집기와 프리뷰**
     - `handlers/preview.mjs`, `admin/pages/editor.astro`, `client/editor.ts`, `client/forms.ts`, `client/repeatable.ts`
     - 조건부 메타 폼(paper/project), 도구 줄, 분할 레이아웃
     - 게이트: 시나리오 3

  8. **번역본 관리**
     - `POST /posts/:id/translation`, rename 시 짝 동반 처리, 목록의 번역 열, 대시보드의 번역 누락 타일
     - 게이트: 시나리오 4

  9. **TS 편집 엔진**
     - `codegen/ts-edit.mjs`, `codegen/ts-emit.mjs`
     - 게이트: 단위 검증 — `profile.ts`·`site.ts`·`categories.ts`·`i18n.ts` 각각에 대해 "값을 읽어 그대로 다시 쓰면 파일이 바이트 동일"한지 확인한다. CRITICAL: 이 항등성 검사를 통과하지 못하면 다음 단계로 가지 않는다.

  10. **프로필 화면**
      - `handlers/profile.mjs`, `admin/pages/profile.astro`, `LocalizedField.astro`
      - 게이트: 시나리오 6

  11. **설정·카테고리 화면**
      - `handlers/config.mjs`, `admin/pages/settings.astro`
      - 게이트: 시나리오 7

  12. **UI 문자열 화면**
      - `handlers/strings.mjs`, `admin/pages/strings.astro`, `client/strings.ts`
      - 게이트: 시나리오 8

  13. **에셋 화면**
      - `handlers/assets.mjs`, `admin/pages/assets.astro`, `client/uploader.ts`, 편집기의 커버·본문 삽입 연동
      - 게이트: 시나리오 10

  14. **태그 화면**
      - `handlers/tags.mjs`, `admin/pages/tags.astro`, `DiffPreview.astro`
      - 게이트: 시나리오 9
      - CRITICAL: 에셋보다 뒤에 둔 이유는 태그 일괄 수정이 기존 파일을 가장 많이 건드리는 기능이라, 그 전에 직렬화 규칙이 충분히 검증되어 있어야 하기 때문이다.

  15. **마감**
      - 오류 처리 전수 점검(코드 표 전체가 실제로 도달 가능한지), 접근성 점검(포커스 순서·`aria-live`·44px 히트 영역), HMR 격리 확인, 대시보드 완성
      - 게이트: 시나리오 12 전체 + `success_criteria` 전 항목
      - `CLAUDE.md`의 변경 이력 표에 이 기능 한 줄 추가, `README.md`에 "관리자 콘솔" 절 추가(로컬 전용임을 명시), `_workspace/`에 관리자 계약 문서 `07_admin_contract.md` 작성
</implementation_order>

</feature_specification>
