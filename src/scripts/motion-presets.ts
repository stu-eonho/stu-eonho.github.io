/**
 * 모션 프리셋.
 *
 * CRITICAL: 프리셋은 3개를 넘기지 않는다. 늘어날수록 사이트의 모션 언어가 흐려진다.
 * 새 모션 요구가 들어오면 먼저 기존 프리셋으로 되는지 확인한다.
 *
 * 잔잔함의 수치 상한 — 이 값을 올리면 잔잔함이 깨진다:
 *   이동 거리 8px / duration 240–420ms / stagger 총 지연 400ms
 *   ease는 outQuad·outCubic만 / 속성은 opacity와 translateY만
 */

/** 이동 거리 상한. CRITICAL: 이 값을 키우면 "슬라이드 인"으로 읽힌다. */
export const REVEAL_DISTANCE = 8;

/** stagger 총 지연 상한. 요소가 몇 개든 이 시간 안에 끝난다. */
export const STAGGER_TOTAL = 400;

const BASE = {
  translateY: [REVEAL_DISTANCE, 0] as [number, number],
  opacity: [0, 1] as [number, number],
  ease: 'outQuad' as const,
};

export const REVEAL = {
  /** 페이지 로드 직후 화면 안에 있는 블록 (홈 히어로 텍스트 등) */
  onLoad: { ...BASE, duration: 360 },
  /** 스크롤로 진입하는 단일 블록 (메타 패널, 섹션 헤더) */
  onEnter: { ...BASE, duration: 320 },
  /** 스크롤로 진입하는 목록 (카드 그리드, 아카이브 행) — delay는 호출부에서 stagger로 붙인다 */
  onEnterStagger: { ...BASE, duration: 320 },
};

/** 시작 상태. 스크립트가 anime.js를 실제로 로드한 뒤에만 세팅한다. */
export const START_STATE = { opacity: 0, translateY: REVEAL_DISTANCE };
