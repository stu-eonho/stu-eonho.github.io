#!/usr/bin/env node
/**
 * README의 "최근 글" 표를 사이트 RSS로 다시 쓴다.
 * `README.md`는 `/en/rss.xml`, `README.ko.md`는 `/rss.xml`을 읽는다.
 *
 * 사용: node scripts/update-readme.mjs            (배포된 사이트의 피드)
 *       node scripts/update-readme.mjs dist       (로컬 빌드 산출물의 피드)
 *
 * README 쪽 표식 사이만 바꾼다. 표식이 없거나 피드에 글이 없으면 아무것도 쓰지 않고 실패한다 —
 * 표를 빈 채로 덮어쓰는 것보다 옛 표가 남는 편이 낫다.
 *
 * CRITICAL: 초안 제외·번역본 선택은 피드가 이미 처리했다. 콘텐츠 파일을 직접 읽어 같은 규칙을
 * 두 벌로 두지 않는다. 그래서 피드에 없는 정보(논문 저자·학회)는 표에도 없다.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SITE_URL = 'https://stu-eonho.github.io';
const LIMIT = 5;
const START = '<!-- recent-posts:start -->';
const END = '<!-- recent-posts:end -->';

const TARGETS = [
  { readme: 'README.md', feed: 'en/rss.xml', header: ['Date', 'Post', 'Category'] },
  { readme: 'README.ko.md', feed: 'rss.xml', header: ['날짜', '글', '카테고리'] },
];

const distDir = process.argv[2] ? path.resolve(process.argv[2]) : null;

async function loadFeed(feedPath) {
  if (distDir) return readFile(path.join(distDir, feedPath), 'utf8');
  // 배포 직후 CDN이 옛 피드를 줄 수 있어 쿼리로 캐시를 비켜 간다.
  const response = await fetch(`${SITE_URL}/${feedPath}?t=${Date.now()}`);
  if (!response.ok) throw new Error(`${feedPath}: HTTP ${response.status}`);
  return response.text();
}

function decode(text) {
  return text
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return match ? decode(match[1].trim()) : '';
}

/** 피드는 `src/lib/feed.ts`가 만든다. 첫 `<category>`가 카테고리 라벨이고 나머지는 태그다. */
function parseItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => ({
    title: tag(item, 'title'),
    link: tag(item, 'link'),
    category: tag(item, 'category'),
    // 글 날짜는 UTC 자정으로 들어간다. 지역 시간으로 바꾸면 하루 밀린다.
    date: new Date(tag(item, 'pubDate')).toISOString().slice(0, 10),
  }));
}

/** 표 칸 안에서 의미가 바뀌는 문자만 막는다. `<`는 GitHub가 HTML 태그로 읽어 지운다. */
function cell(text) {
  return text.replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/\s+/g, ' ');
}

function linkText(text) {
  return cell(text).replace(/([[\]])/g, '\\$1');
}

function renderTable(items, header) {
  const rows = items.map(
    (item) => `| ${item.date} | [${linkText(item.title)}](${item.link}) | ${cell(item.category)} |`,
  );
  // 칸 정렬을 맞추지 않으므로 Prettier가 표를 다시 쓰지 않게 막는다.
  return [
    '<!-- prettier-ignore-start -->',
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...rows,
    '<!-- prettier-ignore-end -->',
  ].join('\n');
}

let failed = false;

for (const target of TARGETS) {
  try {
    const items = parseItems(await loadFeed(target.feed)).slice(0, LIMIT);
    if (items.length === 0) throw new Error(`${target.feed}에 글이 없습니다`);

    const file = path.resolve(target.readme);
    const readme = await readFile(file, 'utf8');
    const start = readme.indexOf(START);
    const end = readme.indexOf(END);
    if (start === -1 || end === -1 || end < start) {
      throw new Error(`${target.readme}에서 ${START} … ${END} 표식을 찾을 수 없습니다`);
    }

    const next = `${readme.slice(0, start + START.length)}\n${renderTable(items, target.header)}\n${readme.slice(end)}`;
    if (next === readme) {
      console.log(`[update-readme] ${target.readme}: 변경 없음`);
      continue;
    }
    await writeFile(file, next);
    console.log(`[update-readme] ${target.readme}: ${items.length}건으로 갱신`);
  } catch (error) {
    failed = true;
    console.error(`[update-readme] ${target.readme}: ${error.message}`);
  }
}

if (failed) process.exit(1);
