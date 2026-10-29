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
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  ['/admin/side-b', './admin/pages/side-b.astro'],
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
            plugins: [
              adminApiPlugin({ root: config.root, logger }),
              quietMusicCoverUploads({ root: config.root }),
            ],
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
      // 핸들러는 요청 시점에 동적으로 불러온다 — 인테그레이션 로딩 비용을 dev 기동에
      // 얹지 않기 위해서다.
      //
      // CRITICAL: 이 import는 Node의 ESM 캐시를 탄다. `admin/server/**` 코드를 고쳐도
      // **프로세스를 다시 띄우기 전에는 반영되지 않는다.** `astro dev stop` 후 다시
      // 시작해야 한다 — 파일 저장으로 일어나는 Astro/Vite 재시작은 같은 프로세스 안에서
      // 일어나므로 이 캐시를 비우지 못한다(실측).
      //
      // 위험한 이유는 "안 바뀜"이 아니라 **반쪽만 바뀜**이다. `src/**`(스키마·설정)는
      // Vite의 ssrLoadModule을 타서 즉시 갱신되므로, 새 스키마 + 옛 직렬화기 조합으로
      // 돌아 파일에 이상한 값이 남을 수 있다. 2026-08-26에 실제로 그랬다.
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

/**
 * Side B 커버를 올려도 dev 서버가 열린 탭을 전부 새로고침하지 않게 한다.
 *
 * 원인: `src/config/music.ts`가 `import.meta.glob('../assets/side-b/*')`로 커버를 모은다. 그
 * 폴더에 파일이 **생기면** Vite의 glob 플러그인이 `music.ts`를 갱신 대상에 넣고, `music.ts`는
 * 서버 쪽에만 있는 모듈이라 Astro(`astro:hmr-reload`)가 `full-reload`를 **모든 탭에** 보낸다.
 * 관리자 Side B 화면은 커버를 드롭한 순간 새로고침되어, 방금 추가한 행과 입력이 사라졌다(실측).
 *
 * 그래서 이 폴더의 `create`만 갱신 대상을 비운다. Astro 훅보다 먼저 돌도록 `order: 'post'`이며,
 * 이 플러그인은 일반(enforce 없음)이라 `enforce: 'post'`인 Astro 훅보다 앞선다.
 *
 * 비워도 잃는 것이 없다: 새 커버는 저장 전까지 아무 글도 참조하지 않고, 저장하면 `music.ts`가
 * 다시 쓰여(`update`) 평소 경로로 glob이 다시 평가된다. 저장 뒤 미참조 커버 정리(`delete`)와
 * 다른 모든 파일 변경은 건드리지 않는다.
 *
 * CRITICAL: `hotUpdate` 하나만 갖는 serve 전용 플러그인이다. 빌드 훅을 추가하지 않는다.
 *
 * @param {{ root: URL }} options
 */
function quietMusicCoverUploads({ root }) {
  const coversDir = fileURLToPath(new URL('./src/assets/side-b/', root));
  return {
    name: 'admin-console-quiet-music-covers',
    apply: 'serve',
    hotUpdate: {
      order: 'post',
      /** @param {{ type: string, file: string }} options */
      handler({ type, file }) {
        if (type !== 'create') return;
        const relative = path.relative(coversDir, path.resolve(file));
        if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return;
        if (path.dirname(relative) !== '.') return;
        return [];
      },
    },
  };
}
