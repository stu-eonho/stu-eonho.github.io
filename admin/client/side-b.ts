/**
 * Side B 화면 — `MUSIC` 값을 폼과 오가게 한다.
 *
 * CRITICAL: 행을 클라이언트에서 버리지 않는다. 서버 오류의 `field`는 `music.<i>.<key>`이고
 * `i`는 **제출된** 배열의 인덱스다. 빈 제목 행을 여기서 걸러 내면 그 뒤 행들의 인덱스가
 * 한 칸씩 당겨져 오류가 엉뚱한 행에 붙는다. 빈 제목 행 제거는 서버가 한다.
 *
 * CRITICAL: 행 안의 필드 경로(`data-field`·`data-localized-field`)는 읽을 때마다 화면 순서로
 * 다시 매긴다. 행 추가·삭제·이동 뒤에도 `showFieldErrors`가 맞는 행을 찾는다.
 */
import { listenService, normalizeListenUrl, collectGenres } from '@/lib/music';
import { get, put, reportError, toast } from './api';
import { need, qs, qsa } from './dom';
import {
  bindLocalizedToggles,
  getValue,
  initChips,
  optional,
  readChips,
  readLocalized,
  setValue,
  writeChips,
  writeLocalized,
  type MaybeLocalized,
} from './fields';
import { createForm, notifyChanged } from './forms';
import { initRepeatable } from './repeatable';
import { initDropZone } from './uploader';
import { L } from '../labels';

interface MusicEntry {
  kind: 'song' | 'album';
  title: string;
  artist: string;
  album?: string;
  year?: string;
  cover?: string;
  genres: string[];
  note?: MaybeLocalized;
  listenUrl?: string;
}

interface SideB {
  music: MusicEntry[];
}

interface SideBResponse {
  music: MusicEntry[];
  covers: string[];
  mtime: number | null;
}

/** 경로를 다시 매길 때 쓰는 원래 키. 템플릿의 경로 값을 처음 한 번 옮겨 둔다. */
const KEY_ATTR = 'data-path-key';
const PATH_ATTRS = ['data-field', 'data-localized-field'] as const;

function rememberKeys(row: HTMLElement): void {
  for (const attr of PATH_ATTRS) {
    for (const node of qsa(`[${attr}]`, row)) {
      if (!node.hasAttribute(KEY_ATTR)) node.setAttribute(KEY_ATTR, node.getAttribute(attr) ?? '');
    }
  }
}

function renumber(row: HTMLElement, index: number): void {
  for (const attr of PATH_ATTRS) {
    for (const node of qsa(`[${attr}][${KEY_ATTR}]`, row)) {
      node.setAttribute(attr, `music.${index}.${node.getAttribute(KEY_ATTR)}`);
    }
  }
}

function noteField(row: HTMLElement): HTMLElement {
  return need(`[data-localized-field][${KEY_ATTR}="note"]`, row);
}

function genreChips(row: HTMLElement): HTMLElement {
  return need('[data-chips="genres"]', row);
}

/** 판정할 수 없으면(빈 값·모르는 호스트·http(s)가 아닌 주소) 빈 문자열. */
function serviceLabel(raw: string): string {
  const normalized = normalizeListenUrl(raw);
  if (!normalized) return '';
  const service = listenService(normalized);
  return service ? `→ ${L.sideB.services[service]}` : '';
}

function updateService(row: HTMLElement): void {
  const label = qs('[data-listen-service]', row);
  if (label) label.textContent = serviceLabel(getValue(row, 'listenUrl'));
}

function updateAlbumVisibility(row: HTMLElement): void {
  qs('[data-album-field]', row)?.classList.toggle(
    'admin-row-hidden',
    getValue(row, 'kind') !== 'song',
  );
}

function showCover(row: HTMLElement, name: string): void {
  setValue(row, 'cover', name);
  const img = qs<HTMLImageElement>('[data-cover-img]', row);
  const nameNode = qs('[data-cover-name]', row);
  qs('[data-cover-empty]', row)?.classList.toggle('admin-row-hidden', name !== '');
  qs('[data-cover-set]', row)?.classList.toggle('admin-row-hidden', name === '');
  if (!img) return;
  if (name === '') {
    img.classList.add('admin-row-hidden');
    img.removeAttribute('src');
    img.alt = '';
    return;
  }
  // dev 서버가 src 아래 파일을 그대로 서빙한다. 업로드 이름은 서버가 겹치지 않게 정한다.
  img.onerror = () => {
    img.classList.add('admin-row-hidden');
    if (nameNode) nameNode.textContent = L.sideB.coverMissing(name);
  };
  img.onload = () => img.classList.remove('admin-row-hidden');
  img.src = `/src/assets/side-b/${encodeURIComponent(name)}`;
  img.alt = L.sideB.coverAlt(name);
  if (nameNode) nameNode.textContent = name;
}

/** 행 하나씩 비교한다. 최상위 키 비교로는 `music` 전체가 늘 "1건"이 된다. */
function countRowChanges(baseline: SideB, current: SideB): number {
  const a = baseline.music ?? [];
  const b = current.music ?? [];
  let count = Math.abs(a.length - b.length);
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) count += 1;
  }
  return count;
}

