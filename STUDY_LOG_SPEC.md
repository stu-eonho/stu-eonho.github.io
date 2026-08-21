<project_specification>

<project_name>Study Log — 개인 연구·학습 기록 블로그 (Astro 정적 사이트 / GitHub Pages)</project_name>

<overview>
개인 연구자·학생이 자신을 소개하고, 읽은 논문(Paper Review)과 진행한 프로젝트(Project), 공부 노트(Notes)를 카테고리별로 기록·공개하는 1인 운영 정적 블로그다. 방문자는 상단 내비게이션 바로 카테고리를 오가며 글을 탐색하고, 메인 화면에서 운영자의 이름·학적·스킬·사진 등 프로필을 한눈에 확인한다. 글쓰기는 웹 에디터가 아니라 리포지토리에 Markdown/MDX 파일을 커밋하는 방식이며, push 하면 GitHub Actions가 빌드해 GitHub Pages로 자동 배포한다.

핵심 사용자 흐름은 세 가지다. (1) 방문자가 루트(`/`)에 들어와 프로필을 읽고 최근 글 카드에서 관심 글로 진입한다. (2) 상단 바에서 `Paper Review` / `Project` / `Notes` 카테고리 목록으로 이동해 페이지네이션·태그로 필터링하며 훑는다. (3) 글 상세에서 목차(TOC)로 긴 논문 리뷰를 탐색하고, 수식(KaTeX)·코드 하이라이트·논문 메타(저자/학회/arXiv 링크)를 확인한다. 댓글 기능은 없으며, 방문자와의 상호작용 경로를 두지 않는다. 운영자 흐름은 `src/content/posts/<category>/<slug>.mdx` 파일 작성 → 커밋 → 자동 배포 한 줄이다.

CRITICAL: 서버·데이터베이스·런타임 API가 존재하지 않는다. 100% 빌드 타임 정적 생성(`output: 'static'`)이며 모든 콘텐츠의 단일 진실 공급원은 Git 리포지토리의 파일이다. 런타임에 데이터를 쓰거나 조회하는 코드를 추가해서는 안 된다.
CRITICAL: 카테고리는 데이터다. 새 카테고리 추가는 `src/config/categories.ts`에 항목 하나를 넣고 `src/content/posts/<id>/` 폴더를 만드는 것으로 끝나야 하며, 페이지 파일이나 라우트를 새로 만들면 안 된다. 모든 카테고리 화면은 `[category]` 동적 라우트 한 벌이 처리한다.
CRITICAL: 디자인 토큰의 출처는 리포지토리 루트의 `DESIGN.md`(Apple / Human Interface Guidelines 레퍼런스, verified 2026-07-11)다. `DESIGN.md`에서 검증된 값과 이 스펙이 웹 구현을 위해 추가한 값(`local extension`)을 반드시 구분해 표기하며, 확장 값을 Apple 검증 토큰인 것처럼 문서화하면 안 된다.

기본 콘텐츠 언어는 ko-KR 단일 로케일이다(UI 문자열·날짜 형식 모두 한국어). 논문 제목·저자·학회명 등 고유명사는 원문 영어를 그대로 쓴다. 다국어 전환은 이번 범위가 아니다.
</overview>

<assumptions>
- 스택 선택: 세션이 비대화형이라 사용자 확인 없이 Astro 7 + MDX + Tailwind CSS 4 정적 빌드를 선택했다. 근거: (a) GitHub Pages는 정적 호스팅만 지원하므로 SSR 프레임워크가 불필요, (b) 논문 리뷰/프로젝트 기록은 파일 기반 콘텐츠 컬렉션과 정합성이 높음, (c) Astro의 zero-JS 기본값이 Lighthouse 목표(≥95) 달성에 유리. 만약 사용자가 Jekyll/Hugo 등 기존 워크플로를 이미 쓰고 있거나 Next.js 숙련도가 높다면 `technology_stack`을 재검토해야 하며, 이 경우 `file_structure`·`route_definitions`는 대체로 이식 가능하나 `content.config.ts` 스키마는 재작성이 필요하다.
- 사이트 제목: 사용자가 임시값 "Study Log"를 그대로 쓰기로 확정했고, 나중에 변경할 계획이라고 밝혔다. 따라서 제목 문자열은 `src/config/site.ts`의 `title` 한 곳에서만 읽어야 하며, 컴포넌트·RSS·OG 메타에 문자열을 중복 하드코딩하면 나중 변경이 누락된다.
- 카테고리 초기 구성: 사용자가 명시한 `Paper Review`, `Project`에 더해 짧은 학습 기록용 `Notes`를 기본 3종으로 넣었다. 근거: 논문/프로젝트 어디에도 속하지 않는 단문이 반드시 생기며, 없으면 카테고리 체계가 곧 무너진다. 불필요하면 `categories.ts`에서 항목 하나를 지우면 된다.
- 프로필 데이터: 사용자가 직접 채우기로 확정했다. 빌더는 `src/config/profile.ts`에 타입·구조·플레이스홀더 값만 만들고 실제 정보를 지어내지 않는다. CRITICAL: 그럴듯한 가짜 이름·학교·스킬을 채워 넣으면 사용자가 무엇을 바꿔야 하는지 구분할 수 없게 된다 — 플레이스홀더는 한눈에 플레이스홀더로 보여야 한다 (아래 `profile_authoring_contract` 참조).
- 타입스크립트 버전: npm `latest`는 7.0.2지만 `@astrojs/check`의 peer 범위가 `^5 || ^6`이므로 TypeScript 6.0.3으로 고정했다. TS 7로 올리면 `astro check`가 peer 충돌로 실패한다.
- `DESIGN.md` 산문 영역에 UTF-8 모지바케(예: `Apple's` → `Appleâs`)가 일부 있으나 `tokens:` 프론트매터의 수치·헥스 값은 온전하다. 토큰은 프론트매터를 신뢰하고, 산문은 의미 해석용으로만 쓴다.
- 검색: Pagefind 정적 인덱스를 채택했다. 근거: 서버 없이 전문 검색이 가능하고 인덱스가 빌드 산출물에 포함된다. 글이 수천 편 규모로 커지면 인덱스 용량을 재검토해야 한다(현 가정: 200편 이하).
</assumptions>

<open_questions>
- Q5. 카테고리 최종 구성: `Notes`를 유지하는가? 향후 `Reading`, `TIL`, `Seminar` 등 추가 계획이 있는가? → `categories.ts` 초기값과 내비게이션 바의 항목 수(모바일 임계점)에 영향. 미해결 상태의 기본값은 Paper Review / Project / Notes 3종이다.

  <resolved>
  - Q1 (해결): `<username>.github.io` 사용자 사이트로 확정. `base`는 `/`, `site`는 `https://<username>.github.io`. 커스텀 도메인 계획 없음 → `public/CNAME`을 만들지 않는다.
  - Q4 (해결): 사이트 제목은 당분간 "Study Log"로 확정하되 추후 변경 예정. 제목은 `site.ts`에서만 정의하고 어디에도 하드코딩하지 않는다.
  - Q6 (해결): GoatCounter 도입 확정. `PUBLIC_GOATCOUNTER_CODE`를 설정하며 푸터에 수집 사실을 한 줄 명시한다.
  - Q7 (해결): 논문 PDF 원문을 리포지토리에 올리지 않고 외부 링크만 저장하는 정책으로 확정.
  - Q3 (해결): 댓글 기능을 구현하지 않는다. giscus를 포함한 모든 댓글 시스템이 out_of_scope이며 관련 환경변수·컴포넌트·CSP 항목을 전부 제거했다. 향후 필요 시 future_considerations 참조.
  - Q2 (부분 해결): 프로필 실제 값은 사용자가 직접 채운다. 빌더는 구조와 플레이스홀더까지만 만들고 값을 창작하지 않는다 → `profile_authoring_contract` 참조. 남은 미해결분은 "어떤 항목을 공개할지"뿐이며, 이는 사용자가 파일을 채우는 시점에 결정된다.
  </resolved>
</open_questions>

<scope_boundaries>
  <in_scope>
    - 상단 고정 내비게이션 바를 통한 카테고리 이동 (Home / Paper Review / Project / Notes / Archive + 검색 + 테마 토글)
    - 메인(`/`) 화면의 프로필 소개: 사진, 이름, 학적, 스킬, 관심 분야, 외부 링크, CTA 버튼
    - Markdown/MDX 기반 글 작성, 카테고리별 목록·페이지네이션·상세 페이지
    - 논문 리뷰 전용 메타(저자·학회·연도·arXiv/DOI/코드 링크) 패널과 프로젝트 전용 메타(기간·역할·스택·저장소/데모 링크) 패널
    - LaTeX 수식(KaTeX) 및 코드 문법 하이라이팅(Shiki)
    - 태그 인덱스 및 태그별 목록, 전체 아카이브(연도 그룹)
    - Pagefind 기반 정적 전문 검색
    - 라이트/다크 테마 (시스템 설정 추종 + 수동 토글, 선택 영구 저장)
    - RSS 피드, sitemap, 기본 OG/Twitter 카드 메타
    - GitHub Actions를 통한 GitHub Pages 자동 배포
    - 반응형 레이아웃 (모바일/태블릿/데스크톱) 및 WCAG 2.1 AA 접근성
  </in_scope>
  <out_of_scope>
    - 사용자 계정, 로그인, 회원가입, 권한 관리 — 방문자는 전원 익명 독자이며 콘텐츠 작성 권한은 GitHub 리포지토리 write 권한과 동일하다
    - 웹 기반 글쓰기 에디터·관리자(CMS) 화면 — 글은 에디터에서 파일로 작성한다
    - 서버, 데이터베이스, 런타임 API, 서버리스 함수
    - 댓글 기능 — giscus를 포함해 어떤 댓글 시스템도 구현하지 않는다. CRITICAL: 글 상세에 댓글 영역, 자리표시자, 주석 처리된 코드를 남기지 않는다
    - 뉴스레터 구독, 이메일 발송, 푸시 알림
    - 조회수·좋아요 등 서버 상태가 필요한 인터랙션
    - 다국어(i18n) 전환 UI 및 영문 번역본
    - 동적 OG 이미지 생성 (글마다 자동 렌더링)
    - 논문 PDF 원문 호스팅 — 저작권상 리포지토리에 복사하지 않고 외부 링크만 저장한다(확정 정책)
    - 네이티브 모바일 앱
  </out_of_scope>
  <future_considerations>
    - Phase 2: satori 계열 빌드 타임 동적 OG 이미지 (글 제목·카테고리를 그린 PNG를 빌드 시 생성)
    - Phase 2: 댓글 — 필요해지면 giscus(GitHub Discussions 기반)가 서버 없이 붙일 수 있는 선택지다. 도입 시 CSP의 `script-src`/`frame-src`에 `https://giscus.app` 추가와 환경변수 4종이 함께 필요하다
    - Phase 2: 시리즈(연작) 기능 — `series` 프론트매터로 글을 묶고 상세 상단에 목차 표시
    - Phase 2: BibTeX 인용 블록 및 `citations.bib` 기반 참고문헌 자동 렌더링
    - Phase 3: en-US 번역 라우트(`/en/**`)와 언어 스위처
    - Phase 3: 논문 읽기 통계 대시보드(연도별/학회별 집계 차트)
  </future_considerations>
</scope_boundaries>

<technology_stack>
  <frontend_application>
    <framework>Astro 7.2.4 — 정적 사이트 생성기. `output: 'static'` 고정. 기본적으로 클라이언트 JS를 0바이트로 출력하며, 인터랙션이 필요한 조각(테마 토글, 모바일 시트, 검색, 목차 하이라이트)만 `script`로 추가한다.</framework>
    <ui_language>Astro 컴포넌트(`.astro`) 전용. CRITICAL: React/Vue/Svelte 등 UI 프레임워크를 도입하지 않는다 — 이 사이트의 인터랙션 총량이 순수 DOM 스크립트로 충분하며, 프레임워크 런타임은 성능 목표에 역행한다.</ui_language>
    <build_tool>Vite (Astro 7에 내장)</build_tool>
    <styling>Tailwind CSS 4.3.3 — `@tailwindcss/vite` 4.3.3 플러그인으로 통합. Tailwind v4의 CSS-first 설정을 사용하며 `tailwind.config.js`를 만들지 않고 `src/styles/global.css`의 `@theme` 블록에 디자인 토큰을 선언한다.</styling>
    <typography_plugin>@tailwindcss/typography 0.5.20 — 본문(`prose`) 스타일 기반. 단, 타이포 수치는 `DESIGN.md` 토큰으로 전면 override 한다(`src/styles/prose.css`).</typography_plugin>
    <routing>Astro 파일 기반 라우팅 + `getStaticPaths()`로 카테고리/글/태그/페이지네이션 경로 전량 빌드 타임 생성</routing>
    <state_management>없음. 클라이언트 상태는 테마 값(`localStorage`) 하나뿐이며 별도 라이브러리를 쓰지 않는다.</state_management>
  </frontend_application>
  <content_layer>
    <collections>Astro Content Layer — `src/content.config.ts`에서 `glob()` 로더 + Zod 스키마로 `posts` 컬렉션 정의. 프론트매터 타입 검증은 빌드 타임에 강제되며, 스키마 위반 시 빌드가 실패해야 한다(경고로 넘기지 않는다).</collections>
    <markdown>@astrojs/mdx 7.0.7 — MDX 지원(컴포넌트 삽입 가능). 순수 `.md`도 동일 컬렉션에서 허용한다.</markdown>
    <math>remark-math 6.0.0 + rehype-katex 7.0.1 + katex 0.18.4 — 인라인·블록 수식을 빌드 타임에 HTML로 렌더링. KaTeX CSS와 폰트는 자체 호스팅(CDN 금지).</math>
    <syntax_highlighting>Shiki 4.4.3 (Astro 내장) — 테마 `github-light` / `github-dark` 듀얼 테마로 다크모드 대응</syntax_highlighting>
    <note>CRITICAL: 데이터베이스 없음. API 없음. 런타임 데이터 페치 없음. 모든 쿼리는 `getCollection()`을 통한 빌드 타임 배열 연산이다.</note>
  </content_layer>
  <libraries>
    <search>astro-pagefind 2.0.1 (Pagefind 1.5.2 래핑) — 빌드 후 `dist`를 인덱싱하는 정적 전문 검색. 검색 UI는 검색 페이지에서만 인덱스를 lazy-load 한다.</search>
    <sitemap>@astrojs/sitemap 3.7.3 — `sitemap-index.xml` 생성</sitemap>
    <rss>@astrojs/rss 4.0.19 — `/rss.xml` 피드 생성</rss>
    <icons>astro-icon 1.2.0 + @iconify-json/lucide 1.2.124 — 빌드 타임 인라인 SVG. 아이콘 폰트나 런타임 아이콘 페치 금지.</icons>
    <images>sharp 0.35.3 — Astro `Image` 컴포넌트의 기본 이미지 서비스. 프로필 사진과 글 커버를 AVIF/WebP로 변환·리사이즈.</images>
    <fonts>pretendard 1.3.9 — 한글 본문용 자체 호스팅 웹폰트. SF Pro는 라이선스상 웹 배포가 불가하므로 시스템 폰트 스택에서만 참조한다(아래 `aesthetic_guidelines` 참조).</fonts>
  </libraries>
  <tooling>
    <language>TypeScript 6.0.3 — CRITICAL: TypeScript 7.x를 설치하지 말 것. `@astrojs/check`의 peer 범위는 `^5.0.0 || ^6.0.0`이며 7 설치 시 `astro check`가 실패한다.</language>
    <type_checking>@astrojs/check 0.9.10 — `astro check`를 CI 필수 게이트로 사용</type_checking>
    <formatting>Prettier 3.x (latest stable) + prettier-plugin-astro 0.14.1</formatting>
    <package_manager>npm (Node 22.12.0 이상 필수 — Astro 7의 engines 요구사항)</package_manager>
  </tooling>
  <build_output>
    <build_command>npm run build → `astro build` 실행 후 astro-pagefind 통합이 `dist/pagefind/` 인덱스를 생성</build_command>
    <note>산출물은 정적 HTML/CSS/JS/이미지뿐이며 Node 런타임 없이 어떤 정적 호스트에서도 서빙 가능해야 한다.</note>
  </build_output>
</technology_stack>

<prerequisites>
  <environment_setup>
    - Node.js 22.12.0 이상 (Astro 7 engines 요구값). 로컬과 CI 모두 `.nvmrc`에 `22`를 기록해 버전을 일치시킨다.
    - npm 9.6.5 이상
    - Git, 그리고 GitHub 계정 및 Pages가 활성화된 리포지토리
    - 권장 에디터 확장: Astro (astro-build.astro-vscode), Tailwind CSS IntelliSense
  </environment_setup>
  <build_configuration>
    - `astro.config.mjs`: `site`(절대 URL, RSS/sitemap/OG에 필수), `base`, `output: 'static'`, integrations = [mdx, sitemap, pagefind, icon], `markdown.remarkPlugins = [remarkMath]`, `markdown.rehypePlugins = [[rehypeKatex, { strict: false }]]`, `markdown.shikiConfig.themes = { light: 'github-light', dark: 'github-dark' }`
    - `vite.plugins = [tailwindcss()]` (@tailwindcss/vite)
    - `tsconfig.json`: `extends: "astro/tsconfigs/strict"`, `strictNullChecks: true`, path alias `@/*` → `src/*`
    - `package.json` scripts: `dev`(astro dev), `build`(astro check && astro build), `preview`(astro preview), `format`(prettier --write .)
    - CRITICAL: `build` 스크립트는 반드시 `astro check`를 선행한다. 타입 오류가 있는 상태로 Pages에 배포되면 안 된다.
    - `public/.nojekyll` 빈 파일을 커밋한다. Astro는 `_astro/` 디렉터리를 출력하는데 밑줄 시작 경로는 Jekyll 처리 경로에서 누락될 수 있다.
  </build_configuration>
