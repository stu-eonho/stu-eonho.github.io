// @ts-check
/**
 * 관리자 콘솔 Astro 인테그레이션.
 *
 * CRITICAL: `command !== 'dev'`이거나 `ADMIN_DISABLED=1`이면 `astro:config:setup`에서
 * **아무것도 하지 않고 반환한다.** 라우트도, Vite 플러그인도, 미들웨어도 등록하지 않는다.
 * 이것이 프로덕션 배제의 유일한 지점이다.
 *
 * CRITICAL: 프로덕션 경로에서 유일하게 남는 것은 `astro:build:done` 가드 하나이며,
 * 이 훅은 검사만 하고 산출물을 만들지 않는다.
 */
import { buildGuard } from './build-guard.mjs';

/**
 * 네이티브 동적 import.
 *
 * CRITICAL: `import(...)`를 그대로 쓰면 안 된다. Astro는 설정과 인테그레이션을 Vite의
 * 모듈 러너로 읽은 뒤 그 러너를 **닫는다.** 이 파일 안의 `import()`는 Vite가
 * `__vite_ssr_dynamic_import__`로 바꿔 두므로, 요청 시점에 부르면 닫힌 러너를 타고
 * "Vite module runner has been closed"로 실패한다(실측으로 확인했다).
 *
 * `Function` 생성자 안의 코드는 Vite가 변환하지 않으므로 진짜 Node ESM import가 된다.
 * 이렇게 불러 온 `middleware.mjs`부터는 Node의 모듈 그래프이므로 그 안의 상대 경로
 * 동적 import도 정상으로 동작한다.
 */
const nativeImport = /** @type {(specifier: string) => Promise<any>} */ (
  new Function('specifier', 'return import(specifier)')
);

const MIDDLEWARE_URL = new URL('./server/middleware.mjs', import.meta.url).href;

/**
 * dev에서만 주입되는 관리자 라우트.
 * entrypoint는 프로젝트 루트 기준 상대 경로다.
 */
const ADMIN_ROUTES = [
  ['/admin', './admin/pages/index.astro'],
  ['/admin/posts', './admin/pages/posts.astro'],
  ['/admin/posts/edit', './admin/pages/editor.astro'],
  ['/admin/profile', './admin/pages/profile.astro'],
  ['/admin/settings', './admin/pages/settings.astro'],
  ['/admin/strings', './admin/pages/strings.astro'],
  ['/admin/tags', './admin/pages/tags.astro'],
  ['/admin/assets', './admin/pages/assets.astro'],
];

export default function adminConsole() {
  return {
    name: 'admin-console',
    hooks: {
      /**
       * @param {{ command: string, injectRoute: (route: { pattern: string, entrypoint: string, prerender?: boolean }) => void, updateConfig: (config: any) => void, config: any, logger: any }} ctx
       */
      'astro:config:setup': ({ command, injectRoute, updateConfig, config, logger }) => {
        // CRITICAL: 유일한 배제 지점. 이 두 줄 아래로는 프로덕션에서 절대 도달하지 않는다.
        if (command !== 'dev') return;
        if (process.env.ADMIN_DISABLED === '1') {
          logger.info('ADMIN_DISABLED=1 — 관리자 콘솔을 등록하지 않습니다.');
          return;
        }

        for (const [pattern, entrypoint] of ADMIN_ROUTES) {
          // prerender를 명시하지 않는다 — `output: 'static'`에서 on-demand 라우트를
          // 요구하면 어댑터가 필요해진다. dev 서버는 어차피 요청마다 다시 렌더한다.
          injectRoute({ pattern, entrypoint });
        }

        updateConfig({
          vite: {
            plugins: [adminApiPlugin({ root: config.root, logger })],
          },
        });

        const allowRemote = process.env.ADMIN_ALLOW_REMOTE === '1';
        logger.info('관리자 콘솔이 활성화되었습니다 — /admin');
        if (allowRemote) {
          logger.warn(
            'ADMIN_ALLOW_REMOTE=1 — 같은 네트워크의 누구나 이 리포지토리를 수정할 수 있습니다.',
          );
        }
      },

      // 프로덕션에서도 도는 유일한 훅. 검사만 한다.
      'astro:build:done': buildGuard,
    },
  };
}

/**
 * 관리자 JSON API를 dev 서버에 붙이는 Vite 플러그인.
 *
 * CRITICAL: `configureServer` 하나만 갖는다. `transform`·`resolveId`·`generateBundle`
 * 같은 빌드 훅을 추가하지 않는다 — 추가하는 순간 프로덕션 번들 경로에 발을 들인다.
 *
 * @param {{ root: URL, logger: any }} options
 */
function adminApiPlugin({ root, logger }) {
  return {
    name: 'admin-console-api',
    apply: 'serve',
    /** @param {any} server */
    configureServer(server) {
      // 핸들러는 요청 시점에 동적으로 불러온다. 인테그레이션 로딩 비용을 dev 기동에
      // 얹지 않고, 핸들러 코드를 고쳤을 때 서버 재시작 없이 반영되게 한다.
      /**
       * @param {import('node:http').IncomingMessage} req
       * @param {import('node:http').ServerResponse} res
       * @param {(err?: unknown) => void} next
       */
      const handler = async (req, res, next) => {
        try {
          const { handleAdminRequest } = await nativeImport(MIDDLEWARE_URL);
          await handleAdminRequest(req, res, { root, server, logger });
        } catch (error) {
          logger.error(`관리자 API 미들웨어 로딩 실패: ${String(error)}`);
          next(error);
        }
      };
      server.middlewares.use('/__admin/api', handler);
    },
  };
}
