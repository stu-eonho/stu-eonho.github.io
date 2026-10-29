/**
 * Side B 페이지의 상호작용 — 카드 뒤집기, 기울기, 장르 필터.
 *
 * `SideBView`의 `<script>`에서만 불러온다. 다른 페이지 번들에 실리지 않는다. anime.js를 쓰지 않는다.
 * 모션 자체는 전부 CSS(MusicCard·SideBView)에 있고, 이 파일은 클래스·속성·CSS 변수만 바꾼다.
 * DOM 계약은 MusicCard.astro·GenreFilter.astro 머리 주석에 있다.
 *
 * CRITICAL: 시작하자마자 모든 뒷면에 inert를 건다. 서버 HTML의 뒷면에는 inert가 없다
 *   (JS가 없을 때 듣기 링크를 쓸 수 있어야 하므로). 이것을 미루면 앞면일 때도 Tab이
 *   보이지 않는 뒷면의 링크·버튼으로 간다.
 * CRITICAL: 필터의 페이드는 li가 아니라 안쪽 [data-tilt]에 건다. li의 opacity·transform은
 *   진입 리빌(motion.ts)이 인라인으로 쓰는 자리다. li에 CSS 애니메이션을 걸면 그 값을 잠시
 *   덮어써, 리빌을 기다리며 숨어 있던 카드가 번쩍 보였다가 다시 사라진다. 서로 다른 요소에
 *   두면 두 opacity가 곱해질 뿐이고, 어느 쪽도 상대의 값을 남겨 두지 않는다.
 */
import { genreHash, genreKey, parseGenreHash } from '@/lib/music';

/** 기울기 최대 각도(°). 이 값을 올리면 잔잔함이 깨진다. */
const MAX_TILT = 6;

/** 필터로 다시 보이게 된 카드의 짧은 페이드. 키프레임은 SideBView에 있다. */
const FILTER_IN = 'is-filter-in';

interface Card {
  item: HTMLElement;
  tilt: HTMLElement;
  card: HTMLElement;
  front: HTMLElement;
  back: HTMLElement;
  genres: Set<string>;
}