</prerequisites>

<environment_variables>
  <note>CRITICAL: 이 프로젝트는 정적 빌드다. `PUBLIC_` 접두사가 붙은 값은 물론이고 빌드 타임에 참조되는 모든 값이 최종 HTML/JS 번들에 평문으로 포함된다. 비밀 값(토큰, API 키, 비공개 이메일)을 환경변수로 주입해서는 안 된다. 아래 변수는 전부 "공개되어도 무방한 식별자"다.</note>
  <variable>
    <name>PUBLIC_SITE_URL</name>
    <description>사이트 절대 URL. 미설정 시 `astro.config.mjs`의 `site` 값을 사용한다. 프리뷰 배포에서 canonical/OG URL을 덮어쓸 때만 지정.</description>
    <required>false</required>
    <example>https://username.github.io</example>
  </variable>
  <variable>
    <name>PUBLIC_GOATCOUNTER_CODE</name>
    <description>GoatCounter 사이트 코드(쿠키리스 방문 통계). 미설정 시 분석 스크립트를 아예 삽입하지 않는다.</description>
    <required>false</required>
    <example>mystudylog</example>
    <note>도입 확정. 배포 전 GoatCounter에서 사이트 코드를 발급받아 채운다. 값이 없으면 스크립트가 삽입되지 않으므로 발급 전에도 빌드는 정상 동작한다.</note>
  </variable>
  <variable>
    <name>(그 외 설정)</name>
    <description>사이트 제목, 설명, 프로필, 카테고리 목록 등 나머지 설정은 환경변수가 아니라 `src/config/*.ts`에 둔다. 타입 검증과 Git 이력 추적이 가능하기 때문이다.</description>
    <required>false</required>
    <example>src/config/site.ts</example>
  </variable>
</environment_variables>

<file_structure>
.
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Pages 배포 워크플로
├── .nvmrc                          # "22"
├── public/
│   ├── .nojekyll                   # 빈 파일 (_astro/ 경로 보호)
│   ├── favicon.svg
│   ├── og-default.png              # 1200x630 기본 OG 이미지
│   └── cv.pdf                      # 선택 (Q2 — 게시하지 않으면 파일과 링크 모두 생략)
├── src/
│   ├── assets/
│   │   └── profile.jpg             # 프로필 사진 원본 (최소 640x640, Image로 최적화됨)
│   ├── components/
│   │   ├── ui/                     # DESIGN.md의 Included Components 대응 프리미티브
│   │   │   ├── Button.astro        # variant: primary | outline | compact
│   │   │   ├── Card.astro          # radius 18px, flat, hairline border
│   │   │   ├── Badge.astro         # 카테고리/상태 라벨
│   │   │   ├── Tabs.astro          # gallery-tab 스타일 (선택 상태 명시)
│   │   │   └── Dialog.astro        # 모바일 내비 시트 및 이미지 라이트박스 공용
│   │   ├── layout/
│   │   │   ├── SiteHeader.astro    # 상단 고정 내비게이션 바
│   │   │   ├── NavLink.astro       # active/inactive 상태 처리
│   │   │   ├── MobileNavSheet.astro
│   │   │   ├── ThemeToggle.astro
│   │   │   └── SiteFooter.astro
│   │   ├── home/
│   │   │   ├── ProfileHero.astro   # 사진 + 이름 + 한 줄 소개 + CTA
│   │   │   ├── EducationList.astro # 학적 타임라인
│   │   │   ├── SkillGroups.astro   # 스킬 그룹 + 칩
│   │   │   ├── InterestList.astro
│   │   │   └── RecentPosts.astro   # 최근 글 6개 그리드
│   │   ├── post/
│   │   │   ├── PostCard.astro
│   │   │   ├── PostMetaHeader.astro
│   │   │   ├── PaperMetaPanel.astro    # category === 'paper-review'
│   │   │   ├── ProjectMetaPanel.astro  # category === 'project'
│   │   │   ├── TableOfContents.astro
│   │   │   └── PrevNextNav.astro
│   │   ├── tag/
│   │   │   └── TagChip.astro
│   │   └── search/
│   │       └── SearchPanel.astro
│   ├── config/
│   │   ├── site.ts                 # 사이트 제목/설명/소셜/내비 순서
│   │   ├── categories.ts           # CRITICAL: 카테고리 단일 정의 지점
│   │   └── profile.ts              # 이름/학적/스킬/관심사/링크
│   ├── content/
│   │   └── posts/
│   │       ├── _template.paper-review.mdx   # 새 글 템플릿 (glob에서 제외됨)
│   │       ├── _template.project.mdx
│   │       ├── paper-review/       # *.md | *.mdx
│   │       ├── project/
│   │       └── notes/
│   ├── content.config.ts           # Zod 스키마 + glob 로더
│   ├── layouts/
│   │   ├── BaseLayout.astro        # html, head, 테마 스크립트, 헤더/푸터
│   │   ├── ListLayout.astro        # 목록형 페이지 공통 셸
│   │   └── PostLayout.astro        # 글 상세 (본문 + TOC)
│   ├── lib/
│   │   ├── posts.ts                # getPublishedPosts, sortByDate, paginate 헬퍼
│   │   ├── tags.ts                 # 태그 집계, slugify
│   │   ├── date.ts                 # Intl.DateTimeFormat('ko-KR') 포맷터
│   │   ├── reading-time.ts         # 읽기 시간 추정
│   │   └── seo.ts                  # canonical/OG 메타 조립
│   ├── pages/
│   │   ├── index.astro             # 홈 = 프로필 + 최근 글
│   │   ├── archive.astro           # 전체 글 연도별
│   │   ├── search.astro
│   │   ├── 404.astro
│   │   ├── rss.xml.ts
│   │   ├── [category]/
│   │   │   ├── index.astro         # 카테고리 목록 1페이지
│   │   │   ├── [slug].astro        # 글 상세 (단일 세그먼트 slug)
│   │   │   └── page/
│   │   │       └── [page].astro    # 2페이지 이후
│   │   └── tags/
│   │       ├── index.astro
│   │       └── [tag].astro
│   └── styles/
│       ├── global.css              # @theme 토큰 + 리셋 + 유틸
│       └── prose.css               # 본문 타이포/코드/수식/표 스타일
├── scripts/
│   └── check-links.mjs             # 빌드 후 내부 링크 검사 (CI 게이트)
├── astro.config.mjs
├── tsconfig.json
├── package.json
├── DESIGN.md                       # 디자인 토큰 원본 (수정 금지, 참조 전용)
└── README.md                       # 프로필 채우는 법 + 글 작성법 + 로컬 실행 + 배포 절차
</file_structure>

<core_data_entities>
  <site_config>
    `src/config/site.ts`가 export 하는 단일 객체. 사이트 전역 상수.
    - title: string (required, max 40자, 예: "Study Log")
    - description: string (required, max 160자, 검색/OG 설명)
    - url: string (required, 절대 URL, 후행 슬래시 없음)
    - base: string (required, 기본 "/", 프로젝트 리포지토리면 "/repo-name")
    - locale: string ("ko-KR" 고정)
    - navOrder: string[] (상단 바 노출 순서. Category id 또는 예약어 "archive")
    - postsPerPage: number (기본 12)
    - recentPostsOnHome: number (기본 6)
    - rssItemLimit: number (기본 50)
    - defaultOgImage: string ("/og-default.png")
  </site_config>

  <category>
    `src/config/categories.ts`의 `CATEGORIES: Category[]`. CRITICAL: 카테고리의 단일 진실 공급원이며, 라우트·내비·컬렉션 스키마가 모두 이 배열에서 파생된다.
    - id: string (required, URL 세그먼트, `[a-z0-9-]+` 패턴, 예: "paper-review" | "project" | "notes")
    - label: string (required, 상단 바 표기, 예: "Paper Review")
    - labelKo: string (required, 목록 페이지 부제용, 예: "논문 리뷰")
    - description: string (required, max 120자, 카테고리 목록 헤더 및 메타 설명)
    - icon: string (required, lucide 아이콘 이름, 예: "file-text" | "folder-git-2" | "notebook-pen")
    - order: number (required, 오름차순 정렬)
    - metaPanel: enum (paper, project, none) — 글 상세에서 렌더링할 메타 패널 종류
    - 초기값: [{ id: "paper-review", metaPanel: "paper", order: 1 }, { id: "project", metaPanel: "project", order: 2 }, { id: "notes", metaPanel: "none", order: 3 }]
    - 파생 타입: `type CategoryId = (typeof CATEGORIES)[number]['id']` — Zod 스키마와 라우트가 이 타입을 재사용한다
  </category>

  <profile>
    `src/config/profile.ts`가 export 하는 단일 객체. 홈 화면 전체의 데이터 소스.
    - name: string (required, 표기명)
    - nameEn: string (optional, 영문 표기)
    - photo: ImageMetadata (required, `src/assets/profile.jpg`를 import 한 값 — 문자열 경로가 아니라 import된 에셋이어야 Astro Image 최적화가 걸린다)
    - photoAlt: string (required, 스크린리더용 설명)
    - tagline: string (required, max 80자, 한 줄 소개)
    - bio: string (required, max 400자, 2~3문장 자기소개)
    - email: string (optional, 미설정 시 이메일 아이콘 미노출)
    - location: string (optional, 예: "Seoul, Korea")
    - education: EducationEntry[] (required, 최신 항목이 배열 앞)
    - skillGroups: SkillGroup[] (required, 최대 5그룹 권장)
    - interests: string[] (required, 연구 관심 분야, 최대 8개)
    - links: SocialLink[] (required, 최대 6개)
    - cvUrl: string (optional, 예: "/cv.pdf")
  </profile>

  <education_entry>
    - degree: enum (BS, MS, PhD, Exchange, Other) — 학위 과정 구분
    - school: string (required, 예: "OO대학교")
    - department: string (required, 예: "컴퓨터공학과")
    - lab: string (optional, 연구실명)
    - advisor: string (optional, 지도교수 — 공개 여부는 사용자 판단, Q2 미해결)
    - startDate: string (required, "YYYY-MM" 형식)
    - endDate: string | null (required, 재학 중이면 null → UI에 "현재" 표시)
    - note: string (optional, 예: "학부 연구생")
  </education_entry>

  <skill_group>
    - name: string (required, 예: "Languages", "ML/DL", "Infra")
    - items: string[] (required, 1개 이상, 각 항목 max 24자)
  </skill_group>

  <social_link>
    - type: enum (github, scholar, linkedin, x, email, orcid, homepage) — 아이콘 매핑 키
    - url: string (required, 절대 URL. type이 email이면 `mailto:` 스킴)
    - label: string (required, aria-label 및 툴팁 텍스트)
  </social_link>

  <post>
    `posts` 컬렉션 엔트리. `src/content/posts/**/*.{md,mdx}`의 프론트매터 + 본문.
    - id: string (Astro가 파일 경로에서 생성. 라우팅에는 `slug`를 쓴다)
    - slug: string (required, URL 세그먼트, `[a-z0-9-]+` 패턴. CRITICAL: 슬래시를 포함할 수 없다 — 라우트가 단일 세그먼트 `[slug]`이므로 중첩 슬러그는 404가 된다)
    - title: string (required, max 120자)
    - description: string (required, max 200자 — 카드 요약·OG·RSS에 공용)
    - category: enum (paper-review, project, notes) — `CategoryId`와 동일 집합. 스키마에서 `z.enum(CATEGORY_IDS)`로 강제
    - date: Date (required, 최초 게시일. 목록 정렬 및 아카이브 그룹 기준)
    - updated: Date (optional, 수정일. 존재하면 상세 헤더에 "수정: ..." 병기)
    - tags: string[] (optional, 기본 [], 항목당 max 24자, 소문자 slug로 정규화되어 `/tags/:tag`에 매핑)
    - draft: boolean (optional, 기본 false. CRITICAL: true면 프로덕션 빌드에서 완전히 제외되며 목록·RSS·sitemap·검색 인덱스 어디에도 나타나지 않는다. `import.meta.env.DEV`에서만 노출)
    - cover: ImageMetadata (optional, 카드/상세 상단 이미지. 권장 1600x900)
    - coverAlt: string (optional, `cover`가 있으면 required)
    - math: boolean (optional, 기본 false. true인 글에만 KaTeX CSS를 head에 삽입 — 전체 페이지에 넣지 않는다)
    - toc: boolean (optional, 기본 true. false면 목차 컬럼을 숨기고 본문을 가운데 정렬)
    - paper: PaperMeta (optional. `category === 'paper-review'`이면 required — Zod `superRefine`으로 검증)
    - project: ProjectMeta (optional. `category === 'project'`이면 required — 동일 검증)
    - 정렬 기본값: `date` 내림차순, 동일 날짜면 `title` 오름차순(안정 정렬 보장)
    - 파생 필드(프론트매터에 쓰지 않고 빌드 타임에 계산): `readingTime: number` (분 단위, `src/lib/reading-time.ts`가 본문에서 산출), `headings: TocHeading[]` (Astro `render()` 반환값), `prev` / `next` (같은 카테고리 내 인접 글)
  </post>

  <paper_meta>
    논문 리뷰 글의 원 논문 정보. `PaperMetaPanel`에 렌더링된다.
    - paperTitle: string (required, 원문 제목 그대로. 번역하지 않는다)
    - authors: string[] (required, 1명 이상. 4명 초과 시 UI에서 "외 N명"으로 축약)
    - venue: string (required, 예: "NeurIPS", "arXiv preprint")
    - year: number (required, 1950 이상 현재연도+1 이하)
    - arxivId: string (optional, 예: "2301.00001" — `https://arxiv.org/abs/{id}` 링크 생성)
    - doi: string (optional, `https://doi.org/{doi}` 링크 생성)
    - pdfUrl: string (optional, 외부 원문 링크. CRITICAL: 리포지토리에 PDF를 복사하지 않고 링크만 저장한다 — 확정 정책)
    - codeUrl: string (optional, 공식 구현 저장소)
    - readDate: Date (optional, 논문을 읽은 날짜. 미설정 시 `date`로 대체)
  </paper_meta>

  <project_meta>
    프로젝트 글의 부가 정보. `ProjectMetaPanel`에 렌더링된다.
    - role: string (required, 예: "1인 개발", "백엔드 담당")
    - period: object (required) — { start: string ("YYYY-MM", required), end: string | null ("YYYY-MM" 또는 진행 중이면 null, required) }
    - stack: string[] (required, 1개 이상, 사용 기술 — Badge로 렌더링)
    - status: enum (in-progress, completed, archived) — 배지 배색이 달라진다
    - repoUrl: string (optional)
    - demoUrl: string (optional)
    - teamSize: number (optional, 1 이상)
  </project_meta>

  <tag>
    저장되지 않는 파생 엔티티. 빌드 타임에 `src/lib/tags.ts`가 전체 글을 순회해 생성한다.
    - slug: string (원본 태그를 소문자화 + 공백을 하이픈으로 + 비허용 문자 제거)
    - label: string (최초 등장한 원본 표기를 대표값으로 사용)
    - count: number (해당 태그가 붙은 published 글 수)
    - posts: Post[] (date 내림차순)
    - 정렬: 태그 인덱스는 `count` 내림차순, 동수면 `label` 오름차순
  </tag>

  <toc_heading>
    파생 엔티티. Astro의 `render()`가 반환하는 `headings`를 필터링해 만든다.
    - depth: number (2 또는 3만 사용. h1은 글 제목이므로 제외, h4 이하는 목차에 넣지 않는다)
    - slug: string (앵커 id)
    - text: string (표시 텍스트)
  </toc_heading>

  <search_record>
    Pagefind가 빌드 후 자동 생성하는 인덱스 레코드. 직접 만들지 않고 마크업으로 제어한다.
    - CRITICAL: 본문 컨테이너에 `data-pagefind-body`를 붙인 요소만 인덱싱된다. 헤더/푸터/내비/메타 패널은 인덱싱 대상에서 제외한다.
    - `data-pagefind-meta="category:{label}"`, `data-pagefind-meta="date:{ISO}"`를 상세 페이지에 부여해 검색 결과에 카테고리·날짜를 표시한다.
    - `draft: true` 글은 애초에 빌드 산출물에 없으므로 인덱스에도 존재하지 않는다.
  </search_record>
</core_data_entities>

