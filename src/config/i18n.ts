/**
 * 다국어 단일 진실 공급원.
 *
 * 이 사이트는 **URL로 언어를 가른다.** 한국어는 접두사 없이 `/`, 영어는 `/en/` 아래에
 * 같은 구조의 페이지를 통째로 다시 빌드한다. 언어 전환은 `<a href>` 하나이며 JS가 없다 —
 * 클라이언트 토글이 아니므로 깜빡임이 없고, 검색엔진이 영어 페이지를 실제로 색인한다.
 *
 * CRITICAL: 화면에 나가는 한국어 문자열을 컴포넌트에 직접 쓰지 않는다. 전부 아래 `UI`를
 * 거친다. 컴포넌트에서 하드코딩하면 영어 빌드에 한국어가 섞여 나가고, 그 누락은
 * 빌드가 잡아 주지 못한다.
 *
 * CRITICAL: `UI.en`은 `typeof UI.ko`로 타입이 고정된다. 한쪽에만 키를 추가하면
 * `astro check`가 실패한다 — 이것이 번역 누락을 막는 유일한 자동 장치다.
 */

export const LOCALES = ['ko', 'en'] as const;
export type Lang = (typeof LOCALES)[number];

/** Zod `z.enum()`에 그대로 넘길 수 있는 튜플. 프론트매터의 `lang` 필드가 쓴다. */
export const LANG_IDS = [...LOCALES] as unknown as [Lang, ...Lang[]];

/** 접두사 없는 언어. 이 값을 바꾸면 URL 구조 전체가 바뀐다. */
export const DEFAULT_LANG: Lang = 'ko';

export interface LangMeta {
  /** `<html lang>` 값 */
  htmlLang: string;
  /** `Intl` 로케일 */
  intlLocale: string;
  /** `og:locale` */
  ogLocale: string;
  /** RSS `<language>` */
  rssLanguage: string;
  /** 언어 토글에 찍히는 2글자 코드 */
  code: string;
  /** 해당 언어를 그 언어로 부르는 이름 */
  nativeName: string;
}

export const LANG_META: Record<Lang, LangMeta> = {
  ko: {
    htmlLang: 'ko',
    intlLocale: 'ko-KR',
    ogLocale: 'ko_KR',
    rssLanguage: 'ko-kr',
    code: 'KO',
    nativeName: '한국어',
  },
  en: {
    htmlLang: 'en',
    intlLocale: 'en-US',
    ogLocale: 'en_US',
    rssLanguage: 'en-us',
    code: 'EN',
    nativeName: 'English',
  },
};

/* ==========================================================================
   값의 다국어 표기
   ========================================================================== */

/** 언어별 값이 반드시 둘 다 있는 형태. */
export type Localized<T = string> = { readonly [K in Lang]: T };

/**
 * 언어별 값이거나, 두 언어에서 동일한 단일 값.
 * 고유명사(예: "PyTorch", "KAIST")는 그냥 문자열로 두면 된다.
 */
export type MaybeLocalized<T = string> = T | Localized<T>;

function isLocalized<T>(value: MaybeLocalized<T>): value is Localized<T> {
  return (
    typeof value === 'object' && value !== null && LOCALES.every((l) => l in (value as object))
  );
}

/** `MaybeLocalized`에서 현재 언어의 값을 꺼낸다. */
export function text(value: MaybeLocalized<string>, lang: Lang): string;
export function text(value: MaybeLocalized<string> | undefined, lang: Lang): string | undefined;
export function text(value: MaybeLocalized<string> | undefined, lang: Lang): string | undefined {
  if (value === undefined) return undefined;
  return isLocalized(value) ? value[lang] : value;
}

/** 배열 버전. `interests`, `skillGroups.items`처럼 항목마다 표기가 갈릴 수 있는 곳에 쓴다. */
export function textList(values: readonly MaybeLocalized<string>[], lang: Lang): string[] {
  return values.map((value) => text(value, lang));
}

