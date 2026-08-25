import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { postSchema } from './content/schema';

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
  /**
   * CRITICAL: 스키마 정의는 `src/content/schema.ts` 한 곳에만 있다.
   * 관리자 콘솔(`admin/`)이 저장 전 검증에 같은 팩토리를 쓴다 — 여기에 규칙을 되돌려
   * 인라인하면 두 벌이 갈라지고, 관리자가 통과시킨 글이 빌드에서 깨진다.
   */
  schema: ({ image }) => postSchema({ image }),
});

export const collections = { posts };