<route_definitions>
  <note>모든 경로는 빌드 타임에 정적 생성된다. 인증 가드나 보호 라우트는 존재하지 않는다(전 페이지 공개).</note>
  <public_routes>
    <route path="/" page="HomePage" description="프로필(이름/학적/스킬/사진) + 최근 글 6개" />
    <route path="/:category" page="CategoryListPage" description="카테고리 글 목록 1페이지. :category는 CATEGORIES의 id 집합으로만 생성" />
    <route path="/:category/page/:page" page="CategoryListPage" description="2페이지 이후. :page는 2부터 시작하는 정수" />
    <route path="/:category/:slug" page="PostDetailPage" description="글 상세. CRITICAL: :slug는 단일 세그먼트다" />
    <route path="/archive" page="ArchivePage" description="전 카테고리 글을 연도별로 묶은 목록" />
    <route path="/tags" page="TagIndexPage" description="태그 클라우드 + 사용 횟수" />
    <route path="/tags/:tag" page="TagDetailPage" description="해당 태그가 달린 전 카테고리 글" />
    <route path="/search" page="SearchPage" description="Pagefind 검색 UI" />
    <route path="/404" page="NotFoundPage" description="GitHub Pages가 자동으로 404.html을 서빙" />
  </public_routes>
  <generated_endpoints>
    <route path="/rss.xml" handler="@astrojs/rss" description="published 글 전체, date 내림차순, 최대 site.rssItemLimit(50)건" />
    <route path="/sitemap-index.xml" handler="@astrojs/sitemap" description="draft 글 제외" />
    <route path="/pagefind/*" handler="astro-pagefind" description="빌드 후 생성되는 검색 인덱스 정적 자산" />
  </generated_endpoints>
  <route_conflict_rules>
    - CRITICAL: `/[category]/[slug].astro`는 반드시 rest 파라미터(`[...slug]`)가 아닌 단일 세그먼트여야 한다. rest로 만들면 `/paper-review/page/2`가 slug `page/2`로 잡혀 페이지네이션이 깨진다.
    - `/[category]/index.astro`가 페이지 1을, `/[category]/page/[page].astro`가 2 이상을 담당한다. `page/1` 경로는 생성하지 않고, UI의 모든 1페이지 링크는 `/[category]`를 가리킨다.
    - `getStaticPaths()`는 `CATEGORIES`에 없는 id를 절대 생성하지 않는다. 존재하지 않는 카테고리 URL은 404로 떨어진다.
  </route_conflict_rules>
  <trailing_slash>`trailingSlash: 'ignore'` (Astro 기본). 내부 링크는 후행 슬래시 없이 통일해 작성한다.</trailing_slash>
</route_definitions>

<component_hierarchy>
  <app_shell>
    <base_layout>                      <!-- BaseLayout.astro: html lang="ko" -->
      <head>
        <seo_meta />                   <!-- title, description, canonical, OG, Twitter, JSON-LD -->
        <theme_init_script />          <!-- CRITICAL: 렌더 차단 인라인 스크립트. FOUC 방지를 위해 body 렌더 전에 실행 -->
        <katex_css />                  <!-- 조건부: post.data.math === true 인 페이지에만 -->
        <analytics_script />           <!-- 조건부: PUBLIC_GOATCOUNTER_CODE 존재 시 -->
      </head>
      <body>
        <skip_to_content_link />       <!-- 포커스 시에만 보이는 접근성 링크 -->
        <site_header>                  <!-- 56px, sticky, 반투명 -->
          <brand_link />               <!-- 사이트 제목 → "/" -->
          <nav_link />                 <!-- CATEGORIES 순회 + Archive. active 상태 표시 -->
          <search_button />            <!-- → /search -->
          <theme_toggle />
          <mobile_menu_button />       <!-- 768px 미만에서만 표시 -->
        </site_header>
        <mobile_nav_sheet />           <!-- Dialog 기반, 헤더에서 slide-down -->
        <main id="main">
          <slot />                     <!-- 각 페이지 -->
        </main>
        <site_footer />                <!-- 소셜 링크, RSS, 저작권 -->
      </body>
    </base_layout>
  </app_shell>

  <page_composition>
    <home_page>                        <!-- pages/index.astro -->
      <profile_hero />                 <!-- 사진 + 이름 + tagline + CTA 2개 + 소셜 아이콘 -->
      <education_list />
      <skill_groups />
      <interest_list />
      <recent_posts />                 <!-- post_card 반복 -->
    </home_page>

    <list_layout>                      <!-- CategoryListPage / ArchivePage / TagDetailPage 공용 -->
      <list_header />                  <!-- 제목 + 설명 + 글 수 -->
      <post_card />                    <!-- 반복 -->
      <pagination />                   <!-- 카테고리 목록에서만 -->
      <empty_state />
    </list_layout>

    <post_layout>                      <!-- PostLayout.astro -->
      <post_meta_header />             <!-- 카테고리 배지, 제목, 날짜, 읽기 시간, 태그 -->
      <paper_meta_panel />             <!-- metaPanel === 'paper' -->
      <project_meta_panel />           <!-- metaPanel === 'project' -->
      <article data-pagefind-body />   <!-- prose 본문 (MDX 렌더 결과) -->
      <table_of_contents />            <!-- 1024px 이상에서 우측 sticky 컬럼, 미만은 접힘 블록 -->
      <prev_next_nav />                <!-- 같은 카테고리 내 이전/다음 글 -->
    </post_layout>

    <search_page>
      <search_panel />                 <!-- Pagefind UI 마운트 지점 -->
    </search_page>
  </page_composition>

  <shared>
    <button />                         <!-- variant: primary(44px) | outline(44px) | compact(36px) -->
    <card />                           <!-- radius 18px, flat, hairline border -->
    <badge />                          <!-- 카테고리/프로젝트 상태/스택 -->
    <tabs />                           <!-- 선택 상태가 시각적으로 명시된 탭 -->
    <dialog />                         <!-- 포커스 트랩 + Escape 닫기, 모바일 내비가 사용 -->
    <tag_chip />
    <empty_state />                    <!-- 아이콘 + 문구 + CTA -->
    <pagination />
  </shared>

  <note>Astro에는 React식 Provider 개념이 없다. 전역 상태에 해당하는 유일한 값(테마)은 `head`의 인라인 스크립트가 `document.documentElement`에 `data-theme` 속성을 세팅하는 방식으로 전달되며, 모든 컴포넌트는 CSS 변수로 이를 소비한다.</note>
</component_hierarchy>

<pages_and_interfaces>
  <global_layout>
    <container>
      - 최대 폭 1120px, 좌우 패딩 22px(모바일) / 24px(768px 이상), 가운데 정렬
      - 본문(prose) 컬럼 최대 폭 720px — 한 줄 길이를 읽기 좋은 범위로 제한
    </container>
    <top_navigation>
      - 높이 56px [local extension], `position: sticky; top: 0; z-index: 50`
      - 배경: 라이트 `rgba(245, 245, 247, 0.72)`, 다크 `rgba(0, 0, 0, 0.72)` + `backdrop-filter: saturate(180%) blur(20px)` (Apple의 반투명 기능 레이어 방향성을 웹으로 확장한 값)
      - 하단 경계: `1px solid rgba(0, 0, 0, 0.08)` (다크: `rgba(255, 255, 255, 0.12)`)
      - 좌측 브랜드: 사이트 제목, 17px / 600 / `#1d1d1f` (다크 `#f5f5f7`), 클릭 시 `/`
      - 중앙 내비 항목: `site.navOrder` 순서대로 Home / Paper Review / Project / Notes / Archive. 폰트 17px / 400, 항목 간 간격 20px, 각 항목 좌우 패딩 8px, 히트 영역 높이 44px
        - inactive: `#6e6e73` (다크 `#86868b`)
        - hover [local extension]: 색상 `#1d1d1f` (다크 `#f5f5f7`)로 150ms ease 전환 — DESIGN.md는 hover를 캡처하지 않았다
        - active(현재 경로): 색상 `#1d1d1f` (다크 `#f5f5f7`) + 항목 하단 2px `#0071e3` 언더라인, `aria-current="page"` 부여. CRITICAL: 선택 상태를 색상만으로 표시하지 않는다 (DESIGN.md "Keep selected state explicit")
        - active 판정: 경로가 `/{category}`로 시작하면 해당 카테고리 항목이 active. `/` 정확 일치일 때만 Home이 active
      - 우측: 검색 아이콘 버튼(20px 아이콘, 44x44px 히트 영역), 테마 토글(동일 규격)
      - 768px 미만: 중앙 내비를 숨기고 우측에 햄버거 버튼 노출. 브랜드 + 검색 + 햄버거만 남는다
    </top_navigation>
    <mobile_nav_sheet>
      - 트리거: 햄버거 버튼. 헤더 아래에서 아래로 펼쳐지는 전체 폭 시트
      - 배경: 라이트 `#ffffff`, 다크 `#000000` (불투명 — 시트가 열리면 시트 가독성이 우선)
      - 항목: 세로 스택, 각 항목 높이 56px, 좌우 패딩 22px, 폰트 20px / 400, 항목 간 hairline 구분선
      - 애니메이션 [local extension]: `translateY(-8px)`에서 0으로 + `opacity` 0에서 1로, 240ms `cubic-bezier(0.4, 0, 0.2, 1)`
      - 동작: 열릴 때 `body` 스크롤 잠금, Escape 및 배경 클릭으로 닫힘, 포커스 트랩, 닫힌 뒤 햄버거 버튼으로 포커스 복귀
      - `prefers-reduced-motion: reduce`이면 transform 없이 즉시 표시
    </mobile_nav_sheet>
    <site_footer>
      - 상단 hairline 경계, 상하 패딩 40px, 배경 `#f5f5f7` (다크 `#000000`)
      - 1행: 소셜 링크 아이콘 (20px, `#6e6e73`, hover `#1d1d1f`), RSS 링크
      - 2행: "© {현재 연도} {profile.name}" 12px / 400 / `#6e6e73`
      - 3행: "Built with Astro · Hosted on GitHub Pages" 12px / `#6e6e73`
      - 4행: "방문 통계는 GoatCounter로 집계하며 쿠키나 개인 식별 정보를 수집하지 않습니다." 12px / `#6e6e73`. CRITICAL: `PUBLIC_GOATCOUNTER_CODE`가 설정된 경우에만 출력한다 — 스크립트를 넣지 않는 빌드에 고지만 남으면 사실과 다른 문구가 된다
    </site_footer>
  </global_layout>

  <home_page>
    <profile_hero>
      - 레이아웃: 768px 이상은 2열(좌 텍스트 / 우 사진), 768px 미만은 사진이 위로 오는 1열 가운데 정렬
      - 상하 패딩 80px(데스크톱) / 56px(모바일)
      - 사진: 200x200px(데스크톱) / 140x140px(모바일), `border-radius: 50%`, `object-fit: cover`. Astro Image로 AVIF/WebP 2배수(400px/280px) 생성, `loading="eager"`, `fetchpriority="high"` (LCP 요소)
      - 이름: 56px / 600 / line-height 60px / letter-spacing -0.28px / `#1d1d1f` (다크 `#f5f5f7`). 768px 미만에서는 40px / 44px
      - tagline: 이름 아래 12px 간격, 28px / 400 / line-height 32px / `#515154` (다크 `#a1a1a6`)
      - 소속 한 줄: `education[0]`에서 파생 — "{school} {department} {degree} 재학" 형태. 17px / 400 / `#6e6e73`
      - bio: tagline 아래 20px 간격, 17px / 400 / line-height 25px / `#1d1d1f`, 최대 폭 640px
      - CTA 영역: bio 아래 32px 간격, 버튼 2개 가로 배치(간격 12px)
        - 1차: "Paper Review 보기" — primary 버튼(44px, `#0071e3` 배경, `#ffffff` 텍스트, radius 980px, padding 11px 21px, 17px/400) → `/paper-review`
        - 2차: "GitHub" — outline 버튼(44px, 투명 배경, `#0066cc` 텍스트/1px 테두리, radius 980px, padding 11px 21px) → `links`의 github URL. CRITICAL: `#0066cc`를 채움 배경색으로 쓰지 않는다
        - 480px 미만에서는 버튼 2개가 세로 스택 + `width: 100%`
      - 소셜 아이콘 행: CTA 아래 20px 간격, 24px 아이콘, 간격 20px, 44x44px 히트 영역, 각 아이콘에 `aria-label` 필수
      - 프로필 사진이 없을 때: 이름 이니셜 원형 플레이스홀더(배경 `rgba(0,0,0,0.05)`, 텍스트 `#6e6e73` 56px)
    </profile_hero>
    <education_section>
      - 섹션 제목 "학적" — 40px / 600 / line-height 44px, 상단 여백 80px
      - 타임라인: 항목별 좌측 8px 원형 마커(`#0071e3`) + 1px 세로 연결선(`rgba(0,0,0,0.12)`), 항목 간 24px
      - 각 항목: 1행 "{school} · {department}" 20px / 600 / `#1d1d1f`, 2행 "{degree} · {startDate} – {endDate 또는 '현재'}" 14px / 400 / `#6e6e73`, 3행 lab/advisor/note가 있으면 14px / `#515154`
      - `endDate`가 null인 항목의 마커는 `#0071e3` 채움 + 2px `rgba(0,113,227,0.24)` 링, 나머지는 `#6e6e73` 채움
      - 날짜 표기: `Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' })` → "2024년 3월"
      - 항목이 0개면 섹션 전체를 렌더링하지 않는다
    </education_section>
    <skills_section>
      - 섹션 제목 "스킬" — 40px / 600
      - 그룹별 블록: 그룹명 14px / 600 / `#6e6e73` / letter-spacing 0.4px, 그 아래 칩 flex-wrap
      - 칩(Badge): 높이 32px, padding 0 12px, radius 980px, 배경 `rgba(0, 0, 0, 0.05)` (다크 `rgba(255,255,255,0.10)`), 텍스트 14px / 400 / `#1d1d1f` (다크 `#f5f5f7`), 간격 8px
      - 칩은 링크가 아니다. 커서 기본값 유지, hover 효과 없음 — 상호작용 가능한 것처럼 보이면 안 된다
      - 그룹 간 간격 24px
    </skills_section>
    <interests_section>
      - 섹션 제목 "관심 분야" — 40px / 600
      - 항목: 최대 8개, 칩 형태(스킬 칩과 동일 규격, 단 배경 `rgba(0,113,227,0.08)` + 텍스트 `#0066cc`)
    </interests_section>
    <recent_posts_section>
      - 섹션 제목 "최근 글" + 우측 "전체 보기" 링크(17px / 400 / `#0066cc`) → `/archive`
      - 그리드: 1024px 이상 3열, 768–1023px 2열, 768px 미만 1열. gap 20px
      - 카드 수: `site.recentPostsOnHome` (기본 6)
      - 비어 있을 때: empty_state — "아직 작성된 글이 없습니다" + "첫 글은 src/content/posts/ 에 Markdown 파일을 추가해 만듭니다" 안내
    </recent_posts_section>
  </home_page>

  <post_card>
    - 규격: `Card` 프리미티브. 배경 `#ffffff` (다크 `#1d1d1f`), radius 18px, `1px solid rgba(0,0,0,0.08)` (다크 `rgba(255,255,255,0.12)`), padding 20px
    - CRITICAL: 그림자를 쓰지 않는다. DESIGN.md의 캡처에서 버튼과 카드 모두 shadow가 없었고 canonical shadow 토큰이 존재하지 않는다. 깊이는 배경 대비와 hairline 경계로만 만든다
    - 커버가 있으면 카드 상단에 16:9 이미지(상단 radius 18px, `object-fit: cover`), 없으면 생략(플레이스홀더 이미지를 만들지 않는다)
    - 1행: 카테고리 배지 — 높이 24px, padding 0 10px, radius 980px, 12px / 400, 배경 `rgba(0,113,227,0.10)`, 텍스트 `#0066cc`. `draft`면 중립 배지 "DRAFT"를 함께 표시(개발 모드 전용)
    - 2행: 제목 — 20px / 600 / line-height 26px / `#1d1d1f` (다크 `#f5f5f7`), 최대 2줄 클램프
    - 3행: description — 14px / 400 / line-height 18px / `#6e6e73`, 최대 2줄 클램프
    - 4행: 날짜(14px / `#6e6e73`) + 태그 최대 3개, 초과분은 "+N"
    - 카드 전체가 하나의 링크다. CRITICAL: 카드 내부에 중첩 링크를 두지 않는다 — 카드 안의 태그는 링크가 아니라 텍스트 배지로 렌더링한다(태그 링크는 태그 인덱스와 글 상세에서 제공)
    - hover [local extension]: 배경 `#ffffff`에서 `#fbfbfd`로 (다크 `#1d1d1f`에서 `#2c2c2e`로), 테두리 `rgba(0,0,0,0.08)`에서 `rgba(0,0,0,0.16)`로, 150ms ease. transform/scale은 사용하지 않는다
    - focus-visible: `outline: 2px solid #0071e3; outline-offset: 2px`
    - `prefers-reduced-motion: reduce`이면 색상 전환도 즉시 적용
  </post_card>

  <category_list_page>
    <header>
      - 상단 패딩 56px. 카테고리 아이콘(28px, `#0071e3`) + `label` 40px / 600 한 줄
      - 부제: "{labelKo} · {description}" 17px / 400 / `#6e6e73`
      - 글 수: "총 {n}편" 14px / `#6e6e73`
    </header>
    <post_list>
      - 그리드는 홈과 동일(3/2/1열, gap 20px), 페이지당 `site.postsPerPage`(기본 12)개
    </post_list>
    <pagination>
      - 목록 하단 40px 간격. 가운데 정렬
      - 이전/다음 버튼: compact 버튼(36px, padding 8px 15px, 14px / 400). 없는 방향은 렌더링하되 비활성 — 배경 `rgba(0,0,0,0.04)`, 텍스트 `#6e6e73`, `aria-disabled="true"`, 포커스 불가
      - 가운데 "{현재} / {전체}" 14px / `#6e6e73`
      - 1페이지 링크는 `/{category}`, 2페이지 이상은 `/{category}/page/{n}`
      - 전체가 1페이지면 페이지네이션 영역 자체를 렌더링하지 않는다
    </pagination>
    <empty_state>
      - 아이콘(48px, `#6e6e73`) + "이 카테고리에는 아직 글이 없습니다" 20px / 400 + "다른 카테고리 둘러보기" compact 버튼 → `/archive`
    </empty_state>
  </category_list_page>

  <post_detail_page>
    <layout>
      - 1024px 이상: 2열 — 본문 720px + 우측 목차 컬럼 240px(간격 40px), 전체를 컨테이너 안에서 가운데 정렬
      - 1024px 미만: 1열. 목차는 본문 상단의 접힘 블록("목차" 라벨, 기본 닫힘)
      - `toc: false`이거나 h2/h3가 2개 미만이면 목차를 렌더링하지 않고 본문을 가운데 배치
    </layout>
    <post_meta_header>
      - 상단 패딩 56px
      - 1행: 카테고리 배지 → 해당 카테고리 목록으로 링크
      - 2행: 제목 40px / 600 / line-height 44px / `#1d1d1f` (다크 `#f5f5f7`). 768px 미만은 28px / 32px
      - 3행: description 20px / 400 / `#515154`
      - 4행: "{게시일}" + `updated`가 있으면 " · 수정 {수정일}" + " · 약 {n}분" 14px / `#6e6e73`. 날짜는 `Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' })` → "2026년 8월 20일", `time` 태그의 `datetime` 속성은 ISO 값
      - 5행: 태그 칩 목록 → 각각 `/tags/{slug}`
      - 6행: 커버 이미지(있으면), 16:9, radius 18px, 상단 여백 32px
    </post_meta_header>
    <paper_meta_panel>
      - 조건: `category.metaPanel === 'paper'`. 본문 시작 전, 커버 아래 32px 간격
      - 배경 `#f5f5f7` (다크 `#1d1d1f`), radius 18px, padding 20px, 그림자 없음
      - 제목 줄: "원 논문" 12px / 600 / `#6e6e73` / letter-spacing 0.4px
      - `paperTitle` 20px / 600 / `#1d1d1f`, 그 아래 저자 14px / `#515154` (4명 초과 시 앞 4명 + "외 N명")
      - "{venue} {year}" 14px / `#6e6e73`
      - 링크 행: arXiv / DOI / PDF / Code 중 존재하는 것만 compact-outline 버튼으로(36px, 8px 15px, 14px/400, `#0066cc` 텍스트·테두리), 간격 8px, 모두 `target="_blank"` + `rel="noopener noreferrer"`
      - `readDate`가 있으면 "읽은 날짜: ..." 12px / `#6e6e73`
    </paper_meta_panel>
    <project_meta_panel>
      - 조건: `category.metaPanel === 'project'`. 배경/규격은 paper 패널과 동일
      - 좌우 2열 정의 목록(640px 미만은 1열): 기간 / 역할 / 팀 규모(있으면) / 상태
      - 기간 표기: "{start}에서 {end 또는 '진행 중'}까지" → "2025년 3월 – 2025년 8월"
      - 상태 배지: in-progress → 배경 `rgba(0,113,227,0.10)` 텍스트 `#0066cc` "진행 중" / completed → 배경 `rgba(0,0,0,0.05)` 텍스트 `#515154` "완료" / archived → 배경 `rgba(0,0,0,0.05)` 텍스트 `#6e6e73` "보관"
      - 스택: Badge 칩 나열(스킬 칩과 동일 규격)
      - 링크 행: Repository / Demo가 있으면 compact-outline 버튼
    </project_meta_panel>
    <article_body>
      - 컨테이너에 `data-pagefind-body` 부여. 최대 폭 720px
      - 본문 기본: 17px / 400 / line-height 28px / letter-spacing -0.374px / `#1d1d1f` (다크 `#f5f5f7`). 문단 간 여백 20px
      - h2: 28px / 600 / line-height 32px, 상단 여백 56px, 하단 20px. h3: 20px / 600, 상단 32px
      - h2/h3에 앵커 링크(hover 시 왼쪽에 해시 기호 표시, `#6e6e73`) — 클릭 시 URL 해시 갱신
      - 링크: `#0066cc`, 밑줄 없음, hover 시 1px 밑줄(currentColor). 다크 모드 `#2997ff`. 외부 링크는 자동으로 `rel="noopener noreferrer"` 부여
      - 인용문: 좌측 3px `rgba(0,0,0,0.12)` 경계, 좌측 패딩 20px, 텍스트 `#515154`, 기울임 없음
      - 인라인 코드: 14px monospace, 배경 `rgba(0,0,0,0.05)`, padding 2px 6px, radius 8px
      - 코드 블록: radius 18px, padding 20px, `overflow-x: auto`, Shiki 듀얼 테마 CSS 변수로 다크 전환. 우상단 "복사" 버튼(compact, hover 시 표시, 클릭 후 1.5초간 "복사됨")
      - 표: 가로 스크롤 컨테이너로 감싸 페이지 자체가 가로 스크롤되지 않게 한다. 헤더행 배경 `#f5f5f7`, 셀 padding 12px, line-height 24px, hairline 경계
      - 이미지: 최대 폭 100%, radius 18px, `loading="lazy"`, 캡션은 14px / `#6e6e73` 가운데 정렬
      - 수식: `math: true`인 글에서만 KaTeX CSS 로드. 블록 수식은 가로 스크롤 허용, 폰트 크기 본문과 동일
      - 목록: 좌측 패딩 24px, 항목 간 8px, line-height 26px
    </article_body>
    <table_of_contents>
      - `nav` 요소에 `aria-label="목차"`를 부여한다. 제목 "목차" 12px / 600 / `#6e6e73` / letter-spacing 0.4px
      - 항목: depth 2는 좌측 패딩 0, depth 3은 12px. 14px / 400 / `#6e6e73`, 항목 간 8px, 최대 2줄 클램프
      - 현재 섹션: `IntersectionObserver`로 판정해 active 처리 — 텍스트 `#1d1d1f` + 좌측 2px `#0071e3` 바
      - `position: sticky; top: 88px` (헤더 56px + 여백 32px)
      - 클릭 시 부드러운 스크롤, `prefers-reduced-motion`에서는 즉시 점프
    </table_of_contents>
    <prev_next_nav>
      - 본문 하단 56px 간격, 같은 카테고리 내 date 기준 인접 글
      - 2열 카드(640px 미만 1열): 좌측 "이전 글", 우측 "다음 글" 라벨 12px / `#6e6e73` + 제목 17px / 600 / `#1d1d1f`, 최대 2줄
      - 한쪽이 없으면 해당 칸을 비워두되 레이아웃 열 구조는 유지한다
    </prev_next_nav>
    <page_end>
      - CRITICAL: 글 상세는 `prev_next_nav`에서 끝난다. 댓글 영역·구독 폼·공유 버튼 등 어떤 상호작용 블록도 두지 않는다
      - 마지막 요소 아래 80px 여백 후 푸터
    </page_end>
  </post_detail_page>

  <archive_page>
    - 헤더: "Archive" 40px / 600 + "전체 {n}편" 17px / `#6e6e73`
    - 연도 그룹: 연도 제목 28px / 600, 상단 여백 40px, 하단 hairline
    - 각 항목은 카드가 아니라 한 줄 리스트: 좌측 날짜("8월 20일" 14px / `#6e6e73`, 고정 폭 96px) + 카테고리 배지 + 제목 17px / 400 / `#1d1d1f`, 항목 최소 높이 44px, 항목 간 hairline
    - hover: 제목 색 `#0066cc`, 150ms
    - 최신 연도가 위. 각 연도 내부는 date 내림차순
    - 768px 미만: 날짜가 제목 위 줄로 이동(2줄 구성)
    - 비어 있을 때: empty_state
  </archive_page>

  <tag_index_page>
    - 헤더: "Tags" 40px / 600 + "총 {n}개" 17px / `#6e6e73`
    - 태그 칩 flex-wrap, 간격 8px. 칩은 라벨 + count 배지(라벨 우측 6px, 12px / `#6e6e73`)로 구성
    - 칩 글자 크기는 count에 따라 3단계 — count 1–2: 14px / 3–5: 17px / 6 이상: 20px (높이는 내용에 맞춰 자동, 최소 히트 영역 44px)
    - 각 칩은 `/tags/{slug}`로 이동
    - 태그가 하나도 없으면 "아직 태그가 없습니다" empty_state
  </tag_index_page>

  <tag_detail_page>
    - 헤더: "#{label}" 40px / 600 + "{n}편" 17px / `#6e6e73` + "전체 태그 보기" 링크 → `/tags`
    - 목록: 카테고리 목록과 동일한 카드 그리드. 페이지네이션 없음(태그당 글 수가 적다고 가정하며, 전체 200편 초과 시 재검토)
    - 카드에 카테고리 배지가 있으므로 여러 카테고리가 섞여도 구분된다
  </tag_detail_page>

  <search_page>
    - 헤더: "Search" 40px / 600
    - 입력창: 높이 48px, radius 980px, 배경 `#ffffff` (다크 `#1d1d1f`), `1px solid rgba(0,0,0,0.12)`, 좌측 20px 검색 아이콘, padding-left 48px, 폰트 17px / 400, placeholder `#6e6e73`
    - focus: 테두리 `#0071e3` + `outline: 2px solid rgba(0,113,227,0.35); outline-offset: 2px`
    - 페이지 진입 시 입력창 자동 포커스
    - Pagefind 인덱스는 첫 키 입력 시 동적 import (초기 페이지 로드에 인덱스를 포함하지 않는다)
    - 디바운스 200ms 후 검색 실행. 결과는 최대 20건, "더 보기" 버튼으로 20건씩 추가
    - 결과 항목: 제목 20px / 600, "카테고리 · 날짜" 14px / `#6e6e73`, 본문 발췌(검색어 하이라이트: 배경 `rgba(0,113,227,0.18)`, 텍스트 색 변경 없음), 항목 간 hairline, 최소 높이 44px
    - 결과 개수를 `aria-live="polite"` 영역에 "{n}개의 결과"로 알린다
    - 상태 — 입력 전: "검색어를 입력하세요" / 로딩: 스켈레톤 3줄(높이 20px, 배경 `rgba(0,0,0,0.05)`, 1200ms pulse) / 결과 0건: "검색 결과가 없습니다" + 쿼리 표시 + "전체 아카이브 보기" compact 버튼 / 인덱스 로드 실패: "검색을 불러오지 못했습니다" + `/archive` 링크
    - 검색어를 DOM에 넣을 때 `textContent`를 쓴다. Pagefind가 반환하는 하이라이트 마크업만 예외로 허용한다
    - JS 비활성 환경: "검색에는 JavaScript가 필요합니다. 아카이브에서 찾아보세요" + `/archive` 링크
  </search_page>

  <not_found_page>
    - 가운데 정렬, 상하 패딩 120px
    - "404" 56px / 600 / `#1d1d1f`, "페이지를 찾을 수 없습니다" 28px / 400 / `#515154`
    - "홈으로" primary 버튼(44px) + "검색하기" outline 버튼(44px), 간격 12px
    - GitHub Pages는 존재하지 않는 경로에 대해 `/404.html`을 자동 서빙한다. 별도 리라이트 설정이 필요 없다
  </not_found_page>

  <keyboard_shortcuts_reference>
    - `/` : 검색 페이지로 이동하고 입력창에 포커스 (입력 요소에 포커스가 있을 때는 동작하지 않는다)
    - `Escape` : 모바일 내비 시트 닫기 / 검색 입력 내용 지우기
    - `Tab` / `Shift+Tab` : 표준 포커스 이동. DOM 순서 = 시각적 순서를 보장한다
    - `Enter` : 포커스된 링크·버튼 활성화
    - 첫 Tab에서 "본문으로 건너뛰기" 스킵 링크가 나타나며 `#main`으로 이동
    - CRITICAL: 위 외의 단일 키 단축키를 추가하지 않는다. 스크린리더 사용자의 탐색 키와 충돌한다
  </keyboard_shortcuts_reference>
