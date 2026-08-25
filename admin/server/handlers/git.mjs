// @ts-check
/**
 * git 워킹 트리 읽기 + 커밋 · 푸시.
 *
 * CRITICAL: 셸을 경유하지 않는다(`exec` 금지). `execFile`로 **인자 배열**만 넘긴다.
 * 커밋 메시지와 파일 경로가 사용자 입력이므로 이 규칙이 곧 인젝션 방어다.
 * 메시지를 셸 문자열로 조립하는 순간 `"; rm -rf ...`가 실행된다.
 *
 * CRITICAL: `push`는 곧 **공개 배포**다. 되돌리기 어려운 외부 행위이므로
 *   - 강제 푸시(`--force`)를 어떤 경로로도 하지 않는다
 *   - 브랜치·원격을 관리자가 바꾸지 않는다(현재 업스트림으로만 보낸다)
 *   - 초안 글 수를 함께 돌려주어 화면이 확인 전에 경고할 수 있게 한다
 *
 * git이 없거나 리포지토리가 아니면 오류가 아니라 `{ available: false }`로 응답한다.
 * 관리자의 다른 기능은 git 없이도 전부 동작해야 한다.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AdminError, fail } from '../errors.mjs';
import { describePost, getValidator, scanPostFiles } from '../content.mjs';

const run = promisify(execFile);

/** 커밋 메시지 상한. git 자체에는 제한이 없지만 폼에서 온 값이므로 경계를 둔다. */
const MAX_MESSAGE_BYTES = 2000;

/**
 * @param {string} cwd
 * @param {string[]} args
 */
