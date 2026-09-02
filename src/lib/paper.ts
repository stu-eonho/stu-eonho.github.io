/**
 * 논문 메타 문자열 조립.
 *
 * CRITICAL: 저자 축약 규칙은 여기 한 곳에만 둔다. 카드와 메타 패널이 각자 구현하면
 * 같은 논문이 두 화면에서 다르게 줄어든다.
 *
 * CRITICAL: 결과를 한 덩어리 문자열로 내지 않고 조각으로 나눈다. 저자 이름은 원문
 * 표기(영어)지만 축약 문구는 화면 언어의 문장이다 — `David Ha 외 2명` 전체를
 * `lang="en"`으로 감싸면 스크린리더가 "외 2명"을 영어로 읽는다. 조각을 나눠야
 * 호출부가 이름에만 `lang`을 걸 수 있다.
 *
 * 언어 문구(`외 N명` / `and N more`)는 주입받는다 — 이 모듈은 사전을 알지 않는 순수 함수다.
 */
import type { Post } from '@/lib/posts';

export type Paper = NonNullable<Post['data']['paper']>;

/** 메타 패널에 그대로 펼치는 저자 수. */
export const PANEL_AUTHOR_LIMIT = 4;

/**
 * 카드에 그대로 펼치는 저자 수.
 * 패널보다 적다 — 카드는 좁은 그리드 칸(약 360px)에 들어가고, 두 줄을 넘기면 잘린다.
 */
export const CARD_AUTHOR_LIMIT = 3;

export interface AuthorLine {
  /** 저자 이름들. 원문 표기이므로 `lang="en"` 안에 넣는다 */
  names: string;
  /** 축약 문구(`외 2명`). 화면 언어의 문장이므로 `lang="en"` 밖에 둔다 */
  more?: string;
}

/** 저자 목록을 한 줄로. `limit`을 넘으면 앞쪽만 남기고 "외 N명"을 붙인다. */
export function formatAuthors(
  authors: readonly string[],
  andMore: (n: number) => string,
  limit: number,
): AuthorLine {
  const shown = authors.slice(0, limit);
  const rest = authors.length - shown.length;
  return { names: shown.join(', '), more: rest > 0 ? andMore(rest) : undefined };
}

export interface Citation extends AuthorLine {
  /** `NeurIPS 2018`. `venue`가 비면 연도만, 그마저 없으면 undefined */
  venue?: string;
}

/**
 * 카드 한 줄짜리 인용 표기 — `저자들 · 학회 연도`.
 *
 * `venue`에는 스키마 하한이 없어 빈 문자열이 들어올 수 있다. 그때 조각을 그대로 두면
 * 호출부에서 ` · 2018`처럼 앞이 빈 줄이 나오므로 여기서 접어 둔다.
 */
export function formatCitation(
  paper: Paper,
  andMore: (n: number) => string,
  authorLimit: number = CARD_AUTHOR_LIMIT,
): Citation {
  const venue = [paper.venue.trim(), String(paper.year)].filter(Boolean).join(' ');
  return { ...formatAuthors(paper.authors, andMore, authorLimit), venue: venue || undefined };
}
