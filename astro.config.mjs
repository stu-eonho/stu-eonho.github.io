// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import pagefind from 'astro-pagefind';
import tailwindcss from '@tailwindcss/vite';
import { createMarkdownOptions } from './markdown.config.mjs';
import adminConsole from './admin/integration.mjs';

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
    /**
     * 로컬 전용 관리자 콘솔(`/admin`).
     *
     * CRITICAL: `pagefind()` 뒤에 둔다 — 앞에 두면 관리자가 주입한 라우트가 Pagefind
     * 인덱싱 대상 판단에 끼어들 여지가 생긴다.
     *
     * CRITICAL: 이 인테그레이션은 `command === 'dev'`가 아니면 라우트·미들웨어·Vite
     * 플러그인을 하나도 등록하지 않는다. 프로덕션 경로에 남는 것은 `astro:build:done`
     * 가드 하나뿐이며, 그 훅은 산출물을 만들지 않고 검사만 한다.
     */
    adminConsole(),
  ],
  markdown: createMarkdownOptions(),
  vite: {
    plugins: [tailwindcss()],
  },
});
