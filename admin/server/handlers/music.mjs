// @ts-check
/**
 * `src/config/music.ts`의 `MUSIC`(Side B 곡·앨범 목록) 편집과 커버 정리.
 *
 * CRITICAL: `MUSIC` 초기자의 범위만 교체한다. 파일의 나머지 — 상단 문서 주석, `MusicEntry`
 * 인터페이스, `MUSIC_COVERS` glob, `musicCover` — 는 바이트 그대로 남는다.
 *
 * CRITICAL: 규칙(`genreKey`·`normalizeListenUrl`)은 `src/lib/music.ts` 한 곳에만 있다.
 * `loadMusicLib`로 불러 쓰고 여기서 다시 구현하지 않는다. 화면의 `listenService`는 프로토콜을
 * 보지 않으므로, 파일에 남는 `listenUrl`은 반드시 `normalizeListenUrl`을 통과한 값이어야 한다.
 *
 * CRITICAL: 커버 자동 삭제는 이 파일에서만, `src/assets/side-b/` 안에서만 일어난다.
 *   - `writeDeclaration`이 성공한 **뒤에만** 지운다. 쓰기가 던지면 아무것도 지우지 않는다.
 *   - 지울 후보는 방금 **저장한 값**이 참조하지 않는 이름이다(요청 원본이 아니라).
 *   - 후보는 **쓰기 전에 검증용으로 읽은 목록**에서만 고른다. 쓰기 뒤 폴더를 다시 읽지 않으므로
 *     저장이 도는 동안 올라온 커버는 후보가 되지 않는다(다음 저장 때 판단된다).
 *   - 일반 파일(심볼릭 링크·디렉터리 제외)이고 이미지 확장자인 것만 후보다. 지우기 직전에
 *     `lstat`으로 한 번 더 일반 파일인지 본다.
 *   - `side-b/` 자체가 심볼릭 링크·정션이면 정리를 통째로 건너뛴다 — `lstat`이 링크로 보거나,
 *     `realpath(side-b)`가 `realpath(src/assets)/side-b`와 다르면 그렇다.
 *   - 각 경로는 `assertInsideAllowedRoot`를 통과하고, 실제 위치가 `side-b/` 바로 아래여야 한다.
 *   - 정리 단계의 어떤 실패도 이미 끝난 저장을 오류로 바꾸지 않는다 — 터미널에 남기고 건너뛴다.
 *
 * 입력 검증: 문자열 필드(`title`·`artist`·`album`·`year`·`cover`)가 문자열이 아닌 값으로 오거나
 * `genres`가 문자열 배열이 아니면 조용히 비우지 않고 `E-VALIDATION`으로 거절한다 — 비워서
 * 저장하면 그 커버가 미참조로 보여 지워진다. 키가 없거나 `null`이면 "값 없음"이다.
 */
import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fail } from '../errors.mjs';
import { mtimeOf, removeFile } from '../fsx.mjs';
import { assertInsideAllowedRoot, dirs } from '../paths.mjs';
import { loadMusic, loadMusicLib } from '../project.mjs';
import { configFile, writeDeclaration } from '../codegen/configs.mjs';
import { ALLOWED } from './assets.mjs';

/** 이유(`note`) 상한. 언어별로 적용한다(문자열 하나면 그 문자열에). */
const NOTE_MAX = 140;

const YEAR_PATTERN = /^\d{4}$/;

/**
 * `src/assets/side-b/` 안의 커버 후보 파일명. 폴더가 없으면 빈 목록.
 *
 * CRITICAL: `isFile()`만 남긴다 — `Dirent.isFile()`은 심볼릭 링크에 false이므로 링크를 통해
 * 폴더 밖 파일을 커버로 삼거나 지우는 경로가 없다.
 *
 * @param {string} projectRoot
 * @returns {Promise<string[]>}
 */