export async function initSideB(): Promise<void> {
  bindLocalizedToggles();

  /** 장르 칩 제안. 불러온 전체 항목에서 모은 표기다(저장 뒤 다시 모은다). */
  let genreSuggestions: string[] = [];

  /**
   * 진행 중인 커버 업로드 수.
   * CRITICAL: 올리는 도중에 저장하면 서버가 아직 아무 행도 참조하지 않는 새 커버를 "미참조"로
   * 보고 지운다(실측). 업로드가 끝날 때까지 저장을 막는다.
   */
  let uploading = 0;

  const music = initRepeatable<MusicEntry>(need('[data-repeatable="music"]'), {
    create: () => ({ kind: 'song', title: '', artist: '', genres: [] }),
    onMount(row) {
      rememberKeys(row);
      initChips(genreChips(row), { suggestions: genreSuggestions });

      qs('[data-name="kind"]', row)?.addEventListener('change', () => updateAlbumVisibility(row));
      qs('[data-name="listenUrl"]', row)?.addEventListener('input', () => updateService(row));

      const drop = need('[data-cover-drop]', row);
      initDropZone(drop, {
        purpose: 'music-cover',
        multiple: false,
        onStart() {
          uploading += 1;
        },
        onUploaded(result) {
          uploading -= 1;
          showCover(row, result.name);
          toast('success', L.sideB.coverUploaded(result.name));
          notifyChanged();
        },
        onFailed(error) {
          uploading -= 1;
          reportError(error);
        },
      });
      // "바꾸기"는 드롭존과 같은 파일 선택창을 연다(드롭존이 숨어 있어도 click은 전달된다).
      qs('[data-cover-replace]', row)?.addEventListener('click', () => drop.click());
      // "지우기"는 값만 비운다. 파일 정리는 저장할 때 서버가 한다.
      qs('[data-cover-clear]', row)?.addEventListener('click', () => {
        showCover(row, '');
        notifyChanged();
      });
    },
    fill(row, value) {
      setValue(row, 'kind', value.kind === 'album' ? 'album' : 'song');
      setValue(row, 'title', value.title ?? '');
      setValue(row, 'artist', value.artist ?? '');
      setValue(row, 'album', value.album ?? '');
      setValue(row, 'year', value.year ?? '');
      showCover(row, value.cover ?? '');
      writeChips(genreChips(row), value.genres ?? []);
      writeLocalized(noteField(row), value.note);
      setValue(row, 'listenUrl', value.listenUrl ?? '');
      updateAlbumVisibility(row);
      updateService(row);
    },
    read(row, index) {
      renumber(row, index);
      const kind = getValue(row, 'kind') === 'album' ? 'album' : 'song';
      // CRITICAL: 제목이 비어도 `undefined`를 돌려주지 않는다(파일 머리 주석 참조).
      // 키 순서는 서버가 쓰는 `MusicEntry` 선언 순서와 같다 — 재오픈 시 변경 0건 비교가 이 순서에 기댄다.
      return {
        kind,
        title: getValue(row, 'title').trim(),
        artist: getValue(row, 'artist').trim(),
        // 앨범 칸은 노래에만 저장된다. 숨긴 칸의 값은 화면에 남겨 두어 종류를 되돌리면 살아난다.
        album: kind === 'song' ? optional(getValue(row, 'album')) : undefined,
        year: optional(getValue(row, 'year')),
        cover: optional(getValue(row, 'cover')),
        genres: readChips(genreChips(row)),
        note: readLocalized(noteField(row)),
        listenUrl: optional(getValue(row, 'listenUrl')),
      };
    },
  });

  async function load(): Promise<SideBResponse> {
    const data = await get<SideBResponse>('/side-b');
    genreSuggestions = collectGenres((data.music ?? []).map((entry) => entry.genres ?? [])).map(
      (genre) => genre.label,
    );
    return data;
  }

  const form = createForm<SideB>({
    read: () => ({ music: music.read() }),
    write(value) {
      music.write(value.music ?? []);
    },
    countChanges: countRowChanges,
    validate: () => (uploading > 0 ? L.sideB.coverUploading : null),
    async save(value, baseMtime) {
      const result = await put<{ mtime: number; changed: boolean; removedCovers: string[] }>(
        '/side-b',
        { music: value.music, baseMtime },
      );
      if (result.removedCovers.length > 0) {
        toast('success', L.sideB.removedCovers(result.removedCovers.length));
      }
      return result;
    },
    onSaved() {
      // 서버가 빈 제목 행을 버리고 링크에 https://를 붙인다 — 저장된 그대로를 다시 보여 준다.
      void load()
        .then((data) => form.reset({ music: data.music }, data.mtime))
        .catch(reportError);
    },
  });

  try {
    const data = await load();
    form.reset({ music: data.music }, data.mtime);
  } catch (error) {
    reportError(error);
  }
}
