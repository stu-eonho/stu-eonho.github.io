// @ts-check
/**
 * 원자적 쓰기와 mtime 스탬프.
 *
 * CRITICAL: 모든 쓰기는 같은 디렉터리의 임시 파일에 쓴 뒤 `rename`으로 교체한다.
 * 부분 기록된 파일이 남으면 dev 서버의 HMR이 깨진 파일을 읽고, 그 순간 사이트와 빌드가
 * 동시에 죽는다.
 *
 * CRITICAL: Windows에서 `rename`은 대상이 열려 있으면 실패할 수 있다(EPERM/EBUSY).
 * 50ms 간격 3회 재시도 후에도 실패하면 `E-WRITE-FAILED`로 올린다.
 */
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fail } from './errors.mjs';

const RENAME_RETRIES = 3;
const RENAME_DELAY_MS = 50;

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 파일의 mtime을 밀리초 정수로 읽는다. 없으면 null.
 * @param {string} file
 * @returns {Promise<number | null>}
 */
export async function mtimeOf(file) {
  try {
    const stats = await stat(file);
    return Math.floor(stats.mtimeMs);
  } catch {
    return null;
  }
}

/** @param {string} file */
export async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

/** @param {string} file */
export async function readText(file) {
  return readFile(file, 'utf8');
}

/**
 * 저장 시 충돌 검사. `baseMtime`이 디스크의 현재 mtime과 다르면 저장하지 않는다.
 *
 * CRITICAL: 에디터에서 파일을 직접 고쳤는데 관리자 탭이 옛 내용을 들고 있는 상황이
 * 실재한다. 이 검사가 없으면 한쪽 변경이 조용히 사라진다.
 *
 * @param {string} file
 * @param {number | null | undefined} baseMtime
 * @param {() => Promise<unknown>} [loadCurrent] 충돌 시 detail에 실을 디스크 현재 내용
 */
export async function assertFresh(file, baseMtime, loadCurrent) {
  if (baseMtime === null || baseMtime === undefined) return;
  const current = await mtimeOf(file);
  if (current === null) return; // 파일이 사라졌다 — 상위 핸들러가 E-NOT-FOUND로 다룬다
  if (current === baseMtime) return;
  const detail = {
    diskMtime: current,
    baseMtime,
    current: loadCurrent ? await loadCurrent() : null,
  };
  throw fail(
    'E-STALE',
    '이 파일이 관리자 밖에서 변경되었습니다. 디스크 내용과 비교한 뒤 다시 저장하세요.',
    { detail },
  );
}

/**
 * 원자적 텍스트 쓰기. 임시 파일 → rename.
 * @param {string} file
 * @param {string} contents
 * @returns {Promise<number>} 새 mtime
 */
export async function writeTextAtomic(file, contents) {
  return writeAtomic(file, contents, 'utf8');
}

/**
 * 원자적 바이너리 쓰기.
 * @param {string} file
 * @param {Buffer} buffer
 */
export async function writeBinaryAtomic(file, buffer) {
  return writeAtomic(file, buffer, undefined);
}

/**
 * @param {string} file
 * @param {string | Buffer} data
 * @param {BufferEncoding} [encoding]
 * @returns {Promise<number>}
 */
async function writeAtomic(file, data, encoding) {
  const dir = path.dirname(file);
  await mkdir(dir, { recursive: true });
  const temp = path.join(dir, `.admin-tmp-${randomBytes(6).toString('hex')}`);

  try {
    await writeFile(temp, data, encoding ? { encoding } : undefined);
  } catch (error) {
    await rm(temp, { force: true }).catch(() => {});
    throw fail('E-WRITE-FAILED', `임시 파일을 만들지 못했습니다: ${path.basename(file)}`, {
      detail: { file, stage: 'temp-write', reason: String(error) },
    });
  }

  for (let attempt = 1; attempt <= RENAME_RETRIES; attempt += 1) {
    try {
      await rename(temp, file);
      const written = await mtimeOf(file);
      return written ?? Date.now();
    } catch (error) {
      if (attempt === RENAME_RETRIES) {
        await rm(temp, { force: true }).catch(() => {});
        throw fail(
          'E-WRITE-FAILED',
          `파일을 저장하지 못했습니다: ${path.basename(file)}. 원본은 그대로이며 변경 사항은 저장되지 않았습니다. 다른 프로그램이 이 파일을 열고 있는지 확인하세요.`,
          { detail: { file, stage: 'rename', reason: String(error) } },
        );
      }
      await sleep(RENAME_DELAY_MS);
    }
  }
  // 도달 불가 — 루프가 반드시 return 하거나 throw 한다
  throw fail('E-WRITE-FAILED', `파일을 저장하지 못했습니다: ${path.basename(file)}`);
}

/**
 * 파일 삭제. 없으면 조용히 넘어간다.
 * @param {string} file
 */
export async function removeFile(file) {
  await rm(file, { force: true });
}

/** @param {string} dir */
export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}
