# 07. 관리자 콘솔 계약

`ADMIN_CONSOLE_FEATURE_SPEC.md` 구현의 경계면 계약과 실측 결과. 후속 작업은 이 문서를 먼저 읽는다.

작성: 2026-08-22 · 근거: 실행한 빌드·API 호출·git diff

---

## 1. 배제 보장 — 이 기능의 가장 중요한 부정 요구사항

배포된 `stu-eonho.github.io/admin`은 404여야 한다. 방어는 네 겹이며 **네 번째를 생략하지 않는다.**

| 겹 | 위치                                  | 내용                                                       |
| -- | ------------------------------------- | ---------------------------------------------------------- |
| 1  | `admin/` 디렉터리 배치                | 파일 기반 라우터의 시야(`src/pages/`) 밖에 있다            |
| 2  | `admin/integration.mjs`               | `command !== 'dev'`면 `astro:config:setup`이 즉시 반환한다 |
| 3  | `adminApiPlugin`                      | `apply: 'serve'` + `configureServer` 훅 하나뿐이다          |
| 4  | `admin/build-guard.mjs`               | `astro:build:done`에서 `dist`를 검사해 유출 시 빌드를 깬다  |

**가드 역검증 (실측):**

| 심은 유출                                     | 결과                                          |
| --------------------------------------------- | --------------------------------------------- |
| `src/pages/guardtest.astro`에 `/__admin/…` 문자열 | 빌드 실패 — `파일 본문: guardtest\index.html` |
| `src/pages/admin.astro` (문자열 없음)          | 빌드 실패 — `라우트: /admin/`, `디렉터리: dist\admin` |

**실측 결과 (관리자 도입 후):** `dist/admin` 없음 · `grep -r "__admin" dist` 0건 ·
`grep -ril admin dist --include=*.html` 0건.

### CRITICAL: Tailwind 스캔 유출

Tailwind v4는 프로젝트 전체를 훑어 클래스 후보 문자열을 찾는다. 실측에서 `admin/server/paths.mjs`의
지역 변수 `absolute`가 프로덕션 CSS에 `.absolute{position:absolute}` 규칙으로 실렸다.
`src/styles/global.css`의 `@source not '../../admin';`이 이것을 막는다.

같은 이유로 **`.gitignore`에 없는 임시 파일을 리포지토리에 남기지 않는다.** 실측에서 임시
테스트 디렉터리의 `.html`·`.mjs`가 `.block`·`.underline` 등 4개 유틸리티를 추가로 끌어왔다.
(Tailwind 자동 탐지는 `.gitignore`를 존중하므로 `dist/`는 스캔되지 않는다.)

---

## 2. 리팩터링 무해성

| 이동                                   | 이전 → 이후                                        |
| -------------------------------------- | -------------------------------------------------- |
| Zod 스키마 → `src/content/schema.ts`   | `postSchema({ image })` 팩토리                      |
| 마크다운 설정 → `markdown.config.mjs`  | `createMarkdownOptions()` 팩토리                     |

**실측 결과:** 페이지 38개(변화 없음) · `astro check` 0오류/0경고 ·
`dist` 전체가 도입 전과 바이트 동일(예외 1건: `pagefind/pagefind-entry.json`의 languages 키 순서.
해시·page_count 동일) · `dist/_astro/*.js` gzip 합 17.3 KB(변화 없음) ·
`check-links` 1022건 이상 없음.

### 스펙과 다르게 구현한 곳 2건

1. **`postSchema`가 제네릭이다.** 스펙 예시의 `image: () => z.ZodTypeAny`로 고정하면 `cover`의
   추론 타입이 `{}`로 넓어져 `<Image src={post.data.cover}>`가 `astro check`에서 깨진다(실측
   10건 오류). `postSchema<TImage extends z.ZodTypeAny>`로 두어 호출자의 실제 타입을 흘려보낸다.
   관리자는 여전히 `postSchema({ image: () => z.string() })`로 호출한다.
