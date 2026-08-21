/**
 * 사이트 전역 상수.
 *
 * CRITICAL: 사이트 제목은 이 파일에서만 정의한다. 컴포넌트·RSS·OG 메타에 문자열을
 * 중복 하드코딩하면 나중에 제목을 바꿀 때 누락된다.
 *
 * 언어(로케일) 정의는 `i18n.ts`가 갖는다. 이 파일에는 언어 상수를 두지 않는다 —
 * 사이트가 2개 언어로 빌드되므로 "사이트의 로케일" 하나라는 개념이 성립하지 않는다.
 */
import { SORTED_CATEGORIES } from './categories';
import type { Localized } from './i18n';

export interface SiteConfig {
  /** 사이트 제목 (max 40자) */
  title: string;
  /** 검색/OG 설명 (언어별 max 160자) */
  description: Localized<string>;
  /** 절대 URL. 후행 슬래시 없음 */
  url: string;
  /** 사용자 사이트이므로 '/'. CRITICAL: 사용자 사이트에서는 이 값을 바꾸지 않는다 */
  base: string;
  /** 상단 바 노출 순서. Category id 또는 예약어 'archive' */
  navOrder: string[];
  postsPerPage: number;
  recentPostsOnHome: number;
  rssItemLimit: number;
  defaultOgImage: string;
}

export const SITE: SiteConfig = {
  title: 'Study Log',
  description: {
    ko: '읽은 논문과 진행한 프로젝트, 그리고 공부 노트를 기록하는 개인 연구 로그입니다.',
    en: 'A personal research log of paper reviews, project write-ups, and study notes.',
  },
  url: import.meta.env.PUBLIC_SITE_URL ?? 'https://stu-eonho.github.io',
  base: '/',
  // 카테고리 순서는 categories.ts에서 파생한다. 하드코딩하지 않는다.
  navOrder: [...SORTED_CATEGORIES.map((c) => c.id), 'archive'],
  postsPerPage: 12,
  recentPostsOnHome: 6,
  rssItemLimit: 50,
  defaultOgImage: '/og-default.png',
};

/**
 * GoatCounter 사이트 코드. 미설정이면 분석 스크립트도, 푸터 수집 고지도 출력하지 않는다.
 * CRITICAL: 스크립트를 넣지 않는 빌드에 고지만 남으면 사실과 다른 문구가 된다.
 */
export const GOATCOUNTER_CODE: string = import.meta.env.PUBLIC_GOATCOUNTER_CODE ?? '';
