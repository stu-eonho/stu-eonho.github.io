/**
 * 언어별 날짜 포맷터.
 *
 * `Intl.DateTimeFormat` 인스턴스 생성은 싸지 않다. (언어 × 스타일) 조합마다 한 번만 만들어
 * 캐시에 담아 재사용한다 — 목록 페이지는 같은 포맷을 수십 번 호출한다.
 */
import { LANG_META, type Lang } from '@/config/i18n';

type Style = 'long' | 'yearMonth' | 'monthDay';

const OPTIONS: Record<Style, Intl.DateTimeFormatOptions> = {
  long: { dateStyle: 'long' },
  yearMonth: { year: 'numeric', month: 'long' },
  monthDay: { month: 'long', day: 'numeric' },
};

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(lang: Lang, style: Style): Intl.DateTimeFormat {
  const key = `${lang}:${style}`;
  let found = cache.get(key);
  if (!found) {
    found = new Intl.DateTimeFormat(LANG_META[lang].intlLocale, OPTIONS[style]);
    cache.set(key, found);
  }
  return found;
}

/** ko "2026년 8월 20일" / en "August 20, 2026" */
export function formatLong(date: Date, lang: Lang): string {
  return formatter(lang, 'long').format(date);
}

/** ko "8월 20일" / en "August 20" — 아카이브 목록의 좌측 날짜 컬럼 */
export function formatMonthDay(date: Date, lang: Lang): string {
  return formatter(lang, 'monthDay').format(date);
}

/** ko "2024년 3월" / en "March 2024" — 학적 타임라인, 프로젝트 기간 */
export function formatYearMonth(date: Date, lang: Lang): string {
  return formatter(lang, 'yearMonth').format(date);
}

/** "YYYY-MM" 문자열을 언어에 맞게 포맷한다. 잘못된 값은 원문을 그대로 돌려준다. */
export function formatYearMonthString(value: string, lang: Lang): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return formatYearMonth(new Date(year, month - 1, 1), lang);
}

/** `time` 요소의 datetime 속성용 ISO 문자열. 언어와 무관하다. */
export function toISODate(date: Date): string {
  return date.toISOString();
}

/** 아카이브 그룹 키 */
export function getYear(date: Date): number {
  return date.getFullYear();
}
