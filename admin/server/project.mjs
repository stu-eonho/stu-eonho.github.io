// @ts-check
/**
 * 프로젝트 소스 모듈을 서버에서 읽는 통로.
 *
 * CRITICAL: `src/config/*.ts`와 `src/content/schema.ts`의 내용을 관리자가 다시 파싱하지
 * 않는다. Vite dev 서버의 `ssrLoadModule`로 **실제 모듈을 그대로 평가해** 값을 얻는다.
 * 그래야 관리자가 보는 카테고리·언어·스키마가 사이트가 쓰는 것과 같은 한 벌이 된다.
 *
 * 부수효과: 관리자가 설정 파일을 쓰면 Vite가 모듈을 무효화하므로 다음 요청에서 새 값이
 * 자동으로 읽힌다. 캐시를 관리자가 따로 들지 않는 이유다.
 */
import { fail } from './errors.mjs';

/**
 * @param {any} server Vite dev server
 * @param {string} specifier `/src/config/site.ts` 처럼 루트 기준 절대 경로
 */
export async function loadProjectModule(server, specifier) {
  try {
    return await server.ssrLoadModule(specifier);
  } catch (error) {
    throw fail('E-INTERNAL', `프로젝트 모듈을 불러오지 못했습니다: ${specifier}`, {
      detail: { specifier, reason: String(error) },
    });
  }
}

/** @param {any} server */
export function loadSiteConfig(server) {
  return loadProjectModule(server, '/src/config/site.ts');
}

/** @param {any} server */
export function loadCategories(server) {
  return loadProjectModule(server, '/src/config/categories.ts');
}

/** @param {any} server */
export function loadI18n(server) {
  return loadProjectModule(server, '/src/config/i18n.ts');
}

/** @param {any} server */
export function loadProfile(server) {
  return loadProjectModule(server, '/src/config/profile.ts');
}

/** @param {any} server */
export function loadPostSchema(server) {
  return loadProjectModule(server, '/src/content/schema.ts');
}

/** @param {any} server */
export function loadTagLib(server) {
  return loadProjectModule(server, '/src/lib/tags.ts');
}
