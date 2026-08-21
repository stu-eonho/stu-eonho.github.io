import type { APIRoute } from 'astro';
import { buildFeed } from '@/lib/feed';

/** 한국어 RSS 피드 — published 글 전체, date 내림차순, 최대 site.rssItemLimit건. */
export const GET: APIRoute = (context) => buildFeed(context, 'ko');
