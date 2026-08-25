// @ts-check
/**
 * `src/config/site.ts`의 `SITE`와 `src/config/categories.ts`의 `CATEGORIES` 편집.
 */
import path from 'node:path';
import { fail } from '../errors.mjs';
import { ensureDir, mtimeOf } from '../fsx.mjs';
import { dirs, SLUG_PATTERN } from '../paths.mjs';
import { loadCategories, loadSiteConfig } from '../project.mjs';
import { configFile, writeDeclaration } from '../codegen/configs.mjs';
import { scanPostFiles } from '../content.mjs';

/* ==========================================================================
   사이트 설정
   ========================================================================== */

/** 편집 가능한 필드. 이 목록 밖의 키는 저장 시 무시하지 않고 원본 값을 유지한다. */
const SITE_EDITABLE = [
  'title',
  'description',
  'url',
  'postsPerPage',
  'recentPostsOnHome',
  'rssItemLimit',
  'defaultOgImage',
];

/**
 * CRITICAL 읽기 전용.
 *   base     — 사용자 사이트에서 `/` 고정
 *   navOrder — `SORTED_CATEGORIES`에서 파생되는 스프레드 표현식. 리터럴 배열로 펴 쓰면
 *              카테고리를 추가해도 내비게이션이 따라오지 않는다
 */
const SITE_DERIVED = ['base', 'navOrder'];

/** @param {{ projectRoot: string, server: any }} ctx */
export async function readSite({ projectRoot, server }) {
  const file = configFile(projectRoot, 'site');
  const mod = await loadSiteConfig(server);
  const mtime = await mtimeOf(file);

  return {
    site: JSON.parse(JSON.stringify(mod.SITE)),
    editable: SITE_EDITABLE,
    derived: SITE_DERIVED,
    envOverrides: {
      // CRITICAL: 값이 아니라 설정 여부만 노출한다.
      PUBLIC_SITE_URL: Boolean(process.env.PUBLIC_SITE_URL),
      PUBLIC_GOATCOUNTER_CODE: Boolean(process.env.PUBLIC_GOATCOUNTER_CODE),
    },
    mtime,
  };
}

/** @param {{ body: any, projectRoot: string, server: any, logger: any }} ctx */
export async function writeSite({ body, projectRoot, server, logger }) {
  const file = configFile(projectRoot, 'site');
  const mod = await loadSiteConfig(server);
  const current = JSON.parse(JSON.stringify(mod.SITE));
  const incoming = body.site ?? {};

  /** @type {Record<string, any>} */
  const next = { ...current };
  for (const key of SITE_EDITABLE) {
    if (incoming[key] !== undefined) next[key] = incoming[key];
  }

  validateSite(next);

  const { mtime, changed } = await writeDeclaration({
    projectRoot,
    file,
    declName: 'SITE',
    value: next,
    baseMtime: body.baseMtime,
    // navOrder는 표현식 그대로, url은 `env ?? '문자열'` 형태를 지키며 문자열만 교체
    preserveExpressions: ['navOrder'],
    fallbackStrings: ['url'],
    preserveComments: true,
    logger,
  });

  return { mtime, changed };
}

/** @param {Record<string, any>} site */
function validateSite(site) {
  if (typeof site.title !== 'string' || site.title.trim() === '') {
    throw fail('E-VALIDATION', 'title은 비울 수 없습니다.', { field: 'title' });
  }
  if (site.title.length > 40) {
    throw fail('E-VALIDATION', 'title은 40자 이내여야 합니다.', { field: 'title' });
  }
  for (const lang of ['ko', 'en']) {
    const value = site.description?.[lang];
    if (typeof value !== 'string' || value.trim() === '') {
      throw fail('E-VALIDATION', `description.${lang}은 비울 수 없습니다.`, {
        field: `description.${lang}`,
      });
    }
    if (value.length > 160) {
      throw fail('E-VALIDATION', `description.${lang}은 160자 이내여야 합니다.`, {
        field: `description.${lang}`,
      });
    }
  }
  if (typeof site.url !== 'string' || !/^https?:\/\//.test(site.url)) {
    throw fail('E-VALIDATION', 'url은 http(s)로 시작하는 절대 URL이어야 합니다.', {
      field: 'url',
    });
  }
  if (site.url.endsWith('/')) {
    throw fail('E-VALIDATION', 'url에 후행 슬래시를 두지 않습니다.', { field: 'url' });
  }
  for (const key of ['postsPerPage', 'recentPostsOnHome', 'rssItemLimit']) {
    const value = site[key];
    if (!Number.isInteger(value) || value < 1) {
      throw fail('E-VALIDATION', `${key}는 1 이상의 정수여야 합니다.`, { field: key });
    }
  }
}