/* ==========================================================================
   경로 ↔ 언어
   ========================================================================== */

const PREFIXED = LOCALES.filter((l) => l !== DEFAULT_LANG);

/** 경로에서 언어를 읽는다. `/en/archive` → `en`, `/archive` → `ko` */
export function langFromPath(pathname: string): Lang {
  const first = pathname.replace(/^\/+/, '').split('/')[0];
  const match = PREFIXED.find((l) => l === first);
  return match ?? DEFAULT_LANG;
}

/** 언어 접두사를 떼어 낸 정규 경로. 항상 `/`로 시작하고 후행 슬래시가 없다. */
export function stripLang(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  for (const lang of PREFIXED) {
    if (trimmed === `/${lang}`) return '/';
    if (trimmed.startsWith(`/${lang}/`)) return trimmed.slice(lang.length + 1);
  }
  return trimmed;
}

/**
 * 정규 경로에 언어 접두사를 붙인다.
 * CRITICAL: 내부 링크는 전부 이 함수를 거쳐야 한다. `/archive`를 직접 쓰면 영어 페이지에서
 * 한국어 페이지로 빠져나가고, 그 순간 사용자는 언어를 잃는다.
 */
export function withLang(path: string, lang: Lang): string {
  const clean = stripLang(path);
  if (lang === DEFAULT_LANG) return clean;
  return clean === '/' ? `/${lang}` : `/${lang}${clean}`;
}

/** 같은 화면의 다른 언어 URL. 언어 토글이 쓴다. */
export function alternatePath(pathname: string, lang: Lang): string {
  return withLang(stripLang(pathname), lang);
}

/** 현재 언어가 아닌 쪽. 2개 언어 전제다. */
export function otherLang(lang: Lang): Lang {
  return lang === 'ko' ? 'en' : 'ko';
}

/* ==========================================================================
   UI 문자열
   ========================================================================== */

