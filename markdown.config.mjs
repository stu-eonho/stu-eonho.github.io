// @ts-check
/**
 * 빌드와 관리자 프리뷰가 공유하는 마크다운 옵션.
 *
 * CRITICAL: 팩토리다. 상수 객체로 두고 재사용하면 unified 프로세서 인스턴스가
 * 빌드와 프리뷰 요청 사이에 공유되어 상태가 섞인다.
 *
 * 관리자 프리뷰가 이 팩토리를 쓰는 이유는 "프리뷰에서 보이는 것"과 "빌드된 페이지"가
 * 갈라지지 않게 하기 위해서다. 여기에 플러그인을 추가하면 양쪽에 동시에 반영된다.
 */
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

/**
 * CRITICAL: 반환 타입을 명시한다. 팩토리로 감싸면 `themes`의 문자열 리터럴이 `string`으로
 * 넓어져 Shiki 테마 타입에 맞지 않는다 — 인라인 객체일 때는 `defineConfig`가 문맥 타입을
 * 줬지만 여기에는 그 문맥이 없다.
 *
 * @returns {NonNullable<import('astro').AstroUserConfig['markdown']>}
 */
export function createMarkdownOptions() {
  return {
    // Astro 7에서 remarkPlugins/rehypePlugins 직접 지정은 deprecated다.
    // 기본 프로세서를 unified()로 확장한다.
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [[rehypeKatex, { strict: false }]],
    }),
    shikiConfig: {
      // 듀얼 테마 — 다크 모드는 prose.css가 CSS 변수를 교체해 처리한다
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  };
}