/* ==========================================================================
   카테고리
   ========================================================================== */

/** @param {{ projectRoot: string, server: any }} ctx */
export async function readCategories({ projectRoot, server }) {
  const file = configFile(projectRoot, 'categories');
  const mod = await loadCategories(server);
  const [mtime, files] = await Promise.all([mtimeOf(file), scanPostFiles(projectRoot)]);

  /** @type {Record<string, number>} */
  const postCounts = {};
  for (const entry of files) {
    postCounts[entry.category] = (postCounts[entry.category] ?? 0) + 1;
  }

  return {
    categories: JSON.parse(JSON.stringify(mod.SORTED_CATEGORIES)),
    postCounts,
    mtime,
  };
}

/** @param {{ body: any, projectRoot: string, server: any, logger: any }} ctx */
export async function writeCategories({ body, projectRoot, server, logger }) {
  const file = configFile(projectRoot, 'categories');
  const incoming = Array.isArray(body.categories) ? body.categories : [];
  if (incoming.length === 0) {
    throw fail('E-VALIDATION', '카테고리는 최소 하나가 필요합니다.', { field: 'categories' });
  }

  const mod = await loadCategories(server);
  const current = JSON.parse(JSON.stringify(mod.CATEGORIES));
  const currentIds = new Set(current.map((/** @type {any} */ c) => c.id));

  const files = await scanPostFiles(projectRoot);
  /** @type {Record<string, number>} */
  const postCounts = {};
  for (const entry of files) postCounts[entry.category] = (postCounts[entry.category] ?? 0) + 1;

  const nextIds = new Set(incoming.map((/** @type {any} */ c) => String(c.id)));

  // CRITICAL: 글이 남아 있는 카테고리는 삭제를 거부한다.
  for (const id of currentIds) {
    if (nextIds.has(id)) continue;
    const count = postCounts[/** @type {string} */ (id)] ?? 0;
    if (count > 0) {
      throw fail('E-CATEGORY-IN-USE', `글 ${count}편이 이 카테고리를 사용 중입니다: ${id}`, {
        field: 'categories',
        detail: { id, count },
      });
    }
  }

  const icons = await loadIconNames();

  /** @type {any[]} */
  const normalized = [];
  const seen = new Set();

  incoming.forEach((/** @type {any} */ raw, /** @type {number} */ index) => {
    const id = String(raw.id ?? '').trim();
    if (!SLUG_PATTERN.test(id)) {
      throw fail('E-VALIDATION', `카테고리 id는 소문자·숫자·하이픈만 허용합니다: "${id}"`, {
        field: `categories[${index}].id`,
      });
    }
    if (seen.has(id)) {
      throw fail('E-VALIDATION', `카테고리 id가 중복됩니다: ${id}`, {
        field: `categories[${index}].id`,
      });
    }
    seen.add(id);

    for (const key of ['label', 'labelKo']) {
      if (typeof raw[key] !== 'string' || raw[key].trim() === '') {
        throw fail('E-VALIDATION', `${key}는 비울 수 없습니다.`, {
          field: `categories[${index}].${key}`,
        });
      }
    }
    for (const lang of ['ko', 'en']) {
      const description = raw.description?.[lang];
      if (typeof description !== 'string' || description.trim() === '') {
        throw fail('E-VALIDATION', `description.${lang}은 비울 수 없습니다.`, {
          field: `categories[${index}].description.${lang}`,
        });
      }
      if (description.length > 120) {
        throw fail('E-VALIDATION', `description.${lang}은 120자 이내여야 합니다.`, {
          field: `categories[${index}].description.${lang}`,
        });
      }
    }

    const icon = String(raw.icon ?? '');
    assertKnownIcon(icon, icons, `categories[${index}].icon`);

    const metaPanel = String(raw.metaPanel ?? 'none');
    if (!['paper', 'project', 'none'].includes(metaPanel)) {
      throw fail('E-VALIDATION', 'metaPanel은 paper / project / none 중 하나여야 합니다.', {
        field: `categories[${index}].metaPanel`,
      });
    }

    normalized.push({
      id,
      label: raw.label,
      labelKo: raw.labelKo,
      description: { ko: raw.description.ko, en: raw.description.en },
      icon,
      // CRITICAL: order는 배열 순서대로 1부터 다시 매긴다.
      order: index + 1,
      metaPanel,
    });
  });

  const { mtime, changed } = await writeDeclaration({
    projectRoot,
    file,
    declName: 'CATEGORIES',
    value: normalized,
    baseMtime: body.baseMtime,
    logger,
  });

  // 새 카테고리의 콘텐츠 폴더를 만든다. 라우트 파일은 만들지 않는다 —
  // CRITICAL: 카테고리는 데이터이며, 라우트는 `categories.ts` + 폴더에서 파생된다.
  /** @type {string[]} */
  const createdFolders = [];
  for (const category of normalized) {
    const folder = path.join(dirs(projectRoot).posts, category.id);
    if (!currentIds.has(category.id)) {
      await ensureDir(folder);
      createdFolders.push(path.relative(projectRoot, folder).split(path.sep).join('/'));
    } else {
      await ensureDir(folder);
    }
  }

  return { mtime, changed, createdFolders };
}