const ko = {
  /** 사이트 전역. 사이트 제목·설명은 site.ts가 갖는다 — 여기에 두지 않는다 */
  site: {
    skipToContent: '본문으로 건너뛰기',
  },

  /** 헤더·내비게이션 */
  nav: {
    home: 'Home',
    archive: 'Archive',
    primaryLabel: '주요',
    mobileLabel: '모바일 주요',
    fallbackLabel: '폴백 주요',
    sheetLabel: '사이트 메뉴',
    menu: '메뉴',
    openMenu: '메뉴 열기',
    closeMenu: '메뉴 닫기',
    searchLabel: '검색',
  },

  /** 테마 토글 (3상태) */
  theme: {
    system: '테마: 시스템',
    light: '테마: 라이트',
    dark: '테마: 다크',
  },

  /** 언어 토글 */
  language: {
    /** 전환 링크의 aria-label. 대상 언어 이름이 들어간다 */
    switchTo: (name: string) => `${name}로 보기`,
  },

  /** 푸터 */
  footer: {
    rss: 'RSS 피드',
    builtWith: 'Built with Astro · Hosted on GitHub Pages',
    analytics: '방문 통계는 GoatCounter로 집계하며 쿠키나 개인 식별 정보를 수집하지 않습니다.',
  },

  /** 홈 */
  home: {
    recentTitle: '최근 글',
    viewAll: '전체 보기',
    emptyTitle: '아직 작성된 글이 없습니다',
    emptyHint: '첫 글은 src/content/posts/ 에 Markdown 파일을 추가해 만듭니다.',
  },

  /** 프로필 카드 */
  profile: {
    education: '학적',
    career: '경력',
    skills: '스킬',
    interests: '관심 분야',
    cv: 'CV',
    /** 재학·재직 중 */
    present: '현재',
    enrolled: '재학',
    graduated: '졸업',
    degree: {
      BS: '학사',
      MS: '석사',
      PhD: '박사',
      Exchange: '교환학생',
      Other: '기타',
    },
    /** 소속 한 줄에 쓰는 축약 표기 */
    degreeShort: {
      BS: '학사',
      MS: '석사',
      PhD: '박사',
      Exchange: '교환',
      Other: '과정',
    },
    employment: {
      'Full-time': '정규직',
      Intern: '인턴',
      Contract: '계약직',
      Freelance: '프리랜스',
      Other: '기타',
    },
  },

  /** 목록·아카이브·태그 */
  list: {
    archiveTitle: 'Archive',
    archiveDescription: '전체 글을 연도별로 모아 봅니다.',
    totalPosts: (n: number) => `전체 ${n}편`,
    categoryTotal: (n: number) => `총 ${n}편`,
    postsCount: (n: number) => `${n}편`,
    pageSuffix: (n: number) => `${n}페이지`,
    yearLabel: (year: number) => `${year}년`,
    emptyArchiveTitle: '아직 작성된 글이 없습니다',
    emptyArchiveHint: 'src/content/posts/ 에 Markdown 파일을 추가하면 여기에 쌓입니다.',
    emptyCategoryTitle: '이 카테고리에는 아직 글이 없습니다',
    emptyCategoryHint: (id: string) =>
      `src/content/posts/${id}/ 에 Markdown 파일을 추가하면 이 목록에 나타납니다.`,
    browseOther: '다른 카테고리 둘러보기',
  },

  /** 태그 */
  tags: {
    title: 'Tags',
    description: '글에 붙은 태그를 사용 횟수 순으로 모아 봅니다.',
    total: (n: number) => `총 ${n}개`,
    viewAll: '전체 태그 보기',
    emptyTitle: '아직 태그가 없습니다',
    emptyHint: '글 프론트매터의 tags 배열에 값을 넣으면 여기에 모입니다.',
    viewArchive: '아카이브 보기',
    tagDescription: (label: string, n: number) => `"${label}" 태그가 붙은 글 ${n}편입니다.`,
  },

  /** 페이지네이션 */
  pagination: {
    label: '페이지 이동',
    prev: '이전',
    next: '다음',
  },

  /** 글 상세 */
  post: {
    updated: '수정',
    readingTime: (min: number) => `약 ${min}분`,
    tocTitle: '목차',
    prevNextLabel: '같은 카테고리의 이웃 글',
    prevPost: '이전 글',
    nextPost: '다음 글',
    headingAnchor: (heading: string) => `${heading} 섹션 링크`,
    copy: '복사',
    copied: '복사됨',
    copyFailed: '복사 실패',
    copyLabel: '코드 복사',
    /** 번역본이 없어 원문을 그대로 보여 줄 때의 안내 */
    fallbackNotice: (name: string) => `이 글은 아직 ${name} 번역이 없어 원문 그대로 표시합니다.`,
    fallbackAction: (name: string) => `${name}로 읽기`,
  },

  /** 논문 메타 패널 */
  paper: {
    panelLabel: '원 논문 정보',
    eyebrow: '원 논문',
    andMore: (n: number) => `외 ${n}명`,
    readDate: (date: string) => `읽은 날짜: ${date}`,
  },

  /** 프로젝트 메타 패널 */
  project: {
    panelLabel: '프로젝트 정보',
    eyebrow: '프로젝트',
    period: '기간',
    role: '역할',
    teamSize: '팀 규모',
    status: '상태',
    people: (n: number) => `${n}명`,
    ongoing: '진행 중',
    statusLabel: {
      'in-progress': '진행 중',
      completed: '완료',
      archived: '보관',
    },
  },

  /** 검색 */
  search: {
    title: 'Search',
    description: '글 제목과 본문에서 검색합니다.',
    inputLabel: '검색어',
    placeholder: '제목과 본문에서 검색',
    prompt: '검색어를 입력하세요',
    searching: '검색 중',
    /** `'{n}'`처럼 문자열을 넘기면 클라이언트에서 치환할 템플릿이 된다 */
    resultCount: (n: number | string) => `${n}개의 결과`,
    loadFailed: '검색을 불러오지 못했습니다',
    loadFailedHint: '새로고침하거나 아카이브를 이용해 주세요.',
    noResults: (term: string) => `"${term}"에 대한 검색 결과가 없습니다.`,
    /** 검색어 자리에 넣는 표식. 서버가 템플릿을 만들고 클라이언트가 이 자리를 채운다 */
    termPlaceholder: '{term}',
    countPlaceholder: '{n}',
    more: '더 보기',
    viewArchive: '전체 아카이브 보기',
    noscriptBefore: '검색에는 JavaScript가 필요합니다. ',
    noscriptLink: '아카이브',
    noscriptAfter: '에서 찾아보세요.',
  },

  /** 404 */
  notFound: {
    title: '404',
    description: '요청한 페이지를 찾을 수 없습니다.',
    message: '페이지를 찾을 수 없습니다',
    goHome: '홈으로',
    goSearch: '검색하기',
  },
};