export async function listMusicCovers(projectRoot) {
  let entries;
  try {
    entries = await readdir(dirs(projectRoot).musicCovers, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && ALLOWED.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort();
}

/** @param {unknown} value */
function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** 키가 없거나 `null`이면 "값 없음"으로 본다. 그 밖의 비문자열은 형식 오류다. @param {unknown} value */
function isWrongType(value) {
  return value !== undefined && value !== null && typeof value !== 'string';
}

/** 문자열 필드 이름 → 형식 오류 문구 */
const STRING_FIELDS = /** @type {const} */ ({
  title: '제목은 문자열이어야 합니다.',
  artist: '가수는 문자열이어야 합니다.',
  album: '앨범은 문자열이어야 합니다.',
  year: '연도는 문자열이어야 합니다.',
  cover: '커버는 파일명 문자열이어야 합니다.',
});

/**
 * 저장 전 처리. 순서는 고정이다 — 빈 제목 행 제거 → trim → 장르 → 링크 → 연도 → 이유 →
 * 커버 → 종류별 필드. 실패는 모아서 한 번에 던진다(`detail.issues`).
 *
 * 오류 `field`는 `music.<i>.<key>`이며 `i`는 **제출된** 배열의 인덱스다(빈 행을 버리기 전).
 * 화면의 행 순서와 같아야 오류가 맞는 행에 붙는다.
 *
 * @param {unknown} input
 * @param {{ genreKey: (name: string) => string, normalizeListenUrl: (raw: string) => string | null | undefined }} lib
 * @param {Set<string>} covers
 */
function sanitize(input, lib, covers) {
  if (!Array.isArray(input)) {
    throw fail('E-BAD-REQUEST', '`music`는 배열이어야 합니다.', { field: 'music' });
  }

  /** @type {{ field: string, message: string }[]} */
  const issues = [];
  /** @type {Record<string, unknown>[]} */
  const music = [];

  input.forEach((/** @type {any} */ raw, index) => {
    const row = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const at = (/** @type {string} */ key) => `music.${index}.${key}`;

    // 1. 제목이 빈 행은 버린다. 문자열이 아닌 제목은 빈 행이 아니라 형식 오류다.
    if (isWrongType(row.title)) {
      issues.push({ field: at('title'), message: STRING_FIELDS.title });
      return;
    }
    const title = str(row.title);
    if (!title) return;

    // 2. 문자열 필드 형식 검사 → trim. 형식이 틀린 값을 ''로 접으면 커버가 미참조로 보여
    //    저장 뒤 정리 단계에서 지워지므로 반드시 거절한다.
    for (const key of /** @type {const} */ (['artist', 'album', 'year', 'cover'])) {
      if (isWrongType(row[key])) issues.push({ field: at(key), message: STRING_FIELDS[key] });
    }
    const kind = row.kind;
    if (kind !== 'song' && kind !== 'album') {
      issues.push({
        field: at('kind'),
        message: '종류는 노래(song) 또는 앨범(album)이어야 합니다.',
      });
    }
    const artist = str(row.artist);
    const album = str(row.album);
    const year = str(row.year);
    const cover = str(row.cover);

    // 3. 장르: 빈 값 제거, `genreKey` 기준 중복 제거(처음 나온 표기를 남긴다).
    /** @type {string[]} */
    const genres = [];
    const seen = new Set();
    if (
      row.genres !== undefined &&
      row.genres !== null &&
      !(
        Array.isArray(row.genres) &&
        row.genres.every((/** @type {unknown} */ name) => typeof name === 'string')
      )
    ) {
      issues.push({ field: at('genres'), message: '장르는 문자열 목록이어야 합니다.' });
    }
    for (const name of Array.isArray(row.genres) ? row.genres : []) {
      const trimmed = str(name);
      if (!trimmed) continue;
      const key = lib.genreKey(trimmed);
      if (seen.has(key)) continue;
      seen.add(key);
      genres.push(trimmed);
    }

    // 4. 듣기 링크: 사이트와 같은 규칙으로 정규화. null이면 거절, undefined면 키 삭제.
    /** @type {string | undefined} */
    let listenUrl;
    if (typeof row.listenUrl === 'string') {
      const normalized = lib.normalizeListenUrl(row.listenUrl);
      if (normalized === null) {
        issues.push({
          field: at('listenUrl'),
          message: '듣기 링크는 http(s) 주소여야 합니다.',
        });
      } else {
        listenUrl = normalized;
      }
    } else if (row.listenUrl !== undefined && row.listenUrl !== null) {
      issues.push({ field: at('listenUrl'), message: '듣기 링크는 문자열이어야 합니다.' });
    }

    // 5. 연도.
    if (year && !YEAR_PATTERN.test(year)) {
      issues.push({ field: at('year'), message: '연도는 네 자리 숫자(YYYY)여야 합니다.' });
    }

    // 6. 이유: 문자열 하나 또는 { ko, en }. 언어별 140자.
    /** @type {string | { ko: string, en: string } | undefined} */
    let note;
    if (typeof row.note === 'string') {
      const value = row.note.trim();
      if (value.length > NOTE_MAX) {
        issues.push({ field: at('note'), message: `이유는 ${NOTE_MAX}자 이하여야 합니다.` });
      }
      if (value) note = value;
    } else if (row.note && typeof row.note === 'object' && !Array.isArray(row.note)) {
      const ko = str(row.note.ko);
      const en = str(row.note.en);
      for (const [lang, value] of /** @type {const} */ ([
        ['ko', ko],
        ['en', en],
      ])) {
        if (value.length > NOTE_MAX) {
          issues.push({
            field: at(`note.${lang}`),
            message: `이유(${lang})는 ${NOTE_MAX}자 이하여야 합니다.`,
          });
        }
      }
      // 한쪽만 채운 값은 그대로 둔다 — 화면이 다른 언어 값으로 대체한다. 둘 다 비면 생략.
      if (ko || en) note = { ko, en };
    } else if (row.note !== undefined && row.note !== null) {
      issues.push({ field: at('note'), message: '이유 형식이 올바르지 않습니다.' });
    }

    // 7. 커버는 `side-b/`에 실제로 있는 파일명이어야 한다.
    if (cover && !covers.has(cover)) {
      issues.push({
        field: at('cover'),
        message: `커버 파일을 찾을 수 없습니다: ${cover}`,
      });
    }

    // 8. 앨범 필드는 노래에만 남는다. 키 순서는 `MusicEntry` 선언 순서.
    /** @type {Record<string, unknown>} */
    const entry = { kind, title, artist };
    if (kind === 'song' && album) entry.album = album;
    if (year) entry.year = year;
    if (cover) entry.cover = cover;
    entry.genres = genres;
    if (note !== undefined) entry.note = note;
    if (listenUrl !== undefined) entry.listenUrl = listenUrl;
    music.push(entry);
  });

  if (issues.length > 0) {
    throw fail('E-VALIDATION', issues[0].message, {
      field: issues[0].field,
      detail: { issues },
    });
  }
  return music;
}

/** @param {{ projectRoot: string, server: any }} ctx */
export async function readMusic({ projectRoot, server }) {
  const file = configFile(projectRoot, 'music');
  const mod = await loadMusic(server);
  const [mtime, covers] = await Promise.all([mtimeOf(file), listMusicCovers(projectRoot)]);
  return {
    // JSON으로 직렬화 가능한 순수 값이다. ImageMetadata(`MUSIC_COVERS`)는 넘기지 않는다.
    music: JSON.parse(JSON.stringify(mod.MUSIC)),
    covers,
    mtime,
  };
}

/** @param {{ body: any, projectRoot: string, server: any, logger: any }} ctx */
export async function writeMusic({ body, projectRoot, server, logger }) {
  const file = configFile(projectRoot, 'music');
  const lib = await loadMusicLib(server);
  const covers = await listMusicCovers(projectRoot);
  const music = sanitize(body?.music, lib, new Set(covers));

  // 쓰기가 던지면(E-STALE·E-CODEGEN·E-WRITE-FAILED) 여기서 끝난다 — 아래 삭제에 닿지 않는다.
  const { mtime, changed } = await writeDeclaration({
    projectRoot,
    file,
    declName: 'MUSIC',
    value: music,
    baseMtime: body?.baseMtime,
    preserveComments: true,
    logger,
  });

  // 후보는 쓰기 **전** 목록(`covers`)에서만 — 저장 도중 올라온 업로드를 지우지 않는다.
  const removedCovers = await removeUnreferencedCovers(projectRoot, covers, music, logger);
  return { mtime, changed, removedCovers };
}

/**
 * 저장된 `MUSIC`이 참조하지 않는 `side-b/` 파일을 지운다. 지운 이름 목록을 돌려준다.
 *
 * 정리 단계의 실패는 저장을 실패로 만들지 않는다(이미 디스크에 쓰였다). 폴더 단위 검사가
 * 실패하면 아무것도 지우지 않고, 한 파일의 실패는 그 파일만 건너뛴다. 어느 쪽이든 터미널에
 * 남긴다 — 남은 파일은 다음 저장 때 다시 후보가 된다.
 *
 * @param {string} projectRoot
 * @param {string[]} candidates 쓰기 전에 읽은 커버 목록 — 이 안에서만 지운다
 * @param {Record<string, unknown>[]} saved
 * @param {any} logger
 */
async function removeUnreferencedCovers(projectRoot, candidates, saved, logger) {
  const referenced = new Set(
    saved.map((entry) => entry.cover).filter((cover) => typeof cover === 'string'),
  );
  const unreferenced = candidates.filter((name) => !referenced.has(name));
  if (unreferenced.length === 0) return [];

  const { assets, musicCovers: coversDir } = dirs(projectRoot);
  /** @type {string} */
  let realCoversDir;
  try {
    // `side-b/` 자체가 링크·정션이면 지울 범위가 폴더 밖으로 옮겨 갈 수 있다 — 정리하지 않는다.
    // Windows 정션은 Node의 lstat에서 심볼릭 링크로 보인다. 그래도 realpath 비교를 한 번 더 한다.
    if ((await lstat(coversDir)).isSymbolicLink()) {
      throw fail('E-PATH-ESCAPE', 'side-b 폴더가 링크입니다.');
    }
    realCoversDir = await assertInsideAllowedRoot(projectRoot, coversDir);
    const [realDir, realAssets] = await Promise.all([realpath(coversDir), realpath(assets)]);
    const expected = path.join(realAssets, 'side-b');
    if (realDir !== expected || realCoversDir !== expected) {
      throw fail('E-PATH-ESCAPE', 'side-b 폴더의 실제 위치가 src/assets/side-b가 아닙니다.');
    }
  } catch (error) {
    logger?.warn?.(`Side B 커버 정리를 건너뜁니다 — ${String(error)}`);
    return [];
  }

  /** @type {string[]} */
  const removed = [];
  for (const name of unreferenced) {
    const target = path.join(coversDir, name);
    try {
      // 목록을 읽은 뒤 링크·폴더로 바뀌었으면 지우지 않는다.
      if (!(await lstat(target)).isFile()) {
        throw fail('E-PATH-ESCAPE', '일반 파일이 아닙니다.');
      }
      const resolved = await assertInsideAllowedRoot(projectRoot, target);
      if (path.dirname(resolved) !== realCoversDir) {
        throw fail('E-PATH-ESCAPE', '잘못된 경로입니다.', { detail: { attempted: resolved } });
      }
      await removeFile(resolved);
      removed.push(name);
    } catch (error) {
      logger?.warn?.(`Side B 커버 정리 실패: ${name} — ${String(error)}`);
    }
  }
  return removed;
}
