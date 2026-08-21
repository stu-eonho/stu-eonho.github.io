# Study Log

읽은 논문(Paper Review)과 진행한 프로젝트(Project), 공부 노트(Notes)를 기록하는 개인 정적 블로그입니다.
글은 웹 에디터가 아니라 이 리포지토리에 Markdown 파일을 커밋해 씁니다. `main`에 push하면 GitHub Actions가 빌드해 GitHub Pages로 배포합니다.

한국어(`/`)와 영어(`/en/`) 두 벌로 빌드됩니다. 해외 포트폴리오로 쓸 수 있게 영어 페이지가 실제 URL을 갖습니다.

Astro 7 · MDX · Tailwind CSS 4 · Pagefind · 서버 없음 · 데이터베이스 없음.

배포 주소: <https://stu-eonho.github.io>

---

## 1. 처음 시작하기

```bash
npm install
npm run dev          # http://localhost:4321
```

Node 22.12.0 이상이 필요합니다(`.nvmrc`에 `22`가 기록되어 있습니다).

| 명령                  | 하는 일                                                |
| --------------------- | ------------------------------------------------------ |
| `npm run dev`         | 개발 서버. draft 글이 보이고, 검색 인덱스는 없습니다   |
| `npm run build`       | `astro check`(타입 검사) 후 정적 빌드 → `dist/`        |
| `npm run preview`     | 빌드 결과를 그대로 서빙합니다                          |
| `npm run check-links` | `dist`의 내부 링크가 실제 파일로 해석되는지 검사합니다 |
| `npm run format`      | Prettier로 전체 포맷                                   |

> **검색과 draft 제외 동작은 개발 서버에서 확인할 수 없습니다.**
> 반드시 `npm run build && npm run preview`로 확인하세요. Pagefind 인덱스는 빌드 후에 생성됩니다.

---

## 2. 프로필 채우기

홈은 **CV 한 장 + 최근 글** 두 덩어리입니다. 프로필 카드 안에 사진·이름·소개·연락처·링크와
학적 / 경력 / 스킬 / 관심 분야가 전부 모여 있고, 그 아래에 최근 글 그리드가 옵니다.

카드의 모든 내용은 `src/config/profile.ts` 한 파일에서 옵니다.
꺾쇠(`<...>`)로 감싼 값이 아직 채우지 않은 자리이며, 화면에도 그대로 보입니다 —
무엇을 채워야 하는지 바로 알 수 있고, 값을 지우면 그 요소가 사라집니다.

1. **`src/config/profile.ts`를 열고 꺾쇠로 감싼 값을 실제 정보로 바꿉니다.**
   공개하고 싶지 않은 항목은 값을 지우거나 줄 전체를 삭제하세요. 각 필드 위 주석에
   "비웠을 때 화면이 어떻게 되는지"가 적혀 있습니다.
   글자가 들어가는 필드는 **한 언어로 쓰거나 두 언어로 나눠 쓸 수 있습니다.**

   ```ts
   school: 'KAIST',                                        // 두 화면에서 그대로
   school: { ko: '서울대학교', en: 'Seoul National University' },  // 언어별로 다르게
   ```

   고유명사처럼 번역할 필요가 없는 값은 문자열 하나로 두세요.

2. **프로필 사진을 `src/assets/profile.jpg`에 넣습니다.**
   정사각형 640×640 이상을 권장하며 원형으로 잘립니다. `.jpeg` / `.png` / `.webp`도 자동으로 인식합니다.
   파일이 없으면 이름 이니셜 원형 플레이스홀더가 대신 나옵니다.
3. **`photoAlt`를 사진 설명으로 바꿉니다.** 스크린리더가 읽는 문구입니다.
4. **CV를 게시한다면** `public/cv.pdf`에 파일을 넣고 `cvUrl: '/cv.pdf'`로 둡니다.
   게시하지 않으면 `cvUrl` 줄과 파일을 함께 지웁니다.
5. `npm run dev`로 홈 화면을 확인합니다.
6. 커밋 후 push하면 자동 배포됩니다.