/** `UI.ko`의 형태가 곧 계약이다. 영어 사전은 이 타입을 만족해야 한다. */
export type UIStrings = typeof ko;

const en: UIStrings = {
  site: {
    skipToContent: 'Skip to content',
  },

  nav: {
    home: 'Home',
    archive: 'Archive',
    primaryLabel: 'Primary',
    mobileLabel: 'Mobile primary',
    fallbackLabel: 'Fallback primary',
    sheetLabel: 'Site menu',
    menu: 'Menu',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    searchLabel: 'Search',
  },

  theme: {
    system: 'Theme: System',
    light: 'Theme: Light',
    dark: 'Theme: Dark',
  },

  language: {
    switchTo: (name: string) => `View in ${name}`,
  },

  footer: {
    rss: 'RSS feed',
    builtWith: 'Built with Astro · Hosted on GitHub Pages',
    analytics:
      'Visits are counted with GoatCounter, which sets no cookies and collects no personally identifying information.',
  },

  home: {
    recentTitle: 'Recent posts',
    viewAll: 'View all',
    emptyTitle: 'No posts yet',
    emptyHint: 'Add a Markdown file under src/content/posts/ to publish the first one.',
  },

  profile: {
    education: 'Education',
    career: 'Experience',
    skills: 'Skills',
    interests: 'Research interests',
    cv: 'CV',
    present: 'Present',
    enrolled: 'enrolled',
    graduated: 'graduated',
    degree: {
      BS: 'BS',
      MS: 'MS',
      PhD: 'PhD',
      Exchange: 'Exchange',
      Other: 'Other',
    },
    degreeShort: {
      BS: 'BS',
      MS: 'MS',
      PhD: 'PhD',
      Exchange: 'Exchange',
      Other: 'Other',
    },
    employment: {
      'Full-time': 'Full-time',
      Intern: 'Intern',
      Contract: 'Contract',
      Freelance: 'Freelance',
      Other: 'Other',
    },
  },

  list: {
    archiveTitle: 'Archive',
    archiveDescription: 'Every post, grouped by year.',
    totalPosts: (n: number) => `${n} post${n === 1 ? '' : 's'}`,
    categoryTotal: (n: number) => `${n} post${n === 1 ? '' : 's'}`,
    postsCount: (n: number) => `${n} post${n === 1 ? '' : 's'}`,
    pageSuffix: (n: number) => `Page ${n}`,
    yearLabel: (year: number) => `${year}`,
    emptyArchiveTitle: 'No posts yet',
    emptyArchiveHint: 'Posts appear here once you add Markdown files under src/content/posts/.',
    emptyCategoryTitle: 'Nothing in this category yet',
    emptyCategoryHint: (id: string) =>
      `Add a Markdown file under src/content/posts/${id}/ and it will show up in this list.`,
    browseOther: 'Browse other categories',
  },

  tags: {
    title: 'Tags',
    description: 'Every tag used across the posts, ordered by how often it appears.',
    total: (n: number) => `${n} tag${n === 1 ? '' : 's'}`,
    viewAll: 'View all tags',
    emptyTitle: 'No tags yet',
    emptyHint: 'Fill in the tags array in a post’s frontmatter and it will be collected here.',
    viewArchive: 'Browse the archive',
    tagDescription: (label: string, n: number) =>
      `${n} post${n === 1 ? '' : 's'} tagged “${label}”.`,
  },

  pagination: {
    label: 'Pagination',
    prev: 'Previous',
    next: 'Next',
  },

  post: {
    updated: 'Updated',
    readingTime: (min: number) => `${min} min read`,
    tocTitle: 'Contents',
    prevNextLabel: 'Neighbouring posts in this category',
    prevPost: 'Previous post',
    nextPost: 'Next post',
    headingAnchor: (heading: string) => `Link to section: ${heading}`,
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Copy failed',
    copyLabel: 'Copy code',
    fallbackNotice: (name: string) =>
      `This post has no ${name} translation yet, so the original is shown as written.`,
    fallbackAction: (name: string) => `Read in ${name}`,
  },

  paper: {
    panelLabel: 'Original paper',
    eyebrow: 'Original paper',
    andMore: (n: number) => `and ${n} more`,
    readDate: (date: string) => `Read on ${date}`,
  },

  project: {
    panelLabel: 'Project details',
    eyebrow: 'Project',
    period: 'Period',
    role: 'Role',
    teamSize: 'Team size',
    status: 'Status',
    people: (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`,
    ongoing: 'Ongoing',
    statusLabel: {
      'in-progress': 'In progress',
      completed: 'Completed',
      archived: 'Archived',
    },
  },

  search: {
    title: 'Search',
    description: 'Search across post titles and bodies.',
    inputLabel: 'Search query',
    placeholder: 'Search titles and content',
    prompt: 'Type to search',
    searching: 'Searching',
    resultCount: (n: number | string) => `${n} result${n === 1 ? '' : 's'}`,
    loadFailed: 'Could not load search',
    loadFailedHint: 'Reload the page, or browse the archive instead.',
    noResults: (term: string) => `No results for “${term}”.`,
    termPlaceholder: '{term}',
    countPlaceholder: '{n}',
    more: 'Load more',
    viewArchive: 'Browse the full archive',
    noscriptBefore: 'Search needs JavaScript. Try the ',
    noscriptLink: 'archive',
    noscriptAfter: ' instead.',
  },

  notFound: {
    title: '404',
    description: 'The page you asked for does not exist.',
    message: 'Page not found',
    goHome: 'Go home',
    goSearch: 'Search',
  },
};

const DICTIONARY: Record<Lang, UIStrings> = { ko, en };

/** 해당 언어의 UI 문자열 묶음. */
export function t(lang: Lang): UIStrings {
  return DICTIONARY[lang];
}

export interface I18nContext {
  lang: Lang;
  /** UI 문자열 */
  t: UIStrings;
  /** 현재 언어를 유지하는 내부 링크 생성기 */
  href: (path: string) => string;
  meta: LangMeta;
}

/**
 * 컴포넌트에서 쓰는 진입점. `.astro` 파일 어디서나 `Astro.url`을 갖고 있으므로
 * lang을 props로 실어 나를 필요가 없다.
 *
 *   const { lang, t, href } = i18n(Astro.url);
 */
export function i18n(url: URL): I18nContext {
  const lang = langFromPath(url.pathname);
  return {
    lang,
    t: DICTIONARY[lang],
    href: (path: string) => withLang(path, lang),
    meta: LANG_META[lang],
  };
}
