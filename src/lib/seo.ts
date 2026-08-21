/** canonical / OG / Twitter / hreflang 메타와 JSON-LD 조립. */
import { SITE } from '@/config/site';
import { PROFILE, isPlaceholder, type Profile } from '@/config/profile';
import {
  DEFAULT_LANG,
  LANG_META,
  LOCALES,
  text,
  textList,
  withLang,
  type Lang,
} from '@/config/i18n';

export interface SeoInput {
  title?: string;
  description?: string;
  /**
   * **언어 접두사를 뺀** 정규 경로. 예: "/paper-review/attention"
   * hreflang 짝을 여기서 파생하므로, `/en/...`을 넣으면 안 된다.
   */
  path: string;
  lang: Lang;
  ogImage?: string;
  type?: 'website' | 'article';
  publishedTime?: Date;
  modifiedTime?: Date;
  tags?: string[];
  /**
   * canonical을 다른 언어 쪽으로 넘긴다.
   * 번역본이 없어 원문을 그대로 실은 페이지가 이 값을 쓴다 — 같은 본문이 두 URL에 있으면
   * 검색엔진이 중복으로 보고 양쪽 평가를 함께 깎는다. 원문 URL 하나로 몰아 준다.
   */
  canonicalLang?: Lang;
}

export interface Alternate {
  hreflang: string;
  href: string;
}

export interface SeoMeta {
  title: string;
  fullTitle: string;
  description: string;
  canonical: string;
  ogImage: string;
  ogLocale: string;
  htmlLang: string;
  lang: Lang;
  type: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  tags: string[];
  /** `<link rel="alternate" hreflang>` 목록. x-default가 마지막에 붙는다 */
  alternates: Alternate[];
}

function absolute(path: string): string {
  const base = SITE.url.replace(/\/$/, '');
  if (/^https?:\/\//.test(path)) return path;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function buildSeo(input: SeoInput): SeoMeta {
  const { lang } = input;
  const meta = LANG_META[lang];
  const title = input.title?.trim() || SITE.title;
  const canonicalLang = input.canonicalLang ?? lang;

  return {
    title,
    // CRITICAL: 사이트 제목은 site.ts에서만 온다. 여기서 문자열을 다시 쓰지 않는다.
    fullTitle: title === SITE.title ? SITE.title : `${title} · ${SITE.title}`,
    description: input.description?.trim() || SITE.description[lang],
    canonical: absolute(withLang(input.path, canonicalLang)),
    ogImage: absolute(input.ogImage ?? SITE.defaultOgImage),
    ogLocale: meta.ogLocale,
    htmlLang: meta.htmlLang,
    lang,
    type: input.type ?? 'website',
    publishedTime: input.publishedTime?.toISOString(),
    modifiedTime: input.modifiedTime?.toISOString(),
    tags: input.tags ?? [],
    alternates: [
      ...LOCALES.map((locale) => ({
        hreflang: LANG_META[locale].htmlLang,
        href: absolute(withLang(input.path, locale)),
      })),
      // x-default — 언어를 특정할 수 없는 방문자가 도착할 기본 URL
      { hreflang: 'x-default', href: absolute(withLang(input.path, DEFAULT_LANG)) },
    ],
  };
}

/** 플레이스홀더 값은 구조화 데이터에 넣지 않는다. */
function clean(value: string | undefined): string | undefined {
  if (!value || isPlaceholder(value)) return undefined;
  return value;
}

/** 홈에 삽입하는 Person JSON-LD */
export function personJsonLd(lang: Lang, profile: Profile = PROFILE): string {
  const affiliation = profile.education[0];
  const currentJob = profile.career.find((entry) => entry.endDate === null);
  const sameAs = profile.links.map((l) => l.url).filter((url) => !isPlaceholder(url));
  const school = affiliation ? text(affiliation.school, lang) : undefined;
  const company = currentJob ? text(currentJob.company, lang) : undefined;

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: clean(text(profile.name, lang)) ?? SITE.title,
    alternateName: clean(text(profile.nameEn, lang)),
    description: clean(text(profile.bio, lang)),
    email: clean(text(profile.email, lang)),
    url: absolute(withLang('/', lang)),
    affiliation: clean(school) ? { '@type': 'Organization', name: school } : undefined,
    worksFor: clean(company) ? { '@type': 'Organization', name: company } : undefined,
    jobTitle: currentJob ? clean(text(currentJob.role, lang)) : undefined,
    knowsAbout: textList(profile.interests, lang).filter((i) => !isPlaceholder(i)),
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  });
}

export interface ArticleJsonLdInput {
  headline: string;
  description: string;
  datePublished: Date;
  dateModified?: Date;
  keywords: string[];
  /** 언어 접두사를 뺀 정규 경로 */
  path: string;
  /** 표시 중인 페이지의 언어 */
  lang: Lang;
  /** 본문이 실제로 쓰인 언어. 폴백 표시 중이면 lang과 다르다 */
  contentLang: Lang;
}

/** 글 상세에 삽입하는 Article JSON-LD */
export function articleJsonLd(input: ArticleJsonLdInput): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    datePublished: input.datePublished.toISOString(),
    dateModified: (input.dateModified ?? input.datePublished).toISOString(),
    author: { '@type': 'Person', name: clean(text(PROFILE.name, input.lang)) ?? SITE.title },
    keywords: input.keywords.join(', '),
    mainEntityOfPage: absolute(withLang(input.path, input.lang)),
    // 본문이 쓰인 언어를 적는다. 화면 언어가 아니다.
    inLanguage: LANG_META[input.contentLang].intlLocale,
  });
}

/** 논문 메타의 외부 링크. CRITICAL: API를 호출하지 않고 문자열만 조합한다. */
export function arxivUrl(id: string): string {
  return `https://arxiv.org/abs/${id}`;
}

export function doiUrl(doi: string): string {
  return `https://doi.org/${doi}`;
}
