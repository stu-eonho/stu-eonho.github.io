/**
 * 설정 화면 — `SITE`와 `CATEGORIES`를 각각 저장한다.
 *
 * 두 선언이 다른 파일에 있으므로 저장 바 한 번에 두 요청이 나간다. 한쪽만 실패하면
 * 그 사실을 그대로 알린다 — "전부 성공"으로 뭉뚱그리지 않는다.
 */
import { get, put, reportError, toast } from './api';
import { el, need, qs } from './dom';
import { getValue, setValue } from './fields';
import { bindCounters, createForm, notifyChanged } from './forms';
import { initRepeatable } from './repeatable';
import { L } from '../labels';

interface Site {
  title: string;
  description: { ko: string; en: string };
  url: string;
  base: string;
  navOrder: string[];
  postsPerPage: number;
  recentPostsOnHome: number;
  rssItemLimit: number;
  defaultOgImage: string;
}

interface Category {
  id: string;
  label: string;
  labelKo: string;
  description: { ko: string; en: string };
  icon: string;
  order?: number;
  metaPanel: 'paper' | 'project' | 'none';
}

interface Payload {
  site: Site;
  categories: Category[];
}

export async function initSettings(): Promise<void> {
  let postCounts: Record<string, number> = {};
  let existingIds = new Set<string>();
  let siteMtime: number | null = null;
  let categoriesMtime: number | null = null;

  const categories = initRepeatable<Category>(need('[data-repeatable="categories"]'), {
    create: () => ({
      id: '',
      label: '',
      labelKo: '',
      description: { ko: '', en: '' },
      icon: 'lucide:file-text',
      metaPanel: 'none',
    }),
    fill(row, value) {
      setValue(row, 'id', value.id);
      setValue(row, 'label', value.label);
      setValue(row, 'labelKo', value.labelKo);
      setValue(row, 'icon', value.icon);
      setValue(row, 'description.ko', value.description?.ko ?? '');
      setValue(row, 'description.en', value.description?.en ?? '');
      setValue(row, 'metaPanel', value.metaPanel ?? 'none');

      const count = postCounts[value.id] ?? 0;
      const badge = qs('[data-post-count]', row);
      if (badge) badge.textContent = count > 0 ? L.settings.categoryInUse(count) : '글 0편';

      // CRITICAL: 기존 카테고리의 id는 바꿀 수 없다. id는 URL 세그먼트이자 폴더명이자
      // 프론트매터 값이라, 바꾸면 파일 이동 + 전 글 수정 + 외부 링크 파손이 함께 일어난다.
      const idInput = qs<HTMLInputElement>('[data-name="id"]', row);
      const hint = qs('[data-id-hint]', row);
      if (idInput && value.id !== '' && existingIds.has(value.id)) {
        idInput.readOnly = true;
        if (hint) hint.textContent = L.settings.categoryIdLocked;
      }

      // 글이 남아 있으면 삭제를 막는다.
      const remove = qs<HTMLButtonElement>('[data-row-remove]', row);
      if (remove && count > 0) {
        remove.disabled = true;
        remove.title = L.settings.categoryInUse(count);
      }
    },
    read(row) {
      const id = getValue(row, 'id').trim();
      if (id === '') return undefined;
      return {
        id,
        label: getValue(row, 'label').trim(),
        labelKo: getValue(row, 'labelKo').trim(),
        description: {
          ko: getValue(row, 'description.ko').trim(),
          en: getValue(row, 'description.en').trim(),
        },
        icon: getValue(row, 'icon').trim(),
        metaPanel: (getValue(row, 'metaPanel') || 'none') as Category['metaPanel'],
      };
    },
  });

  const form = createForm<Payload>({
    read() {
      return {
        site: {
          title: getValue(document, 'title'),
          description: {
            ko: getValue(document, 'description.ko'),
            en: getValue(document, 'description.en'),
          },
          url: getValue(document, 'url').trim(),
          base: '/',
          navOrder: [],
          postsPerPage: Number(getValue(document, 'postsPerPage')) || 1,
          recentPostsOnHome: Number(getValue(document, 'recentPostsOnHome')) || 1,
          rssItemLimit: Number(getValue(document, 'rssItemLimit')) || 1,
          defaultOgImage: getValue(document, 'defaultOgImage').trim(),
        },
        categories: categories.read(),
      };
    },
    write(value) {
      setValue(document, 'title', value.site.title);
      setValue(document, 'description.ko', value.site.description.ko);
      setValue(document, 'description.en', value.site.description.en);
      setValue(document, 'url', value.site.url);
      setValue(document, 'postsPerPage', value.site.postsPerPage);
      setValue(document, 'recentPostsOnHome', value.site.recentPostsOnHome);
      setValue(document, 'rssItemLimit', value.site.rssItemLimit);
      setValue(document, 'defaultOgImage', value.site.defaultOgImage);
      categories.write(value.categories);
      bindCounters();
    },
    countChanges(baseline, current) {
      let count = 0;
      if (JSON.stringify(baseline.site) !== JSON.stringify(current.site)) count += 1;
      if (JSON.stringify(baseline.categories) !== JSON.stringify(current.categories)) count += 1;
      return count;
    },
    async save(value) {
      const baseline = form.baseline();
      const results: string[] = [];

      if (JSON.stringify(baseline.site) !== JSON.stringify(value.site)) {
        const result = await put<{ mtime: number }>('/config/site', {
          site: value.site,
          baseMtime: siteMtime,
        });
        siteMtime = result.mtime;
        results.push('사이트 설정');
      }

      if (JSON.stringify(baseline.categories) !== JSON.stringify(value.categories)) {
        const result = await put<{ mtime: number; createdFolders: string[] }>(
          '/config/categories',
          { categories: value.categories, baseMtime: categoriesMtime },
        );
        categoriesMtime = result.mtime;
        results.push('카테고리');
        if (result.createdFolders?.length) {
          toast('success', L.settings.restartNotice);
        }
        // 새 id는 다음 렌더부터 잠긴다.
        existingIds = new Set(value.categories.map((category) => category.id));
      }

      // 두 파일 중 무엇이 저장되었는지 그대로 알린다.
      if (results.length > 0) toast('success', `${results.join(' · ')} 저장`);

      return { mtime: siteMtime };
    },
  });

  try {
    const [siteData, categoryData, icons] = await Promise.all([
      get<{
        site: Site;
        envOverrides: Record<string, boolean>;
        mtime: number | null;
      }>('/config/site'),
      get<{ categories: Category[]; postCounts: Record<string, number>; mtime: number | null }>(
        '/config/categories',
      ),
      get<{ icons: string[] }>('/config/icons').catch(() => ({ icons: [] as string[] })),
    ]);

    siteMtime = siteData.mtime;
    categoriesMtime = categoryData.mtime;
    postCounts = categoryData.postCounts;
    existingIds = new Set(categoryData.categories.map((category) => category.id));

    form.reset({ site: siteData.site, categories: categoryData.categories }, siteData.mtime);

    // 읽기 전용 행
    const base = qs('[data-readonly="base"]');
    if (base) base.textContent = siteData.site.base;
    const navOrder = qs('[data-readonly="navOrder"]');
    if (navOrder) navOrder.textContent = siteData.site.navOrder.join(' → ');

    if (siteData.envOverrides.PUBLIC_SITE_URL) {
      qs('[data-url-env-warning]')?.classList.remove('admin-row-hidden');
    }

    const goatcounter = qs('[data-goatcounter]');
    if (goatcounter) {
      goatcounter.textContent = siteData.envOverrides.PUBLIC_GOATCOUNTER_CODE
        ? L.settings.goatcounterSet
        : L.settings.goatcounterUnset;
    }

    // 아이콘 자동완성 — 목록이 커서 datalist에만 넣는다.
    const datalist = qs('#lucide-icons');
    for (const name of icons.icons ?? []) {
      datalist?.append(el('option', { value: name }));
    }

    notifyChanged();
  } catch (error) {
    reportError(error);
  }
}