> **사진을 커밋하기 전에 배경에 개인정보(주소, 사원증, 문서)가 찍히지 않았는지 확인하세요.**
> 한 번 커밋된 파일은 이후 삭제해도 Git 이력에 남습니다.

빌드할 때 미기입 항목이 남아 있으면 콘솔에 경고 한 줄이 나옵니다. **경고일 뿐 빌드는 성공합니다** —
사이트를 먼저 띄워 보고 나중에 채워도 됩니다.

### 경력 쓰기

`career` 배열에 최신 항목이 앞에 오도록 넣습니다. 재직 중이면 `endDate: null`로 두면
화면에 "현재"로 표시되고, 카드 상단 요약에도 현직으로 함께 나옵니다.

```ts
career: [
  {
    company: { ko: '○○연구소', en: 'OO Research Institute' },
    role: { ko: '연구 인턴', en: 'Research Intern' },
    team: 'NLP',               // 두 언어 공통이면 문자열 하나로. 생략 가능
    employment: 'Intern',      // Full-time | Intern | Contract | Freelance | Other, 생략 가능
    startDate: '2025-06',
    endDate: null,             // 재직 중
    description: {             // 생략 가능
      ko: '한국어 요약 모델 평가 파이프라인 구축',
      en: 'Built an evaluation pipeline for Korean summarization models',
    },
  },
],
```

`Full-time` / `Intern` 같은 구분값과 `학사` / `BS` 같은 학위 표기는 화면 언어에 맞춰 자동으로 번역됩니다 —
직접 쓰지 않습니다.

경력이 없으면 `career: []`로 두세요. 섹션 전체가 사라집니다.

### 비웠을 때 어떻게 되나

| 비운 항목                                      | 화면                                                  |
| ---------------------------------------------- | ----------------------------------------------------- |
| `email`                                        | 소셜 아이콘 행에서 이메일 아이콘만 사라집니다         |
| `links`                                        | 소셜 아이콘 행 전체가 사라집니다                      |
| `cvUrl`                                        | CV 버튼이 사라집니다                                  |
| 네 섹션 모두                                   | CV 본문 블록 자체가 사라지고 신원 + 소개문만 남습니다 |
| `education`                                    | 학적 섹션 전체와 카드 상단의 소속 한 줄이 사라집니다  |
| `career`                                       | 경력 섹션 전체와 카드 상단의 현직 표기가 사라집니다   |
| `skillGroups`                                  | 스킬 섹션 전체가 사라집니다                           |
| `interests`                                    | 관심 분야 섹션 전체가 사라집니다                      |
| 사진 미교체                                    | 이름 이니셜 원형 플레이스홀더로 대체됩니다            |
| `nameEn`, `location`, `lab`, `advisor`, `note` | 해당 줄만 생략됩니다                                  |

`nameEn`(영문 병기)은 한국어 화면에서만 이름 옆에 붙습니다. 영어 화면에서는 이름 자체가 이미 영문이므로 생략됩니다.

---

## 3. 한국어 / 영어

사이트는 한 번 빌드할 때 두 벌이 나옵니다.

| 화면               | 한국어                         | 영어                                    |
| ------------------ | ------------------------------ | --------------------------------------- |
| 홈                 | `/`                            | `/en`                                   |
| 카테고리           | `/paper-review`                | `/en/paper-review`                      |
| 글 상세            | `/notes/my-slug`               | `/en/notes/my-slug`                     |
| 아카이브·태그·검색 | `/archive`, `/tags`, `/search` | `/en/archive`, `/en/tags`, `/en/search` |
| RSS                | `/rss.xml`                     | `/en/rss.xml`                           |

전환은 헤더 오른쪽, 검색과 다크 모드 토글 옆의 **`EN` / `KO`** 버튼입니다.
지금 보고 있는 화면의 반대 언어 URL로 이동하는 **링크**이며 JavaScript를 쓰지 않습니다 —
그래서 깜빡임이 없고, JS를 꺼도 동작하고, 영어 URL을 공유하면 상대도 영어로 봅니다.

`<link rel="alternate" hreflang>`과 사이트맵이 두 URL을 짝으로 묶어 주므로
검색엔진이 영어 페이지를 따로 색인합니다. 검색(Pagefind)도 언어별 인덱스가 분리되어
`/search`는 한국어 글을, `/en/search`는 영어 글을 찾습니다.

