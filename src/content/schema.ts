/**
 * 글 프론트매터 스키마의 유일한 정의.
 *
 * CRITICAL: `image`를 주입받는 이유는 Astro의 content loader가 넘겨주는 `image()`와
 * 관리자 검증기가 넘기는 대체 검증기를 같은 스키마로 쓰기 위해서다. 관리자에 규칙을
 * 복제하면 두 벌이 조용히 갈라진다 — 관리자가 통과시킨 글이 빌드에서 깨지거나, 그 반대가 된다.
 *
 * 관리자는 `postSchema({ image: () => z.string() })`로 호출하고, 반환된 문자열 경로가
 * 실제 파일로 존재하는지는 별도로 검사한다(참조 무결성 관문).
 *
 * CRITICAL: `TImage`를 제네릭으로 둔다. `image: () => z.ZodTypeAny`로 고정하면 `cover`의
 * 추론 타입이 `{}`로 넓어져 `<Image src={post.data.cover}>`가 `astro check`에서 깨진다 —
 * 주입 지점을 열어 두되 호출자의 실제 스키마 타입은 그대로 흘려보내야 한다.
 */
import { z } from 'astro/zod';
import { CATEGORY_IDS, getCategory } from '../config/categories';
import { DEFAULT_LANG, LANG_IDS } from '../config/i18n';

export function postSchema<TImage extends z.ZodTypeAny>({ image }: { image: () => TImage }) {
  return z
    .object({
      slug: z
        .string()
        .regex(
          /^[a-z0-9-]+$/,
          'slug는 소문자·숫자·하이픈만 허용하며 슬래시를 포함할 수 없습니다 (라우트가 단일 세그먼트입니다)',
        ),
      /**
       * 글의 언어. 생략하면 한국어다.
       *
       * 같은 `category` + `slug`를 가진 파일이 언어별로 하나씩 존재할 수 있다.
       * 예) `attention.mdx`(ko) + `attention.en.mdx`(lang: 'en')
       * 번역본이 없는 언어에서는 원문이 그대로 노출되고 안내 배너가 붙는다.
       */
      lang: z.enum(LANG_IDS).default(DEFAULT_LANG),
      /**
       * CRITICAL: `.min(1)`이 있어야 한다. 빈 문자열도 `z.string()`을 통과하는데,
       * 프론트매터 직렬화는 빈 값을 키째로 생략한다 — 그 결과 `description` 키가 없는
       * 파일이 만들어지고, 다시 읽을 때 "Required"로 실패해 **dev 서버와 빌드가 함께
       * 죽는다.** 실제로 그렇게 죽었다. 여기서 막아야 관리자가 저장 전에 잡는다.
       *
       * `.trim()`이 먼저 오는 이유: 공백만 있는 값(`'   '`)은 `.min(1)`을 통과한다.
       * 다듬은 뒤에 길이를 재야 "빈 제목"이 실제로 막힌다.
       */
      title: z
        .string()
        .trim()
        .min(1, 'title은 비울 수 없습니다')
        .max(120, 'title은 120자 이내여야 합니다'),
      description: z
        .string()
        .trim()
        .min(1, 'description은 비울 수 없습니다')
        .max(200, 'description은 200자 이내여야 합니다'),
      category: z.enum(CATEGORY_IDS, {
        message: `category는 다음 중 하나여야 합니다: ${CATEGORY_IDS.join(', ')}`,
      }),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      tags: z.array(z.string().max(24, '태그는 항목당 24자 이내여야 합니다')).default([]),
      draft: z.boolean().default(false),
      cover: image().optional(),
      coverAlt: z.string().optional(),
      math: z.boolean().default(false),
      toc: z.boolean().default(true),
      paper: z
        .object({
          paperTitle: z.string(),
          authors: z.array(z.string()).min(1, 'authors는 최소 1명이 필요합니다'),
          venue: z.string(),
          year: z
            .number()
            .int()
            .min(1950, 'year는 1950 이상이어야 합니다')
            .max(new Date().getFullYear() + 1, 'year가 너무 미래입니다'),
          arxivId: z.string().optional(),
          doi: z.string().optional(),
          pdfUrl: z.url().optional(),
          codeUrl: z.url().optional(),
          readDate: z.coerce.date().optional(),
        })
        .optional(),
      project: z
        .object({
          role: z.string(),
          period: z.object({
            start: z.string().regex(/^\d{4}-\d{2}$/, 'period.start는 "YYYY-MM" 형식이어야 합니다'),
            end: z
              .string()
              .regex(/^\d{4}-\d{2}$/, 'period.end는 "YYYY-MM" 형식이거나 null이어야 합니다')
              .nullable(),
          }),
          stack: z.array(z.string()).min(1, 'stack은 최소 1개가 필요합니다'),
          status: z.enum(['in-progress', 'completed', 'archived']),
          repoUrl: z.url().optional(),
          demoUrl: z.url().optional(),
          teamSize: z.number().int().min(1).optional(),
        })
        .optional(),
    })
    .superRefine((data, ctx) => {
      // CRITICAL: 카테고리별 필수 메타를 여기서 강제한다.
      // 이게 없으면 메타 패널이 빈 채로 배포된다.
      const panel = getCategory(data.category).metaPanel;
      if (panel === 'paper' && !data.paper) {
        ctx.addIssue({
          code: 'custom',
          path: ['paper'],
          message: `category: "${data.category}" 글에는 paper 블록이 필요합니다 (paperTitle, authors, venue, year)`,
        });
      }
      if (panel === 'project' && !data.project) {
        ctx.addIssue({
          code: 'custom',
          path: ['project'],
          message: `category: "${data.category}" 글에는 project 블록이 필요합니다 (role, period, stack, status)`,
        });
      }
      if (data.cover && !data.coverAlt) {
        ctx.addIssue({
          code: 'custom',
          path: ['coverAlt'],
          message: 'cover를 지정했으면 coverAlt(스크린리더용 설명)가 필요합니다',
        });
      }
    });
}
