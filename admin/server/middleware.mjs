// @ts-check
/**
 * 관리자 JSON API 라우터.
 *
 * 마운트 접두사는 `/__admin/api`이며, Vite dev 서버의 Connect 미들웨어가 처리한다.
 *
 * CRITICAL: `src/pages/api/`에 엔드포인트를 만들면 `output: 'static'`에서 프리렌더
 * 대상이 되어 POST가 동작하지 않고, 프로덕션 빌드 산출물에도 흔적이 남는다.
 *
 * CRITICAL: 모든 실패는 오류 봉투를 지킨다. 여기서 처리되지 않은 예외를 잡아
 * `E-INTERNAL`로 감싸며, 스택 트레이스는 터미널에만 찍고 응답 본문에 넣지 않는다.
 */
import { AdminError, fail } from './errors.mjs';
import { assertAllowed } from './guard.mjs';
import { toProjectRoot } from './paths.mjs';

/** 본문 상한 12MB. 초과 시 즉시 413으로 끊고 스트림을 파기한다. */
const MAX_BODY_BYTES = 12 * 1024 * 1024;

/**
 * 라우트 표. `[method, 패턴, 모듈, 내보낸 함수명]`.
 * 패턴의 `:name`은 한 세그먼트를 잡는다.
 */
const ROUTES = [
  ['GET', '/session', './handlers/session.mjs', 'getSession'],

  ['GET', '/posts', './handlers/posts.mjs', 'listPosts'],
  ['POST', '/posts', './handlers/posts.mjs', 'createPost'],
  ['POST', '/posts/:id/translation', './handlers/posts.mjs', 'createTranslation'],
  ['GET', '/posts/:id', './handlers/posts.mjs', 'readPost'],
  ['PUT', '/posts/:id', './handlers/posts.mjs', 'updatePost'],
  ['DELETE', '/posts/:id', './handlers/posts.mjs', 'deletePost'],

  ['POST', '/preview', './handlers/preview.mjs', 'renderPreview'],

  ['GET', '/profile', './handlers/profile.mjs', 'readProfile'],
  ['PUT', '/profile', './handlers/profile.mjs', 'writeProfile'],

  ['GET', '/config/site', './handlers/config.mjs', 'readSite'],
  ['PUT', '/config/site', './handlers/config.mjs', 'writeSite'],
  ['GET', '/config/categories', './handlers/config.mjs', 'readCategories'],
  ['GET', '/config/icons', './handlers/config.mjs', 'listIcons'],
  ['PUT', '/config/categories', './handlers/config.mjs', 'writeCategories'],

  ['GET', '/strings', './handlers/strings.mjs', 'readStrings'],
  ['PUT', '/strings', './handlers/strings.mjs', 'writeStrings'],

  ['GET', '/tags', './handlers/tags.mjs', 'listTags'],
  ['POST', '/tags/rename', './handlers/tags.mjs', 'renameTag'],
  ['POST', '/tags/merge', './handlers/tags.mjs', 'mergeTags'],
  ['POST', '/tags/delete', './handlers/tags.mjs', 'deleteTag'],

  ['GET', '/assets', './handlers/assets.mjs', 'listAssets'],
  ['POST', '/assets', './handlers/assets.mjs', 'uploadAsset'],
  ['DELETE', '/assets/:name', './handlers/assets.mjs', 'deleteAsset'],

  ['GET', '/git/status', './handlers/git.mjs', 'gitStatus'],
  ['POST', '/git/commit', './handlers/git.mjs', 'gitCommit'],
  ['POST', '/git/push', './handlers/git.mjs', 'gitPush'],
];

/**
 * 패턴을 요청 경로에 맞춰 본다.
 * @param {string} pattern
 * @param {string[]} segments
 * @returns {Record<string, string> | null}
 */
function matchPattern(pattern, segments) {
  const parts = pattern.split('/').filter(Boolean);
  if (parts.length !== segments.length) return null;
  /** @type {Record<string, string>} */
  const params = {};
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part.startsWith(':')) {
      params[part.slice(1)] = decodeURIComponent(segments[i]);
    } else if (part !== segments[i]) {
      return null;
    }
  }
  return params;
}

