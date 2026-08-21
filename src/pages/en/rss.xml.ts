import type { APIRoute } from 'astro';
import { buildFeed } from '@/lib/feed';

/** 영어 RSS 피드. 번역본이 없는 글은 원문 그대로 실린다(목록과 같은 규칙). */
export const GET: APIRoute = (context) => buildFeed(context, 'en');