### 글 번역하기

**UI와 프로필은 항상 두 언어로 나옵니다. 글 본문은 번역본을 쓴 것만 영어가 됩니다.**

번역본을 만들려면 원문 옆에 `.en`을 끼운 파일을 두고 `lang: en`을 넣습니다.

```
src/content/posts/notes/
  intl-date-format.md       ← 원문 (lang 생략 = ko)
  intl-date-format.en.md    ← 번역본 (lang: en)
```

```yaml
---
slug: intl-date-format # 원문과 **똑같이** 둡니다 — 이 값으로 두 글이 묶입니다
lang: en
title: Formatting dates with Intl.DateTimeFormat
description: ...
category: notes # 원문과 같아야 합니다
date: 2026-08-21
tags: [javascript, i18n]
---
```

`slug`와 `category`가 같으면 같은 글의 번역본으로 묶이고, `/en/notes/intl-date-format`에
영어판이 실립니다. `slug`가 다르면 **별개의 글 두 편**이 됩니다.

번역본이 없는 글은 `/en/`에서 원문이 그대로 나오고, 본문 위에 안내 배너가 붙습니다.
이런 페이지는 canonical이 원문 URL을 가리킵니다 — 같은 본문이 두 URL에 있을 때
검색엔진이 중복으로 보고 양쪽 평가를 함께 깎는 것을 막기 위해서입니다.

같은 `slug` + `category` + `lang` 조합이 두 번 나오면 **빌드가 실패합니다.**
어느 파일이 이길지 알 수 없는 상태로 배포되지 않게 하기 위한 것입니다.

### UI 문구 고치기

화면에 나오는 모든 문구는 `src/config/i18n.ts`의 `UI` 사전 한 곳에 있습니다.
컴포넌트에 한국어를 직접 쓰지 마세요 — 영어 빌드에 한국어가 섞여 나갑니다.

영어 사전은 한국어 사전의 타입(`typeof ko`)을 그대로 만족해야 하므로,
**한쪽에만 키를 추가하면 `astro check`가 실패합니다.** 번역 누락을 잡는 장치는 이것뿐입니다.

### 언어 추가하기

`src/config/i18n.ts`의 `LOCALES`에 코드를 넣고 `LANG_META`·`UI`에 항목을 추가한 뒤,
`src/pages/en/` 아래 파일들을 그대로 복사한 폴더를 만듭니다. 페이지 파일은 전부
`src/components/views/`의 뷰 하나를 부르는 한 줄짜리라 복사만 하면 됩니다.

---

## 4. 새 글 쓰기

1. `src/content/posts/_template.paper-review.mdx` 또는 `_template.project.mdx`를 복사합니다.
   (밑줄로 시작하는 파일은 컬렉션에서 제외되므로 템플릿 자체는 사이트에 나오지 않습니다.)
2. `src/content/posts/<카테고리>/<슬러그>.mdx`로 저장합니다.
3. 프론트매터를 채웁니다. `draft: true`인 동안에는 개발 서버에서만 보입니다.
4. 다 쓰면 `draft` 줄을 지우거나 `false`로 바꾸고 커밋합니다.

### 프론트매터

