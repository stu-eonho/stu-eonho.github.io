// @ts-check
/**
 * 본문 마크다운 렌더링.
 *
 * CRITICAL: 프로세서 인스턴스를 요청마다 새로 만들지 않는다. Shiki 하이라이터 초기화가
 * 수백 ms이며, 그만큼 타이핑 중 프리뷰가 밀린다. dev 서버 프로세스에서 한 번 만들어
 * 재사용한다.
 *
 * CRITICAL: 빌드와 같은 옵션(`markdown.config.mjs`)을 쓴다. 프리뷰에서 보이는 것과
 * 실제 페이지가 갈라지면 프리뷰의 가치가 없다.
 *
 * MDX의 JSX 표현식은 렌더링하지 않는다 — MDX 컴파일 + 컴포넌트 해석을 요청마다 돌리는
 * 비용이 프리뷰의 가치보다 크다. JSX·import·export 줄은 자리표시 블록으로 표시한다.
 */
import { createMarkdownProcessor, isUnifiedProcessor } from '@astrojs/markdown-remark';
import { createMarkdownOptions } from '../../../markdown.config.mjs';

/** @type {Promise<any> | null} */
let processorPromise = null;

/**
 * 빌드가 쓰는 것과 같은 렌더러를 만든다.
 *
 * CRITICAL: `createMarkdownProcessor(options)`에 옵션 객체를 통째로 넘기면 안 된다.
 * 그 함수는 `remarkPlugins`/`rehypePlugins`만 읽고 `processor` 필드를 무시한다 —
 * 그러면 remark-math·rehype-katex가 빠진 채 렌더되어 프리뷰에만 수식이 안 나온다
 * (실측으로 확인했다). Astro 내부와 같은 경로인 `processor.createRenderer(shared)`를 쓴다.
 */
function getProcessor() {
  if (!processorPromise) {
    const { processor, ...rest } = createMarkdownOptions();
    // 옵션 객체의 나머지(shikiConfig 등)는 그대로 넘긴다. Astro 내부와 같은 경로다.
    const shared = /** @type {any} */ (rest);
    processorPromise =
      processor && isUnifiedProcessor(processor)
        ? /** @type {any} */ (processor).createRenderer(shared)
        : createMarkdownProcessor(shared);
  }
  return processorPromise;
}

const PLACEHOLDER_PREFIX = 'ADMINJSXPLACEHOLDER';

/** `import` / `export` 문, 그리고 줄 전체를 차지하는 JSX 태그. */
const JSX_LINE = /^\s*(?:import\s|export\s|<\/?[A-Z][\w.]*(?:\s|\/?>|$))/;

/**
 * 코드 펜스 안은 건드리지 않는다 — 예제 코드에 JSX가 있는 것이 정상이다.
 * @param {string} body
 */
function stripJsxLines(body) {
  const lines = String(body ?? '').split('\n');
  /** @type {string[]} */
  const stripped = [];
  /** @type {string[]} */
  const out = [];
  let inFence = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (!inFence && JSX_LINE.test(line)) {
      const index = stripped.length;
      stripped.push(line);
      // 문단 하나로 분리되도록 앞뒤를 빈 줄로 감싼다.
      out.push('', `${PLACEHOLDER_PREFIX}${index}`, '');
      continue;
    }
    out.push(line);
  }

  return { markdown: out.join('\n'), stripped };
}

/** @param {unknown} text */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{ body: any }} ctx
 */
export async function renderPreview({ body }) {
  const source = typeof body.body === 'string' ? body.body : '';
  const { markdown, stripped } = stripJsxLines(source);

  const processor = await getProcessor();
  const result = await processor.render(markdown);

  let html = result.code;

  // 자리표시자를 점선 블록으로 되돌린다.
  // CRITICAL: 원문을 이스케이프해 넣는다 — 사용자 입력을 날것으로 HTML에 넣지 않는다.
  stripped.forEach((line, index) => {
    const token = `${PLACEHOLDER_PREFIX}${index}`;
    const block = `<div class="admin-jsx-block" data-jsx-placeholder><code>${escapeHtml(
      line.trim(),
    )}</code></div>`;
    html = html.split(`<p>${token}</p>`).join(block).split(token).join(block);
  });

  return {
    html,
    headings: result.metadata?.headings ?? [],
    strippedBlocks: stripped.length,
  };
}
