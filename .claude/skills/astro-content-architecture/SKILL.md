---
name: astro-content-architecture
description: Astro 7 정적 사이트의 콘텐츠 아키텍처를 구축한다. Content Layer + Zod 스키마, 카테고리를 데이터로 다루는 동적 라우트, getStaticPaths 페이지네이션, 조건부 프론트매터 검증(superRefine), 순수 함수 lib 헬퍼 작업 시 반드시 사용할 것. "카테고리 추가", "content.config.ts", "getStaticPaths", "라우트 충돌", "프론트매터 스키마", "빌드 타임 생성", "페이지네이션" 요청이나 Astro 콘텐츠 컬렉션 관련 오류 해결에 적용한다. 런타임 데이터 페치가 필요한 SSR 프로젝트에는 사용하지 않는다.
---

# Astro Content Architecture — 카테고리를 데이터로

## 이 스킬이 지키는 원칙

**새 카테고리를 추가하는 일이 코드 편집이 되어서는 안 된다.** 설정 파일에 항목 하나를 넣고 폴더를 만드는 것으로 끝나야 한다. 페이지 파일이나 라우트를 새로 만들어야 한다면 아키텍처가 이미 실패한 것이다.

이 원칙이 무너지는 지점은 항상 같다: 카테고리 문자열이 두 곳 이상에 존재하게 되는 순간. 그때부터 추가·이름 변경마다 누락이 생긴다.

## 1. 단일 정의 지점에서 타입을 파생한다

```ts
// src/config/categories.ts
export const CATEGORIES = [
  { id: 'paper-review', label: 'Paper Review', description: '...', icon: 'lucide:file-text' },
  { id: 'project', label: 'Project', description: '...', icon: 'lucide:folder-git-2' },
  { id: 'notes', label: 'Notes', description: '...', icon: 'lucide:notebook-pen' },
] as const;

// 타입은 배열에서 파생한다. 손으로 유니온을 쓰지 않는다.
export type CategoryId = (typeof CATEGORIES)[number]['id'];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];
export const getCategory = (id: string) => CATEGORIES.find((c) => c.id === id);
```

`as const`가 핵심이다. 이게 없으면 `id`가 `string`으로 넓어지고 타입 파생 체인 전체가 끊어진다.

`CATEGORY_IDS`의 타입 단언은 Zod의 `z.enum()`이 최소 1개 원소를 가진 튜플을 요구하기 때문이다.

**아래 전부가 이 파일 하나에서만 파생되어야 한다:**

- Zod 스키마의 `category` enum
- 각 카테고리 라우트의 `getStaticPaths()`
- 내비게이션 항목
- 카테고리 목록 페이지의 헤더·설명·아이콘

**검증 방법:** 항목 하나를 추가하고 `src/content/posts/<id>/` 폴더를 만든다. **다른 파일을 한 줄도 고치지 않고** 새 카테고리 페이지가 빌드되면 통과다. 한 줄이라도 고쳐야 한다면 그 파일이 파생 체인 밖에 있다는 뜻이니 고쳐라.

## 2. 조건부 검증은 `superRefine`으로 강제한다

카테고리마다 필수 메타가 다르다. 논문 리뷰에는 저자·학회가, 프로젝트에는 기간·역할이 필요하다. 이걸 옵셔널 필드로 두면 **메타 패널이 빈 채로 배포된다.**

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { CATEGORY_IDS } from './config/categories';

const posts = defineCollection({
  // _로 시작하는 템플릿 파일을 제외한다
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/posts' }),
  schema: z
    .object({
      title: z.string().max(120),
      description: z.string().max(200),
      category: z.enum(CATEGORY_IDS),
      publishedAt: z.coerce.date(),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      math: z.boolean().default(false),
      paper: z
        .object({
          /* authors, venue, year, arxiv, doi, code ... */
        })
        .optional(),
      project: z
        .object({
          /* period, role, stack, repo, demo, status ... */
        })
        .optional(),
    })
    .superRefine((data, ctx) => {
      if (data.category === 'paper-review' && !data.paper) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['paper'],
          message: "category가 'paper-review'인 글에는 paper 블록이 필수입니다.",
        });
      }
      if (data.category === 'project' && !data.project) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['project'],
          message: "category가 'project'인 글에는 project 블록이 필수입니다.",
        });
      }
    }),
});