2. **`markdown.config.mjs`에 반환 타입을 명시한다.** 팩토리로 감싸면 `themes`의 문자열 리터럴이
   `string`으로 넓어져 Shiki 테마 타입에 맞지 않는다(인라인 객체일 때는 `defineConfig`가 문맥
   타입을 줬다).

---

## 3. Vite 모듈 러너 — 우회가 필요한 지점

**증상:** `admin/integration.mjs` 안에서 `await import('./server/middleware.mjs')`를 요청 시점에
부르면 `Vite module runner has been closed`로 실패한다.

**원인:** Astro는 설정과 인테그레이션을 Vite의 모듈 러너로 읽은 뒤 그 러너를 닫는다. 이 파일의
`import()`는 Vite가 `__vite_ssr_dynamic_import__`로 바꿔 두었으므로 닫힌 러너를 탄다.

**해결:** `new Function('specifier', 'return import(specifier)')`로 만든 네이티브 import를 쓴다.
`Function` 생성자 안의 코드는 Vite가 변환하지 않는다. 이렇게 불러 온 `middleware.mjs`부터는
Node의 모듈 그래프이므로 그 안의 상대 경로 동적 import는 정상 동작한다.

`server.ssrLoadModule`은 정상 동작한다 — 관리자는 이것으로 `src/config/*.ts`와
`src/content/schema.ts`를 **실제 모듈로 평가해** 값을 얻는다. 관리자가 설정 파일을 쓰면 Vite가
모듈을 무효화하므로 다음 요청에서 새 값이 자동으로 읽힌다(관리자가 캐시를 따로 들지 않는 이유).

---

## 4. 프론트매터 직렬화 계약

키 순서: `slug` → `lang` → `title` → `description` → `category` → `date` → `updated` → `tags`
→ `draft` → `cover` → `coverAlt` → `math` → `toc` → `paper` → `project`

- 기본값과 같은 값은 생략: `lang: 'ko'`, `draft: false`, `math: false`, `toc: true`, `tags: []`
- 날짜는 `YYYY-MM-DD`, 따옴표 없음. 시각 성분 없음
- `tags`·`stack`은 플로우 한 줄(`[a, b]`), `authors`는 블록 여러 줄
- `period.start`/`end`는 항상 홑따옴표(`'2026-08'`)
- 값이 `undefined`이거나 빈 문자열인 선택 필드는 키째로 생략. `null`은 남긴다
- 본문은 종료 구분자 뒤 빈 줄 하나로 시작하고, 파일은 개행 하나로 끝난다

**스펙과 다른 곳 1건:** 스펙은 `stack`을 블록 스타일로 적었으나 실제 `study-log-site.mdx`는
플로우 한 줄이다. 실제 파일을 따랐다 — 그래야 태그 일괄 수정이 `tags` 줄 외의 줄을 건드리지 않는다.

**항등성 실측:** 기존 글 4편(`.mdx` 2 + `.md` 2)을 읽어 그대로 다시 쓰면 **전부 바이트 동일.**

---

## 5. TS 설정 파일 편집 계약

| 파일             | 선언         | 연산                     | 보존 대상                                      |
| ---------------- | ------------ | ------------------------ | ---------------------------------------------- |
| `profile.ts`     | `PROFILE`    | 초기자 전체 교체         | 최상위 프로퍼티 앞 JSDoc, 닫는 괄호 앞 주석    |
| `site.ts`        | `SITE`       | 초기자 전체 교체         | `navOrder` 표현식, `url`의 `env ?? '…'` 형태   |
| `categories.ts`  | `CATEGORIES` | 초기자 전체 교체         | `as const satisfies readonly Category[]` 꼬리  |
| `i18n.ts`        | `ko` / `en`  | 문자열 리터럴 단위 교체  | 섹션 주석 23개, 함수형 값 18개                 |

**항등성 실측 (값을 읽어 그대로 다시 쓰기):**

