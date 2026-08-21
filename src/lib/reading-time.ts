/**
 * 읽기 시간 추정.
 * 한글 500자/분, 영문 200단어/분을 혼합해 계산한다.
 * 코드 블록·수식·프론트매터는 읽기 대상에서 제외한다.
 */

const KOREAN_CHARS_PER_MINUTE = 500;
const ENGLISH_WORDS_PER_MINUTE = 200;

function stripNonProse(body: string): string {
  return body
    .replace(/^---\n[\s\S]*?\n---/, '') // 프론트매터
    .replace(/```[\s\S]*?```/g, '') // 코드 블록
    .replace(/\$\$[\s\S]*?\$\$/g, '') // 블록 수식
    .replace(/`[^`]*`/g, '') // 인라인 코드
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // 이미지
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 링크는 텍스트만 남긴다
    .replace(/<[^>]+>/g, ' '); // JSX/HTML 태그
}

/** 분 단위 읽기 시간. 최소 1분. */
export function estimateReadingTime(body: string | undefined): number {
  if (!body) return 1;
  const text = stripNonProse(body);
  const koreanChars = (text.match(/[\u3131-\uD79D]/g) ?? []).length;
  const englishWords = (text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length;
  const minutes = koreanChars / KOREAN_CHARS_PER_MINUTE + englishWords / ENGLISH_WORDS_PER_MINUTE;
  return Math.max(1, Math.round(minutes));
}
