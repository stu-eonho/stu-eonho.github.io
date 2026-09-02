// @ts-check
/**
 * 빌드와 관리자 프리뷰가 공유하는 마크다운 옵션.
 *
 * CRITICAL: 팩토리다. 상수 객체로 두고 재사용하면 unified 프로세서 인스턴스가
 * 빌드와 프리뷰 요청 사이에 공유되어 상태가 섞인다.
 *
 * 관리자 프리뷰가 이 팩토리를 쓰는 이유는 "프리뷰에서 보이는 것"과 "빌드된 페이지"가
 * 갈라지지 않게 하기 위해서다. 여기에 플러그인을 추가하면 양쪽에 동시에 반영된다.
 */
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

/**
 * 정렬 키워드 → CSS.
 *
 * `float`가 아니라 **블록 정렬**이다. 본문 흐름 안에서 이미지 상자를 왼쪽/가운데/오른쪽에
 * 놓을 뿐, 글이 이미지를 감싸고 돌지는 않는다.
 */
const ALIGNMENTS = {
  left: 'margin-inline-end: auto',
  center: 'margin-inline: auto',
  right: 'margin-inline-start: auto',
};

/** 너비 표기. 네 자리까지만 받는다 — 본문 폭(720px)을 한참 넘는 값은 의미가 없다. */
const WIDTH_TOKEN = /^(\d{1,4})(?:px)?$/;

/** 표 삽입기가 저장하는 값의 허용 목록. 임의 문자열을 HTML 속성으로 넘기지 않는다. */
const TABLE_OPTIONS = {
  align: new Set(['left', 'center', 'right']),
  width: new Set(['full', 'fit']),
  tint: new Set(['none', 'gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple']),
  tintScope: new Set(['header', 'body', 'all']),
};

/**
 * alt 텍스트 **맨 끝**에 붙은 표시 옵션을 읽는다.
 *
 *   ![스크린샷|400](x.png)         → 최대 400px
 *   ![스크린샷|center](x.png)      → 가운데 정렬
 *   ![스크린샷|400|center](x.png)  → 둘 다 (순서 무관)
 *   ![A | B](x.png)                → 마지막 조각이 옵션이 아니므로 그대로 둔다
 *
 * CRITICAL: 뒤에서부터 **아는 토큰인 동안만** 떼어 낸다. 모르는 조각을 만나면 즉시 멈춘다 —
 * 그래야 파이프가 들어간 평범한 설명문(`A | B`)이 옵션으로 오해되지 않는다.
 *
 * @param {string} alt
 * @returns {{ alt: string, width: number | null, align: string | null } | null}
 */
function parseImageOptions(alt) {
  const parts = alt.split('|');
  let width = null;
  let align = null;
  let consumed = 0;

  // `parts[0]`은 설명문 본체다. 절대 소비하지 않는다.
  for (let i = parts.length - 1; i >= 1; i -= 1) {
    const token = parts[i].trim().toLowerCase();

    const size = token.match(WIDTH_TOKEN);
    if (size && width === null) {
      width = Number(size[1]);
      consumed += 1;
      continue;
    }
    if (token in ALIGNMENTS && align === null) {
      align = token;
      consumed += 1;
      continue;
    }
    break;
  }

  if (consumed === 0) return null;
  return {
    alt: parts
      .slice(0, parts.length - consumed)
      .join('|')
      .trimEnd(),
    width,
    align,
  };
}

/**
 * hast 트리를 훑는다.
 *
 * `unist-util-visit`를 쓰지 않는 이유: 직접 의존성이 아니라 전이 의존성이며,
 * 호이스팅에 기대는 것은 취약하다(`yaml`을 명시 선언한 것과 같은 이유). 여덟 줄이면 된다.
 *
 * @param {any} node
 * @param {(node: any) => void} fn
 */
function walk(node, fn) {
  fn(node);
  for (const child of node?.children ?? []) walk(child, fn);
}