| 파일            | 결과                                                                      |
| --------------- | ------------------------------------------------------------------------- |
| `categories.ts` | **바이트 동일**                                                            |
| `site.ts`       | **바이트 동일**                                                            |
| `i18n.ts`       | **바이트 동일** (문자열 100개 × 2언어). 한 값만 바꾸면 정확히 한 줄만 변경 |
| `profile.ts`    | 아래 2가지만 차이. 나머지 전부 동일                                        |

`profile.ts`에서 되살릴 수 없는 것:

1. **중첩 배열·객체 안쪽의 줄 주석** — 예: `endDate: null, // 재학 중이면 null → "현재"로 표시됩니다`.
   같은 설명이 파일 상단 인터페이스의 JSDoc에 있으므로 정보 손실은 아니다. 관리자 화면 하단에
   이 사실을 고지한다.
2. **한 줄에 담기는 배열의 여러 줄 표기** — `skillGroups`·`links`가 100칸 안에 들어가면 인라인으로
   정규화된다. 첫 저장 이후로는 멱등하다.

**방출 규칙:** 들여쓰기 2칸 · 홑따옴표 · 100칸 안에 담기면 인라인, 넘치면 여러 줄 + 후행 콤마 ·
`{ ko, en }`의 두 값이 같으면 문자열 하나로 접음 · `undefined` 프로퍼티는 방출 안 함 ·
`null`은 그대로 · 쓰기 직전 재파싱해 구문 오류 0을 확인한 뒤에야 디스크에 남김.

**`prettier --write`를 호출하지 않는다** — 호출하면 건드리지 않은 부분까지 포맷이 바뀌어 diff가
오염된다.

---

## 6. 보안 게이트 (실측)

| 시도                                              | 결과                                       |
| ------------------------------------------------- | ------------------------------------------ |
| `Origin: https://evil.example`로 `PUT /profile`   | 403 `E-FORBIDDEN-ORIGIN`                   |
| 토큰 없이 같은 오리진에서 `PUT /profile`          | 401 `E-BAD-TOKEN`                          |
| `Host: evil.example`                              | 403 (Vite의 allowedHosts가 먼저 막고, 관리자 Host 검사가 두 번째 겹) |
| `GET /posts/..%2F..%2F..%2Fpackage.json`          | 403 `E-PATH-ESCAPE` — `package.json` 읽히지 않음 |
| `Origin` 헤더 없는 `DELETE`                       | 403 `E-FORBIDDEN-ORIGIN`                   |
| `ADMIN_DISABLED=1`                                | `/admin` 404 · `/__admin/api/session` 404 · 사이트 200 |
| `ADMIN_ALLOW_REMOTE=1`                            | 관리자 상단에 빨간 경고 배너 상시 노출     |

- `/session` 응답에 `Access-Control-Allow-Origin`을 **절대** 붙이지 않는다. 크로스 오리진 페이지가
  토큰을 읽지 못하는 것이 3번 방어의 전부다.
- `E-PATH-ESCAPE`·`E-FORBIDDEN-ORIGIN`은 응답에 경로·출발지를 되비추지 않는다(터미널에만 남긴다).
- 허용 루트는 정확히 3개: `src/content/posts`, `src/assets`, `src/config`.
  `path.relative` + `realpath`로 검사한다 — 문자열 `startsWith`는 `src/assets-evil`을 통과시킨다.
- 외부 프로세스는 `git status`뿐이며 `execFile`로 고정 인자만 넘긴다(셸 미경유).

---

## 7. 검증 파이프라인 5관문

저장 요청 하나가 통과해야 하는 순서. 뒤 단계가 앞 단계의 통과를 전제한다.

1. **경로 안전** — 허용 루트 안인가 (`assertInsideAllowedRoot`)
2. **형태** — slug 정규식, category/lang이 설정에 있는가 (`assertShape`)
3. **스키마** — `postSchema()` 파싱. 실패 시 Zod 이슈를 `{ field, message }`로 (`assertSchema`)
4. **참조 무결성** — `cover` 파일 존재, **본문 이미지 참조** 파일 존재, 태그 24자 (`assertReferences`)
5. **충돌** — `baseMtime` 일치, 대상 경로 중복 없음