</pages_and_interfaces>

<core_functionality>
  <content_authoring>
    - `src/content/posts/<category>/<slug>.mdx` 파일 생성만으로 글이 추가된다. 별도 등록 절차 없음
    - 프론트매터는 Zod 스키마로 빌드 타임 검증. 필수 필드 누락, 잘못된 `category`, 형식 오류는 빌드 실패로 이어진다
    - `category`가 `paper-review`인데 `paper` 블록이 없으면(또는 `project`인데 `project` 블록이 없으면) 빌드 실패. 메타 패널이 빈 채로 배포되는 상황을 원천 차단한다
    - `draft: true`는 프로덕션 빌드에서 완전 제외, `astro dev`에서는 노출되며 목록에 "DRAFT" 배지 표시
    - MDX에서 `src/components/`의 컴포넌트를 직접 import 해 사용할 수 있다
    - `_template.paper-review.mdx`, `_template.project.mdx`를 복사해 새 글을 시작한다
  </content_authoring>
  <category_navigation>
    - 상단 바 항목은 `CATEGORIES`를 `order` 오름차순으로 순회해 생성. 하드코딩 금지
    - 현재 경로 기반 active 상태 계산 및 `aria-current="page"` 부여
    - 카테고리별 목록 + 페이지네이션 + 카테고리 설명 헤더
    - 새 카테고리 추가 절차: `categories.ts`에 항목 추가 → `src/content/posts/<id>/` 폴더 생성 → 끝. 어떤 페이지 파일도 수정하지 않는다
  </category_navigation>
  <post_rendering>
    - Markdown/MDX를 빌드 타임에 HTML로 렌더링
    - KaTeX 수식과 Shiki 코드 하이라이팅(듀얼 테마)
    - h2/h3 자동 앵커 및 목차 생성, 스크롤 위치 기반 active 하이라이트
    - 카테고리별 메타 패널 분기(`metaPanel` 값에 따라 paper / project / none)
    - 같은 카테고리 내 이전/다음 글 링크
    - 예상 읽기 시간 계산 및 표시
  </post_rendering>
  <discovery>
    - 태그 집계 및 태그별 목록 (전 카테고리 횡단)
    - 연도별 아카이브
    - Pagefind 정적 전문 검색 (제목 + 본문 + 메타)
    - RSS 피드 (최신 `site.rssItemLimit`건)
  </discovery>
  <theming>
    - 3상태 테마: `system`(기본) / `light` / `dark`. 토글은 이 세 값을 순환한다
    - 초기 적용: `head`의 렌더 차단 인라인 스크립트가 `localStorage.theme`을 읽어 `html` 요소에 `data-theme`을 세팅. CRITICAL: 이 스크립트는 반드시 스타일시트보다 먼저, `body` 렌더 전에 실행되어야 FOUC(밝은 화면 번쩍임)가 없다
    - `system` 상태에서는 `prefers-color-scheme` 변화를 `matchMedia` 리스너로 실시간 반영
    - 선택값은 `localStorage`에 저장되어 재방문 시 유지된다
  </theming>
  <seo_and_feeds>
    - 페이지별 `title`, `description`, canonical URL, OG/Twitter 카드 메타
    - `sitemap-index.xml` 자동 생성 (draft 제외)
    - 글 상세에 `Article` JSON-LD (headline, datePublished, dateModified, author, keywords)
    - 홈에 `Person` JSON-LD (name, affiliation, sameAs = 소셜 링크)
  </seo_and_feeds>
</core_functionality>

<error_handling>
  <build_time>
    - CRITICAL: 콘텐츠 스키마 위반은 경고가 아니라 빌드 실패다. 잘못된 프론트매터가 조용히 배포되면 화면이 깨진 채로 공개된다
    - 에러 메시지는 파일 경로 + 필드명 + 기대값을 포함해야 한다 (Zod 메시지에 한국어 힌트를 직접 작성)
    - 깨진 내부 링크: `scripts/check-links.mjs`가 빌드 후 `dist`의 내부 링크가 실제 파일로 해석되는지 검사하고, 실패 시 워크플로를 중단한다
    - 존재하지 않는 이미지 import: Astro가 빌드 타임에 실패시킨다(런타임 404로 미루지 않는다)
    - `astro check` 타입 오류가 1건 이상이면 빌드 중단
  </build_time>
  <user_facing>
    <not_found>
      - 존재하지 않는 경로 → `/404.html` (위 not_found_page 명세)
      - 존재하지 않는 태그 slug → 404 (`getStaticPaths`가 생성한 태그만 유효)
      - 존재하지 않는 카테고리 → 404
    </not_found>
    <image_failure>
      - 이미지 로드 실패 시 `alt` 텍스트가 보이도록 하고, 컨테이너에 `aspect-ratio`를 고정해 레이아웃이 무너지지 않게 한다
      - 프로필 사진이 없으면 이름 이니셜 원형 플레이스홀더를 렌더링한다
    </image_failure>
    <search_failure>
      - Pagefind 인덱스 로드 실패 → "검색을 불러오지 못했습니다. 새로고침하거나 아카이브를 이용해 주세요" + `/archive` 링크
      - 결과 0건은 에러가 아니라 정상 상태로 처리한다
    </search_failure>
    <script_failure>
      - JS가 실행되지 않아도 모든 콘텐츠를 읽을 수 있어야 한다(정적 HTML). JS 없이 잃는 기능은 검색, 테마 토글, 모바일 시트, 목차 하이라이트, 코드 복사뿐이다
      - 모바일 내비: JS 실패 시 햄버거 버튼을 숨기고 접힘 요소 기반 폴백 내비를 노출한다
      - 테마 토글: JS 실패 시 토글 버튼을 렌더링하지 않고 `prefers-color-scheme`만 따른다
    </script_failure>
    <offline>
      - 오프라인 전용 처리(서비스 워커, 캐시 전략)는 범위 밖이다. 브라우저 기본 오프라인 화면에 맡긴다
    </offline>
  </user_facing>
</error_handling>

