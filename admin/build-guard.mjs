// @ts-check
/**
 * 프로덕션 유출 가드.
 *
 * CRITICAL: 이 훅은 관리자 배제의 **네 번째 겹**이다. 앞의 셋은
 *   1. 관리자 파일이 `src/pages/` 밖에 있어 파일 기반 라우터의 시야에 없다
 *   2. `injectRoute`가 `command === 'dev'` 안에서만 호출된다
 *   3. Vite 플러그인이 `configureServer`만 갖는다(빌드 훅 없음)
 * 이며, 이 가드는 그 셋이 모두 실패했을 때를 위한 것이다.
 * 앞의 셋을 믿고 이 가드를 생략하지 않는다.
 *
 * 유출은 배포 전에 반드시 빌드를 깨야 한다. `npm run build`가 곧 CI 게이트다.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 본문을 검사할 확장자. 텍스트 산출물만 본다. */
const SCANNED_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.xml', '.txt']);

/** 유출 표식. 관리자 API 접두사이자 클라이언트 코드 전반에 박히는 문자열이다. */
const LEAK_MARKER = '__admin';

/**
 * 재귀적으로 파일 경로를 모은다.
 * @param {string} dir
 * @param {string[]} acc
 * @returns {Promise<string[]>}
 */
async function collectFiles(dir, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collectFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

/** @param {string} target */
async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * `astro:build:done` 훅 본체.
 * @param {{ dir: URL, pages: { pathname: string }[], logger: { error: (msg: string) => void } }} ctx
 */
export async function buildGuard({ dir, pages, logger }) {
  const outDir = fileURLToPath(dir);
  /** @type {string[]} */
  const leaks = [];

  // 1. 라우트 표에 admin 경로가 있는가
  for (const page of pages ?? []) {
    const pathname = page.pathname.replace(/^\/+/, '');
    if (pathname === 'admin' || pathname.startsWith('admin/')) {
      leaks.push(`라우트: /${pathname}`);
    }
  }

  // 2. dist/admin 디렉터리가 존재하는가
  if (await exists(path.join(outDir, 'admin'))) {
    leaks.push(`디렉터리: ${path.join(outDir, 'admin')}`);
  }

  // 3. 산출물 본문에 `__admin` 문자열이 있는가
  const files = await collectFiles(outDir);
  for (const file of files) {
    if (!SCANNED_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    let contents;
    try {
      contents = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    if (contents.includes(LEAK_MARKER)) {
      leaks.push(`파일 본문: ${path.relative(outDir, file)} ("${LEAK_MARKER}" 발견)`);
    }
  }

  if (leaks.length === 0) return;

  const message = [
    '관리자 코드가 프로덕션 빌드에 유출되었습니다.',
    '',
    '발견된 항목:',
    ...leaks.map((leak) => `  - ${leak}`),
    '',
    '관리자 콘솔은 `astro dev`에서만 존재해야 합니다. 다음을 확인하세요:',
    '  - `admin/pages/*.astro`를 `src/pages/` 아래로 복사하지 않았는지',
    "  - `admin/integration.mjs`의 `injectRoute`가 `command === 'dev'` 안에 있는지",
    '  - 관리자 Vite 플러그인에 `configureServer` 이외의 훅이 없는지',
  ].join('\n');

  logger.error(message);
  throw new Error(message);
}

export default buildGuard;
