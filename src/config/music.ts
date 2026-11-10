/**
 * Side B(좋아하는 곡·앨범)의 데이터 소스.
 *
 * 여기 있는 값은 전부 직접 채웁니다. `MUSIC`이 비어 있으면 Side B 화면은 빈 상태 안내를
 * 보여 줍니다. 관리자(`/admin/side-b`)에서 편집하면 이 파일의 `MUSIC`만 다시 쓰입니다.
 *
 * 필드:
 *   kind      'song' 또는 'album'
 *   title     곡 또는 앨범 이름
 *   artist    아티스트
 *   album     (선택) 곡이 실린 앨범
 *   year      (선택) 발매 연도
 *   cover     (선택) `src/assets/side-b/` 안의 파일명. 없으면 대체 커버를 그립니다
 *   genres    장르 목록. 필터 선택지가 여기서 모입니다 (대소문자·공백 차이는 같은 장르)
 *   note      (선택) 좋아하는 이유. 언어별 최대 140자
 *   listenUrl (선택) 듣기 링크. http(s)만 허용
 */

import type { MaybeLocalized } from './i18n';

export interface MusicEntry {
  kind: 'song' | 'album';
  title: string;
  artist: string;
  album?: string;
  year?: string;
  cover?: string;
  genres: string[];
  note?: MaybeLocalized<string>;
  listenUrl?: string;
}

/**
 * Side B에 담을 곡·앨범 목록. 위에서 아래 순서가 화면 순서입니다.
 */
export const MUSIC: MusicEntry[] = [
  {
    kind: 'album',
    title: 'Hurry Up Tomorrow',
    artist: 'The Weeknd',
    year: '2025',
    genres: [],
    listenUrl: 'https://open.spotify.com/album/3OxfaVgvTxUTy7276t7SPU?si=J0mPF2BCQI6X8WaqAOYaCg',
  },
];

/**
 * 커버 이미지. `src/assets/side-b/`에 넣은 파일이 파일명을 키로 자동으로 잡힙니다.
 */
const coverModules = import.meta.glob<ImageMetadata>(
  '../assets/side-b/*.{jpg,jpeg,png,webp,avif,gif}',
  { eager: true, import: 'default' },
);

export const MUSIC_COVERS: Record<string, ImageMetadata> = Object.fromEntries(
  Object.entries(coverModules).map(([path, meta]) => [path.split('/').pop() ?? path, meta]),
);

/** 파일명으로 커버를 찾는다. 이름이 없거나 파일이 없으면 `undefined`. */
export function musicCover(name: string | undefined): ImageMetadata | undefined {
  return name ? MUSIC_COVERS[name] : undefined;
}
