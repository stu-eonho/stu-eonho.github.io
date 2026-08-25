/**
 * 이미지 화면 — 업로드·목록·사용처·삭제.
 *
 * CRITICAL: 사용 중인 파일의 삭제 버튼은 비활성이며 툴팁에 사용 글을 넣는다.
 * 참조가 남은 채 파일이 사라지면 `astro build`가 실패한다.
 */
import { del, get, reportError, toast } from './api';
import { clear, copyText, el, formatBytes, need, qs } from './dom';
import { initDropZone } from './uploader';
import { L } from '../labels';

interface Asset {
  name: string;
  ext: string;
  bytes: number;
  width: number | null;
  height: number | null;
  mtime: number;
  usedBy: { id: string; field: string }[];
}

/** 글에 붙여 넣을 상대 경로. 글은 `src/content/posts/<category>/` 깊이에 있다. */
function relativeFromPost(name: string): string {
  return `../../../assets/${name}`;
}

export async function initAssets(): Promise<void> {
  const grid = need('[data-asset-grid]');
  const emptyHost = need('[data-asset-empty]');
  const template = need<HTMLTemplateElement>('[data-asset-template]');
  const drop = need('[data-asset-drop]');

  function render(assets: Asset[]): void {
    clear(grid);
    clear(emptyHost);

    if (assets.length === 0) {
      emptyHost.append(el('p', { class: 'admin-empty-note', text: L.assets.emptyHint }));
      return;
    }

    for (const asset of assets) {
      const fragment = template.content.cloneNode(true) as DocumentFragment;
      const card = fragment.querySelector<HTMLElement>('[data-asset-card]');
      if (!card) continue;

      const thumb = qs<HTMLImageElement>('[data-asset-thumb]', card);
      if (thumb) {
        thumb.src = `/src/assets/${encodeURIComponent(asset.name)}`;
        thumb.alt = asset.name;
        thumb.loading = 'lazy';
      }

      const name = qs('[data-asset-name]', card);
      if (name) name.textContent = asset.name;

      const meta = qs('[data-asset-meta]', card);
      if (meta) {
        const size = asset.width && asset.height ? `${asset.width}×${asset.height} · ` : '';
        meta.textContent = `${size}${formatBytes(asset.bytes)}`;
      }

      const usage = qs('[data-asset-usage]', card);
      if (usage) {
        usage.textContent =
          asset.usedBy.length > 0 ? L.assets.inUse(asset.usedBy.length) : L.assets.unused;
      }

      const copy = qs<HTMLButtonElement>('[data-asset-copy]', card);
      copy?.addEventListener('click', async () => {
        const ok = await copyText(relativeFromPost(asset.name));
        copy.textContent = ok ? L.assets.copied : L.assets.copyPath;
        window.setTimeout(() => {
          copy.textContent = L.assets.copyPath;
        }, 2000);
      });

      const remove = qs<HTMLButtonElement>('[data-asset-delete]', card);
      if (remove) {
        if (asset.usedBy.length > 0) {
          remove.disabled = true;
          remove.title = asset.usedBy.map((use) => `${use.id} (${use.field})`).join('\n');
        } else {
          remove.addEventListener('click', async () => {
            try {
              await del(`/assets/${encodeURIComponent(asset.name)}`);
              toast('success', `삭제했습니다: ${asset.name}`);
              await load();
            } catch (error) {
              reportError(error);
            }
          });
        }
      }

      grid.append(fragment);
    }
  }

  async function load(): Promise<void> {
    const data = await get<{ assets: Asset[] }>('/assets');
    render(data.assets);
  }

  initDropZone(drop, {
    progressHost: grid,
    onUploaded: (result) => {
      toast('success', `${result.name} (${formatBytes(result.bytes)})`);
      void load().catch(reportError);
    },
    onFailed: (error) => reportError(error),
  });

  try {
    await load();
  } catch (error) {
    reportError(error);
  }
}
