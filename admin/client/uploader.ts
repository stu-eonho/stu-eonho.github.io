/**
 * 이미지 업로드 — 드래그앤드롭 + base64 인코딩 + 진행 표시.
 *
 * 멀티파트 파서 의존성을 피하려고 base64 JSON으로 싣는다.
 *
 * CRITICAL: 8MB 초과 파일은 요청을 보내기 전에 클라이언트에서 먼저 막는다. 서버도 다시
 * 막지만, 8MB를 base64로 부풀려 보내는 것 자체가 낭비다.
 */
import { post } from './api';
import { el, qs } from './dom';
import { L } from '../labels';

export const MAX_BYTES = 8 * 1024 * 1024;

export interface UploadResult {
  name: string;
  path: string;
  relativeFromPost: string;
  width: number | null;
  height: number | null;
  bytes: number;
}

export class UploadTooLargeError extends Error {
  constructor(bytes: number) {
    super(`${L.assets.tooLarge(MAX_BYTES / 1024 / 1024)} (${(bytes / 1024 / 1024).toFixed(1)}MB)`);
    this.name = 'UploadTooLargeError';
  }
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      // `data:image/png;base64,AAAA...` → `AAAA...`
      const comma = result.indexOf(',');
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadFile(
  file: File,
  purpose: 'content' | 'profile-photo' = 'content',
): Promise<UploadResult> {
  if (file.size > MAX_BYTES) throw new UploadTooLargeError(file.size);
  const dataBase64 = await readAsBase64(file);
  return post<UploadResult>('/assets', { filename: file.name, dataBase64, purpose });
}

export interface DropZoneOptions {
  /** 업로드 성공마다 호출 */
  onUploaded: (result: UploadResult, file: File) => void;
  /** 업로드 실패마다 호출 */
  onFailed?: (error: unknown, file: File) => void;
  /** 진행 카드를 붙일 컨테이너 */
  progressHost?: HTMLElement | null;
  multiple?: boolean;
}

/**
 * 드롭 영역 하나를 초기화한다.
 * 클릭하면 파일 선택창이 열리고, 드래그 중에는 `data-dragging`이 붙는다.
 */
export function initDropZone(zone: HTMLElement, options: DropZoneOptions): void {
  if (zone.dataset.bound === '1') return;
  zone.dataset.bound = '1';

  const input = el('input', {
    type: 'file',
    accept: 'image/jpeg,image/png,image/webp,image/avif,image/gif',
    class: 'admin-visually-hidden',
    multiple: options.multiple !== false,
  });
  zone.after(input);

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    void handleFiles(input.files);
    input.value = '';
  });

  for (const type of ['dragenter', 'dragover']) {
    zone.addEventListener(type, (event) => {
      event.preventDefault();
      zone.setAttribute('data-dragging', 'true');
    });
  }
  for (const type of ['dragleave', 'drop']) {
    zone.addEventListener(type, (event) => {
      event.preventDefault();
      zone.setAttribute('data-dragging', 'false');
    });
  }
  zone.addEventListener('drop', (event) => {
    void handleFiles((event as DragEvent).dataTransfer?.files ?? null);
  });

  async function handleFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const card = options.progressHost ? addProgressCard(options.progressHost, file) : null;
      try {
        const result = await uploadFile(file);
        card?.remove();
        options.onUploaded(result, file);
      } catch (error) {
        // CRITICAL: 실패한 카드를 지우지 않는다. 사유를 남겨 무엇이 왜 실패했는지 보이게 한다.
        if (card) markCardFailed(card, error);
        options.onFailed?.(error, file);
      }
    }
  }
}

function addProgressCard(host: HTMLElement, file: File): HTMLElement {
  const bar = el('div', { class: 'admin-progress-bar' });
  const card = el('div', { class: 'card' }, [
    el('p', { class: 'admin-asset-name', text: file.name }),
    el('p', { class: 'admin-asset-meta', text: L.assets.uploading }),
    el('div', { class: 'admin-progress' }, [bar]),
  ]);
  host.prepend(card);
  // 실제 진행률은 fetch로 알 수 없다. 읽기·전송이 진행 중임만 보인다.
  window.requestAnimationFrame(() => {
    bar.style.width = '70%';
  });
  return card;
}

function markCardFailed(card: HTMLElement, error: unknown): void {
  const meta = qs('.admin-asset-meta', card);
  const message = error instanceof Error ? error.message : String(error);
  if (meta) meta.textContent = message;
  card.classList.add('admin-changed');
  qs('.admin-progress', card)?.remove();
}
