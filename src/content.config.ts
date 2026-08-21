import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { CATEGORY_IDS, getCategory } from './config/categories';
import { DEFAULT_LANG, LANG_IDS } from './config/i18n';

const posts = defineCollection({
  // CRITICAL: 밑줄로 시작하는 템플릿 파일(_template.*.mdx)을 컬렉션에서 제외한다.
  loader: glob({
    pattern: ['**/*.{md,mdx}', '!**/_*'],
    base: './src/content/posts',
    /**
     * CRITICAL: 기본 id 생성기는 `intl-date-format.en.md`와 `intl-date-format.md`를
     * 같은 id로 접는다(디렉터리와 중간 확장자가 함께 사라진다). 그러면 번역본 한쪽이
     * 조용히 다른 쪽을 덮어써서 원문이 통째로 사라진다 — 빌드는 성공하고 페이지 수도
     * 그대로라서 알아채기 어렵다.
     *
     * 확장자만 떼고 경로를 그대로 id로 쓴다. 언어 접미사가 id에 남아 두 파일이 구분된다.
     */
    generateId: ({ entry }) => entry.replace(/\.mdx?$/, ''),
  }),
  schema: ({ image }) =>
    z
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
        title: z.string().max(120, 'title은 120자 이내여야 합니다'),
        description: z.string().max(200, 'description은 200자 이내여야 합니다'),
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
              start: z
                .string()
                .regex(/^\d{4}-\d{2}$/, 'period.start는 "YYYY-MM" 형식이어야 합니다'),
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
      }),
});

export const collections = { posts };