**3번의 메시지를 관리자에서 재작성하지 않는다.** 스키마에 이미 한국어로 적혀 있고, 재작성하면
스키마를 고칠 때 두 벌이 갈라진다.

### CRITICAL: 본문 이미지 참조도 4번에서 막는다

`![alt](../상대경로)`와 `<img src="../상대경로">`가 없는 파일을 가리키면 Vite가 모듈을 해석하지
못해 **dev 서버와 `astro build`가 함께 죽는다.** 프론트매터 `cover`만 검사하면 부족하다 —
편집기의 "이미지 삽입"이 자리표시 경로(`../../../assets/파일명`)를 넣어 실제로 사이트를 내렸다.

검사 대상은 `.`으로 시작하는 상대 경로뿐이다. `/foo.png`는 `public/`을, `http(s)://`는 외부
자원을 가리켜 Vite의 번들 대상이 아니다. 코드 펜스 안의 이미지 문법은 예제 코드이므로 건드리지
않는다.

짝이 되는 UI 방어: 편집기의 "이미지 삽입"은 자리표시를 넣지 않고 **실제로 올라간 파일 중에서만**
고르게 한다(다이얼로그 안에서 바로 업로드도 가능). 고르지 않고 닫으면 본문은 그대로다.

### CRITICAL: 본문 링크 주소도 4번에서 막는다

이 사이트의 내부 링크는 전부 루트 기준 절대 경로다 — `i18n.href()`가 그렇게 만든다.
스킴도 없고 슬래시로도 시작하지 않는 목적지(`url`, `foo`)는 글이 놓인 디렉터리 기준 상대
경로로 해석되어 **반드시 깨진다.** 편집기의 "링크" 도구가 `](url)` 자리표시를 넣던 탓에
`<a href="url">`이라는 죽은 링크가 실제로 배포됐다.

| 형태                     | 판정   |
| ------------------------ | ------ |
| `https://…`, `mailto:…`  | 허용   |
| `/archive`               | 허용   |
| `#section`               | 허용   |
| `./sibling`, `../x`      | 허용   |
| `url`, `foo`             | **거부** |

이미지와 마찬가지로 코드 펜스 안은 건드리지 않고, 역슬래시로 이스케이프된 `\[`·`\!`는
링크·이미지가 아니라 글자 그대로이므로 검사 대상이 아니다.

짝이 되는 UI 방어: "링크" 도구가 주소를 묻는 다이얼로그를 띄운다. 주소를 비운 채 확인하면
아무것도 넣지 않는다.

### 빌드 게이트도 함께 고쳤다 — `scripts/check-links.mjs`

기존 검사는 `if (!href.startsWith('/')) continue;`로 **상대 경로를 통째로 건너뛰었다**
("상대 경로는 Astro가 생성하지 않는다"는 전제). 레이아웃·컴포넌트에 대해서는 맞지만
**글 본문은 사람이 쓴다** — 그래서 `href="url"`이 검사 1200건을 통과해 배포됐다.

이제 스킴 없는 링크는 전부 검사하며, 상대 경로는 그 링크가 실린 HTML 파일의 디렉터리를
기준으로 푼다. 역검증: `url`과 `./nope`를 심으면 2건을 잡고 종료 코드 1로 배포를 막으며,
`/archive`는 통과한다. 기존 콘텐츠에서 오탐 0건.

---

## 8. 번역본 짝짓기

키는 `category` + `slug`. `src/lib/posts.ts`의 `translationKey`와 같은 규칙이다.

깨질 수 있는 경로 둘을 모두 막는다.

| 경로                 | 처리                                                     |
| -------------------- | -------------------------------------------------------- |
| 한쪽만 slug 변경     | 저장 시 짝도 함께 rename (`renamed[]`에 명시 + 확인 창)  |
| 한쪽만 category 변경 | 저장 시 짝도 같은 카테고리 폴더로 이동                   |

**실측:** `test-paper` → `test-paper-2` 변경 시 `renamed`에 2건이 실리고, 이후 목록에서 두 언어가
모두 `hasTranslation: true`를 유지했다.

