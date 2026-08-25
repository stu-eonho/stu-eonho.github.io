// @ts-check
/**
 * `src/assets/` 이미지 관리.
 *
 * CRITICAL: `.svg`는 거부한다 — 스크립트가 실행될 수 있는 유일한 이미지 포맷이다.
 * CRITICAL: 확장자만 믿지 않는다. 매직 바이트로 실제 포맷을 확인해 위조를 막는다.
 * CRITICAL: 참조가 남은 이미지는 삭제를 거부한다. 강제 삭제 옵션을 두지 않는다 —
 *           참조가 남은 채 파일이 사라지면 `astro build`가 실패한다.
 */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fail } from '../errors.mjs';
import { ensureDir, exists, removeFile, writeBinaryAtomic } from '../fsx.mjs';
import { assertInsideAllowedRoot, assertSafeFilename, dirs } from '../paths.mjs';
import { idFromParts, readPostFile, scanPostFiles } from '../content.mjs';
import { findProfilePhoto } from './profile.mjs';

/** 상한 8MB. 리사이즈는 하지 않는다 — 원본 그대로 두고 Astro 이미지 파이프라인에 맡긴다. */
const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);

/**
 * 매직 바이트 → 실제 포맷.
 * @param {Buffer} buffer
 * @returns {string | null}
 */
function detectFormat(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (buffer.subarray(0, 3).toString('latin1') === 'GIF') return 'gif';
  if (
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp';
  }
  // AVIF는 ISOBMFF 컨테이너다. ftyp 브랜드로 판정한다.
  if (buffer.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('latin1');
    if (brand.startsWith('avif') || brand.startsWith('avis') || brand.startsWith('mif1')) {
      return 'avif';
    }
  }
  return null;
}

/** 확장자가 기대하는 포맷 집합. jpg/jpeg는 같은 포맷이다. */
const EXTENSION_FORMAT = {
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.png': 'png',
  '.webp': 'webp',
  '.avif': 'avif',
  '.gif': 'gif',
};

/**
 * 파일명 정규화: 소문자화 → 공백·언더바를 하이픈으로 → 허용 문자 외 제거.
 * @param {string} filename
 */
function normalizeName(filename) {
  const extension = path.extname(filename).toLowerCase();
  const base = filename
    .slice(0, filename.length - path.extname(filename).length)
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9.-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return { base: base || 'image', extension };
}

/**
 * 중복이면 `-2`, `-3` 접미를 붙인다.
 * @param {string} assetsDir
 * @param {string} base
 * @param {string} extension
 */
async function uniqueName(assetsDir, base, extension) {
  let candidate = `${base}${extension}`;
  let counter = 2;
  while (await exists(path.join(assetsDir, candidate))) {
    candidate = `${base}-${counter}${extension}`;
    counter += 1;
  }
  return candidate;
}

/**
 * 이미지 치수. sharp가 실패해도 업로드를 막지 않는다.
 * @param {string} file
 */