/* ==========================================================================
   아이콘
   ========================================================================== */

/** @type {Set<string> | null} */
let iconNames = null;

async function loadIconNames() {
  if (iconNames) return iconNames;
  try {
    const { createRequire } = await import('node:module');
    const data = createRequire(import.meta.url)('@iconify-json/lucide/icons.json');
    iconNames = new Set([...Object.keys(data.icons ?? {}), ...Object.keys(data.aliases ?? {})]);
  } catch {
    iconNames = new Set();
  }
  return iconNames;
}

/**
 * @param {string} icon `lucide:file-text` 형태
 * @param {Set<string>} names
 * @param {string} field
 */
function assertKnownIcon(icon, names, field) {
  if (names.size === 0) return; // 아이콘 목록을 못 읽었으면 검사를 건너뛴다
  const [prefix, name] = icon.split(':');
  if (prefix !== 'lucide' || !name) {
    throw fail('E-UNKNOWN-ICON', `아이콘 이름은 "lucide:이름" 형태여야 합니다: ${icon}`, {
      field,
      detail: { suggestions: [] },
    });
  }
  if (names.has(name)) return;
  throw fail('E-UNKNOWN-ICON', `lucide에 없는 아이콘 이름입니다: ${name}`, {
    field,
    detail: { suggestions: suggestIcons(name, names) },
  });
}

/**
 * 비슷한 이름 3개. 접두·부분 일치 순으로 고른다.
 * @param {string} name
 * @param {Set<string>} names
 */
function suggestIcons(name, names) {
  const all = [...names];
  const prefix = all.filter((candidate) => candidate.startsWith(name.slice(0, 3)));
  const partial = all.filter((candidate) => candidate.includes(name.slice(0, 4)));
  return [...new Set([...prefix, ...partial])].slice(0, 3).map((n) => `lucide:${n}`);
}

/** 아이콘 목록을 화면 자동완성에 쓰라고 노출한다. */
export async function listIcons() {
  const names = await loadIconNames();
  return { icons: [...names].map((name) => `lucide:${name}`) };
}
