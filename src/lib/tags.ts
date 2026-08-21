/**
 * 태그 집계. 저장되지 않는 파생 엔티티이며 빌드 타임에 전체 글을 순회해 만든다.
 */
import type { Post } from './posts';
import { sortByDate } from './posts';
import { DEFAULT_LANG, LANG_META, withLang, type Lang } from '@/config/i18n';

/** posts.ts와 같은 이유로 고정 로케일을 쓴다 — 언어에 따라 태그 순서가 흔들리지 않게. */
const COLLATION = LANG_META[DEFAULT_LANG].intlLocale;

export interface Tag {
  slug: string;
  label: string;
  count: number;
  posts: Post[];
}

/** 소문자화 + 공백을 하이픈으로 + 비허용 문자 제거 */
export function slugifyTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

/** count 내림차순, 동수면 label 오름차순 */
export function collectTags(posts: Post[]): Tag[] {
  const map = new Map<string, Tag>();
  for (const post of posts) {
    for (const raw of post.data.tags) {
      const slug = slugifyTag(raw);
      if (!slug) continue;
      const existing = map.get(slug);
      if (existing) {
        existing.count += 1;
        existing.posts.push(post);
      } else {
        // 최초 등장한 원본 표기를 대표값으로 쓴다.
        map.set(slug, { slug, label: raw.trim(), count: 1, posts: [post] });
      }
    }
  }
  return [...map.values()]
    .map((tag) => ({ ...tag, posts: sortByDate(tag.posts) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, COLLATION));
}

/** 태그 인덱스의 3단계 글자 크기. count 1–2 / 3–5 / 6 이상 */
export function tagSizeStep(count: number): 1 | 2 | 3 {
  if (count >= 6) return 3;
  if (count >= 3) return 2;
  return 1;
}

export function tagHref(slug: string, lang: Lang): string {
  return withLang(`/tags/${slug}`, lang);
}
