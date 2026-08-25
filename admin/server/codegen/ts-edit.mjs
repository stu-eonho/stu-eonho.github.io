// @ts-check
/**
 * `typescript` 컴파일러 API 기반 바이트 스플라이스 엔진.
 *
 * CRITICAL: 파일을 통째로 재생성하지 않는다. 편집 대상 **선언의 바이트 범위만** 교체한다.
 * import·타입 선언·헬퍼 함수·문서 주석은 언제나 원본 그대로 남는다.
 *
 * 지원 연산은 3종뿐이며, 이 밖의 편집을 하지 않는다.
 *   1. replaceInitializer(declName, text)
 *      — `PROFILE` / `SITE` / `CATEGORIES`의 초기자 전체 교체.
 *        `as const satisfies ...` 같은 꼬리는 초기자 범위 밖이므로 자동 보존된다.
 *   2. replaceStringLiterals(declName, changes)
 *      — `ko`/`en` 사전의 단일 문자열 리터럴 교체. 주변 주석·함수형 값 전부 불변.
 *   3. readPropertyText / readPropertyComments
 *      — 재생성 시 원본 표현식·주석을 그대로 옮겨 심기 위한 읽기.
 *
 * CRITICAL: 쓰기 직전 새 소스를 다시 파싱해 구문 오류가 0인지 확인한다. 설정 파일이
 * 깨지면 dev 서버와 빌드가 동시에 죽는다 — 절대 깨진 파일을 디스크에 남기지 않는다.
 */
import ts from 'typescript';
import { fail } from '../errors.mjs';

/**
 * @param {string} source
 * @param {string} fileName
 */
export function parse(source, fileName = 'config.ts') {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/**
 * 최상위 `const <name> = ...` 선언을 찾는다. `export const`도 포함한다.
 * @param {ts.SourceFile} sourceFile
 * @param {string} name
 * @returns {ts.VariableDeclaration}
 */
function findDeclaration(sourceFile, name) {
  /** @type {ts.VariableDeclaration | null} */
  let found = null;
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        found = declaration;
      }
    }
  }
  if (!found) {
    throw fail('E-CODEGEN', `설정 파일에서 \`${name}\` 선언을 찾지 못했습니다.`);
  }
  return found;
}

/**
 * 초기자 노드. `as const satisfies X` 같은 꼬리를 벗겨 안쪽 리터럴을 돌려준다.
 * 벗겨 낸 만큼 꼬리는 교체 범위 밖에 남아 자동으로 보존된다.
 * @param {ts.VariableDeclaration} declaration
 */
function innerInitializer(declaration) {
  let node = declaration.initializer;
  if (!node) {
    throw fail('E-CODEGEN', '선언에 초기자가 없습니다.');
  }
  while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    node = node.expression;
  }
  return node;
}

/**
 * 선언의 초기자 리터럴 범위만 새 텍스트로 교체한다.
 *
 * @param {string} source
 * @param {string} declName
 * @param {string} text 새 리터럴 (들여쓰기 깊이 0 기준으로 방출된 것)
 * @returns {string}
 */
export function replaceInitializer(source, declName, text) {
  const sourceFile = parse(source);
  const declaration = findDeclaration(sourceFile, declName);
  const initializer = innerInitializer(declaration);
  const start = initializer.getStart(sourceFile);
  const end = initializer.getEnd();
  return source.slice(0, start) + text + source.slice(end);
}

/**
 * 선언 초기자(객체 리터럴)의 최상위 프로퍼티 원본 텍스트를 읽는다.
 *
 * `SITE.navOrder`의 스프레드 표현식처럼 **계산식이라 재생성하면 안 되는** 값을 그대로
 * 옮겨 심기 위한 것이다. 리터럴 배열로 펴 쓰면 카테고리를 추가해도 내비게이션이 따라오지
 * 않는다.
 *
 * @param {string} source
 * @param {string} declName
 * @param {string} propertyName
 * @returns {string | null}
 */
export function readPropertyText(source, declName, propertyName) {
  const sourceFile = parse(source);
  const initializer = innerInitializer(findDeclaration(sourceFile, declName));
  if (!ts.isObjectLiteralExpression(initializer)) return null;
  for (const property of initializer.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    if (propertyKey(property) !== propertyName) continue;
    return property.initializer.getText(sourceFile);
  }
  return null;
}

/**
 * 선언 초기자(객체 리터럴)의 최상위 프로퍼티 앞 주석 블록을 읽는다.
 *
 * CRITICAL: `PROFILE`의 각 프로퍼티 앞 JSDoc(`/** 표기명. ... *\/`)은 사용자가 값을 채울
 * 때 읽는 안내다. 재생성 시 이 주석을 잃으면 파일의 사용성이 무너진다.
 *
 * 되살릴 수 없는 것: 중첩 배열·객체 **안쪽**의 줄 주석(예: `endDate: null, // 재학 중이면
 * null`). 같은 설명이 파일 상단 인터페이스의 JSDoc에 있으므로 정보 손실은 아니다.
 *
 * @param {string} source
 * @param {string} declName
 * @returns {Record<string, string>}
 */