/**
 * 요청 본문을 JSON으로 읽는다. 빈 본문은 `{}`.
 * @param {import('node:http').IncomingMessage} req
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    let total = 0;
    let settled = false;

    /** @param {unknown} error */
    const bail = (error) => {
      if (settled) return;
      settled = true;
      // 나머지 바이트를 버린다. 여기서 소켓을 바로 파기하면 클라이언트가 413 응답을
      // 읽지 못하고 연결 오류만 보게 된다 — 응답을 보낸 뒤에 미들웨어가 끊는다.
      req.pause();
      reject(error);
    };

    req.on('data', (chunk) => {
      if (settled) return;
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        bail(
          fail(
            'E-PAYLOAD-TOO-LARGE',
            `요청 본문이 상한(${Math.round(MAX_BODY_BYTES / 1024 / 1024)}MB)을 넘었습니다.`,
          ),
        );
        return;
      }
      chunks.push(chunk);
    });

    req.on('error', (error) => bail(fail('E-BAD-REQUEST', `요청을 읽지 못했습니다: ${error}`)));

    req.on('end', () => {
      if (settled) return;
      settled = true;
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (raw === '') {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(fail('E-BAD-REQUEST', '요청 본문이 올바른 JSON이 아닙니다.'));
      }
    });
  });
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} payload
 */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Origin');
  // CRITICAL: Access-Control-Allow-Origin을 절대 붙이지 않는다. 크로스 오리진 페이지가
  // /session 응답(토큰)을 읽지 못하는 것이 세션 토큰 방어의 근거다.
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.end(body);
}

/**
 * 관리자 API 요청 하나를 처리한다.
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {{ root: URL | string, server: any, logger: any }} context
 */
export async function handleAdminRequest(req, res, { root, server, logger }) {
  const method = (req.method ?? 'GET').toUpperCase();
  const url = new URL(req.url ?? '/', 'http://localhost');
  const segments = url.pathname.split('/').filter(Boolean);

  try {
    // ---- 게이트 3중. 라우트를 찾기 전에 통과해야 한다. ----
    const gate = assertAllowed(req);

    /** @type {null | { module: string, name: string, params: Record<string, string> }} */
    let matched = null;
    let pathExists = false;

    for (const [routeMethod, pattern, module, name] of ROUTES) {
      const params = matchPattern(pattern, segments);
      if (!params) continue;
      pathExists = true;
      if (routeMethod !== method) continue;
      matched = { module, name, params };
      break;
    }

    if (!matched) {
      if (pathExists) {
        throw fail('E-METHOD', `${method}는 이 엔드포인트에서 허용되지 않습니다.`);
      }
      throw fail('E-NOT-FOUND', `알 수 없는 관리자 API 경로입니다: /${segments.join('/')}`);
    }

    const body = method === 'GET' || method === 'DELETE' ? {} : await readJsonBody(req);
    const handlers = await import(matched.module);
    const handler = handlers[matched.name];
    if (typeof handler !== 'function') {
      throw fail('E-INTERNAL', `핸들러를 찾지 못했습니다: ${matched.name}`);
    }

    const data = await handler({
      params: matched.params,
      query: url.searchParams,
      body,
      projectRoot: toProjectRoot(root),
      server,
      logger,
      allowRemote: gate.allowRemote,
    });

    sendJson(res, 200, { ok: true, data: data ?? null });
  } catch (error) {
    if (error instanceof AdminError) {
      // 보안 게이트 거절은 터미널에 출발지를 남긴다.
      if (error.code === 'E-FORBIDDEN-ORIGIN' || error.code === 'E-PATH-ESCAPE') {
        logger.warn(
          `관리자 API 요청 거절 [${error.code}] ${method} ${url.pathname} — ${JSON.stringify(error.detail)}`,
        );
      }
      // CRITICAL: E-PATH-ESCAPE는 시도한 경로를 응답에 되비추지 않는다.
      const envelope = error.toEnvelope();
      if (error.code === 'E-PATH-ESCAPE' || error.code === 'E-FORBIDDEN-ORIGIN') {
        envelope.error.detail = null;
      }
      sendJson(res, error.status, envelope);
      // 본문 상한을 넘긴 요청은 응답을 보낸 뒤에 소켓을 끊는다. 남은 바이트를 끝까지
      // 읽어 주면 상한을 두는 의미가 없다.
      if (error.code === 'E-PAYLOAD-TOO-LARGE') req.destroy();
      return;
    }

    // CRITICAL: 스택 트레이스는 터미널에만. 응답 본문에 넣지 않는다.
    const stack = error instanceof Error ? (error.stack ?? error.message) : String(error);
    logger.error(`관리자 API 내부 오류 ${method} ${url.pathname}\n${stack}`);
    sendJson(res, 500, {
      ok: false,
      error: {
        code: 'E-INTERNAL',
        message: '예상치 못한 오류입니다. 터미널 로그를 확인하세요.',
        field: null,
        detail: null,
      },
    });
  }
}
