// @ts-check
/**
 * 관리자 API 오류 봉투.
 *
 * CRITICAL: 모든 실패가 이 형태를 지킨다. 미들웨어가 처리되지 않은 예외를 잡아
 * `E-INTERNAL`로 감싸며, 스택 트레이스는 터미널에만 찍고 응답 본문에 넣지 않는다.
 */

/** 오류 코드 → 기본 HTTP 상태. `error_handling` 표와 1:1로 대응한다. */
export const ERROR_STATUS = {
  'E-FORBIDDEN-ORIGIN': 403,
  'E-BAD-TOKEN': 401,
  'E-NOT-FOUND': 404,
  'E-STALE': 409,
  'E-DUPLICATE-SLUG': 409,
  'E-VALIDATION': 422,
  'E-PATH-ESCAPE': 403,
  'E-CATEGORY-IN-USE': 409,
  'E-UNKNOWN-ICON': 422,
  'E-READONLY-STRING': 422,
  'E-TAG-TOO-LONG': 422,
  'E-ASSET-TYPE': 422,
  'E-ASSET-TOO-LARGE': 413,
  'E-ASSET-IN-USE': 409,
  'E-CODEGEN': 500,
  'E-WRITE-FAILED': 500,
  'E-GIT': 409,
  'E-BAD-REQUEST': 400,
  'E-PAYLOAD-TOO-LARGE': 413,
  'E-METHOD': 405,
  'E-INTERNAL': 500,
};

/** 봉투를 갖춘 관리자 오류. 핸들러는 이것만 던진다. */
export class AdminError extends Error {
  /**
   * @param {keyof typeof ERROR_STATUS} code
   * @param {string} message 한국어 설명. 사용자에게 그대로 보인다
   * @param {{ field?: string | null, detail?: unknown, status?: number }} [options]
   */
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'AdminError';
    this.code = code;
    this.field = options.field ?? null;
    this.detail = options.detail ?? null;
    this.status = options.status ?? ERROR_STATUS[code] ?? 500;
  }

  toEnvelope() {
    return {
      ok: false,
      error: {
        code: this.code,
        message: this.message,
        field: this.field,
        detail: this.detail,
      },
    };
  }
}

/**
 * @param {keyof typeof ERROR_STATUS} code
 * @param {string} message
 * @param {{ field?: string | null, detail?: unknown, status?: number }} [options]
 */
export function fail(code, message, options) {
  return new AdminError(code, message, options);
}
