/**
 * Side B(좋아하는 곡·앨범) 순수 로직: 장르 필터 키·해시, 듣기 링크 서비스 판정.
 *
 * CRITICAL: 이 파일은 어떤 모듈도 import하지 않는다. Astro 컴포넌트, 관리자 서버
 * (`ssrLoadModule`), 관리자 클라이언트(`@/lib/music`), Node 테스트 러너가 모두 같은
 * 파일을 직접 불러야 하므로 `@/` 별칭이나 다른 모듈에 기대면 어느 한 쪽에서 깨진다.
 */

export type ListenService = 'youtube' | 'youtube-music' | 'spotify' | 'apple-music' | 'melon';

export interface GenreOption {
  key: string;
  label: string;
  count: number;
}

/** 장르 비교 키. 대소문자·앞뒤 공백 차이를 같은 장르로 합친다. */
export function genreKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * 카드들의 장르 목록에서 필터 선택지를 모은다.
 * label은 처음 나온 표기, 정렬은 count 내림차순(같으면 처음 나온 순서).
 * 한 카드 안에서 같은 키가 중복돼도 1로 센다.
 */
export function collectGenres(lists: readonly (readonly string[])[]): GenreOption[] {
  const map = new Map<string, GenreOption>();
  for (const list of lists) {
    const seen = new Set<string>();
    for (const name of list) {
      const key = genreKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const found = map.get(key);
      if (found) found.count += 1;
      else map.set(key, { key, label: name.trim(), count: 1 });
    }
  }
  // Array.prototype.sort는 안정 정렬이므로 같은 count는 삽입(처음 나온) 순서를 유지한다
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** 장르 필터의 URL 해시(`#` 제외). */
export function genreHash(key: string): string {
  return 'genre=' + encodeURIComponent(key);
}

/** `#genre=...`에서 키를 꺼낸다. 형식이 아니거나 디코드에 실패하면 null. */
export function parseGenreHash(hash: string): string | null {
  const match = /^#genre=(.+)$/.exec(hash);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/** 듣기 링크의 호스트로 서비스를 판정한다. 모르는 호스트·잘못된 URL은 null. */
export function listenService(url: string): ListenService | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^(www|m)\./, '');
  } catch {
    return null;
  }
  // music.youtube.com은 youtube.com보다 먼저 본다
  if (host === 'music.youtube.com') return 'youtube-music';
  if (host === 'youtube.com' || host === 'youtu.be') return 'youtube';
  if (host === 'open.spotify.com' || host === 'spotify.com') return 'spotify';
  if (host === 'music.apple.com') return 'apple-music';
  if (host === 'melon.com') return 'melon';
  return null;
}

/**
 * 듣기 링크 입력을 정규화한다.
 * 공백뿐이면 undefined(미입력), 스킴이 없으면 `https://`를 붙이고, http(s)가 아니거나
 * 해석할 수 없으면 null(거절). `mailto:`·`javascript:`가 href로 나가지 않게 막는다.
 */
export function normalizeListenUrl(raw: string): string | null | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  let candidate = text;
  if (text.startsWith('//')) candidate = 'https:' + text;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(text)) candidate = 'https://' + text;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? candidate : null;
  } catch {
    return null;
  }
}
