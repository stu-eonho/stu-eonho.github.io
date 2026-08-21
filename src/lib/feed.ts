/**
 * 언어별 RSS 피드 조립.
 * `/rss.xml`(한국어)과 `/en/rss.xml`(영어)이 이 함수 하나를 공유한다.
 */
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE } from '@/config/site';
import { getPublishedPosts, postHref, postsForLang } from '@/lib/posts';
import { getCategory } from '@/config/categories';
import { LANG_META, withLang, type Lang } from '@/config/i18n';

/** 피드 자신의 절대 URL. `<atom:link rel="self">`가 가리키는 값이다. */
function feedUrl(lang: Lang): string {
  return `${SITE.url.replace(/\/$/, '')}${withLang('/rss.xml', lang)}`;
}

export async function buildFeed(context: APIContext, lang: Lang): Promise<Response> {
  // CRITICAL: postsForLang을 거친다. 전체 글을 그대로 쓰면 같은 글이 언어별로 두 번 실린다.
  const posts = postsForLang(await getPublishedPosts(), lang).slice(0, SITE.rssItemLimit);
  const site = context.site ?? new URL(SITE.url);

  return rss({
    title: SITE.title,
    description: SITE.description[lang],
    site,
    trailingSlash: false,
    // 언어별 피드가 각자의 self 링크를 갖는다 — 리더가 둘을 별개 구독으로 인식한다.
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    customData: [
      `<language>${LANG_META[lang].rssLanguage}</language>`,
      `<atom:link href="${feedUrl(lang)}" rel="self" type="application/rss+xml" />`,
    ].join(''),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: postHref(post, lang),
      categories: [getCategory(post.data.category).label, ...post.data.tags],
    })),
  });
}