<third_party_integrations>
  <integration name="GitHub Pages">
    <purpose>정적 사이트 호스팅 및 HTTPS 제공</purpose>
    <setup>리포지토리 Settings → Pages → Source를 "GitHub Actions"로 설정. CRITICAL: "Deploy from a branch"를 선택하면 Jekyll 파이프라인을 타게 되어 `_astro/` 자산이 누락될 수 있다</setup>
    <constraints>정적 파일만 서빙. 서버 사이드 리다이렉트·커스텀 HTTP 헤더 설정이 불가하므로 CSP 등 보안 정책은 meta 태그로 가능한 범위까지만 적용한다</constraints>
  </integration>
  <integration name="GoatCounter">
    <purpose>쿠키리스·개인정보 비수집 방문 통계 (도입 확정)</purpose>
    <sdk>스크립트 임베드 (gc.zgo.at/count.js), `data-goatcounter` 속성으로 엔드포인트 지정</sdk>
    <configuration>`async` 로드. `PUBLIC_GOATCOUNTER_CODE` 미설정 시 스크립트 태그 자체를 출력하지 않는다</configuration>
    <privacy>쿠키를 설정하지 않고 개인 식별 정보를 수집하지 않으므로 별도 동의 배너를 두지 않는다. 대신 푸터에 통계 수집 사실을 한 줄로 명시한다(site_footer 4행). CRITICAL: 이 고지 문구를 생략하지 않는다 — 배너 없이 통계를 수집하는 근거가 "수집 사실을 명시하고 식별 정보를 받지 않는다"는 점이기 때문이다</privacy>
  </integration>
  <integration name="arXiv / DOI">
    <purpose>논문 메타 패널의 원문 링크</purpose>
    <sdk>없음 — API를 호출하지 않고 `arxivId` / `doi` 값으로 URL을 문자열 조합한다</sdk>
    <note>CRITICAL: 빌드 타임에도 런타임에도 외부 API를 호출하지 않는다. 논문 메타는 전적으로 프론트매터에 수기 입력된 값이다</note>
  </integration>
</third_party_integrations>

<aesthetic_guidelines>
  <design_source>
    CRITICAL: 모든 색상·타이포·컴포넌트 수치의 출처는 리포지토리 루트 `DESIGN.md` (Apple / Human Interface Guidelines 레퍼런스, verification v2, verified 2026-07-11)다.
    아래 값은 두 종류로 나뉘며, 코드 주석과 `global.css`의 토큰 이름에도 이 구분을 유지한다.
    - [verified] — `DESIGN.md`의 `tokens:` 프론트매터에서 직접 가져온 값. 임의로 바꾸지 않는다
    - [local extension] — Apple 캡처에 존재하지 않아 이 웹 프로젝트가 정의한 값(hover/focus/disabled 상태, 레이아웃 스케일, 모션, 다크 모드 중립색). `DESIGN.md`의 "Don't infer hover, disabled, or focus visuals that were not retained by the capture" 지침에 따라 Apple 검증 토큰으로 표기해서는 안 된다
  </design_source>

  <design_fusion>
    콘텐츠가 주인공이고 크롬은 조용히 물러나는 Apple의 접근을 학술 블로그에 적용한다. 넓은 여백, 얕은 색 팔레트, 단 하나의 파란 액션 색으로 위계를 만들고 장식은 최소화한다. 상단 내비게이션만 반투명 기능 레이어로 떠 있고(Liquid Glass 방향성의 웹 확장) 나머지 면은 평평하다. 그림자를 쓰지 않으며 깊이는 배경 대비와 1px 헤어라인으로 표현한다.
  </design_fusion>

  <color_palette>
    <primary_colors>
      - Primary Action `#0071e3` [verified] — 채움 버튼 배경, active 언더라인, 타임라인 마커
      - Brand / Dark Canvas `#000000` [verified] — 다크 모드 캔버스
      - Link `#0066cc` [verified] — 라이트 배경 위 링크 텍스트 및 outline 버튼의 텍스트/테두리. CRITICAL: 채움 배경색으로 쓰지 않는다
      - Link on Dark `#2997ff` [verified] — 다크 배경 위 링크
      - On Primary `#ffffff` [verified] — 파란 채움 버튼 위 텍스트
    </primary_colors>
    <background_colors>
      - Canvas (light) `#f5f5f7` [verified] — 페이지 바닥면, 푸터, 메타 패널
      - Surface (light) `#ffffff` [verified] — 카드, 검색 입력, 모바일 시트
      - Canvas (dark) `#000000` [verified]
      - Surface (dark) `#1d1d1f` [local extension] — Apple foreground 값을 다크 표면으로 전용. 다크에서 카드/패널 배경
      - Surface hover (light) `#fbfbfd` [local extension] / (dark) `#2c2c2e` [local extension]
      - Nav glass (light) `rgba(245, 245, 247, 0.72)` [local extension] / (dark) `rgba(0, 0, 0, 0.72)` [local extension]
      - Chip fill `rgba(0, 0, 0, 0.05)` [local extension] / (dark) `rgba(255, 255, 255, 0.10)` [local extension]
      - Accent tint `rgba(0, 113, 227, 0.10)` [local extension] — 카테고리 배지 배경
      - Interest tint `rgba(0, 113, 227, 0.08)` [local extension] — 관심 분야 칩 배경
      - Disabled fill `rgba(0, 0, 0, 0.04)` [local extension] — 비활성 페이지네이션 버튼
      - Dialog overlay `rgba(0, 0, 0, 0.32)` [local extension]
      - Search highlight `rgba(0, 113, 227, 0.18)` [local extension]
      - Focus ring soft `rgba(0, 113, 227, 0.35)` [local extension] — 검색 입력 포커스
      - Active marker ring `rgba(0, 113, 227, 0.24)` [local extension] — 재학 중 타임라인 마커
    </background_colors>
    <text_colors>
      - Foreground `#1d1d1f` [verified] — 제목·본문 (다크에서는 `#f5f5f7` [local extension])
      - Secondary `#515154` [verified] — 부제, 인용문, 보조 설명
      - Muted `#6e6e73` [verified] — 날짜, 캡션, 비활성 내비, 라벨
      - Muted on dark `#86868b` [local extension] — 다크 모드의 muted 대응값
      - Secondary on dark `#a1a1a6` [local extension]
    </text_colors>
    <status_colors>
      - 프로젝트 진행 중: 텍스트 `#0066cc` / 배경 `rgba(0, 113, 227, 0.10)` [local extension]
      - 프로젝트 완료: 텍스트 `#515154` / 배경 `rgba(0, 0, 0, 0.05)` [local extension]
      - 프로젝트 보관: 텍스트 `#6e6e73` / 배경 `rgba(0, 0, 0, 0.05)` [local extension]
      - CRITICAL: 성공/경고/위험을 표시할 빨강·초록·주황 계열을 도입하지 않는다. 이 사이트에는 폼 제출도 파괴적 동작도 없어 상태 색이 필요 없고, 팔레트에 없는 색을 들이면 위계가 무너진다
    </status_colors>
    <borders>
      - Hairline (light) `rgba(0, 0, 0, 0.08)` [local extension] — 카드 테두리, 구분선
      - Hairline strong (light) `rgba(0, 0, 0, 0.12)` [local extension] — 입력 테두리, 인용문 바, 타임라인 연결선
      - Hairline hover (light) `rgba(0, 0, 0, 0.16)` [local extension] — 카드 hover 테두리
      - Hairline (dark) `rgba(255, 255, 255, 0.12)` [local extension]
      - Outline hover tint `rgba(0, 102, 204, 0.06)` [local extension] — outline 버튼 hover 배경
    </borders>
    <dark_theme>
      - 전환 방식: `html` 요소의 `data-theme="dark"` 속성 + CSS 변수 재정의. 클래스가 아니라 속성을 쓴다(인라인 스크립트에서 단일 속성 세팅이 가장 빠르다)
      - CRITICAL: `#0071e3`는 다크 캔버스(`#000000`) 위 텍스트 색으로 쓸 수 없다 — 대비 4.47:1로 AA(4.5:1) 미달이다. 다크에서 파란색 텍스트/링크는 반드시 `#2997ff`(대비 6.97:1)를 쓰고, `#0071e3`는 흰 텍스트를 얹는 채움 버튼 배경으로만 남긴다
      - 이미지: 다크 모드에서 밝은 스크린샷이 눈부시지 않도록 본문 이미지에 `filter: brightness(0.92)`를 적용한다 [local extension]. 프로필 사진에는 적용하지 않는다
    </dark_theme>
  </color_palette>

  <typography>
    <font_families>
      - Display: `"SF Pro Display", -apple-system, BlinkMacSystemFont, "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", system-ui, sans-serif` — 40px 이상 제목 역할 [verified: SF Pro Display가 Apple의 display 패밀리]
      - Text: `"SF Pro Text", -apple-system, BlinkMacSystemFont, "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", system-ui, sans-serif` — 본문·컨트롤 역할 [verified]
      - Mono: `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace` [local extension — `DESIGN.md`는 SF Mono를 declared-only로 분류하고 승격하지 않았다. 코드 블록에는 모노스페이스가 반드시 필요하므로 로컬 확장으로 명시한다]
      - CRITICAL: SF Pro는 웹 폰트로 재배포할 수 없다(Apple 라이선스). 다운로드하거나 CDN에서 로드하지 말 것 — Apple 기기에서는 시스템 폰트로 자동 적용되고, 그 외 환경은 Pretendard로 폴백된다
      - Pretendard 1.3.9는 npm 패키지에서 자체 호스팅한다. `font-display: swap`, 한글 서브셋 우선 로드, `preload`는 본문용 400 weight 하나만 적용해 초기 요청을 늘리지 않는다
    </font_families>
    <font_sizes>
      - Display Hero 56px / 600 / line-height 60px / letter-spacing -0.28px [verified] — 홈 이름, 404 코드
      - Section 40px / 600 / line-height 44px [verified] — 섹션 제목, 목록 페이지 제목, 글 상세 제목
      - Tile Heading 28px / 400 / line-height 32px / letter-spacing 0.196px [verified] — tagline, 아카이브 연도, 본문 h2(단 h2는 weight 600으로 조정 [local extension] — 본문 위계상 400은 문단과 구분되지 않는다)
      - Body 17px / 400 / line-height 25px / letter-spacing -0.374px [verified] — 본문, 내비 항목, 버튼 라벨. 단 긴 글 가독성을 위해 `article` 내부 문단만 line-height 28px로 확장 [local extension]
      - Body Small 14px / 400 / line-height 18px / letter-spacing -0.224px [verified] — 날짜, 메타, compact 버튼, 카드 요약
      - Caption 12px / 400 / line-height 16px / letter-spacing -0.12px [verified] — 저작권, 라벨, 배지
      - Card Title 20px / 600 / line-height 26px [local extension] — 검증된 스케일에 28px과 17px 사이가 비어 있어 카드/서브헤딩용으로 추가
      - 모바일(768px 미만) 축소 규칙: Display Hero 56px→40px(line-height 44px), Section 40px→28px(32px), Tile Heading 28px→20px(26px). Body 이하는 축소하지 않는다
      - CRITICAL: 위 7개 크기(56/40/28/20/17/14/12px) 밖의 폰트 크기를 도입하지 않는다
    </font_sizes>
    <line_heights>
      - UI 텍스트는 위 토큰의 고정 line-height를 그대로 쓴다
      - 본문 문단만 28px (17px 기준 약 1.65) — 한글 본문은 라틴 문자보다 넉넉한 행간이 필요하다 [local extension]
      - 목록 항목 26px, 표 셀 24px [local extension]
    </line_heights>
  </typography>

  <spacing>
    - 검증된 컴포넌트 로컬 값 [verified]: compact 8px, control-inline 15px, pill-block 11px, pill-inline 21px, content 20px. 버튼 패딩과 카드 내부 패딩에는 이 값을 그대로 쓴다
    - 레이아웃 스케일 [local extension]: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56 / 80 / 120px. `DESIGN.md`가 "샘플링한 모든 마진을 시스템 토큰으로 취급하지 말 것"이라 명시했으므로, 이 스케일은 Apple 토큰이 아니라 본 프로젝트의 확장임을 토큰 이름(`--space-ext-*`)에 드러낸다
    - 섹션 간 수직 여백: 데스크톱 80px, 모바일 56px
    - 컨테이너 좌우 패딩: 모바일 22px, 768px 이상 24px
    - 그리드 gap: 20px (content 토큰과 일치)
  </spacing>

  <borders_and_shadows>
    <borders>
      - 두께: 1px 고정(헤어라인). 2px는 focus ring과 active 언더라인에만, 3px는 인용문 바에만 사용
      - Radius: control 8px [verified] — 인라인 코드, 작은 표면 / docs-card 18px [verified] — 카드, 코드 블록, 이미지, 메타 패널 / marketing-pill 980px [verified] — 모든 버튼과 칩. 프로필 사진만 예외로 `50%`
      - CRITICAL: 8 / 18 / 980 세 값(+ 원형 50%) 외의 radius를 만들지 않는다. 12px, 16px 같은 중간값은 시스템을 흐린다
    </borders>
    <shadows>
      - CRITICAL: 그림자 토큰이 없다. `DESIGN.md`는 캡처된 버튼과 카드 모두 shadow를 보고하지 않았고 canonical shadow 토큰이 존재하지 않는다고 명시했다. `box-shadow`를 깊이 표현에 사용하지 않는다
      - 유일한 예외: focus-visible 링과 검색 입력의 포커스 강조 — 이는 깊이가 아니라 접근성 신호이며 `outline`을 우선 사용한다
      - 떠 있는 표면(상단 내비, 모바일 시트)의 분리감은 반투명 + `backdrop-filter` + 1px 헤어라인으로만 만든다
    </shadows>
  </borders_and_shadows>

  <component_styling>
    <buttons>
      - primary [verified]: 배경 `#0071e3`, 텍스트 `#ffffff`, radius 980px, padding 11px 21px, height 44px, font 17px/400
        - hover [local extension]: 배경 `#0077ed`, 150ms ease
        - active [local extension]: 배경 `#006edb`
        - focus-visible [local extension]: `outline: 2px solid #0071e3; outline-offset: 2px`
      - outline [verified]: 배경 transparent, 텍스트 `#0066cc`, `1px solid #0066cc`, radius 980px, padding 11px 21px, height 44px, font 17px/400
        - hover [local extension]: 배경 `rgba(0, 102, 204, 0.06)`
        - 다크 모드 [local extension]: 텍스트/테두리 `#2997ff`
      - compact [verified]: 배경 `#0071e3`, 텍스트 `#ffffff`, radius 980px, padding 8px 15px, height 36px, font 14px/400
      - compact-outline [local extension]: compact 규격에 outline 배색 — 논문/프로젝트 링크 버튼과 페이지네이션에 사용
      - disabled [local extension]: 배경 `rgba(0, 0, 0, 0.04)`, 텍스트 `#6e6e73`, 커서 default, `aria-disabled="true"`. 포커스 대상에서 제외
      - CRITICAL: 36px과 44px을 하나의 기본값으로 합치지 않는다. 44px은 히어로/주요 CTA, 36px은 카드·메타 패널 내부 보조 액션이다
    </buttons>
    <nav_tabs>
      - font 17px / 400 [verified: product-gallery-tab], 색상 inactive `#6e6e73` / active `#1d1d1f`
      - 높이 44px 히트 영역 [local extension — 검증된 53px은 Apple Store 제품 썸네일 전용 값이라 상단 내비에 그대로 옮기지 않는다]
      - 선택 상태는 색상 + 2px `#0071e3` 언더라인 + `aria-current`로 삼중 표시
    </nav_tabs>
    <cards>
      - 배경 `#ffffff` [verified: hig-reference-card], radius 18px [verified], 그림자 없음 [verified: flat]
      - 테두리 `1px solid rgba(0, 0, 0, 0.08)` [local extension — HIG 문서 카드에는 테두리가 캡처되지 않았으나, `#ffffff` 카드를 `#f5f5f7` 캔버스에 얹으면 경계가 약해 헤어라인을 추가한다]
      - padding 20px [verified: content 토큰]
      - CRITICAL: 이 카드 스타일을 "Apple 네이티브 카드 토큰"이라고 문서화하지 않는다. HIG 문서 사이트의 크롬에서 온 값이다
    </cards>
    <badges>
      - 높이 24px(작은 배지) / 32px(스킬·스택 칩), padding 0 10px / 0 12px, radius 980px, font 12px/400 / 14px/400
      - 카테고리 배지: 배경 `rgba(0,113,227,0.10)`, 텍스트 `#0066cc`
      - 중립 배지: 배경 `rgba(0,0,0,0.05)`, 텍스트 `#515154`
    </badges>
    <inputs>
      - 검색 입력: 높이 48px, radius 980px, 배경 `#ffffff`, `1px solid rgba(0,0,0,0.12)`, padding-left 48px(아이콘 자리), font 17px/400
      - placeholder `#6e6e73` — CRITICAL: placeholder도 4.5:1 대비를 지켜야 하므로 이보다 옅은 색을 쓰지 않는다
      - focus: 테두리 `#0071e3` + `outline: 2px solid rgba(0,113,227,0.35); outline-offset: 2px`
      - 이 사이트의 유일한 입력 요소다. 폼·유효성 검사·에러 메시지 스타일은 존재하지 않는다
    </inputs>
    <dialog>
      - 모바일 내비 시트: 배경 불투명 `#ffffff` / `#000000`, radius 0(전체 폭), 헤더 아래에 붙음
      - 포커스 트랩 필수, Escape로 닫힘, 열릴 때 `body { overflow: hidden }`
      - 배경 오버레이 `rgba(0, 0, 0, 0.32)` [local extension]
    </dialog>
    <tabs>
      - 상단 내비가 유일한 탭 패턴이다. 별도 인페이지 탭 컴포넌트를 도입하지 않는다(`Tabs.astro`는 내비 항목 렌더링에만 쓰인다)
    </tabs>
  </component_styling>

  <animations>
    <note>CRITICAL: `DESIGN.md`는 모션 토큰을 승격하지 않았다("No exact Apple motion token is promoted"). 아래 값은 전부 [local extension]이며 Apple 모션 스펙으로 표기하지 않는다.</note>
    <micro_interactions>
      - 색상/배경/테두리 전환: 150ms `cubic-bezier(0.4, 0, 0.2, 1)`
      - 버튼 press: 배경색만 변경. `transform: scale()`을 쓰지 않는다(pill 형태에서 왜곡이 눈에 띈다)
      - 코드 복사 버튼: opacity 0에서 1로 120ms. "복사됨" 라벨은 1.5초 후 원래 라벨로 복귀
    </micro_interactions>
    <page_transitions>
      - 페이지 전환 애니메이션을 도입하지 않는다. Astro View Transitions를 사용하지 않으며, 즉시 렌더가 학술 콘텐츠 탐색에 더 적합하다
    </page_transitions>
    <loading_states>
      - 검색 결과 스켈레톤: 높이 20px 바 3개, 배경 `rgba(0,0,0,0.05)`, opacity 1에서 0.5를 거쳐 1로 1200ms 무한 반복 ease-in-out
      - 이미지: `aspect-ratio`로 공간을 미리 확보해 CLS를 0으로 유지한다. 스피너를 쓰지 않는다
    </loading_states>
    <scroll>
      - 목차 앵커 클릭: `scroll-behavior: smooth`, `scroll-margin-top: 88px`(sticky 헤더 보정)
      - 목차 active 하이라이트: `IntersectionObserver`(rootMargin `-25% 0px -70% 0px`), 색상 전환 150ms
    </scroll>
    <reduced_motion>
      - CRITICAL: `@media (prefers-reduced-motion: reduce)`에서 모든 `transition-duration`과 `animation-duration`을 `0.01ms`로 낮추고, `scroll-behavior: auto`로 되돌리며, 스켈레톤 펄스를 정지 상태로 고정한다
    </reduced_motion>
  </animations>

  <responsive_design>
    <note>`DESIGN.md`는 범용 브레이크포인트를 승격하지 않았다. 아래는 전부 [local extension]이며, 검증된 컴포넌트 지오메트리(44px/36px 버튼, 18px radius, 폰트 스케일)는 데스크톱 값을 그대로 유지한다.</note>
    <breakpoints>
      - mobile 0–767px — 1열, 상단 내비는 햄버거 시트, 히어로 세로 스택, 목차는 접힘 블록
      - tablet 768–1023px — 카드 2열, 상단 내비 전체 노출, 히어로 2열, 목차는 여전히 접힘 블록
      - desktop 1024–1279px — 카드 3열, 글 상세 2열(본문 720px + 목차 240px)
      - wide 1280px 이상 — 컨테이너 최대 폭 1120px에서 고정, 좌우 자동 여백
    </breakpoints>
    <mobile_adaptations>
      - 상단 내비 항목 → 전체 폭 시트(항목 높이 56px, 폰트 20px)
      - 카드 그리드 3열 → 1열, gap 20px 유지
      - 히어로: 사진(140px) 위, 텍스트 아래, 전체 가운데 정렬
      - CTA 버튼 2개 → 세로 스택 + `width: 100%` (높이 44px 유지)
      - 목차 sticky 컬럼 → 본문 상단 접힘 블록
      - 아카이브 리스트: 날짜 고정 폭 96px → 제목 위 줄로 이동(2줄 구성)
      - 프로젝트 메타 패널 2열 → 1열
      - 표와 코드 블록: 컨테이너 자체에 `overflow-x: auto` — CRITICAL: `body`가 가로 스크롤되면 안 된다
      - 폰트 축소는 위 font_sizes의 모바일 규칙만 적용
    </mobile_adaptations>
    <touch_interactions>
      - 최소 탭 타깃 44x44px (WCAG 2.5.8). 아이콘 버튼과 내비 항목 모두 이 규격을 만족해야 한다
      - hover 전용 정보를 만들지 않는다 — 코드 복사 버튼은 `@media (hover: none)` 환경에서 항상 표시한다
      - 스와이프 제스처를 도입하지 않는다. 뒤로가기는 브라우저 기본 동작에 맡긴다
      - `-webkit-tap-highlight-color: transparent` + 명시적 `:active` 배경 변화로 피드백을 준다
    </touch_interactions>
  </responsive_design>

  <icons>
    - 라이브러리: lucide (`@iconify-json/lucide` 1.2.124) via `astro-icon` 1.2.0 — 빌드 타임 인라인 SVG
    - 크기: 내비/푸터 20px, 소셜 24px, 카테고리 헤더 28px, 빈 상태 48px
    - stroke-width 1.5, `currentColor` 상속 — 아이콘에 색을 직접 지정하지 않는다
    - CRITICAL: 아이콘 전용 버튼에는 `aria-label`이 필수이며, 장식용 아이콘에는 `aria-hidden="true"`를 붙인다
    - 아이콘 폰트나 런타임 아이콘 페치를 쓰지 않는다
  </icons>

  <accessibility>
    <target>WCAG 2.1 AA</target>
    <contrast>
      아래 대비값은 이 스펙 작성 시 팔레트 조합으로 직접 계산한 결과다.
      - `#1d1d1f` on `#ffffff` — 15.9:1 통과 / on `#f5f5f7` — 14.6:1 통과
      - `#515154` on `#ffffff` — 7.9:1 통과
      - `#6e6e73` on `#ffffff` — 5.1:1 통과 / on `#f5f5f7` — 4.7:1 통과 (본문 최소 기준을 겨우 넘으므로 이보다 옅은 회색을 추가하지 않는다)
      - `#0066cc` on `#ffffff` — 5.6:1 통과
      - `#ffffff` on `#0071e3` — 4.7:1 통과 (버튼 텍스트 17px, 일반 텍스트 기준 통과)
      - `#2997ff` on `#000000` — 7.0:1 통과
      - `#86868b` on `#000000` — 5.8:1 통과
      - 실패: `#0071e3` on `#000000` — 4.47:1 (AA 미달). CRITICAL: 다크 배경 위 파란 텍스트에는 반드시 `#2997ff`를 쓴다
      - 색상만으로 정보를 전달하지 않는다: 카테고리는 배지 텍스트, 내비 선택은 언더라인, 프로젝트 상태는 라벨 텍스트를 함께 제공한다
    </contrast>
    <keyboard>
      - 모든 링크·버튼·입력이 Tab으로 도달 가능하며, DOM 순서 = 시각적 순서를 보장한다
      - focus-visible 링: `2px solid #0071e3`, `outline-offset: 2px`. CRITICAL: `outline: none`을 대체 표시 없이 사용하지 않는다
      - 다크 모드 focus 링은 `#2997ff`
      - 모바일 내비 시트: 포커스 트랩, Escape 닫기, 닫힌 후 트리거 버튼으로 포커스 복귀
      - 스킵 링크가 첫 번째 포커스 대상이다
    </keyboard>
    <screen_readers>
      - `html` 요소에 `lang="ko"`. 영문 인용 블록에는 `lang="en"`을 부여한다
      - 랜드마크: `header`, `nav`(`aria-label="주요"`), `main`(`id="main"`), `footer`
      - 아이콘 전용 버튼(검색, 테마 토글, 햄버거, 코드 복사)에 `aria-label` 필수
      - 테마 토글은 `aria-pressed`가 아니라 현재 상태를 `aria-label`("테마: 시스템 / 라이트 / 다크")로 알린다(3상태이므로 boolean이 부적절)
      - 검색 결과 개수는 `aria-live="polite"`로 안내
      - 목차는 `aria-label="목차"`를 가진 `nav`로 감싼다
      - 커버·프로필 이미지에 의미 있는 `alt`. 순수 장식 이미지는 `alt=""`
      - 헤딩 위계를 건너뛰지 않는다: 페이지당 h1은 1개(글 제목 또는 페이지 제목), 본문은 h2부터 시작
    </screen_readers>
    <motion>
      - `prefers-reduced-motion: reduce` 존중 (위 reduced_motion 참조)
      - 자동 재생·무한 루프 애니메이션은 검색 스켈레톤이 유일하며, reduced-motion에서 정지한다
    </motion>
  </accessibility>