async function readDimensions(file) {
  try {
    const { default: sharp } = await import('sharp');
    const meta = await sharp(file).metadata();
    return { width: meta.width ?? null, height: meta.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

/**
 * 각 이미지가 어느 글에서 쓰이는지 찾는다.
 * 프론트매터 `cover`와 본문 텍스트 양쪽을 본다.
 *
 * @param {string} projectRoot
 * @param {string[]} names
 */
async function collectUsage(projectRoot, names) {
  /** @type {Record<string, { id: string, field: string }[]>} */
  const usage = {};
  for (const name of names) usage[name] = [];

  const files = await scanPostFiles(projectRoot);
  for (const entry of files) {
    const { frontmatter, body } = await readPostFile(entry.file);
    const id = idFromParts(entry.category, entry.base);
    const cover = typeof frontmatter.cover === 'string' ? frontmatter.cover : '';
    for (const name of names) {
      if (cover.endsWith(`/${name}`) || cover === name) usage[name].push({ id, field: 'cover' });
      else if (body.includes(name)) usage[name].push({ id, field: 'body' });
    }
  }
  return usage;
}

/** @param {{ projectRoot: string }} ctx */
export async function listAssets({ projectRoot }) {
  const assetsDir = dirs(projectRoot).assets;
  let entries;
  try {
    entries = await readdir(assetsDir, { withFileTypes: true });
  } catch {
    return { assets: [], maxBytes: MAX_BYTES };
  }

  const files = entries
    .filter((entry) => entry.isFile() && ALLOWED.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort();

  const usage = await collectUsage(projectRoot, files);

  const assets = [];
  for (const name of files) {
    const file = path.join(assetsDir, name);
    const stats = await stat(file);
    const { width, height } = await readDimensions(file);
    assets.push({
      name,
      ext: path.extname(name).toLowerCase(),
      bytes: stats.size,
      width,
      height,
      mtime: Math.floor(stats.mtimeMs),
      usedBy: usage[name] ?? [],
    });
  }

  return { assets, maxBytes: MAX_BYTES };
}

/** @param {{ body: any, projectRoot: string }} ctx */
export async function uploadAsset({ body, projectRoot }) {
  const filename = String(body.filename ?? '');
  const purpose = String(body.purpose ?? 'content');
  const dataBase64 = String(body.dataBase64 ?? '');

  const { base, extension } = normalizeName(filename);

  if (extension === '.svg') {
    throw fail('E-ASSET-TYPE', 'SVG는 업로드할 수 없습니다 (스크립트가 실행될 수 있습니다).', {
      field: 'filename',
    });
  }
  if (!ALLOWED.has(extension)) {
    throw fail(
      'E-ASSET-TYPE',
      `허용되지 않은 확장자입니다: ${extension || '(없음)'}. 허용: ${[...ALLOWED].join(', ')}`,
      { field: 'filename' },
    );
  }

  const buffer = Buffer.from(dataBase64, 'base64');
  if (buffer.length === 0) {
    throw fail('E-BAD-REQUEST', '이미지 데이터가 비어 있습니다.', { field: 'dataBase64' });
  }
  if (buffer.length > MAX_BYTES) {
    throw fail(
      'E-ASSET-TOO-LARGE',
      `파일이 상한 ${MAX_BYTES / 1024 / 1024}MB를 넘습니다 (${(buffer.length / 1024 / 1024).toFixed(1)}MB).`,
      { field: 'filename' },
    );
  }

  const actual = detectFormat(buffer);
  const expected = EXTENSION_FORMAT[/** @type {keyof typeof EXTENSION_FORMAT} */ (extension)];
  if (actual === null || actual !== expected) {
    throw fail(
      'E-ASSET-TYPE',
      `확장자(${extension})와 실제 파일 형식(${actual ?? '알 수 없음'})이 다릅니다.`,
      { field: 'filename' },
    );
  }

  const assetsDir = dirs(projectRoot).assets;
  await ensureDir(assetsDir);

  let name;
  if (purpose === 'profile-photo') {
    // CRITICAL: 프로필 사진은 정확히 하나여야 한다. 기존 profile.* 를 전부 지운다 —
    // 둘 이상 남으면 `import.meta.glob` 결과의 첫 항목이 무엇인지 보장되지 않는다.
    const existing = await findProfilePhoto(projectRoot);
    for (const stale of [existing.name, ...existing.duplicates]) {
      if (!stale) continue;
      const staleFile = path.join(assetsDir, stale);
      await assertInsideAllowedRoot(projectRoot, staleFile);
      await removeFile(staleFile);
    }
    name = `profile${extension}`;
  } else {
    name = await uniqueName(assetsDir, base, extension);
  }

  assertSafeFilename(name);
  const file = path.join(assetsDir, name);
  await assertInsideAllowedRoot(projectRoot, file);
  await writeBinaryAtomic(file, buffer);

  const { width, height } = await readDimensions(file);

  // CRITICAL: 상대 경로 단계 수를 하드코딩하지 않는다. 글이 놓이는 깊이에서 계산한다.
  const samplePostDir = path.join(dirs(projectRoot).posts, 'category');
  const relativeFromPost = path.relative(samplePostDir, file).split(path.sep).join('/');

  return {
    name,
    path: path.relative(projectRoot, file).split(path.sep).join('/'),
    relativeFromPost,
    width,
    height,
    bytes: buffer.length,
  };
}

/** @param {{ params: Record<string, string>, projectRoot: string }} ctx */
export async function deleteAsset({ params, projectRoot }) {
  const name = assertSafeFilename(String(params.name ?? ''), 'name');
  const file = path.join(dirs(projectRoot).assets, name);
  await assertInsideAllowedRoot(projectRoot, file);

  if (!(await exists(file))) {
    throw fail('E-NOT-FOUND', `이미지를 찾을 수 없습니다: ${name}`, { field: 'name' });
  }

  const usage = await collectUsage(projectRoot, [name]);
  const usedBy = usage[name] ?? [];
  if (usedBy.length > 0) {
    throw fail('E-ASSET-IN-USE', `글 ${usedBy.length}편이 이 이미지를 사용 중입니다.`, {
      field: 'name',
      detail: { usedBy },
    });
  }

  await removeFile(file);
  return { deleted: name };
}
