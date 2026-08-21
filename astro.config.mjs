// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import pagefind from 'astro-pagefind';
import tailwindcss from '@tailwindcss/vite';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// CRITICAL: `<username>.github.io` 사용자 사이트다. `base`를 설정하면 모든 자산 경로가 한 단계
// 어긋나므로 기본값 `/`를 유지한다. 다른 호스트로 옮길 때 바꿀 값은 아래 `site` 하나뿐이다.
const SITE = process.env.PUBLIC_SITE_URL ?? 'https://stu-eonho.github.io';

export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [
    mdx(),
    // 사이트맵이 `/`와 `/en/` 짝을 hreflang alternate로 묶어 준다.
    // defaultLocale은 접두사가 없는 언어여야 한다 — i18n.ts의 DEFAULT_LANG과 같은 값이다.
    sitemap({
      i18n: {
        defaultLocale: 'ko',
        locales: { ko: 'ko-KR', en: 'en-US' },
      },
    }),
    icon(),
    pagefind(),
  ],
  markdown: {
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
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