</aesthetic_guidelines>

<security_considerations>
  <content_and_input>
    - 방문자 입력 경로가 사실상 없다. 방문자가 제출하는 데이터는 검색어(클라이언트 로컬 처리)뿐이며 서버로 전송되지 않는다
    - CRITICAL: MDX는 임의 코드 실행이 가능하다. 리포지토리 write 권한자만 콘텐츠를 작성하므로 신뢰 경계는 리포지토리 권한과 동일하다. 외부 기여 PR을 병합할 때는 MDX 내 스크립트와 import를 반드시 사람이 검토한다
    - 마크다운의 raw HTML 처리는 Astro 기본 동작을 유지하고 `allowDangerousHtml`을 명시적으로 켜지 않는다. 외부에서 받은 콘텐츠를 그대로 붙여넣지 않는다
    - 검색어를 DOM에 삽입할 때 `innerHTML`이 아니라 `textContent`를 쓴다. Pagefind가 생성한 하이라이트 마크업만 예외로 허용한다
  </content_and_input>
  <secrets>
    - CRITICAL: 정적 빌드이므로 모든 환경변수가 산출물에 평문으로 남는다. 비밀 값을 `.env`에 두거나 GitHub Actions secrets로 주입해 빌드에 넣지 않는다
    - `.env`, `.env.local`을 `.gitignore`에 포함한다
    - 개인 이메일 공개 여부는 사용자 선택이다(Q2 미해결). 공개하지 않으려면 `profile.email`을 비워 아이콘 자체를 없앤다
  </secrets>
  <third_party_scripts>
    - CRITICAL: 외부 스크립트는 GoatCounter 하나뿐이다. 새 서드파티 스크립트를 추가하려면 이 목록과 CSP를 함께 갱신해야 한다
    - 모든 외부 링크에 `rel="noopener noreferrer"` — `target="_blank"` 사용 시 필수
    - 폰트·CSS·JS를 CDN에서 로드하지 않고 전부 자체 호스팅한다(KaTeX CSS 및 폰트, Pretendard 포함). 서드파티 CDN 장애가 사이트 렌더를 막지 않게 한다
    - `meta name="referrer" content="strict-origin-when-cross-origin"`
  </third_party_scripts>
  <headers>
    - GitHub Pages는 커스텀 HTTP 헤더를 지원하지 않는다. 따라서 CSP·HSTS를 서버 헤더로 설정할 수 없다
    - 가능한 범위: `meta http-equiv="Content-Security-Policy"`로 `default-src 'self'; img-src 'self' data:; script-src 'self' https://gc.zgo.at 'unsafe-inline'; frame-src 'none'; style-src 'self' 'unsafe-inline'`를 선언한다
    - `'unsafe-inline'`이 필요한 이유: 테마 초기화 인라인 스크립트와 Shiki 인라인 스타일. nonce는 정적 호스팅에서 요청별 생성이 불가하므로 쓸 수 없다. 이 사이트에 사용자 입력 저장 경로가 없어 XSS 표면이 사실상 없다는 점을 근거로 수용한다
    - HTTPS는 GitHub Pages가 제공한다. 리포지토리 설정에서 "Enforce HTTPS"를 반드시 켠다
  </headers>
  <repository>
    - 프로필 사진·CV에 주민등록번호·주소·전화번호 등 민감정보가 포함되지 않았는지 커밋 전에 확인한다. CRITICAL: Git 이력은 되돌리기 어렵다 — 한 번 커밋된 파일은 이후 삭제해도 이력에 남는다
    - 논문 PDF 원문을 리포지토리에 커밋하지 않는다(저작권 — 확정 정책). `paper.pdfUrl`에 외부 링크만 저장한다
    - GitHub Actions의 `permissions`를 최소 권한으로 명시한다(`contents: read`, `pages: write`, `id-token: write`)
  </repository>
</security_considerations>

<advanced_functionality>
  <draft_workflow>
    - `draft: true` 글은 `astro dev`에서만 보이고 목록 카드에 "DRAFT" 중립 배지가 붙는다
    - 프로덕션 빌드에서는 목록·RSS·sitemap·검색 인덱스·정적 경로 생성에서 전부 제외된다. CRITICAL: URL을 직접 알아도 접근할 수 없어야 한다(경로 자체가 생성되지 않음)
  </draft_workflow>
  <reading_aids>
    - 예상 읽기 시간: 본문 글자 수 기반(한글 500자/분, 영문 200단어/분 혼합 계산)으로 상세 헤더에 "약 N분" 표기
    - 코드 블록 복사 버튼
    - h2/h3 앵커 링크로 특정 섹션 직접 공유
    - 목차 스크롤 추적
  </reading_aids>
  <profile_authoring_contract>
    프로필 실제 값은 사용자가 직접 채운다(Q2 확정). 빌더의 책임은 "채우기 쉬운 빈 양식"을 만드는 것까지다.
    <builder_rules>
      - CRITICAL: 그럴듯한 가짜 값을 지어내지 않는다. 실존할 법한 이름·학교·지도교수명을 넣으면 사용자가 무엇을 바꿔야 할지 구분할 수 없고, 지우지 못한 값이 그대로 배포된다
      - 플레이스홀더는 꺾쇠로 감싸 한눈에 구분되게 쓴다: `'<이름>'`, `'<한 줄 소개>'`, `'<학교명>'`. 배열형은 예시 1개만 같은 형식으로 넣는다
      - `src/config/profile.ts`의 모든 필드 위에 한 줄 주석으로 (1) 무엇을 쓰는 곳인지, (2) 생략 가능 여부, (3) 생략 시 화면에서 어떻게 되는지를 적는다
      - 타입은 완전하게 정의한다. 사용자가 값만 바꾸면 되고 타입을 건드릴 일이 없어야 하며, 오타는 `astro check`가 잡아준다
      - CRITICAL: 플레이스홀더 상태로도 빌드가 성공해야 한다. 프로필 미기입을 빌드 실패로 만들지 않는다 — 사용자가 사이트를 먼저 띄워보고 나중에 채우는 순서를 막게 된다
    </builder_rules>
    <placeholder_warning>
      - 빌드 시 `profile.ts`에 `<`로 시작하는 플레이스홀더 값이 남아 있으면 콘솔에 경고 1줄을 출력한다: "profile.ts에 미기입 항목 N개가 남아 있습니다 (필드명 나열)"
      - CRITICAL: 경고이지 에러가 아니다. 종료 코드에 영향을 주지 않으며 배포를 막지 않는다
    </placeholder_warning>
    <graceful_omission>
      각 항목을 비웠을 때의 화면 동작. CRITICAL: 빈 값이 빈 상자나 깨진 레이아웃으로 보이면 안 되고, 해당 요소가 통째로 사라져야 한다.
      - `email` 없음 → 소셜 아이콘 행에서 이메일 아이콘만 제거
      - `links` 비었음 → 소셜 아이콘 행 전체 미출력. 히어로의 "GitHub" outline 버튼도 함께 미출력(1차 CTA만 남음)
      - `cvUrl` 없음 → CV 링크 미출력, `public/cv.pdf` 파일도 두지 않는다
      - `education` 비었음 → 학적 섹션 전체 미출력 + 히어로의 소속 한 줄도 미출력(`education[0]`에서 파생되므로)
      - `skillGroups` 비었음 → 스킬 섹션 전체 미출력
      - `interests` 비었음 → 관심 분야 섹션 전체 미출력
      - `photo` 미교체 → 이니셜 원형 플레이스홀더로 대체(위 profile_hero 명세)
      - `nameEn`, `location`, `lab`, `advisor`, `note`, `teamSize` 없음 → 해당 줄만 생략, 주변 여백은 유지하지 않고 자연스럽게 붙는다
    </graceful_omission>
    <fill_in_procedure>
      README에 아래 절차를 그대로 적는다. 사용자가 코드를 읽지 않고도 수행할 수 있어야 한다.
      1. `src/config/profile.ts`를 열고 꺾쇠(`<...>`)로 감싼 값을 실제 정보로 바꾼다. 공개하고 싶지 않은 항목은 값을 지우거나 줄 전체를 삭제한다
      2. 프로필 사진을 `src/assets/profile.jpg`에 같은 파일명으로 덮어쓴다 (정사각형 640x640 이상 권장, 원형으로 잘림)
      3. `photoAlt`를 사진 설명으로 바꾼다 (스크린리더가 읽는 문구)
      4. CV를 게시한다면 `public/cv.pdf`에 파일을 넣고 `cvUrl: '/cv.pdf'`를 남긴다. 게시하지 않으면 `cvUrl` 줄과 파일을 함께 지운다
      5. `npm run dev`로 홈 화면을 확인한다
      6. 커밋 후 push하면 자동 배포된다
      - CRITICAL: 사진을 커밋하기 전에 배경에 개인정보(주소, 사원증, 문서)가 찍히지 않았는지 확인한다. Git 이력에서 지우기 어렵다
    </fill_in_procedure>
  </profile_authoring_contract>
  <content_ergonomics>
    - `src/content/posts/_template.paper-review.mdx`, `_template.project.mdx` 템플릿을 두어 새 글 작성 시 복사해 쓴다. CRITICAL: 밑줄로 시작하는 파일은 컬렉션 glob 패턴에서 제외되어야 한다(`!**/_*`)
    - README에 "새 글 쓰는 법" 절차를 명시한다
  </content_ergonomics>
  <performance>
    - 기본 클라이언트 JS 0바이트. 페이지별로 필요한 스크립트만 추가한다
    - 검색 인덱스는 `/search` 방문 + 첫 입력 시점에만 로드
    - KaTeX CSS는 `math: true` 글에서만 로드
    - 이미지는 빌드 타임에 AVIF/WebP 변환 + `srcset` 생성, 명시적 width/height로 CLS 0 유지
  </performance>