function parseGenres(raw: string | undefined): Set<string> {
  try {
    const list: unknown = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(list) ? list.filter((v) => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

export function initSideB(root: HTMLElement): void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  const cards = new Map<Element, Card>();
  for (const item of root.querySelectorAll<HTMLElement>('[data-music-item]')) {
    const tilt = item.querySelector<HTMLElement>('[data-tilt]');
    const card = item.querySelector<HTMLElement>('[data-card]');
    const front = item.querySelector<HTMLElement>('[data-face="front"]');
    const back = item.querySelector<HTMLElement>('[data-face="back"]');
    if (!tilt || !card || !front || !back) continue;

    // 가장 먼저 — 숨겨진 면을 Tab·스크린리더에서 뺀다
    back.inert = true;
    front.inert = false;
    cards.set(item, { item, tilt, card, front, back, genres: parseGenres(item.dataset.genres) });
  }

  const cardOf = (target: EventTarget | null): Card | undefined => {
    const item = target instanceof Element ? target.closest('[data-music-item]') : null;
    return item ? cards.get(item) : undefined;
  };

  // ---- 뒤집기 ----

  /** 면을 바꾸고 inert를 맞바꾼다. focus면 반대 면의 버튼으로 포커스를 옮긴다 —
   *  방금 누른 버튼이 inert가 되어 포커스를 잃기 때문이다. */
  function setFlipped(c: Card, flipped: boolean, focus: boolean): void {
    c.card.classList.toggle('is-flipped', flipped);
    c.front.inert = flipped;
    c.back.inert = !flipped;
    if (focus) {
      c.card.querySelector<HTMLElement>(flipped ? '[data-unflip]' : '[data-flip]')?.focus();
    }
  }

  root.addEventListener('click', (event) => {
    const c = cardOf(event.target);
    if (!c) return;
    const target = event.target as Element;

    if (target.closest('[data-flip]')) {
      setFlipped(c, true, true);
      return;
    }
    // 뒤집힌 카드는 빈 곳을 눌러도 앞면으로 돌아간다. 듣기 링크는 제외.
    // 뒤집힌 동안 앞면은 inert라 click 대상이 될 수 없으므로 카드 안의 click은 곧 뒷면 click이다.
    if (!c.card.classList.contains('is-flipped') || target.closest('a')) return;
    // 뒷면 글을 끌어 선택한 경우는 뒤집지 않는다(드래그가 끝날 때도 click이 난다)
    const selecting = !(window.getSelection()?.isCollapsed ?? true);
    if (selecting && !target.closest('[data-unflip]')) return;
    setFlipped(c, false, true);
  });

  // ---- 기울기 ----
  // 마우스가 있고 모션 줄이기가 아닐 때만. 조건은 이벤트마다 다시 본다 — 설정이 바뀌어도 따라간다.

  let tilted: Card | undefined;
  let pending: { c: Card; x: number; y: number } | undefined;
  let frame = 0;

  function untilt(): void {
    if (!tilted) return;
    tilted.tilt.style.removeProperty('--tilt-x');
    tilted.tilt.style.removeProperty('--tilt-y');
    tilted = undefined;
  }

  /** 프레임당 한 번, 마지막 포인터 위치로만 쓴다. */
  function writeTilt(): void {
    frame = 0;
    if (!pending) return;
    const { c, x, y } = pending;
    pending = undefined;
    if (tilted !== c) untilt();

    // li는 기울지 않으므로 그 상자를 기준으로 잰다. 기울어진 래퍼로 재면 기울기가 다시
    // 상자를 바꿔 떨린다.
    const rect = c.item.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const offset = (v: number) => Math.max(-0.5, Math.min(0.5, v - 0.5));
    const px = offset((x - rect.left) / rect.width);
    const py = offset((y - rect.top) / rect.height);
    // 포인터가 있는 모서리가 내려앉는다
    c.tilt.style.setProperty('--tilt-x', `${(-py * 2 * MAX_TILT).toFixed(2)}deg`);
    c.tilt.style.setProperty('--tilt-y', `${(px * 2 * MAX_TILT).toFixed(2)}deg`);
    tilted = c;
  }

  root.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || !finePointer.matches || reducedMotion.matches) return;
    const c = cardOf(event.target);
    if (!c) {
      pending = undefined;
      untilt();
      return;
    }
    pending = { c, x: event.clientX, y: event.clientY };
    frame ||= requestAnimationFrame(writeTilt);
  });

  // pointerleave는 거품이 일지 않아 카드마다 단다. 카드 사이 틈으로 나간 경우도 여기서 잡힌다.
  for (const c of cards.values()) {
    c.item.addEventListener('pointerleave', () => {
      if (pending?.c === c) pending = undefined;
      if (tilted === c) untilt();
    });
  }

  // ---- 장르 필터 ----

  const chips = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-genre-filter] button[data-genre-key]'),
  );
  const status = root.querySelector<HTMLElement>('[data-filter-status]');
  /** "전체"는 빈 문자열이다(data-genre-key가 값 없이 렌더된다) */
  const chipKey = (chip: HTMLElement): string => chip.dataset.genreKey ?? '';
  let active = '';

  /** userAction이 아니면(해시로 열 때) 페이드·낭독·주소 갱신을 하지 않는다. */
  function applyFilter(key: string, userAction: boolean): void {
    active = key;
    for (const chip of chips) chip.setAttribute('aria-pressed', String(chipKey(chip) === key));

    untilt();
    const fade = userAction && !reducedMotion.matches;
    for (const c of cards.values()) {
      // 필터를 바꾸면 뒤집힌 카드는 전부 앞면으로. 포커스는 누른 칩에 남긴다.
      if (c.card.classList.contains('is-flipped')) setFlipped(c, false, false);

      const show = key === '' || c.genres.has(key);
      if (!show) {
        // 숨기는 순간에는 애니메이션을 넣지 않는다(스펙 §6-1). 도는 중이던 페이드도 떼어,
        // 다음에 보일 때 새로 재생되게 한다.
        c.tilt.classList.remove(FILTER_IN);
      } else if (c.item.hidden && fade) {
        c.tilt.classList.add(FILTER_IN);
      }
      c.item.hidden = !show;
    }

    if (!userAction) return;
    const chip = chips.find((ch) => chipKey(ch) === key);
    if (status && chip) status.textContent = chip.dataset.status ?? '';
    // 뒤로 가기 기록을 쌓지 않는다. 전체면 해시를 지운다.
    const base = location.pathname + location.search;
    history.replaceState(history.state, '', key ? `${base}#${genreHash(key)}` : base);
  }

  root.addEventListener('animationend', (event) => {
    if (event.target instanceof Element) event.target.classList.remove(FILTER_IN);
  });

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      const key = chipKey(chip);
      // 이미 눌린 장르를 다시 누르면 전체로 돌아간다
      const next = key === active ? '' : key;
      if (next === active) return; // 전체 상태에서 "전체"
      applyFilter(next, true);
    });
  }

  // 주소의 해시로 연다. 모르는 장르면 서버 HTML의 "전체" 그대로 둔다.
  const fromHash = parseGenreHash(location.hash);
  const initial = fromHash === null ? '' : genreKey(fromHash);
  if (initial && chips.some((chip) => chipKey(chip) === initial)) applyFilter(initial, false);
}