번역본이 없어도 사이트는 정상이다(원문 + 안내 배너로 폴백). 관리자는 이것을 **오류가 아니라
정보로** 표시한다.

---

## 9. 화면 ↔ API 대응

| 화면                | 쓰는 엔드포인트                                                          |
| ------------------- | ------------------------------------------------------------------------ |
| `/admin`            | `GET /posts`, `GET /profile`, `GET /git/status`                          |
| `/admin/posts`      | `GET /posts`, `POST /posts/:id/translation`, `DELETE /posts/:id`         |
| `/admin/posts/edit` | `GET/POST/PUT /posts`, `POST /preview`, `GET/POST /assets`, `GET /session` |
| `/admin/profile`    | `GET/PUT /profile`, `POST /assets`(`purpose: profile-photo`)             |
| `/admin/settings`   | `GET/PUT /config/site`, `GET/PUT /config/categories`, `GET /config/icons` |
| `/admin/strings`    | `GET/PUT /strings`                                                       |
| `/admin/tags`       | `GET /tags`, `POST /tags/{rename,merge,delete}`                          |
| `/admin/assets`     | `GET/POST /assets`, `DELETE /assets/:name`                               |

`GET /config/icons`는 스펙에 없는 추가 엔드포인트다 — 카테고리 아이콘 입력의 자동완성 목록을
서버가 갖고 있어야 `E-UNKNOWN-ICON`과 같은 판정 기준을 쓴다.

---

## 10. 프리뷰

### CRITICAL: 프리뷰 화면은 KaTeX CSS와 `prose.css`를 함께 실어야 한다

둘 중 하나라도 빠지면 프리뷰가 사이트와 다르게 보인다. 실측으로 확인한 증상:

| 빠진 것            | 증상                                                                        |
| ------------------ | --------------------------------------------------------------------------- |
| `katex.min.css`    | 수식이 **두 벌로 겹쳐 나온다.** KaTeX는 접근성용 `.katex-mathml`(MathML)과 시각용 `.katex-html`을 둘 다 내보내는데, CSS가 없으면 어느 쪽도 숨겨지지 않는다. 브라우저가 MathML을 자체 렌더한 수식 아래에 스타일 없는 `.katex-html` 파편(`√`, `dk`, `QK⊤`)이 그대로 찍힌다 |
| `prose.css`        | 본문 타이포가 사이트와 갈린다. `PostLayout.astro`만 import하고 있어 관리자에는 적용되지 않았다 |

사이트는 `math: true`인 글에서만 KaTeX CSS를 싣지만(약 23KB 절약), 관리자는 dev 전용이고
어느 글이든 수식을 바로 켤 수 있어야 하므로 `AdminLayout`에서 항상 싣는다.

`public/katex/fonts/`에는 `.woff2` 20개만 있고 CSS가 참조하는 `.woff`·`.ttf` 40개는 없다.
`src` 목록에서 woff2가 먼저라 최신 브라우저는 요청하지 않는다 — 404가 나지 않으며 문제가 아니다.

### 프리뷰 ↔ 사이트 동등성 (실측)

같은 본문을 프리뷰와 실제 페이지에 각각 통과시켜 비교했다. **KaTeX 마크업이 바이트 동일**하며,
유일한 차이는 인라인 `style`의 후행 세미콜론(`…em;"` vs `…em"`)이다 — Astro 빌드의 HTML
최소화가 떼는 것이고 렌더 결과에 영향이 없다.

### 줄바꿈은 마크다운 규칙 그대로다

프리뷰가 사이트와 같은 규칙을 쓰므로, Enter 한 번은 **문단을 나누지 않는다.**