/**
 * 표 앞의 `table-config` 코드 펜스를 표 표시 속성으로 바꾼다.
 *
 * MDX에서 HTML 주석은 문법 오류가 되고 인라인 style은 JSX 객체 문법을 요구하므로, 사람이
 * 읽고 고칠 수 있는 작은 설정 펜스를 쓴다. 바로 다음 노드가 표일 때만 소비한다. 알 수 없는
 * 키와 값은 버려 임의의 HTML 속성이나 CSS가 들어갈 수 없게 한다.
 *
 * ```table-config
 * align=center width=fit tint=blue tint-scope=header
 * ```
 *
 * @returns {(tree: any) => void}
 */
export function remarkTablePresentation() {
  return (tree) => {
    const children = tree?.children;
    if (!Array.isArray(children)) return;

    for (let index = 0; index < children.length - 1; index += 1) {
      const config = children[index];
      const table = children[index + 1];
      if (config?.type !== 'code' || config.lang !== 'table-config' || table?.type !== 'table') {
        continue;
      }

      const parsed = Object.fromEntries(
        String(config.value ?? '')
          .trim()
          .split(/\s+/)
          .map((token) => token.split('=', 2))
          .filter(([key, value]) => key && value),
      );
      const align = TABLE_OPTIONS.align.has(parsed.align) ? parsed.align : 'left';
      const width = TABLE_OPTIONS.width.has(parsed.width) ? parsed.width : 'full';
      const tint = TABLE_OPTIONS.tint.has(parsed.tint) ? parsed.tint : 'none';
      const tintScope = TABLE_OPTIONS.tintScope.has(parsed['tint-scope'])
        ? parsed['tint-scope']
        : 'header';
      const header = parsed.header !== 'false';

      table.data = table.data ?? {};
      table.data.hProperties = {
        ...(table.data.hProperties ?? {}),
        'data-table-align': align,
        'data-table-width': width,
        'data-table-tint': tint,
        'data-table-tint-scope': tintScope,
        'data-table-header': String(header),
      };
      children.splice(index, 1);
      index -= 1;
    }
  };
}

/**
 * 모든 표를 가로 스크롤 컨테이너로 감싼다. 게시물 클라이언트 스크립트에 맡기면 관리자
 * 프리뷰와 초기 HTML이 달라지므로, 빌드와 프리뷰가 공유하는 렌더 단계에서 처리한다.
 *
 * @returns {(tree: any) => void}
 */
export function rehypeTablePresentation() {
  return (tree) => {
    const wrap = (/** @type {any} */ node) => {
      if (!Array.isArray(node?.children)) return;
      for (let index = 0; index < node.children.length; index += 1) {
        const child = node.children[index];
        if (child?.type === 'element' && child.tagName === 'table') {
          const properties = child.properties ?? {};
          if (properties['data-table-header'] === 'false') {
            child.children = child.children.filter(
              (/** @type {any} */ section) =>
                !(section?.type === 'element' && section.tagName === 'thead'),
            );
          }
          node.children[index] = {
            type: 'element',
            tagName: 'div',
            properties: {
              className: ['table-scroll'],
              'data-table-align': properties['data-table-align'] ?? 'left',
              'data-table-width': properties['data-table-width'] ?? 'full',
            },
            children: [child],
          };
          continue;
        }
        wrap(child);
      }
    };
    wrap(tree);
  };
}

/**
 * `![설명|400|center](경로)`의 표시 옵션을 실제 스타일로 옮기는 rehype 플러그인.
 *
 * CRITICAL: `width` 속성을 덮어쓰지 않는다. Astro가 넣어 준 `width`/`height`는 원본 비율이며,
 * 그 값이 있어야 브라우저가 로드 전에 자리를 잡아 레이아웃이 밀리지 않는다(CLS).
 * 표시 크기는 `max-width`로만 줄인다 — `height: auto`는 `prose.css`에 이미 있다.
 *
 * CRITICAL: `min(…px, 100%)`을 쓴다. 좁은 화면에서 고정 px가 뷰포트를 넘으면 가로 스크롤이
 * 생긴다.
 *
 * CRITICAL: 정렬에는 `display: block`이 함께 필요하다. 이미지는 기본이 인라인이라
 * `margin: auto`가 듣지 않는다.
 */
