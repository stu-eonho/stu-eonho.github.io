// @ts-check
/**
 * 세션 토큰 발급.
 *
 * CRITICAL: 이 엔드포인트만 토큰 없이 호출 가능하다(GET이므로 변경 게이트에 걸리지
 * 않는다). 대신 루프백·Host 게이트는 여기에도 동일하게 적용된다.
 *
 * CRITICAL: 응답에 `Access-Control-Allow-Origin`을 붙이지 않는다 — 크로스 오리진
 * 페이지가 이 응답을 읽지 못하는 것이 토큰 방어의 전부다. (미들웨어가 보장한다)
 */
import { getSessionToken } from '../guard.mjs';
import { loadCategories, loadI18n, loadSiteConfig } from '../project.mjs';
import { currentBranch } from './git.mjs';

/** @param {{ projectRoot: string, server: any, allowRemote: boolean }} ctx */
export async function getSession({ projectRoot, server, allowRemote }) {
  const [site, categories, i18n, branch] = await Promise.all([
    loadSiteConfig(server),
    loadCategories(server),
    loadI18n(server),
    currentBranch(projectRoot),
  ]);

  return {
    token: getSessionToken(),
    projectRoot,
    siteTitle: site.SITE.title,
    siteUrl: site.SITE.url,
    gitBranch: branch,
    allowRemote,
    // 카테고리·언어는 관리자 폼의 select 옵션이자 검증 기준이다.
    // CRITICAL: 관리자가 자체 목록을 갖지 않는다 — 설정 파일이 유일한 출처다.
    categories: categories.SORTED_CATEGORIES.map((/** @type {any} */ category) => ({
      id: category.id,
      label: category.label,
      labelKo: category.labelKo,
      description: category.description,
      icon: category.icon,
      order: category.order,
      metaPanel: category.metaPanel,
    })),
    languages: i18n.LOCALES.map((/** @type {any} */ lang) => ({
      id: lang,
      code: i18n.LANG_META[lang].code,
      nativeName: i18n.LANG_META[lang].nativeName,
    })),
    defaultLang: i18n.DEFAULT_LANG,
    env: {
      // CRITICAL: 값이 아니라 설정 여부만 노출한다.
      publicSiteUrl: Boolean(process.env.PUBLIC_SITE_URL),
      goatcounter: Boolean(process.env.PUBLIC_GOATCOUNTER_CODE),
    },
  };
}
