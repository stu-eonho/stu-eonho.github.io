// @ts-check
/**
 * `src/config/profile.ts`의 `PROFILE` 편집.
 *
 * CRITICAL: `PROFILE` 초기자의 범위만 교체한다. 파일의 나머지 — 상단 문서 주석 블록,
 * `Degree`·`EducationEntry`·`CareerEntry`·`SkillGroup`·`SocialLink`·`Profile` 인터페이스,
 * `PROFILE_PHOTO` glob, `isPlaceholder`, `collectPlaceholderFields` — 는 바이트 그대로 남는다.
 *
 * CRITICAL: `PROFILE` 리터럴 **내부**의 중첩 줄 주석(예: `// 재학 중이면 null → "현재"로
 * 표시됩니다`)은 재생성 시 사라진다. 같은 설명이 파일 상단 인터페이스의 JSDoc에 이미 있으므로
 * 정보 손실은 아니다. 최상위 프로퍼티 앞 JSDoc은 원문 그대로 되살린다.
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { mtimeOf } from '../fsx.mjs';
import { dirs } from '../paths.mjs';
import { loadProfile } from '../project.mjs';
import { configFile, writeDeclaration } from '../codegen/configs.mjs';

const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * `src/assets/profile.*` 파일명.
 *
 * CRITICAL: 정확히 하나여야 한다. `profile.ts`의 `import.meta.glob`이 매칭 결과의 첫
 * 항목을 쓰므로 둘 이상 있으면 어느 쪽이 잡힐지 보장되지 않는다.
 *
 * @param {string} projectRoot
 * @returns {Promise<{ name: string | null, duplicates: string[] }>}
 */
export async function findProfilePhoto(projectRoot) {
  let entries;
  try {
    entries = await readdir(dirs(projectRoot).assets, { withFileTypes: true });
  } catch {
    return { name: null, duplicates: [] };
  }
  const matches = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => {
      const extension = path.extname(name).toLowerCase();
      return name.slice(0, -extension.length) === 'profile' && PHOTO_EXTENSIONS.includes(extension);
    })
    .sort();
  return { name: matches[0] ?? null, duplicates: matches.slice(1) };
}

/**
 * 링크 URL을 저장 직전에 정규화한다.
 *
 * CRITICAL: 폼에 `eonho@korea.ac.kr`처럼 스킴 없이 적으면 브라우저가 사이트 내부 경로로
 * 읽어 404가 된다. 화면(`ProfileCard`·`SiteFooter`)도 같은 함수를 거치지만, 파일에
 * 바른 값이 남아야 JSON-LD·다시 열었을 때의 폼 값까지 한 벌로 맞는다.
 *
 * 규칙은 `src/config/profile.ts`의 `socialHref` 한 곳에만 있다 — 여기서 다시 구현하지 않는다.
 *
 * @param {any} profile
 * @param {any} server
 */
async function normalizeLinks(profile, server) {
  if (!Array.isArray(profile?.links)) return profile;
  const { socialHref } = await loadProfile(server);
  return {
    ...profile,
    links: profile.links.map((/** @type {any} */ link) =>
      typeof link?.url === 'string' ? { ...link, url: socialHref(link) } : link,
    ),
  };
}

/** @param {{ projectRoot: string, server: any }} ctx */
export async function readProfile({ projectRoot, server }) {
  const file = configFile(projectRoot, 'profile');
  const mod = await loadProfile(server);
  const [mtime, photo] = await Promise.all([mtimeOf(file), findProfilePhoto(projectRoot)]);

  return {
    // JSON으로 직렬화 가능한 순수 값이다. 함수·ImageMetadata는 넘기지 않는다.
    profile: JSON.parse(JSON.stringify(mod.PROFILE)),
    placeholders: mod.collectPlaceholderFields(mod.PROFILE),
    photo: photo.name,
    photoDuplicates: photo.duplicates,
    mtime,
  };
}

/** @param {{ body: any, projectRoot: string, server: any, logger: any }} ctx */
export async function writeProfile({ body, projectRoot, server, logger }) {
  const file = configFile(projectRoot, 'profile');
  const profile = await normalizeLinks(body.profile, server);
  const { mtime, changed } = await writeDeclaration({
    projectRoot,
    file,
    declName: 'PROFILE',
    value: profile,
    baseMtime: body.baseMtime,
    preserveComments: true,
    logger,
  });
  return { mtime, changed };
}
