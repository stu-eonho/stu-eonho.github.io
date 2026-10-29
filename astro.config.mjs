// @ts-check
import { readFileSync } from 'node:fs';
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

/**
 * `<meta name="robots" content="noindex">`를 단 페이지는 사이트맵에서도 뺀다.
 *
 * 사이트맵의 `filter`는 `astro:build:done`에서 불리므로 그 시점에는 페이지 HTML이 이미 디스크에
 * 있다. 그래서 "색인할지"의 판단을 페이지 쪽(`SeoInput.noindex`) 한 곳에만 두고, 여기서는 빌드된
 * HTML을 읽어 따른다. 예: Side B는 `MUSIC`이 비어 있는 동안 noindex이며, 곡을 담으면 사이트맵에도
 * 자동으로 다시 들어간다. (`src/config/music.ts`를 직접 import하지 않는 이유 — 이 파일은
 * `import.meta.glob`으로 커버 이미지를 모으는 TS 모듈이라 설정 파일에서 불러 쓰기에 무겁고, 같은
 * 판단을 두 군데에 두게 된다.)
 *
 * `outDir`는 `astro:config:done`에서 받는다 — `--outDir`로 바꿔 빌드해도 맞는 폴더를 읽는다.
 */
/** @type {URL} */
let outDir = new URL('./dist/', import.meta.url);
const NOINDEX_META = /<meta\s+name="robots"\s+content="[^"]*\bnoindex\b/i;

/** @param {string} pageUrl 사이트맵 후보의 절대 URL */
function isNoindexPage(pageUrl) {
  const relative = decodeURIComponent(new URL(pageUrl).pathname).replace(/^\//, '');
  const file =
    relative === '' || relative.endsWith('/')
      ? `${relative}index.html`
      : relative.endsWith('.html')
        ? relative
        : `${relative}/index.html`;
  try {
    return NOINDEX_META.test(readFileSync(new URL(file, outDir), 'utf8'));
  } catch {
    return false; // HTML이 아니거나 찾지 못한 경로는 기존대로 사이트맵에 둔다
  }
}

export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [
    mdx(),
    {
      name: 'local:noindex-out-dir',
      hooks: {
        'astro:config:done': ({ config }) => {
          outDir = config.outDir;
        },
      },
    },
    // 사이트맵이 `/`와 `/en/` 짝을 hreflang alternate로 묶어 준다.
    // defaultLocale은 접두사가 없는 언어여야 한다 — i18n.ts의 DEFAULT_LANG과 같은 값이다.
    sitemap({
      i18n: {
        defaultLocale: 'ko',
        locales: { ko: 'ko-KR', en: 'en-US' },
      },
      // noindex 페이지 제외 — 위 `isNoindexPage` 주석 참조
      filter: (page) => !isNoindexPage(page),
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