export function rehypeImageSize() {
  return (/** @type {any} */ tree) => {
    walk(tree, (node) => {
      if (node?.tagName !== 'img' || !node.properties) return;

      const alt = node.properties.alt;
      if (typeof alt !== 'string') return;

      const options = parseImageOptions(alt);
      if (!options) return;

      // 표시 옵션은 화면에 읽히면 안 된다 — alt에서 떼어 낸다.
      node.properties.alt = options.alt;

      /** @type {string[]} */
      const styles = [];
      if (options.width !== null) styles.push(`max-width: min(${options.width}px, 100%)`);
      if (options.align !== null) {
        styles.push(
          'display: block',
          ALIGNMENTS[/** @type {keyof typeof ALIGNMENTS} */ (options.align)],
        );
      }
      if (styles.length === 0) return;

      const declared = styles.join('; ');
      node.properties.style = node.properties.style
        ? `${node.properties.style}; ${declared}`
        : declared;
    });
  };
}

/**
 * 본문에 수식이 있으면 `frontmatter.math`를 켜는 remark 플러그인.
 *
 * CRITICAL: 이게 없으면 **수식이 조용히 깨진다.** KaTeX는 접근성을 위해 같은 수식을 두 벌로
 * 낸다 — 스크린리더용 MathML(`.katex-mathml`)과 눈으로 보는 HTML(`.katex-html`). 둘 중
 * 하나를 숨기는 것은 `katex.min.css`이므로, CSS를 싣지 않으면 **두 벌이 나란히 보인다**
 * (`P(z_{t+1}|a_t,z_t,h_t)P (zt+1 | at, zt, ht)`). 2026-08-26에 실제로 그렇게 나갔다.
 *
 * 원래는 프론트매터의 `math: true`가 CSS 로딩을 결정했다. 그런데 그 값은 본문에서 이미
 * 알 수 있는 사실을 사람이 손으로 한 번 더 적는 것이라, 잊으면 위 증상이 난다.
 * 본문이 진실이므로 본문에서 읽는다.
 *
 * `remarkMath` **뒤에** 놓아야 한다 — math/inlineMath 노드를 만드는 것이 그 플러그인이다.
 */
export function remarkDetectMath() {
  return (/** @type {any} */ tree, /** @type {any} */ file) => {
    const frontmatter = file?.data?.astro?.frontmatter;
    if (!frontmatter) return; // 관리자 프리뷰 등 astro 데이터가 없는 경로

    let found = false;
    walk(tree, (node) => {
      if (node?.type === 'math' || node?.type === 'inlineMath') found = true;
    });
    if (found) frontmatter.math = true;
  };
}

/**
 * CRITICAL: 반환 타입을 명시한다. 팩토리로 감싸면 `themes`의 문자열 리터럴이 `string`으로
 * 넓어져 Shiki 테마 타입에 맞지 않는다 — 인라인 객체일 때는 `defineConfig`가 문맥 타입을
 * 줬지만 여기에는 그 문맥이 없다.
 *
 * @returns {NonNullable<import('astro').AstroUserConfig['markdown']>}
 */
export function createMarkdownOptions() {
  return {
    // Astro 7에서 remarkPlugins/rehypePlugins 직접 지정은 deprecated다.
    // 기본 프로세서를 unified()로 확장한다.
    processor: unified({
      remarkPlugins: [remarkMath, remarkTablePresentation, remarkDetectMath],
      rehypePlugins: [[rehypeKatex, { strict: false }], rehypeImageSize, rehypeTablePresentation],
    }),
    shikiConfig: {
      // 듀얼 테마 — 다크 모드는 prose.css가 CSS 변수를 교체해 처리한다
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  };
}