async function git(cwd, args) {
  return run('git', args, { cwd, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
}

/**
 * git 실패의 stderr를 사람이 읽을 문장으로.
 * @param {any} error
 * @returns {string}
 */
function gitErrorMessage(error) {
  const stderr = String(error?.stderr ?? '').trim();
  const stdout = String(error?.stdout ?? '').trim();
  return stderr || stdout || String(error?.message ?? error);
}

/**
 * `git status --porcelain=v1 -z`를 파싱한다.
 * @param {string} stdout
 */
function parseStatus(stdout) {
  /** @type {{ status: string, path: string }[]} */
  const files = [];
  // -z는 NUL 구분이다. rename(R)·copy(C) 항목은 "새이름\0옛이름" 두 조각을 쓴다.
  const records = stdout.split('\0');
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    if (!record) continue;
    const status = record.slice(0, 2);
    const target = record.slice(3);
    if (status[0] === 'R' || status[0] === 'C') i += 1; // 옛 이름 조각을 건너뛴다
    files.push({ status: status.trim() || status, path: target });
  }
  return files;
}

/**
 * 업스트림 대비 앞선/뒤진 커밋 수. 업스트림이 없으면 null.
 * @param {string} projectRoot
 */
async function trackingInfo(projectRoot) {
  let upstream = null;
  try {
    const { stdout } = await git(projectRoot, [
      'rev-parse',
      '--abbrev-ref',
      '--symbolic-full-name',
      '@{u}',
    ]);
    upstream = stdout.trim();
  } catch {
    return { upstream: null, ahead: 0, behind: 0 };
  }

  try {
    const { stdout } = await git(projectRoot, [
      'rev-list',
      '--left-right',
      '--count',
      `${upstream}...HEAD`,
    ]);
    const [behind, ahead] = stdout.trim().split(/\s+/).map(Number);
    return { upstream, ahead: ahead || 0, behind: behind || 0 };
  } catch {
    return { upstream, ahead: 0, behind: 0 };
  }
}

/**
 * 원격 URL. 자격 증명이 박힌 URL은 사용자 자신의 것이므로 그대로 보여 준다.
 * @param {string} projectRoot
 * @returns {Promise<string | null>}
 */
async function remoteUrl(projectRoot) {
  try {
    const { stdout } = await git(projectRoot, ['remote', 'get-url', 'origin']);
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * 초안 글 수.
 *
 * CRITICAL: 푸시는 곧 배포다. 초안은 프로덕션 빌드에서 제외되지만 **파일 자체는 공개
 * 리포지토리로 올라간다.** 확인 화면이 그 사실을 알릴 수 있도록 함께 돌려준다.
 *
 * @param {string} projectRoot
 * @param {any} server
 * @returns {Promise<number>}
 */
async function countDrafts(projectRoot, server) {
  try {
    const validator = await getValidator(server);
    const files = await scanPostFiles(projectRoot);
    const items = await Promise.all(
      files.map((entry) => describePost(projectRoot, entry, validator)),
    );
    return items.filter((item) => item.draft).length;
  } catch {
    return 0;
  }
}

/** @param {{ projectRoot: string, server: any }} ctx */
export async function gitStatus({ projectRoot, server }) {
  let branch = null;
  try {
    const { stdout } = await git(projectRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
    branch = stdout.trim();
  } catch {
    return {
      available: false,
      branch: null,
      files: [],
      clean: true,
      upstream: null,
      ahead: 0,
      behind: 0,
      remote: null,
      drafts: 0,
    };
  }

  /** @type {{ status: string, path: string }[]} */
  let files = [];
  try {
    const { stdout } = await git(projectRoot, ['status', '--porcelain=v1', '-z']);
    files = parseStatus(stdout);
  } catch {
    files = [];
  }

  const [tracking, remote, drafts] = await Promise.all([
    trackingInfo(projectRoot),
    remoteUrl(projectRoot),
    countDrafts(projectRoot, server),
  ]);

  return {
    available: true,
    branch,
    files,
    clean: files.length === 0,
    remote,
    drafts,
    ...tracking,
  };
}

/**
 * 고른 파일을 스테이징하고 커밋한다.
 *
 * @param {{ body: any, projectRoot: string }} ctx
 */
export async function gitCommit({ body, projectRoot }) {
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (message === '') {
    throw fail('E-GIT', '커밋 메시지를 입력하세요.', { field: 'message' });
  }
  if (Buffer.byteLength(message, 'utf8') > MAX_MESSAGE_BYTES) {
    throw fail('E-GIT', `커밋 메시지가 너무 깁니다(${MAX_MESSAGE_BYTES}바이트 이내).`, {
      field: 'message',
    });
  }
  if (message.includes('\0')) {
    throw fail('E-GIT', '커밋 메시지에 허용되지 않는 문자가 있습니다.', { field: 'message' });
  }

  const files = Array.isArray(body.files) ? body.files.map(String).filter(Boolean) : [];
  if (files.length === 0) {
    throw fail('E-GIT', '커밋할 파일을 하나 이상 고르세요.', { field: 'files' });
  }
  // CRITICAL: 경로가 옵션으로 해석되지 않도록 `--` 뒤에만 넣는다.
  for (const file of files) {
    if (file.startsWith('-') || file.includes('\0')) {
      throw fail('E-GIT', `허용되지 않는 경로입니다: ${file}`, { field: 'files' });
    }
  }

  try {
    // `-A`는 삭제도 반영한다. 경로를 지정했으므로 고른 것만 대상이다.
    await git(projectRoot, ['add', '-A', '--', ...files]);
  } catch (error) {
    throw fail('E-GIT', `스테이징에 실패했습니다: ${gitErrorMessage(error)}`, { field: 'files' });
  }

  // 스테이징 결과가 비면 커밋할 것이 없다 — git이 종료 코드 1로 실패하기 전에 막는다.
  try {
    const { stdout } = await git(projectRoot, ['diff', '--cached', '--name-only']);
    if (stdout.trim() === '') {
      throw fail('E-GIT', '스테이징된 변경이 없습니다. 고른 파일이 이미 커밋되었을 수 있습니다.');
    }
  } catch (error) {
    // 위에서 우리가 던진 E-GIT는 그대로 올린다. git 자체 실패는 다음 단계가 다시 잡는다.
    if (error instanceof AdminError) throw error;
  }

  try {
    // CRITICAL: 메시지를 인자 배열로만 넘긴다. 셸을 거치지 않으므로 인용이 필요 없다.
    await git(projectRoot, ['commit', '-m', message]);
  } catch (error) {
    throw fail('E-GIT', `커밋에 실패했습니다: ${gitErrorMessage(error)}`);
  }

  let hash = null;
  try {
    const { stdout } = await git(projectRoot, ['rev-parse', '--short', 'HEAD']);
    hash = stdout.trim();
  } catch {
    /* 해시는 표시용이다 */
  }

  const tracking = await trackingInfo(projectRoot);
  return { hash, committed: files.length, ...tracking };
}

/**
 * 현재 브랜치를 업스트림으로 푸시한다.
 *
 * CRITICAL: `--force`를 쓰지 않는다. 원격 이력을 덮어쓰는 경로를 관리자에 두지 않는다.
 * 업스트림이 없으면 만들지 않고 거절한다 — 어느 원격으로 보낼지는 사람이 정할 일이다.
 *
 * @param {{ projectRoot: string }} ctx
 */
export async function gitPush({ projectRoot }) {
  const tracking = await trackingInfo(projectRoot);
  if (!tracking.upstream) {
    throw fail(
      'E-GIT',
      '업스트림 브랜치가 없습니다. 터미널에서 `git push -u origin <브랜치>`를 한 번 실행해 주세요.',
    );
  }
  if (tracking.ahead === 0) {
    throw fail('E-GIT', '푸시할 커밋이 없습니다.');
  }
  if (tracking.behind > 0) {
    throw fail(
      'E-GIT',
      `원격이 ${tracking.behind}개 커밋 앞서 있습니다. 터미널에서 \`git pull\`로 먼저 합친 뒤 푸시하세요.`,
    );
  }

  try {
    const { stdout, stderr } = await git(projectRoot, ['push']);
    const after = await trackingInfo(projectRoot);
    return { pushed: tracking.ahead, output: (stderr || stdout || '').trim(), ...after };
  } catch (error) {
    throw fail('E-GIT', `푸시에 실패했습니다: ${gitErrorMessage(error)}`);
  }
}

/**
 * 세션 응답에 실을 브랜치 이름만. 실패해도 던지지 않는다.
 * @param {string} projectRoot
 */
export async function currentBranch(projectRoot) {
  try {
    const { stdout } = await git(projectRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
    return stdout.trim();
  } catch {
    return null;
  }
}