</advanced_functionality>

<final_integration_test>
  <test_scenario_1>
    <description>첫 방문자가 홈에서 프로필을 확인하고 논문 리뷰로 진입</description>
    <steps>
      1. 브라우저에서 사이트 루트(`/`)를 연다
      2. 상단 바가 화면 최상단에 56px 높이로 고정되어 있고 배경이 반투명한지 확인
      3. 프로필 사진이 200px 원형으로 표시되고 이름이 56px 크기로 렌더링되는지 확인
      4. 학적 섹션에 `education` 배열이 최신순으로 표시되고, 재학 중 항목의 종료일이 "현재"로 표시되는지 확인
      5. 스킬 칩에 마우스를 올려 hover 효과나 포인터 커서가 없는지(링크가 아님) 확인
      6. "Paper Review 보기" 버튼(높이 44px, 배경 `#0071e3`)을 클릭
      7. `/paper-review`로 이동하고 상단 바의 "Paper Review" 항목에 `#0071e3` 언더라인과 `aria-current="page"`가 생기는지 확인
      8. 목록에서 첫 번째 카드를 클릭해 글 상세로 진입
      9. 카드 제목과 상세 페이지 제목이 일치하는지 확인
      10. 본문 위에 "원 논문" 메타 패널이 있고 `paperTitle`·저자·"{venue} {year}"가 표시되는지 확인
      11. arXiv 버튼이 새 탭으로 열리며 `rel="noopener noreferrer"`가 붙어 있는지 확인
      12. 브라우저 뒤로가기로 목록에 돌아오는지 확인
    </steps>
  </test_scenario_1>
  <test_scenario_2>
    <description>새 카테고리를 코드 수정 없이 추가</description>
    <steps>
      1. `src/config/categories.ts`에 `{ id: 'seminar', label: 'Seminar', labelKo: '세미나', description: '...', icon: 'presentation', order: 4, metaPanel: 'none' }` 항목을 추가
      2. `src/content/posts/seminar/` 폴더를 만들고 `category: seminar`인 글 1편을 작성
      3. `npm run dev` 실행
      4. 상단 바에 "Seminar" 항목이 Notes 뒤에 나타나는지 확인
      5. `/seminar`로 이동해 목록 헤더에 label·labelKo·description이 표시되는지 확인
      6. 새 글 카드가 목록에 보이는지 확인
      7. 글 상세로 진입해 메타 패널이 렌더링되지 않는지(`metaPanel: 'none'`) 확인
      8. `/archive`와 `/rss.xml`에도 새 글이 포함되는지 확인
      9. CRITICAL 검증: `src/pages/` 아래 어떤 파일도 수정하지 않았음을 `git status`로 확인
      10. `npm run build`가 성공하고 `dist/seminar/index.html`이 생성되는지 확인
    </steps>
  </test_scenario_2>
  <test_scenario_3>
    <description>잘못된 프론트매터가 빌드를 실패시키는지 검증</description>
    <steps>
      1. `category: paper-review`인 글에서 `paper` 블록 전체를 삭제
      2. `npm run build` 실행
      3. 빌드가 0이 아닌 종료 코드로 실패하는지 확인
      4. 에러 메시지에 해당 파일 경로와 "paper" 필드명이 포함되는지 확인
      5. `paper` 블록을 복원하고 이번에는 `category: unknown-category`로 변경
      6. 다시 빌드해 enum 위반으로 실패하는지 확인
      7. `category`를 복원하고 `title`을 삭제한 뒤 빌드해 required 위반으로 실패하는지 확인
      8. `title`을 복원한 뒤 `slug`를 `my/nested/post`처럼 슬래시를 포함한 값으로 변경해 빌드
      9. slug 패턴 위반으로 실패하는지 확인 (단일 세그먼트 강제)
      10. `cover`만 지정하고 `coverAlt`를 비운 채 빌드해 실패하는지 확인
      11. 모든 필드를 정상 복원하고 빌드가 성공하는지 확인
    </steps>
  </test_scenario_3>
  <test_scenario_4>
    <description>다크 모드 전환과 FOUC 부재 검증</description>
    <steps>
      1. OS 테마를 다크로 설정하고 사이트를 새로 연다
      2. 페이지 로드 순간 밝은 화면이 번쩍이지 않는지 확인 (인라인 테마 스크립트 동작)
      3. 캔버스 배경이 `#000000`, 본문 텍스트가 `#f5f5f7`인지 확인
      4. 본문 링크 색이 `#2997ff`이고 `#0071e3`이 아닌지 확인
      5. primary 버튼은 여전히 `#0071e3` 배경 + 흰 텍스트인지 확인
      6. 테마 토글을 클릭해 light로 전환하고 배경이 `#f5f5f7`로 바뀌는지 확인
      7. 페이지를 새로고침해 light 선택이 유지되는지 확인 (`localStorage`)
      8. 토글을 한 번 더 눌러 system으로 돌아오고 OS 설정을 따르는지 확인
      9. 토글의 `aria-label`이 현재 상태를 반영해 바뀌는지 DevTools 접근성 트리로 확인
      10. 코드 블록이 다크 테마(`github-dark`)로 전환되는지 확인
      11. 본문 이미지에 `filter: brightness(0.92)`가 적용되고 프로필 사진에는 적용되지 않는지 확인
    </steps>
  </test_scenario_4>
  <test_scenario_5>
    <description>모바일 내비게이션과 반응형 레이아웃</description>
    <steps>
      1. 뷰포트를 375x812로 설정하고 홈을 연다
      2. 상단 바에 브랜드·검색·햄버거만 보이고 카테고리 항목은 숨겨졌는지 확인
      3. 히어로가 세로 스택이고 사진이 140px인지 확인
      4. CTA 버튼 2개가 세로로 쌓이고 각각 전체 폭·높이 44px인지 확인
      5. 햄버거를 탭해 시트가 아래로 펼쳐지는지 확인
      6. `body` 스크롤이 잠기는지 확인
      7. Tab 키로 포커스가 시트 밖으로 나가지 않는지 확인 (포커스 트랩)
      8. Escape를 눌러 닫히고 포커스가 햄버거 버튼으로 돌아오는지 확인
      9. 카드 그리드가 1열인지 확인
      10. 긴 표와 코드 블록이 포함된 글 상세를 열어 해당 요소만 가로 스크롤되고 `body`는 가로 스크롤되지 않는지 확인
      11. 목차가 sticky 컬럼이 아니라 본문 상단 접힘 블록인지 확인
      12. 모든 내비 항목과 아이콘 버튼의 히트 영역이 최소 44x44px인지 확인
    </steps>
  </test_scenario_5>
  <test_scenario_6>
    <description>검색 동작과 빈 결과 처리</description>
    <steps>
      1. `npm run build && npm run preview`로 프로덕션 빌드를 서빙 (개발 모드에는 Pagefind 인덱스가 없다)
      2. 상단 바의 검색 아이콘을 클릭해 `/search`로 이동
      3. 입력창에 자동 포커스가 걸리는지 확인
      4. DevTools Network 탭을 열고, 첫 키 입력 전에는 pagefind 요청이 없는지 확인
      5. 본문에만 등장하는 단어를 입력하고 200ms 후 결과가 나타나는지 확인
      6. 결과에 제목·카테고리·날짜·발췌가 표시되고 검색어가 하이라이트되는지 확인
      7. 결과 개수가 `aria-live` 영역에 안내되는지 확인
      8. 결과 항목을 클릭해 해당 글 상세로 이동하는지 확인
      9. 검색으로 돌아와 존재하지 않는 문자열("zzzqqq")을 입력
      10. "검색 결과가 없습니다" 안내와 `/archive` 버튼이 나오는지 확인
      11. `draft: true` 글의 제목을 검색해 결과에 나오지 않는지 확인
      12. 헤더·푸터에만 있는 문자열("Built with Astro")을 검색해 결과에 나오지 않는지 확인 (`data-pagefind-body` 범위 검증)
    </steps>
  </test_scenario_6>
  <test_scenario_7>
    <description>수식·코드·목차가 포함된 긴 논문 리뷰 렌더링</description>
    <steps>
      1. `math: true`, h2 4개 + h3 6개, 블록 수식과 파이썬 코드 블록을 포함한 글을 작성
      2. 데스크톱(1440px)에서 글 상세를 연다
      3. 본문이 720px, 목차가 240px 컬럼으로 우측에 sticky 표시되는지 확인
      4. 블록 수식이 KaTeX로 렌더링되고 원본 LaTeX 문자열이 노출되지 않는지 확인
      5. 페이지 소스에서 KaTeX CSS가 로드되었는지 확인
      6. `math` 필드가 없는 다른 글을 열어 KaTeX CSS가 로드되지 않는지 확인
      7. 코드 블록에 문법 하이라이팅이 적용되고 우상단 복사 버튼이 hover 시 나타나는지 확인
      8. 복사 버튼을 눌러 라벨이 "복사됨"으로 바뀌고 1.5초 뒤 복귀하는지 확인
      9. 스크롤을 내리며 목차의 active 항목이 현재 섹션을 따라 이동하는지 확인
      10. 목차 항목을 클릭해 해당 섹션으로 이동하고, 제목이 sticky 헤더에 가리지 않는지 확인 (`scroll-margin-top: 88px`)
      11. h2 제목에 hover 해 앵커 기호가 나타나고 클릭 시 URL 해시가 갱신되는지 확인
      12. 상세 헤더의 "약 N분" 읽기 시간이 본문 분량에 비례해 표시되는지 확인 (짧은 글과 비교)
      13. OS의 "동작 줄이기"를 켜고 목차 클릭 시 부드러운 스크롤 대신 즉시 점프하는지 확인
    </steps>
  </test_scenario_7>
  <test_scenario_8>
    <description>페이지네이션·태그·아카이브 탐색</description>
    <steps>
      1. 한 카테고리에 15편(기본 페이지 크기 12 초과)의 글을 준비하고 빌드
      2. `/paper-review`에서 카드 12개가 보이는지 확인
      3. 하단 페이지네이션에 "1 / 2"와 "다음" 버튼이 보이고 "이전"은 비활성인지 확인
      4. 비활성 "이전"에 `aria-disabled="true"`가 있고 Tab으로 포커스되지 않는지 확인
      5. "다음"을 클릭해 `/paper-review/page/2`로 이동하고 나머지 3편이 보이는지 확인
      6. "이전"으로 돌아왔을 때 URL이 `/paper-review/page/1`이 아니라 `/paper-review`인지 확인
      7. 글 상세로 들어가 태그 칩을 클릭해 `/tags/{slug}`로 이동
      8. 해당 태그가 붙은 글이 카테고리를 가로질러 모두 표시되는지 확인
      9. `/tags`로 이동해 태그가 count 내림차순으로 정렬되고 사용 횟수에 따라 글자 크기가 3단계로 나뉘는지 확인
      10. `/archive`로 이동해 연도가 최신순으로 그룹되고 각 그룹 내부가 날짜 내림차순인지 확인
      11. 존재하지 않는 태그 URL(`/tags/nonexistent`)로 직접 이동해 404 페이지가 뜨는지 확인
      12. 404 페이지의 "홈으로" 버튼이 동작하는지 확인
    </steps>
  </test_scenario_8>
  <test_scenario_9>
    <description>GitHub Pages 배포 파이프라인 end-to-end</description>
    <steps>
      1. 리포지토리 Settings → Pages에서 Source가 "GitHub Actions"인지 확인
      2. `main` 브랜치에 새 글 커밋을 push
      3. Actions 탭에서 워크플로가 자동 트리거되는지 확인
      4. build 잡에서 `astro check`가 통과하고 `astro build`가 성공하는지 로그로 확인
      5. Pagefind 인덱스 생성 로그와 링크 검사 통과 로그가 나타나는지 확인
      6. deploy 잡이 `github-pages` 환경으로 배포되고 URL을 출력하는지 확인
      7. 배포된 사이트에서 새 글이 보이는지 확인
      8. `/rss.xml`과 `/sitemap-index.xml`이 200으로 응답하고 새 글을 포함하는지 확인
      9. 홈 소스에 `Person` JSON-LD가, 글 상세 소스에 `Article` JSON-LD(headline / datePublished / author)가 들어 있는지 확인하고 canonical URL이 배포 도메인과 일치하는지 확인
      10. `_astro/` 경로의 CSS/JS 자산이 404가 아닌지 확인 (`.nojekyll` 검증)
      11. 존재하지 않는 경로로 접근해 커스텀 404 페이지가 서빙되는지 확인
      12. 의도적으로 타입 오류를 만든 커밋을 push해 워크플로가 실패하고 배포가 일어나지 않는지 확인
      13. 해당 커밋을 `git revert`해 이전 상태로 복구되는지 확인 (롤백 절차 검증)
    </steps>
  </test_scenario_9>
  <test_scenario_10>
    <description>접근성 및 성능 기준 검증</description>
    <steps>
      1. 홈에서 Tab 키를 한 번 눌러 "본문으로 건너뛰기" 스킵 링크가 나타나는지 확인
      2. Enter를 눌러 포커스가 `#main`으로 이동하는지 확인
      3. 계속 Tab 하며 모든 인터랙티브 요소에 `#0071e3` 2px 포커스 링이 보이는지, 순서가 시각적 순서와 일치하는지 확인
      4. 아이콘 전용 버튼 각각에 `aria-label`이 있는지 DevTools 접근성 트리로 확인
      5. axe DevTools 또는 Lighthouse 접근성 감사를 실행해 위반 0건인지 확인
      6. 페이지당 h1이 정확히 1개이고 헤딩 위계가 건너뛰지 않는지 확인
      7. Lighthouse(모바일, 프로덕션 빌드)에서 Performance 95 이상, Accessibility 100, Best Practices 95 이상, SEO 100인지 확인
      8. CLS가 0.01 미만인지 확인 (이미지 aspect-ratio 검증)
      9. 홈의 초기 JS 전송량이 5KB(gzip) 미만인지 Network 탭으로 확인
      10. 이미지가 AVIF 또는 WebP로 서빙되고 `srcset`이 있는지 확인
      11. 다크 모드에서 Lighthouse 접근성 감사를 다시 실행해 대비 위반이 없는지 확인
      12. JavaScript를 비활성화하고 홈·목록·상세를 모두 읽을 수 있는지, 모바일에서 폴백 내비가 동작하는지 확인
    </steps>
  </test_scenario_10>
</final_integration_test>

<success_criteria>
  <functionality>
    - 상단 바에서 Home / Paper Review / Project / Notes / Archive 전 카테고리로 이동 가능하며 현재 위치가 언더라인 + `aria-current`로 표시된다
    - 홈에 프로필 사진·이름·학적·스킬·관심 분야·소셜 링크·최근 글 6개가 모두 렌더링된다
    - `profile.ts`가 플레이스홀더 상태여도 빌드가 성공하고 홈이 깨지지 않으며, 미기입 항목 경고가 콘솔에 1줄 출력된다
    - `profile.ts`의 선택 항목을 각각 비웠을 때 해당 요소만 사라지고 빈 상자나 어긋난 레이아웃이 남지 않는다
    - `categories.ts`에 항목 하나를 추가하는 것만으로 새 카테고리의 내비·목록·페이지네이션·상세가 동작한다 (`src/pages/` 무수정)
    - 프론트매터 스키마 위반 시 빌드가 실패한다 (경고 후 통과가 아니다)
    - `paper-review` 글은 논문 메타 패널을, `project` 글은 프로젝트 메타 패널을 표시한다
    - KaTeX 수식과 Shiki 코드 하이라이팅이 렌더링되고, KaTeX CSS는 `math: true` 글에만 로드된다
    - 검색이 제목·본문을 대상으로 동작하고 draft 글과 헤더/푸터 텍스트는 결과에 나오지 않는다
    - `draft: true` 글은 프로덕션 산출물에 경로 자체가 존재하지 않는다
    - RSS(최신 50건)와 sitemap이 생성되고 draft를 제외한다
    - 라이트/다크/시스템 3상태 테마가 동작하고 선택이 재방문 시 유지되며 FOUC가 없다
  </functionality>
  <user_experience>
    - Lighthouse(모바일, 프로덕션 빌드) Performance 95 이상, Accessibility 100, Best Practices 95 이상, SEO 100
    - LCP 1.5초 미만, CLS 0.01 미만, INP 200ms 미만 (홈 및 글 상세, 시뮬레이션 4G 기준)
    - 홈 초기 JS 전송량 5KB 미만(gzip). 글 상세 8KB 미만
    - JavaScript를 끈 상태에서도 전 페이지의 콘텐츠를 읽고 링크로 탐색할 수 있다
    - 375px 폭에서 어떤 페이지도 `body` 가로 스크롤이 발생하지 않는다
    - 모든 인터랙티브 요소의 히트 영역이 최소 44x44px이다
  </user_experience>
  <technical_quality>
    - `astro check` 타입 오류 0건, 경고 0건
    - `src/pages/` 아래 카테고리 id가 하드코딩된 문자열 리터럴이 0건 (전부 `categories.ts`에서 파생)
    - 색상 리터럴이 컴포넌트에 직접 등장하지 않고 전부 `global.css`의 CSS 변수를 경유한다
    - `global.css`의 모든 토큰에 `[verified]` 또는 `[local extension]` 출처 주석이 달려 있다
    - 빌드 시간 60초 미만 (글 50편 기준, CI 환경)
    - `dist` 총 용량 15MB 미만 (글 50편, 이미지 포함 기준)
    - 깨진 내부 링크 0건 (`scripts/check-links.mjs` 통과)
  </technical_quality>
  <visual_design>
    - 사용된 모든 색이 aesthetic_guidelines의 팔레트에 존재한다 (팔레트 외 색 0건)
    - radius가 8px / 18px / 980px (+ 프로필 사진의 50%) 값으로만 구성된다
    - `box-shadow`가 깊이 표현 용도로 사용된 곳이 0건 (focus 신호 제외)
    - 버튼 높이가 44px 또는 36px 두 값으로만 존재한다
    - 폰트 크기가 정의된 스케일(56/40/28/20/17/14/12px) 밖의 값을 쓰지 않는다
    - 라이트·다크 양쪽에서 본문 대비 4.5:1, 대형 텍스트 3:1을 모두 만족한다
  </visual_design>
  <build>
    - `main` push 시 GitHub Actions가 자동 빌드·배포하고, 실패 시 배포하지 않는다
    - 배포된 사이트에서 `_astro/` 자산이 정상 로드된다
    - 존재하지 않는 경로가 커스텀 404를 서빙한다
    - Node 22.12.0 환경에서 클린 클론 → `npm ci` → `npm run build`가 성공한다
  </build>