| 입력                | 결과                |
| ------------------- | ------------------- |
| Enter 한 번         | 같은 문단으로 이어짐 |
| 줄 끝 역슬래시(`\`) | `<br>` 삽입          |
| 줄 끝 공백 2개      | `<br>` 삽입          |
| 빈 줄               | 새 문단(`<p>`)       |

처음 쓰는 사람이 반드시 걸리는 지점이라 편집기 본문 아래에 이 규칙을 한 줄로 안내한다.
`remark-breaks`로 Enter 한 번을 `<br>`로 바꾸는 선택지가 있으나, 기존 글 전체의 렌더가 바뀌므로
기본값으로 켜지 않았다.


- 프로세서는 dev 서버 프로세스에서 **한 번** 만들어 재사용한다(Shiki 초기화가 수백 ms).
- **CRITICAL:** `createMarkdownProcessor(options)`에 옵션 객체를 통째로 넘기면 안 된다. 그 함수는
  `remarkPlugins`/`rehypePlugins`만 읽고 `processor` 필드를 무시하므로 remark-math·rehype-katex가
  빠진 채 렌더된다(실측으로 확인). Astro 내부와 같은 경로인 `processor.createRenderer(shared)`를 쓴다.
- JSX·`import`·`export` 줄은 렌더하지 않고 점선 자리표시 블록으로 바꾼다. 코드 펜스 안은 건드리지
  않는다.
- 클라이언트는 400ms 디바운스로 호출하고, 응답에 순번을 붙여 늦게 도착한 응답을 버린다.
- **프리뷰를 비웠다 채우지 않는다.** 통째로 교체하고 갱신 중에는 스피너만 켠다.
- **프리뷰 실패는 토스트를 띄우지 않는다.** 회색 한 줄로만 알리고 직전 결과를 유지한다.

**성능 실측:** 첫 렌더 257ms(Shiki 초기화 포함), 이후 5,000자 본문 190ms.

---

## 11. HMR 격리

- `admin/pages/*.astro`와 `AdminLayout.astro`는 `src/config/*`를 import하지 않는다. 설정에서 오는
  값은 전부 `/session`으로 가져온다.
- 각 관리자 페이지의 스크립트는 `import.meta.hot?.accept(() => {})`로 자기 수용해 갱신이 전체
  새로고침으로 번지지 않게 한다. (Vite 6+에서 `import.meta.hot.decline()`은 제거되었다.)
- 관리자가 `src/config/*`나 `src/content/**`를 쓰면 Vite가 모듈을 갱신해 **사이트 탭이** 자동으로
  새로고침된다. 이것은 의도된 부수효과다.

---

## 12. CSS 격리

- `admin/styles/admin.css`는 `src/styles/global.css`를 import하고 **시맨틱 변수만** 쓴다.
- 요소 셀렉터 단독 규칙(`input { … }`)이 없다. 모든 규칙이 `.admin-` 접두 클래스 또는
  `[data-admin]` 스코프 안에 있다.
- `src/components/ui/*.astro`를 관리자 요구에 맞춰 수정하지 않았다. 관리자 전용 변형은 전부
  `admin.css`의 클래스로 해결했다.
- 관리자 화면은 사이트와 같은 팔레트를 쓰므로 기존 대비 감사 결과를 승계한다.

---

## 13. 실측 테스트 결과

| 묶음                              | 결과   |
| --------------------------------- | ------ |
| 글 CRUD·번역·충돌·프리뷰·태그 dryRun | 22/22 |
| 설정 쓰기(strings·profile·categories·site) | 30/30 |
| 에셋 업로드·형식 위조·용량·사용 중 삭제 | 10/10 |
| 태그 병합·정규화·diff 범위        | 10/10 |
| 보안 게이트                       | 7/7    |
| 본문 이미지 참조 무결성            | 8/8    |
| 본문 링크 무결성                  | 8/8    |
| 참조 추출 규칙(단위)              | 11/11  |
| 프리뷰 ↔ 사이트 동등성            | 12/12  |

---

## 14. 남은 결정 (스펙 `open_questions`)

이번 구현은 스펙의 기본값을 그대로 따랐다. 바꾸려면 여기부터 본다.

- **Q1 git 커밋·푸시 버튼** — **사용자 요청으로 넣었다**(2026-08-23). 아래 §15 참조.
- **Q2 UI 문자열 키 추가·삭제** — 막았다. 기존 키의 값만 편집한다.
- **Q3 이미지 리사이즈** — 하지 않는다. 8MB 상한 + 초과 시 거부.
- **Q4 관리자 화면 언어** — 한국어 고정. 문자열은 `admin/labels.ts`에 따로 둔다.

---

## 15. git 커밋 · 푸시 (Q1 — 나중에 추가)

스펙의 기본값은 "읽기 전용"이었으나 사용자가 명시적으로 요청해 추가했다.
초안이 함께 배포될 위험은 사용자가 인지하고 수용했으며, 확인 창이 그 사실을 매번 알린다.

| 엔드포인트           | 하는 일                                        |
| -------------------- | ---------------------------------------------- |
| `GET /git/status`    | 파일 목록 + `upstream`·`ahead`·`behind`·`remote`·`drafts` |
| `POST /git/commit`   | `{ message, files[] }` — 고른 파일만 스테이징 후 커밋 |
| `POST /git/push`     | 현재 업스트림으로 푸시                          |

### CRITICAL: 인젝션 방어는 `execFile` 인자 배열이 전부다

커밋 메시지와 파일 경로가 **사용자 입력**이다. 셸 문자열로 조립하는 순간
`x"; rm -rf ...`가 실행된다. 셸을 아예 경유하지 않는다.
실측: 메시지 `x"; touch pwned; echo "`를 커밋하면 그 문자열이 **그대로** 메시지로 저장되고
`pwned` 파일은 생기지 않는다.

경로는 `--` 뒤에만 넣고, `-`로 시작하는 경로는 아예 거절한다(`--hard` 같은 값이 옵션으로
해석되는 것을 막는다).

### CRITICAL: 강제 푸시로 가는 경로가 없다

`--force`를 서버에도 화면에도 두지 않았다. 대신 아래를 거절한다.

| 상황                 | 처리                                          |
| -------------------- | --------------------------------------------- |
| 업스트림 없음        | 거절 — 터미널에서 `git push -u`를 한 번 하라고 안내 |
| 보낼 커밋 없음       | 거절                                          |
| 원격이 앞서 있음     | 거절 — `git pull`을 먼저 하라고 안내           |

브랜치·원격을 관리자가 바꾸지 않는다. 현재 업스트림으로만 보낸다.

### 푸시 확인 창

푸시는 곧 공개 배포이므로 확인 없이 실행하지 않는다. 기본 포커스는 취소다.
창에는 브랜치·원격 URL·보낼 커밋 수를 보여 주고, **초안 글이 있으면 경고를 하나 더 띄운다** —
초안은 사이트에 안 나오지만 **파일은 공개 리포지토리로 올라가기 때문이다.**

### 보안 경계는 그대로다

커밋·푸시도 다른 변경 요청과 같은 3중 게이트를 지난다. 실측:

| 시도                              | 결과                     |
| --------------------------------- | ------------------------ |
| 크로스 오리진 `POST /git/commit`  | 403 `E-FORBIDDEN-ORIGIN` |
| 크로스 오리진 `POST /git/push`    | 403 `E-FORBIDDEN-ORIGIN` |
| 토큰 없는 `POST /git/push`        | 401 `E-BAD-TOKEN`        |

**CRITICAL: `ADMIN_ALLOW_REMOTE=1`의 무게가 달라졌다.** 이전에는 "같은 네트워크의 누구나
리포지토리를 고칠 수 있다"였지만, 이제 **"같은 네트워크의 누구나 공개 사이트에 발행할 수 있다"**
이다. 이 플래그는 켜지 않는 것을 기본으로 한다.

푸시는 이 PC의 git 자격 증명을 쓴다. 관리자는 그 값을 읽지도 저장하지도 않는다.

### 테스트

핸들러가 `projectRoot`를 인자로 받으므로 **임시 디렉터리의 격리된 저장소**로 검증한다 —
사용자 리포지토리를 건드리지 않는다. 18건: 상태 조회, 커밋 거절 3종, 선택 파일만 커밋,
메시지 보존, 셸 인젝션 방어, 삭제 반영, 푸시 거절 3종, 정상 푸시.