export function readPropertyComments(source, declName) {
  const sourceFile = parse(source);
  const initializer = innerInitializer(findDeclaration(sourceFile, declName));
  /** @type {Record<string, string>} */
  const comments = {};
  if (!ts.isObjectLiteralExpression(initializer)) return comments;

  for (const property of initializer.properties) {
    const key = propertyKey(property);
    if (!key) continue;
    const ranges = ts.getLeadingCommentRanges(source, property.pos) ?? [];
    if (ranges.length === 0) continue;
    const text = ranges.map((range) => source.slice(range.pos, range.end)).join('\n');
    // 원본에 빈 줄로 띄어져 있었으면 그 리듬도 되살린다. 없으면 프로퍼티가 빽빽하게
    // 붙어 나와 손으로 쓴 파일과 모양이 갈린다.
    const gap = source.slice(property.pos, ranges[0].pos);
    comments[key] = (gap.match(/\n/g) ?? []).length >= 2 ? `\n${text}` : text;
  }

  // 마지막 프로퍼티 뒤, 닫는 중괄호 앞에 남은 주석(어느 프로퍼티에도 붙지 않는 것).
  const last = initializer.properties[initializer.properties.length - 1];
  if (last) {
    const tailStart = last.getEnd();
    const tail = source.slice(tailStart, initializer.getEnd());
    const commentOnly = tail
      .replace(/^\s*,?\s*/, '')
      .replace(/\s*\}$/, '')
      .trim();
    if (commentOnly.startsWith('//') || commentOnly.startsWith('/*')) {
      comments[TRAILING_COMMENT_KEY] = commentOnly;
    }
  }

  return comments;
}

/** `readPropertyComments` 결과에서 "닫는 괄호 앞 주석"을 담는 키. */
export const TRAILING_COMMENT_KEY = '__trailing__';

/**
 * 환경변수 폴백 표현식을 지키면서 그 안의 문자열만 바꾼 표현식 텍스트를 만든다.
 *
 * `SITE.url`이 유일한 사용처다. 값은 편집 가능하지만 원문은
 * `import.meta.env.PUBLIC_SITE_URL ?? 'https://…'` 형태의 표현식이라, 통째로 리터럴로
 * 바꾸면 환경변수 우선 규칙이 사라진다. 폴백 자리의 문자열만 갈아 끼운다.
 *
 * @param {string} source
 * @param {string} declName
 * @param {string} propertyName
 * @param {string} value
 * @returns {string} 새 표현식 텍스트
 */
export function rewriteFallbackString(source, declName, propertyName, value) {
  const literal = emitStringLiteral(value);
  const sourceFile = parse(source);
  const initializer = innerInitializer(findDeclaration(sourceFile, declName));
  if (!ts.isObjectLiteralExpression(initializer)) return literal;

  for (const property of initializer.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    if (propertyKey(property) !== propertyName) continue;

    const expression = property.initializer;
    if (
      ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return `${expression.left.getText(sourceFile)} ?? ${literal}`;
    }
    return literal;
  }
  return literal;
}

/** @param {ts.ObjectLiteralElementLike} property */
function propertyKey(property) {
  const name = property.name;
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

/**
 * 점 표기 경로(`nav.archive`)의 문자열 리터럴 노드만 교체한다.
 *
 * CRITICAL: 다른 모든 바이트는 불변이다 — 섹션 주석도, 함수형 값도.
 * 여러 변경을 한 번에 적용할 때는 뒤쪽 노드부터 교체해 앞 노드의 오프셋이 밀리지 않게 한다.
 *
 * @param {string} source
 * @param {string} declName `ko` 또는 `en`
 * @param {{ path: string, value: string }[]} changes
 * @returns {string}
 */
export function replaceStringLiterals(source, declName, changes) {
  if (changes.length === 0) return source;

  const sourceFile = parse(source);
  const initializer = innerInitializer(findDeclaration(sourceFile, declName));
  if (!ts.isObjectLiteralExpression(initializer)) {
    throw fail('E-CODEGEN', `\`${declName}\`이 객체 리터럴이 아닙니다.`);
  }

  /** @type {{ start: number, end: number, text: string }[]} */
  const edits = [];

  for (const change of changes) {
    const node = resolvePath(initializer, change.path);
    if (!node) {
      throw fail('E-CODEGEN', `문자열 경로를 찾지 못했습니다: ${declName}.${change.path}`, {
        field: change.path,
      });
    }
    if (!ts.isStringLiteral(node) && !ts.isNoSubstitutionTemplateLiteral(node)) {
      // CRITICAL: 함수형 값은 코드에서만 고친다. 여기까지 왔다면 상위 검사가 샌 것이다.
      throw fail('E-READONLY-STRING', `이 값은 코드에서만 수정할 수 있습니다: ${change.path}`, {
        field: change.path,
      });
    }
    edits.push({
      start: node.getStart(sourceFile),
      end: node.getEnd(),
      text: emitStringLiteral(change.value),
    });
  }

  edits.sort((a, b) => b.start - a.start);
  let output = source;
  for (const edit of edits) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  }
  return output;
}