</success_criteria>

<build_output>
  <build_command>npm run build (= `astro check && astro build`, 이후 astro-pagefind 통합이 인덱스 생성)</build_command>
  <output_directory>dist/</output_directory>
  <contents>
    - `index.html`, `404.html`, `archive/index.html`, `search/index.html`, `tags/index.html`
    - 카테고리별 `{category}/index.html`, `{category}/page/{n}/index.html`, `{category}/{slug}/index.html`
    - 태그별 `tags/{tag}/index.html`
    - `_astro/` — 해시가 붙은 CSS/JS/폰트 번들
    - 최적화된 이미지 (AVIF/WebP + 원본 포맷 폴백, 다중 해상도)
    - `pagefind/` — 검색 인덱스 및 런타임
    - `rss.xml`, `sitemap-index.xml`, `sitemap-0.xml`
    - `.nojekyll`, `favicon.svg`, `og-default.png`
  </contents>
  <deployment_note>산출물은 순수 정적 파일이다. Node 런타임이나 서버 설정 없이 어떤 정적 호스트에도 그대로 업로드할 수 있어야 하며, GitHub Pages 외의 호스트로 옮길 때 바꿀 값은 `astro.config.mjs`의 `site`/`base`뿐이어야 한다.</deployment_note>
</build_output>

<deployment_and_operations>
  <environments>
    - local: `npm run dev` (http://localhost:4321). draft 글이 보이며 Pagefind 인덱스는 없다
    - local production preview: `npm run build && npm run preview` — 검색과 draft 제외 동작을 검증할 수 있는 유일한 환경. CRITICAL: 검색 관련 변경은 반드시 이 환경에서 확인한다
    - production: GitHub Pages. `main` 브랜치 push 시 자동 배포
    - staging 환경은 두지 않는다. 1인 운영 블로그에서 별도 스테이징의 유지 비용이 이득을 넘어서며, 로컬 프리뷰로 충분하다
  </environments>
  <ci_cd>
    <workflow_file>.github/workflows/deploy.yml</workflow_file>
    <trigger>`push`(branches: [main]) + `workflow_dispatch`(수동 재배포용)</trigger>
    <permissions>`contents: read`, `pages: write`, `id-token: write` — 최소 권한으로 명시</permissions>
    <concurrency>`group: pages`, `cancel-in-progress: false` — 연속 push 시 배포가 뒤엉키지 않게 한다</concurrency>
    <steps>
      1. build 잡: `actions/checkout@v7` → `withastro/action@v6` (패키지 매니저 감지, 의존성 설치, `npm run build` 실행, `dist`를 Pages 아티팩트로 업로드) → `node scripts/check-links.mjs dist`
      2. deploy 잡 (`needs: build`, `environment: github-pages`): `actions/deploy-pages@v5` (스텝에 `id: deployment`을 부여하고 환경 URL로 `steps.deployment.outputs.page_url` 사용)
    </steps>
    <gates>`npm run build`에 `astro check`가 포함되어 있으므로 타입 오류 시 build 잡이 실패하고 deploy 잡은 실행되지 않는다. 내부 링크 검사도 build 잡의 마지막 단계로 실행해 동일하게 배포를 막는다</gates>
    <rollback>
      - 1순위: 문제가 된 커밋을 `git revert`하고 push → 자동 재배포. Git 이력이 그대로 남아 추적 가능하다
      - 2순위: Actions에서 마지막 정상 워크플로 실행을 "Re-run all jobs"로 재실행
      - CRITICAL: `gh-pages` 브랜치를 손으로 수정하지 않는다. Actions 기반 배포에서는 그런 브랜치가 존재하지 않으며, 수동 개입은 다음 배포에서 덮어써진다
      - 복구 목표: 잘못된 배포를 인지한 뒤 5분 이내 이전 상태 복원(revert 커밋 1회 + 빌드 시간)
    </rollback>
  </ci_cd>
  <hosting>
    - GitHub Pages. 선택 근거: 리포지토리와 호스팅이 같은 곳에 있어 별도 계정·결제·연동이 필요 없고, 콘텐츠가 이미 Git에 있는 정적 사이트에 추가 인프라를 붙일 이유가 없다
    - HTTPS: Settings → Pages에서 "Enforce HTTPS"를 켠다
    - 리포지토리 형태: `<username>.github.io` 사용자 사이트로 확정. `astro.config.mjs`에 `site: 'https://<username>.github.io'`를 넣고 `base`는 기본값 `/`를 유지한다 — CRITICAL: 사용자 사이트에는 `base`를 설정하지 않는다(설정하면 모든 자산 경로가 한 단계 어긋난다)
    - 커스텀 도메인 계획 없음 → `public/CNAME`을 만들지 않는다. 나중에 도메인을 붙이면 `CNAME` 파일 추가 + DNS 설정 + `site` 값 변경 세 가지를 함께 해야 한다
  </hosting>
  <observability>
    <logging>
      - 서버가 없으므로 애플리케이션 로그가 존재하지 않는다. 관측 가능한 로그는 GitHub Actions 빌드 로그뿐이다
      - CRITICAL: 빌드 로그에 환경변수 값을 출력하지 않는다. `PUBLIC_` 접두사가 붙은 값이라도 로그에 남기지 않는 것을 기본으로 한다
    </logging>
    <metrics>
      - 빌드 상태: Actions 배지를 README에 넣어 실패를 즉시 인지한다
      - 방문 통계: GoatCounter(도입 확정). 페이지뷰와 리퍼러만 확인하며, 쿠키·개인 식별 정보는 수집하지 않는다
      - 성능: 릴리스마다 수동으로 Lighthouse를 1회 실행해 success_criteria의 임계값을 확인한다. 자동화된 성능 예산 CI는 이번 범위 밖이다
    </metrics>
    <uptime>GitHub Pages의 가용성에 전적으로 의존한다. 자체 모니터링을 두지 않으며, 장애 시 대응은 GitHub Status 확인이 전부다</uptime>
  </observability>
  <backups_and_recovery>
    - 콘텐츠의 원본은 Git 리포지토리 전체다. GitHub 원격과 로컬 클론이 이중화 역할을 한다
    - 추가 조치: 로컬에 최소 1개의 클론을 유지하고, 분기마다 리포지토리 아카이브(zip)를 별도 저장소에 보관한다
    - 이미지·PDF 등 바이너리 원본도 Git에 커밋되므로 별도 백업 대상이 아니다
    - RPO: 마지막 push 시점(사실상 0). RTO: 리포지토리만 있으면 새 계정에서도 10분 내 재배포 가능
  </backups_and_recovery>
</deployment_and_operations>

<key_implementation_notes>
  <critical_paths>
    - `src/config/categories.ts`의 파생 구조: 이 파일 하나에서 `CategoryId` 타입 → Zod enum → `getStaticPaths` → 내비 항목이 전부 파생되어야 한다. 여기서 타입 파생이 끊기면 "카테고리 추가 = 데이터 편집" 원칙 전체가 무너진다. 가장 먼저, 가장 정확하게 만든다
    - `content.config.ts`의 조건부 검증(`superRefine`): `category`에 따라 `paper` / `project` 블록을 강제하는 로직. 이게 없으면 메타 패널이 빈 채로 배포된다
    - `head`의 테마 초기화 인라인 스크립트: 위치(스타일시트보다 먼저)와 동기 실행 여부가 FOUC를 가른다. 나중에 옮기면 회귀가 눈에 잘 띄지 않는다
    - `/[category]/[slug]`의 단일 세그먼트 제약: rest 파라미터로 만들면 페이지네이션과 충돌한다. 라우트 파일 생성 시점에 고정한다
  </critical_paths>
  <recommended_implementation_order>
    1. 프로젝트 스캐폴딩: `npm create astro@latest` → TypeScript strict, Node 22 확인, `.nvmrc` 작성
    2. 통합 설치·설정: mdx, sitemap, icon, pagefind, `@tailwindcss/vite`, remark-math/rehype-katex. `astro.config.mjs` 완성 후 빈 페이지로 빌드 성공 확인
    3. 디자인 토큰: `src/styles/global.css`의 `@theme` 블록에 DESIGN.md 팔레트·타이포·radius·spacing을 CSS 변수로 선언하고 각 줄에 `[verified]` / `[local extension]` 주석을 단다. 다크 모드 변수 재정의까지 이 단계에서 끝낸다
    4. 설정 파일 3종: `site.ts`, `categories.ts`(+ `CategoryId` 파생 타입), `profile.ts` — `profile_authoring_contract`의 규칙대로 주석 달린 플레이스홀더 양식으로 작성한다(가짜 값 창작 금지)
    5. UI 프리미티브: `Button`, `Card`, `Badge`, `TagChip`. 토큰만 사용하고 색 리터럴을 쓰지 않는다
    6. `BaseLayout` + `SiteHeader` + `SiteFooter` + 테마 초기화 스크립트 + `ThemeToggle`. 이 시점에 다크 모드와 FOUC를 검증한다
    7. `content.config.ts` 스키마 + 샘플 글 3편(카테고리별 1편) 작성. 일부러 잘못된 프론트매터를 넣어 빌드 실패를 확인한다(시나리오 3)
    8. `[category]/index.astro` + `[category]/[slug].astro` + `page/[page].astro` — 카테고리 라우트 일체. 여기서 시나리오 2(카테고리 추가)를 미리 검증한다
    9. `PostLayout` + `PostMetaHeader` + `PaperMetaPanel` + `ProjectMetaPanel` + `prose.css`(본문 타이포·코드·수식·표)
    10. `TableOfContents` + 앵커 링크 + `IntersectionObserver` 하이라이트 + 코드 복사 버튼 + 읽기 시간
    11. 홈: `ProfileHero` → `EducationList` → `SkillGroups` → `InterestList` → `RecentPosts`
    12. `archive.astro`, `tags/index.astro`, `tags/[tag].astro`, `404.astro`
    13. `search.astro` + Pagefind — CRITICAL: 반드시 `npm run build && npm run preview`로 검증한다
    14. `rss.xml.ts`, SEO 메타(`lib/seo.ts`), JSON-LD, OG 기본 이미지
    15. 모바일 내비 시트 + 반응형 마무리 + `prefers-reduced-motion` 처리
    16. GoatCounter 분석 스크립트 + 푸터 수집 고지 문구
    17. `scripts/check-links.mjs` + `.github/workflows/deploy.yml` + `public/.nojekyll` + GitHub Pages 설정 → 첫 배포
    18. 접근성 감사(axe/Lighthouse) → 성능 튜닝 → README 작성(`profile_authoring_contract`의 프로필 기입 절차 + 글 쓰는 법 포함) → 플레이스홀더 경고 스크립트 확인
  </recommended_implementation_order>
  <content_schema_sketch>
    ```ts
    // src/content.config.ts
    import { defineCollection, z } from 'astro:content';
    import { glob } from 'astro/loaders';
    import { CATEGORY_IDS, getCategory } from './config/categories';

    const posts = defineCollection({
      // CRITICAL: 밑줄로 시작하는 템플릿 파일을 제외한다
      loader: glob({ pattern: ['**/*.{md,mdx}', '!**/_*'], base: './src/content/posts' }),
      schema: ({ image }) =>
        z
          .object({
            slug: z.string().regex(/^[a-z0-9-]+$/, 'slug는 소문자·숫자·하이픈만 허용하며 슬래시를 포함할 수 없습니다'),
            title: z.string().max(120),
            description: z.string().max(200),
            category: z.enum(CATEGORY_IDS),
            date: z.coerce.date(),
            updated: z.coerce.date().optional(),
            tags: z.array(z.string().max(24)).default([]),
            draft: z.boolean().default(false),
            cover: image().optional(),
            coverAlt: z.string().optional(),
            math: z.boolean().default(false),
            toc: z.boolean().default(true),
            paper: z
              .object({
                paperTitle: z.string(),
                authors: z.array(z.string()).min(1),
                venue: z.string(),
                year: z.number().int().min(1950).max(new Date().getFullYear() + 1),
                arxivId: z.string().optional(),
                doi: z.string().optional(),
                pdfUrl: z.string().url().optional(),
                codeUrl: z.string().url().optional(),
                readDate: z.coerce.date().optional(),
              })
              .optional(),
            project: z
              .object({
                role: z.string(),
                period: z.object({
                  start: z.string().regex(/^\d{4}-\d{2}$/),
                  end: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
                }),
                stack: z.array(z.string()).min(1),
                status: z.enum(['in-progress', 'completed', 'archived']),
                repoUrl: z.string().url().optional(),
                demoUrl: z.string().url().optional(),
                teamSize: z.number().int().min(1).optional(),
              })
              .optional(),
          })
          .superRefine((data, ctx) => {
            // CRITICAL: 카테고리별 필수 메타를 여기서 강제한다
            const panel = getCategory(data.category).metaPanel;
            if (panel === 'paper' && !data.paper) {
              ctx.addIssue({ code: 'custom', path: ['paper'], message: 'paper-review 글에는 paper 블록이 필요합니다' });
            }
            if (panel === 'project' && !data.project) {
              ctx.addIssue({ code: 'custom', path: ['project'], message: 'project 글에는 project 블록이 필요합니다' });
            }
            if (data.cover && !data.coverAlt) {
              ctx.addIssue({ code: 'custom', path: ['coverAlt'], message: 'cover가 있으면 coverAlt가 필요합니다' });
            }
          }),
    });

    export const collections = { posts };
    ```
  </content_schema_sketch>
  <performance_considerations>
    - CRITICAL: 클라이언트 JS의 기본값은 0이다. 스크립트를 추가할 때마다 "정적 HTML로 불가능한가"를 먼저 확인한다
    - 프로필 사진은 LCP 요소다. `loading="eager"` + `fetchpriority="high"`를 주고 lazy로 두지 않는다. 그 외 이미지는 전부 lazy
    - 폰트: Pretendard 400 하나만 `preload`. weight를 늘리면 초기 요청이 그만큼 늘어난다
    - Pagefind 인덱스는 `/search`에서 첫 입력 시 동적 import. 다른 페이지 번들에 포함시키지 않는다
    - KaTeX CSS는 `math: true` 글에서만 head에 삽입 (약 23KB 절약)
    - 모든 이미지에 명시적 width/height 또는 `aspect-ratio` — CLS 0 유지
    - 빌드 시간이 60초를 넘기 시작하면 이미지 변환이 병목일 가능성이 높다. 원본 해상도 상한(장변 2000px)을 두어 관리한다
  </performance_considerations>
  <testing_strategy>
    - 단위 테스트 프레임워크를 도입하지 않는다. 로직이 순수 함수 몇 개(날짜 포맷, 태그 slugify, 페이지네이션 계산, 읽기 시간)뿐이며, 이 프로젝트의 실질적 회귀는 렌더 결과와 빌드 실패에서 나온다
    - 1차 안전망: 콘텐츠 스키마 검증 + `astro check`. 두 게이트를 CI 필수로 둔다
    - 2차 안전망: final_integration_test의 시나리오 10종을 릴리스 전 수동 실행. 시나리오 2(카테고리 추가)와 3(스키마 실패)은 아키텍처 원칙의 회귀 테스트이므로 생략하지 않는다
    - 3차: `scripts/check-links.mjs`를 CI에 포함해 깨진 내부 링크를 빌드 실패로 만든다
    - 접근성: 릴리스마다 axe DevTools 또는 Lighthouse 접근성 감사 1회, 라이트/다크 양쪽에서 실행
  </testing_strategy>
  <tool_usage>
    - 개발 중 시각 검증은 `npm run dev` + 브라우저 DevTools 반응형 모드(375 / 768 / 1024 / 1440px)로 한다
    - 검색과 draft 제외 동작은 dev 서버에서 검증할 수 없다 — 반드시 `npm run build && npm run preview`를 쓴다
    - 대비 검증은 DevTools의 색상 대비 표시 또는 Lighthouse 접근성 감사를 쓰고 눈으로 판단하지 않는다
    - `DESIGN.md`는 참조 전용이다. 토큰 값을 바꿔야 한다고 판단되면 그 파일을 수정하는 대신 `global.css`에 `[local extension]` 주석과 함께 확장 토큰을 추가한다
  </tool_usage>
</key_implementation_notes>

</project_specification>