| 필드                 | 필수 | 설명                                                                    |
| -------------------- | ---- | ----------------------------------------------------------------------- |
| `slug`               | ✔   | URL 세그먼트. 소문자·숫자·하이픈만. **슬래시를 쓸 수 없습니다**         |
| `lang`               |      | `ko`(기본) / `en`. 번역본을 쓸 때만 지정합니다 → [3장](#3-한국어--영어) |
| `title`              | ✔   | 120자 이내                                                              |
| `description`        | ✔   | 200자 이내. 카드·검색·RSS·OG에 공용으로 쓰입니다                        |
| `category`           | ✔   | `paper-review` / `project` / `notes`                                    |
| `date`               | ✔   | 최초 게시일. 목록 정렬과 아카이브 그룹 기준                             |
| `updated`            |      | 수정일. 있으면 상세 헤더에 "수정: ..."이 붙습니다                       |
| `tags`               |      | 배열. 항목당 24자 이내                                                  |
| `draft`              |      | `true`면 프로덕션 빌드에서 완전히 제외됩니다                            |
| `cover` / `coverAlt` |      | 커버 이미지와 설명. `cover`가 있으면 `coverAlt`는 필수입니다            |
| `math`               |      | `true`인 글에만 KaTeX CSS가 실립니다                                    |
| `toc`                |      | 기본 `true`. `false`면 목차 없이 본문을 가운데 정렬합니다               |
| `paper`              | ▲    | `category: paper-review`면 **필수**                                     |
| `project`            | ▲    | `category: project`면 **필수**                                          |

프론트매터가 스키마에 어긋나면 **빌드가 실패합니다.** 경고 후 넘어가지 않습니다 —
잘못된 프론트매터가 조용히 배포되면 화면이 깨진 채로 공개되기 때문입니다.

### 수식과 코드

- 수식: `$인라인$`, `$$블록$$` (`math: true`인 글에서만 스타일이 실립니다)
- 코드: 백틱 세 개 + 언어 이름. 라이트/다크 듀얼 테마로 하이라이팅되고 복사 버튼이 붙습니다
- MDX에서는 `src/components/`의 컴포넌트를 직접 import 해 쓸 수 있습니다

---

## 5. 카테고리 추가하기

**페이지 파일을 만들지 않습니다.** 두 단계로 끝납니다.

1. `src/config/categories.ts`의 `CATEGORIES` 배열에 항목을 추가합니다.

   ```ts
   {
     id: 'seminar',
     label: 'Seminar',        // 상단 바·배지 표기. 두 언어 공통입니다
     labelKo: '세미나',        // 한국어 목록 부제에 쓰입니다
     description: {           // 언어별로 반드시 둘 다 씁니다
       ko: '세미나에서 들은 내용을 정리합니다.',
       en: 'Notes from the seminars I attended.',
     },
     icon: 'lucide:presentation',
     order: 4,
     metaPanel: 'none',   // paper | project | none
   }
   ```

2. `src/content/posts/seminar/` 폴더를 만듭니다.

내비게이션 항목, 목록 페이지, 페이지네이션, 글 상세, 아카이브, RSS가 **한국어·영어 양쪽 모두** 자동으로 따라옵니다.
`metaPanel`을 `paper` 또는 `project`로 두면 해당 메타 블록이 프론트매터 필수가 됩니다.

카테고리를 지우려면 배열에서 항목을 빼고 해당 폴더의 글을 옮기거나 지웁니다.

---

## 6. 사이트 설정

| 파일                       | 담는 것                                                                |
| -------------------------- | ---------------------------------------------------------------------- |
| `src/config/site.ts`       | 사이트 제목·설명·내비 순서·페이지 크기. **제목은 여기서만 정의합니다** |
| `src/config/i18n.ts`       | 언어 정의와 화면 문구 사전. **UI 문자열은 여기서만 정의합니다**        |
| `src/config/categories.ts` | 카테고리 단일 정의 지점                                                |
| `src/config/profile.ts`    | 프로필                                                                 |
| `astro.config.mjs`         | `site` 절대 URL. 다른 호스트로 옮길 때 바꿀 값은 이것 하나뿐입니다     |
| `src/styles/global.css`    | 디자인 토큰 (`[verified]` / `[local extension]` 출처 주석 포함)        |

### 환경변수 (선택)

| 이름                      | 설명                                                                          |
| ------------------------- | ----------------------------------------------------------------------------- |
| `PUBLIC_SITE_URL`         | canonical/OG URL을 덮어씁니다. 프리뷰 배포에서만 씁니다                       |
| `PUBLIC_GOATCOUNTER_CODE` | GoatCounter 사이트 코드. 없으면 분석 스크립트도 푸터 고지도 출력하지 않습니다 |

> **정적 빌드이므로 모든 환경변수가 산출물에 평문으로 남습니다.**
> 토큰·API 키·비공개 이메일 같은 비밀 값을 넣지 마세요.

---

## 7. 배포

이 리포지토리는 `stu-eonho.github.io`(사용자 사이트)로 배포하도록 이미 설정되어 있습니다.
`astro.config.mjs`의 `site`와 `src/config/site.ts`의 `url`이 `https://stu-eonho.github.io`를 가리킵니다.
`base`는 건드리지 않습니다 — 사용자 사이트에서 `base`를 설정하면 모든 자산 경로가 어긋납니다.

1. 리포지토리 이름이 `stu-eonho.github.io`인지 확인합니다.
2. 이 프로젝트를 그 리포지토리의 `main` 브랜치로 push합니다.
3. Settings → Pages → **Source를 "GitHub Actions"로 설정**합니다.
   "Deploy from a branch"를 고르면 Jekyll 파이프라인을 타서 `_astro/` 자산이 누락될 수 있습니다.
4. Settings → Pages → **Enforce HTTPS**를 켭니다.
5. `main`에 push하면 `.github/workflows/deploy.yml`이 빌드·배포합니다.
6. 첫 배포 뒤 `https://stu-eonho.github.io`와 `https://stu-eonho.github.io/en`이 모두 열리는지 확인합니다.

> 다른 주소로 옮길 때 바꿀 값은 `astro.config.mjs`의 `site`와 `src/config/site.ts`의 `url` 두 곳입니다.
> 이 값이 틀리면 canonical·OG·hreflang·사이트맵·RSS가 전부 잘못된 도메인을 가리킵니다.

타입 오류가 있거나 내부 링크가 깨지면 build 잡이 실패하고 **배포는 일어나지 않습니다.**

### 되돌리기

1. 문제가 된 커밋을 `git revert`하고 push합니다 → 자동 재배포. 이력이 남아 추적할 수 있습니다.
2. 또는 Actions에서 마지막 정상 실행을 "Re-run all jobs"로 재실행합니다.

`gh-pages` 브랜치를 손으로 고치지 마세요. Actions 기반 배포에는 그런 브랜치가 없고, 수동 개입은 다음 배포에서 덮어써집니다.

---

## 8. 이 사이트에 없는 것

의도적으로 넣지 않았습니다. 다시 논의하기 전에는 추가하지 않습니다.

- 서버·데이터베이스·런타임 API — 모든 데이터는 빌드 타임에 이 리포지토리의 파일에서 옵니다
- 댓글 기능 — 자리표시자나 주석 처리된 코드도 남기지 않습니다
- 로그인·회원가입·관리자 화면
- 조회수·좋아요 등 서버 상태가 필요한 인터랙션
- 자동 번역 — 영어 글은 사람이 쓴 번역본만 실립니다
- 브라우저 언어 감지 자동 리다이렉트 — 정적 호스팅이라 리다이렉트를 만들 수 없고,
  사용자가 고른 언어를 임의로 덮어쓰지 않기 위해서이기도 합니다
- 논문 PDF 원문 호스팅 — 저작권상 외부 링크(`paper.pdfUrl`)만 저장합니다

---

## 9. 디자인과 모션

- 디자인 토큰의 출처는 리포지토리 루트의 `DESIGN.md`입니다. **이 파일은 수정하지 않습니다.**
  값을 바꿔야 하면 `src/styles/global.css`에 `[local extension]` 주석과 함께 확장 토큰을 추가합니다.
- 색상·크기·radius는 전부 `global.css`의 CSS 변수를 경유합니다. 컴포넌트에 색상 리터럴을 쓰지 않습니다.
- 모션은 진입 리빌 한 겹뿐입니다(페이드 + 8px 상승 + 시차). 페이지 전환 애니메이션은 없습니다.
- `prefers-reduced-motion: reduce`에서는 전환과 애니메이션이 멈추고, anime.js를 아예 내려받지 않습니다.
- JavaScript가 없어도 모든 페이지의 콘텐츠를 읽고 링크로 탐색할 수 있습니다.
  JS 없이 잃는 기능은 검색, 테마 토글, 모바일 시트, 목차 하이라이트, 코드 복사뿐입니다.
  **언어 전환은 JS 없이도 동작합니다** — 링크이기 때문입니다.