/**
 * 문자열 값을 리터럴로. `ts-emit.mjs`와 같은 규칙이다.
 * @param {string} value
 */
function emitStringLiteral(value) {
  const base = value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  const singles = (value.match(/'/g) ?? []).length;
  const doubles = (value.match(/"/g) ?? []).length;
  if (singles > doubles) return `"${base.replace(/"/g, '\\"')}"`;
  return `'${base.replace(/'/g, "\\'")}'`;
}

/**
 * 점 표기 경로를 따라 프로퍼티 값 노드를 찾는다.
 * @param {ts.ObjectLiteralExpression} root
 * @param {string} dottedPath
 * @returns {ts.Node | null}
 */
function resolvePath(root, dottedPath) {
  const segments = dottedPath.split('.').filter(Boolean);
  /** @type {ts.Node} */
  let current = root;
  for (const segment of segments) {
    if (!ts.isObjectLiteralExpression(current)) return null;
    /** @type {ts.Node | null} */
    let next = null;
    for (const property of current.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      if (propertyKey(property) !== segment) continue;
      next = property.initializer;
    }
    if (!next) return null;
    current = next;
  }
  return current === root ? null : current;
}

/**
 * `ko`/`en` 사전을 평탄화한다. 화면이 쓰는 목록이자 편집 가능 여부의 판정 근거다.
 *
 * @param {string} source
 * @param {string} declName
 * @returns {{ path: string, value: string | null, kind: 'string' | 'function' | 'other' }[]}
 */
export function flattenDictionary(source, declName) {
  const sourceFile = parse(source);
  const initializer = innerInitializer(findDeclaration(sourceFile, declName));
  /** @type {{ path: string, value: string | null, kind: 'string' | 'function' | 'other' }[]} */
  const out = [];

  /**
   * @param {ts.Node} node
   * @param {string} prefix
   */
  const walk = (node, prefix) => {
    if (!ts.isObjectLiteralExpression(node)) return;
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const key = propertyKey(property);
      if (!key) continue;
      const path = prefix ? `${prefix}.${key}` : key;
      const value = property.initializer;

      if (ts.isObjectLiteralExpression(value)) {
        walk(value, path);
        continue;
      }
      if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
        out.push({ path, value: value.text, kind: 'string' });
        continue;
      }
      if (
        ts.isArrowFunction(value) ||
        ts.isFunctionExpression(value) ||
        ts.isTemplateExpression(value)
      ) {
        // CRITICAL: 함수형 값은 읽기 전용이다. 시그니처만 화면에 보여 준다.
        out.push({ path, value: value.getText(sourceFile), kind: 'function' });
        continue;
      }
      out.push({ path, value: value.getText(sourceFile), kind: 'other' });
    }
  };

  walk(initializer, '');
  return out;
}

/**
 * 쓰기 직전 구문 검증.
 *
 * CRITICAL: 하나라도 오류가 있으면 쓰지 않고 `E-CODEGEN`으로 실패한다. 생성된 소스는
 * 터미널에 덤프해 원인을 추적할 수 있게 한다.
 *
 * @param {string} source
 * @param {string} fileName
 * @param {{ error: (msg: string) => void }} [logger]
 */
export function assertParses(source, fileName, logger) {
  const sourceFile = parse(source, fileName);
  const diagnostics = /** @type {any} */ (sourceFile).parseDiagnostics ?? [];
  if (diagnostics.length === 0) return;

  const messages = diagnostics
    .slice(0, 5)
    .map(
      (/** @type {any} */ diagnostic) =>
        `${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')} (offset ${diagnostic.start})`,
    );

  logger?.error(
    `[admin] 생성된 소스에 구문 오류가 있어 저장하지 않았습니다: ${fileName}\n${messages.join('\n')}\n----- 생성된 소스 -----\n${source}\n-----------------------`,
  );

  throw fail(
    'E-CODEGEN',
    '설정 파일을 안전하게 수정할 수 없었습니다. 변경 사항이 저장되지 않았습니다.',
    { detail: { file: fileName, messages } },
  );
}
