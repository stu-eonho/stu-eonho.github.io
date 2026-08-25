// @ts-check
/**
 * 접근 제어 3중 게이트.
 *
 * 관리자 콘솔에는 인증·권한 개념이 없다. "로컬 루프백에서만 접근 가능"이 보안 경계이며,
 * 그 실체가 이 파일이다.
 *
 * 위협 모델: 운영자가 dev 서버를 켠 채 아무 웹사이트나 방문하면, 그 사이트의 스크립트가
 * `http://localhost:4321/__admin/api/...`로 요청을 보낼 수 있다. 응답은 CORS가 막지만
 * **요청 자체는 서버에 도달하며 부작용(파일 쓰기)은 이미 일어난다.**
 *
 * 방어 3중:
 *   1. 루프백 검사   — 원격 주소가 127.0.0.1 / ::1 이 아니면 403
 *   2. Origin 검사   — 변경 요청의 Origin이 dev 서버 자신의 오리진이 아니면 403
 *   3. 세션 토큰     — 변경 요청은 X-Admin-Token을 요구한다
 * 추가로 DNS 리바인딩 대비 Host 헤더 검사를 둔다.
 *
 * CRITICAL: `/session` 응답에 `Access-Control-Allow-Origin`을 절대 붙이지 않는다.
 * 크로스 오리진 페이지가 토큰을 읽지 못하는 것이 3번 방어의 근거다.
 */
import { randomBytes } from 'node:crypto';
import { fail } from './errors.mjs';

/** dev 서버 프로세스 메모리에만 사는 세션 토큰. 재시작하면 무효다. */
const SESSION_TOKEN = randomBytes(32).toString('hex');

/** 부작용이 있는 메서드. 여기에 Origin·토큰 게이트가 걸린다. */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);

/** 허용 Host 호스트명. 포트는 별도로 붙는다. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function getSessionToken() {
  return SESSION_TOKEN;
}

export function isRemoteAllowed() {
  return process.env.ADMIN_ALLOW_REMOTE === '1';
}

/**
 * `Host: localhost:4321` → `localhost`
 * @param {string | string[] | undefined} hostHeader
 * @returns {string | null}
 */
function hostnameOf(hostHeader) {
  if (typeof hostHeader !== 'string' || hostHeader === '') return null;
  if (hostHeader.startsWith('[')) {
    const close = hostHeader.indexOf(']');
    return close === -1 ? null : hostHeader.slice(0, close + 1);
  }
  return hostHeader.split(':')[0];
}

/**
 * 요청이 게이트를 통과하는지 검사한다. 실패하면 AdminError를 던진다.
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {{ remoteAddress: string, allowRemote: boolean }}
 */
export function assertAllowed(req) {
  const allowRemote = isRemoteAllowed();
  const method = (req.method ?? 'GET').toUpperCase();
  const remoteAddress = req.socket?.remoteAddress ?? '';

  // ---- 1. 루프백 검사 ----
  if (!allowRemote && !LOOPBACK_ADDRESSES.has(remoteAddress)) {
    throw fail('E-FORBIDDEN-ORIGIN', '로컬(루프백)에서만 접근할 수 있습니다.', {
      detail: { remoteAddress },
    });
  }

  // ---- DNS 리바인딩 대비: Host 헤더 검사 ----
  // 공격자 도메인이 127.0.0.1로 리바인딩되면 Origin 검사가 그 도메인 이름으로 통과할
  // 여지가 있다. Host를 함께 보면 두 겹이 된다.
  if (!allowRemote) {
    const hostname = hostnameOf(req.headers.host);
    if (!hostname || !LOOPBACK_HOSTS.has(hostname)) {
      throw fail('E-FORBIDDEN-ORIGIN', '허용되지 않은 Host 헤더입니다.', {
        detail: { host: req.headers.host ?? null },
      });
    }
  }

  // ---- 2. Origin 검사 (변경 요청 한정) ----
  if (MUTATING_METHODS.has(method)) {
    const origin = req.headers.origin;
    // CRITICAL: Origin이 아예 없는 변경 요청도 거절한다. 브라우저는 항상 붙인다 —
    // 없다는 것은 브라우저가 아니라는 뜻이고, curl로 우회하는 경로를 열어 둘 이유가 없다.
    if (typeof origin !== 'string' || origin === '') {
      throw fail('E-FORBIDDEN-ORIGIN', 'Origin 헤더가 없는 변경 요청은 허용되지 않습니다.');
    }
    let originHost;
    try {
      originHost = new URL(origin).hostname;
    } catch {
      throw fail('E-FORBIDDEN-ORIGIN', 'Origin 헤더를 해석할 수 없습니다.', {
        detail: { origin },
      });
    }
    const selfHost = hostnameOf(req.headers.host);
    const originIsLoopback = LOOPBACK_HOSTS.has(originHost) || originHost === '::1';
    const matchesSelf = selfHost !== null && originHost === hostnameOf(selfHost);
    if (!allowRemote && !(originIsLoopback && matchesSelf)) {
      throw fail('E-FORBIDDEN-ORIGIN', '다른 오리진에서 온 변경 요청은 허용되지 않습니다.', {
        detail: { origin },
      });
    }
    if (allowRemote && !matchesSelf) {
      throw fail('E-FORBIDDEN-ORIGIN', '다른 오리진에서 온 변경 요청은 허용되지 않습니다.', {
        detail: { origin },
      });
    }

    // ---- 3. 세션 토큰 ----
    const token = req.headers['x-admin-token'];
    if (typeof token !== 'string' || token !== SESSION_TOKEN) {
      throw fail('E-BAD-TOKEN', '세션 토큰이 없거나 일치하지 않습니다.');
    }
  }

  return { remoteAddress, allowRemote };
}
