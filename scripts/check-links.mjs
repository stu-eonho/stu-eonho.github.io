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

/** 링크가 가리키는 실제 파일이 있는지 */
async function resolves(href) {
  const clean = href.split('#')[0].split('?')[0];
  if (clean === '' || clean === '/') return existsSync(path.join(root, 'index.html'));

  const rel = decodeURIComponent(clean.replace(/^\//, ''));
  const candidates = [
    path.join(root, rel),
    path.join(root, `${rel}.html`),
    path.join(root, rel, 'index.html'),
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
    if (!href.startsWith('/')) continue; // 상대 경로는 Astro가 생성하지 않는다
    checked += 1;
    if (!(await resolves(href))) {
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
