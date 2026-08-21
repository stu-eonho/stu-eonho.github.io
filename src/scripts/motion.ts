/**
 * 진입 리빌 모션 레이어 — 스크롤로 들어오는 블록 담당.
 *
 * 처음부터 화면에 보이는 블록은 이 파일이 다루지 않는다. `[data-reveal-onload]`가
 * 붙어 CSS 애니메이션으로 첫 페인트와 함께 재생된다(motion.css 참조).
 *
 * CRITICAL: 아래 게이트를 이 순서대로 통과해야 anime.js가 로드된다. 순서를 바꾸지 않는다.
 *   1. reduced-motion 검사 — import보다 먼저. 순서가 뒤집히면 접근성 설정을 켠 사용자가
 *      쓰지도 않을 라이브러리를 받는다
 *   2. 스크립트 시작 시점에 **화면 밖에 있는** 리빌 대상만 남긴다
 *   3. 남은 대상이 없으면 반환
 *   4. 대상이 뷰포트에 접근할 때 비로소 동적 import
 *
 * 게이트 2가 핵심이다. 이미 그려진 요소를 라이브러리 도착 후에 opacity 0으로 되돌렸다가
 * 다시 페이드인하면 "보였다가 사라졌다 나타나는" 깜빡임이 된다. 화면 밖 요소는 숨겨도
 * 사용자가 볼 수 없으므로 이 문제가 생기지 않는다.
 *
 * 게이트 4가 있는 이유: anime.js v4 엔진은 gzip 약 15KB로, 페이지 로드와 동시에 받으면
 * 스펙의 초기 JS 예산(홈 5KB / 글 상세 8KB)을 넘긴다.
 *
 * CRITICAL: CSS 기본값이 이미 애니메이션의 최종 상태다. 로드에 실패해도 콘텐츠는
 * 그대로 보이며, 이 파일은 조용히 반환한다.
 */
import { REVEAL, START_STATE, STAGGER_TOTAL } from './motion-presets';

/** 요소 하단이 뷰포트 상단선에 40px 못 미쳤을 때 시작한다. */
const ROOT_MARGIN = '0px 0px -40px 0px';

interface RevealUnit {
  kind: 'group' | 'single';
  root: HTMLElement;
  items: HTMLElement[];
}

/** 지금 이 순간 뷰포트와 겹치는가. 겹친다면 이미 사용자 눈에 그려진 요소다. */
function isOnScreen(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  return rect.top < viewportHeight && rect.bottom > 0;
}

export async function initMotion(): Promise<void> {
  // 게이트 1 — 접근성 설정
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (typeof IntersectionObserver === 'undefined') return;

  const candidates: RevealUnit[] = [];

  for (const group of document.querySelectorAll<HTMLElement>('[data-reveal-group]')) {
    const items = Array.from(group.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (items.length > 0) candidates.push({ kind: 'group', root: group, items });
  }

  for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
    if (el.closest('[data-reveal-group]')) continue;
    candidates.push({ kind: 'single', root: el, items: [el] });
  }

  // 게이트 2 — 이미 화면에 보이는 것은 제외한다. 여기서 걸러야 깜빡이지 않는다.
  // getBoundingClientRect 한 번씩만 읽고 끝낸다(강제 리플로 1회).
  const units = candidates.filter((unit) => !isOnScreen(unit.root));

  // 게이트 3 — 남은 대상이 없으면 라이브러리를 받을 이유가 없다.
  if (units.length === 0) return;

  const byRoot = new Map<Element, RevealUnit>();
  for (const unit of units) byRoot.set(unit.root, unit);

  let loading: Promise<AnimeModule | null> | null = null;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const unit = byRoot.get(entry.target);
        if (!unit) continue;

        // once — 한 번 재생한 뒤 관측을 끊는다. 오르내릴 때 재생이 반복되지 않는다.
        observer.unobserve(entry.target);
        byRoot.delete(entry.target);

        void play(unit);
      }
    },
    { rootMargin: ROOT_MARGIN },
  );

  for (const unit of units) observer.observe(unit.root);

  async function play(unit: RevealUnit): Promise<void> {
    // 게이트 4 — 여기서야 로드. 쓰는 것만 import 해 트리셰이킹을 살린다.
    loading ??= load();
    const anime = await loading;
    if (!anime) return;

    const { animate, stagger, utils } = anime;

    // 라이브러리가 실제로 도착한 뒤에야 시작 상태를 세팅한다.
    // 도착이 늦어 그사이 요소가 화면에 들어와 버렸다면, 숨겼다 보여주면 깜빡이므로 건너뛴다.
    if (isOnScreen(unit.root)) {
      const rect = unit.root.getBoundingClientRect();
      const alreadyWellInside = rect.top < (window.innerHeight || 0) * 0.9;
      if (alreadyWellInside) return;
    }

    utils.set(unit.items, START_STATE);

    animate(unit.items, {
      ...(unit.kind === 'group' ? REVEAL.onEnterStagger : REVEAL.onEnter),
      // 요소 수와 무관하게 총 지연을 STAGGER_TOTAL 안에 가둔다.
      ...(unit.kind === 'group' ? { delay: stagger([0, STAGGER_TOTAL]) } : {}),
    });
  }
}

type AnimeModule = Pick<typeof import('animejs'), 'animate' | 'stagger' | 'utils'>;

async function load(): Promise<AnimeModule | null> {
  try {
    const { animate, stagger, utils } = await import('animejs');
    return { animate, stagger, utils };
  } catch {
    // 조용히 실패한다. 콘텐츠는 이미 최종 상태로 보이고 있다.
    return null;
  }
}