export const collections = { posts };
```

**에러 메시지에 무엇을 고쳐야 하는지 쓴다.** 빌드가 실패하는 순간 작성자가 보는 유일한 안내다. "Invalid input"으로는 아무도 못 고친다.

**스키마 위반은 경고가 아니라 빌드 실패여야 한다.** Astro의 기본 동작이 그렇지만, 이걸 우회하는 설정을 추가하지 않는다.

## 3. 라우트 충돌을 설계 시점에 차단한다

```
src/pages/
├── [category]/
│   ├── index.astro          # /paper-review
│   ├── [slug].astro         # /paper-review/my-post     ← 단일 세그먼트
│   └── page/[page].astro    # /paper-review/page/2
```

**`[slug].astro`를 `[...slug].astro`(rest 파라미터)로 만들면 `/paper-review/page/2`를 잡아채서 페이지네이션이 깨진다.** 라우트 파일을 만드는 시점에 고정하고 나중에 바꾸지 않는다. 이 충돌은 글이 몇 개 없을 때(2페이지가 없을 때)는 드러나지 않다가 나중에 터진다.

`getStaticPaths()`에서 카테고리를 순회한다:

```ts
export async function getStaticPaths() {
  const all = await getPublishedPosts();
  return CATEGORIES.map((cat) => ({
    params: { category: cat.id },
    props: { posts: all.filter((p) => p.data.category === cat.id), category: cat },
  }));
}
```

페이지네이션 라우트는 1페이지를 **생성하지 않는다** — `[category]/index.astro`가 이미 처리한다. 중복 생성하면 같은 내용이 두 URL에 존재해 SEO가 나빠진다.

```ts
// page/[page].astro — 2페이지부터
const pages = Math.ceil(posts.length / PER_PAGE);
for (let p = 2; p <= pages; p++) {
  /* ... */
}
```

## 4. draft 제외는 한 곳에서만 한다

```ts
// src/lib/posts.ts
export async function getPublishedPosts() {
  const posts = await getCollection('posts', ({ data }) =>
    import.meta.env.PROD ? !data.draft : true,
  );
  return posts.sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf());
}
```

`getCollection()`을 직접 부르는 곳이 두 곳 이상이 되면, 언젠가 한 곳에서 draft 필터를 빠뜨리고 미완성 글이 배포된다. **모든 조회는 이 함수를 거친다.**

dev에서는 draft를 보여주고 prod에서만 제외하는 것이 위 구현의 의도다. 따라서 **draft 동작은 `npm run build && npm run preview`로만 검증된다.** dev 서버에서 확인한 결과는 의미가 없다.

## 5. lib 함수는 순수 함수로 둔다

단위 테스트 프레임워크를 도입하지 않는 프로젝트에서, 순수성이 유일한 안전망이다.

```ts
// 좋다 — 입력만으로 출력이 결정된다
export function paginate<T>(items: T[], page: number, perPage: number) {
  const total = Math.ceil(items.length / perPage);
  return { items: items.slice((page - 1) * perPage, page * perPage), page, total };
}

// 나쁘다 — 전역 상태에 의존해 결과를 예측할 수 없다
let cache: Post[] = [];
export function paginate(page: number) {
  return cache.slice(/* ... */);
}
```

`slugify`는 특히 주의한다. 태그 URL의 안정성이 여기 달렸고, **태그 목록 페이지와 태그 상세 페이지가 같은 함수를 써야** 링크가 안 깨진다. 한글 태그를 다룬다면 어떻게 처리할지(음차 변환 / URL 인코딩 유지 / 원문 보존) 정하고 한 곳에만 구현한다.

## 6. 런타임 데이터 접근을 쓰지 않는다

이 프로젝트는 100% 빌드 타임 정적 생성이다. 다음이 소스에 존재해서는 안 된다:

- `fetch()` — 빌드 타임 페치조차 콘텐츠 소스로 쓰지 않는다. 단일 진실 공급원은 Git 리포지토리의 파일이다
- DB 클라이언트, 서버리스 핸들러, API 라우트
- `output: 'server'` / `'hybrid'` 설정

모든 쿼리는 `getCollection()` 결과에 대한 **배열 연산**이다. 태그 집계도 아카이브 연도 그룹도 전부 `reduce`와 `filter`다.

`grep -rn "fetch(" src/`로 주기적으로 확인한다.

## 7. 빌드 게이트

```json
{ "scripts": { "build": "astro check && astro build" } }
```

`astro check`가 **선행**한다. 타입 오류가 있는 상태로 배포되면 안 된다. 이 순서를 바꾸거나 `astro check`를 빼는 "빠른 빌드" 스크립트를 만들지 않는다 — 만드는 순간 그게 기본값이 된다.

## 흔한 함정

| 증상                                | 원인                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| 새 카테고리 페이지가 404            | `content/posts/<id>/` 폴더가 없거나, 폴더에 글이 0편(빈 컬렉션이면 경로가 생성되지 않을 수 있음) |
| 페이지네이션 2페이지가 404          | `[slug]`를 rest 파라미터로 만들어 충돌                                                           |
| 템플릿 파일이 글 목록에 나타남      | glob 패턴에서 `_` 접두 파일을 제외하지 않음                                                      |
| 메타 패널이 빈 채로 렌더            | `superRefine` 조건부 검증 부재                                                                   |
| dev에선 되는데 배포하면 글이 사라짐 | draft 필터. 의도된 동작인지 확인                                                                 |
| 태그 링크 404                       | `slugify`가 두 곳에 다르게 구현됨                                                                |
| `astro check` peer 충돌             | TypeScript 7.x 설치. `@astrojs/check`의 peer는 `^5 \|\| ^6` — 6.0.3으로 고정                     |
