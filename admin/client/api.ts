/**
 * 관리자 API 클라이언트.
 *
 * - 세션 토큰을 한 번 받아 두고 변경 요청 헤더에 실는다
 * - 오류 봉투를 해석해 `AdminApiError`로 던진다
 * - `E-BAD-TOKEN`이면 토큰을 한 번 갱신하고 원 요청을 1회만 재시도한다
 * - 네트워크 실패(dev 서버 종료)는 상단 고정 배너 + 5초 폴링으로 다룬다
 *
 * CRITICAL: 편집 중 내용은 어떤 실패에서도 지우지 않는다.
 */
import { L } from '../labels';

const BASE = '/__admin/api';

export interface AdminErrorBody {
  code: string;
  message: string;
  field: string | null;
  detail: unknown;
}

export class AdminApiError extends Error {
  code: string;
  field: string | null;
  detail: unknown;
  status: number;

  constructor(body: AdminErrorBody, status: number) {
    super(body.message);
    this.name = 'AdminApiError';
    this.code = body.code;
    this.field = body.field;
    this.detail = body.detail;
    this.status = status;
  }
}

/** dev 서버 연결이 끊겼을 때. 오류 코드가 없다. */
export class AdminOfflineError extends Error {
  constructor() {
    super(L.errors.network);
    this.name = 'AdminOfflineError';
  }
}

export interface SessionInfo {
  token: string;
  projectRoot: string;
  siteTitle: string;
  siteUrl: string;
  gitBranch: string | null;
  allowRemote: boolean;
  categories: {
    id: string;
    label: string;
    labelKo: string;
    description: { ko: string; en: string };
    icon: string;
    order: number;
    metaPanel: 'paper' | 'project' | 'none';
  }[];
  languages: { id: string; code: string; nativeName: string }[];
  defaultLang: string;
  env: { publicSiteUrl: boolean; goatcounter: boolean };
}

let session: SessionInfo | null = null;
let sessionPromise: Promise<SessionInfo> | null = null;

async function fetchSession(): Promise<SessionInfo> {
  const response = await rawRequest('GET', '/session', undefined, null);
  session = response as SessionInfo;
  return session;
}

/** 현재 세션. 없으면 받아 온다. 페이지 로드 시 가장 먼저 호출한다. */
export function getSession(): Promise<SessionInfo> {
  if (session) return Promise.resolve(session);
  if (!sessionPromise) {
    sessionPromise = fetchSession().finally(() => {
      sessionPromise = null;
    });
  }
  return sessionPromise;
}

export function cachedSession(): SessionInfo | null {
  return session;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function rawRequest(
  method: string,
  path: string,
  body: unknown,
  token: string | null,
): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8';
  if (token && MUTATING.has(method)) headers['X-Admin-Token'] = token;

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      // 같은 오리진 전용이다. 크로스 오리진 자격 증명을 보내지 않는다.
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new AdminOfflineError();
  }

  let payload: { ok?: boolean; data?: unknown; error?: AdminErrorBody };
  try {
    payload = await response.json();
  } catch {
    throw new AdminApiError(
      { code: 'E-INTERNAL', message: L.errors.unknown, field: null, detail: null },
      response.status,
    );
  }

  if (!response.ok || payload.ok === false) {
    const error = payload.error ?? {
      code: 'E-INTERNAL',
      message: L.errors.unknown,
      field: null,
      detail: null,
    };
    throw new AdminApiError(error, response.status);
  }

  return payload.data;
}

/**
 * 관리자 API 호출.
 *
 * CRITICAL: `E-BAD-TOKEN` 재시도는 정확히 1회다. 무한 재시도는 dev 서버가 죽은 상황에서
 * 요청 폭풍을 만든다.
 */
export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const needsToken = MUTATING.has(method);
  const current = needsToken ? (await getSession()).token : null;

  try {
    return (await rawRequest(method, path, body, current)) as T;
  } catch (error) {
    if (error instanceof AdminApiError && error.code === 'E-BAD-TOKEN' && needsToken) {
      session = null;
      const refreshed = await getSession();
      try {
        return (await rawRequest(method, path, body, refreshed.token)) as T;
      } catch (retryError) {
        if (retryError instanceof AdminApiError && retryError.code === 'E-BAD-TOKEN') {
          throw new AdminApiError(
            { ...retryError, message: L.errors.sessionExpired } as AdminErrorBody,
            retryError.status,
          );
        }
        throw retryError;
      }
    }
    throw error;
  }
}

export const get = <T = unknown>(path: string) => api<T>('GET', path);
export const post = <T = unknown>(path: string, body?: unknown) => api<T>('POST', path, body ?? {});
export const put = <T = unknown>(path: string, body?: unknown) => api<T>('PUT', path, body ?? {});
export const del = <T = unknown>(path: string) => api<T>('DELETE', path);

/* ==========================================================================
   토스트
   ========================================================================== */

type ToastKind = 'success' | 'error';

function toastRoot(): HTMLElement {
  let root = document.querySelector<HTMLElement>('.admin-toasts');
  if (!root) {
    root = document.createElement('div');
    root.className = 'admin-toasts';
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }
  return root;
}

/**
 * 토스트를 띄운다. 성공은 4초 후 자동 소멸, 실패는 수동으로 닫을 때까지 유지한다.
 * 실패 토스트에는 오류 코드를 작게 표기해 사용자가 그대로 옮겨 적을 수 있게 한다.
 */
export function toast(kind: ToastKind, message: string, code?: string): void {
  const root = toastRoot();
  const item = document.createElement('div');
  item.className = `admin-toast admin-toast-${kind}`;

  const text = document.createElement('span');
  text.className = 'admin-toast-text';
  text.textContent = message;
  item.appendChild(text);

  if (code) {
    const badge = document.createElement('span');
    badge.className = 'admin-toast-code';
    badge.textContent = code;
    item.appendChild(badge);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'admin-toast-close';
  close.setAttribute('aria-label', '알림 닫기');
  close.textContent = '×';
  close.addEventListener('click', () => item.remove());
  item.appendChild(close);

  root.appendChild(item);

  if (kind === 'success') {
    window.setTimeout(() => item.remove(), 4000);
  }
}

/** 예외를 토스트로 옮긴다. 오프라인은 배너가 맡으므로 토스트를 띄우지 않는다. */
export function reportError(error: unknown): void {
  if (error instanceof AdminOfflineError) {
    showOfflineBanner();
    return;
  }
  if (error instanceof AdminApiError) {
    toast('error', error.message, error.code);
    return;
  }
  toast('error', L.errors.unknown);
}

/* ==========================================================================
   오프라인 배너
   ========================================================================== */

let offlineTimer: number | null = null;

export function showOfflineBanner(): void {
  if (document.querySelector('.admin-offline')) return;

  const banner = document.createElement('div');
  banner.className = 'admin-offline';
  banner.setAttribute('role', 'status');
  banner.textContent = L.app.offline;
  document.body.prepend(banner);
  document.documentElement.classList.add('admin-has-offline');

  // 5초 간격으로 /session을 폴링해 복구되면 배너를 걷는다.
  offlineTimer = window.setInterval(async () => {
    try {
      await rawRequest('GET', '/session', undefined, null);
      banner.remove();
      document.documentElement.classList.remove('admin-has-offline');
      if (offlineTimer !== null) window.clearInterval(offlineTimer);
      offlineTimer = null;
      // 토큰이 새 프로세스의 것으로 바뀌었을 수 있다.
      session = null;
      void getSession();
    } catch {
      /* 아직 죽어 있다 — 다음 주기에 다시 본다 */
    }
  }, 5000);
}
