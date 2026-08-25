#!/usr/bin/env node
/**
 * 빌드 산출물의 내부 링크가 실제 파일로 해석되는지 검사한다.
 * 실패하면 0이 아닌 종료 코드를 돌려주어 배포를 막는다.
 *
 * 사용: node scripts/check-links.mjs dist
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'dist');

if (!existsSync(root)) {
  console.error(`[check-links] 산출물 디렉터리를 찾을 수 없습니다: ${root}`);
  process.exit(1);
}

/** 검사에서 제외할 링크 접두사 — 외부·특수 스킴 */
const SKIP_PREFIX = ['http://', 'https://', 'mailto:', 'tel:', 'data:', 'javascript:', '//', '#'];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

/**
 * 링크가 가리키는 실제 파일이 있는지.
 *
 * `from`은 링크가 실린 HTML 파일이다. 상대 경로는 그 파일이 놓인 디렉터리를 기준으로 푼다.
 */
async function resolves(href, from) {
  const clean = href.split('#')[0].split('?')[0];
  if (clean === '' || clean === '/') return existsSync(path.join(root, 'index.html'));

  const base = clean.startsWith('/') ? root : path.dirname(from);
  const rel = decodeURIComponent(clean.replace(/^\//, ''));
  const candidates = [
    path.resolve(base, rel),
    path.resolve(base, `${rel}.html`),
    path.resolve(base, rel, 'index.html'),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const info = await stat(candidate);
    if (info.isFile()) return true;
  }
  return false;
}

const htmlFiles = (await walk(root)).filter((file) => file.endsWith('.html'));
const broken = [];
let checked = 0;

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const hrefs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);

  for (const href of hrefs) {
    if (SKIP_PREFIX.some((prefix) => href.startsWith(prefix))) continue;
    // 스킴이 있는 링크(외부, mailto: 등)는 SKIP_PREFIX 밖의 것도 검사 대상이 아니다.
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(href)) continue;
    /*
      CRITICAL: 상대 경로도 검사한다.
      Astro의 레이아웃·컴포넌트는 루트 기준 절대 경로만 만들지만, **글 본문은 사람이 쓴다.**
      `[텍스트](url)` 같은 목적지가 그대로 통과해 `<a href="url">`이라는 죽은 링크가 배포된
      적이 있다. 여기서 걸러야 배포 전에 잡힌다.
    */
    checked += 1;
    if (!(await resolves(href, file))) {
      broken.push({ file: path.relative(root, file), href });
    }
  }
}

if (broken.length > 0) {
  console.error(`[check-links] 깨진 내부 링크 ${broken.length}건:`);
  for (const item of broken) console.error(`  ${item.file} → ${item.href}`);
  process.exit(1);
}

console.log(`[check-links] ${htmlFiles.length}개 파일에서 내부 링크 ${checked}건 검사 — 이상 없음`);
