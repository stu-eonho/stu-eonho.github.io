/**
 * 카테고리 단일 진실 공급원.
 *
 * CRITICAL: 새 카테고리를 추가하는 절차는 두 단계로 끝나야 한다.
 *   1. 아래 `CATEGORIES` 배열에 항목 하나를 추가한다
 *   2. `src/content/posts/<id>/` 폴더를 만든다
 * `src/pages/` 아래 어떤 파일도 만들거나 수정하지 않는다. 내비게이션·목록·페이지네이션·
 * 상세 라우트·Zod enum이 전부 이 배열에서 파생된다.
 */

import type { Lang, Localized } from './i18n';

/** 글 상세에서 렌더링할 메타 패널 종류. */
export type MetaPanel = 'paper' | 'project' | 'none';

export interface Category {
  /** URL 세그먼트. `[a-z0-9-]+` 패턴 */
  id: string;
  /** 상단 바 표기 */
  label: string;
  /** 목록 페이지 부제용 한국어 표기 */
  labelKo: string;
  /** 카테고리 목록 헤더 및 메타 설명 (언어별 max 120자) */
  description: Localized<string>;
  /** lucide 아이콘 이름 */
  icon: string;
  /** 오름차순 정렬 */
  order: number;
  /** 글 상세의 메타 패널 종류 */
  metaPanel: MetaPanel;
}

export const CATEGORIES = [
  {
    id: 'paper-review',
    label: 'Paper Review',
    labelKo: '논문 리뷰',
    description: {
      ko: '읽은 논문을 정리하고 핵심 아이디어와 한계를 기록합니다.',
      en: 'Notes on papers I have read — the core idea, and where it falls short.',
    },
    icon: 'lucide:file-text',
    order: 1,
    metaPanel: 'paper',
  },
  {
    id: 'project',
    label: 'Project',
    labelKo: '프로젝트',
    description: {
      ko: '직접 만들고 운영한 프로젝트의 과정과 결과를 남깁니다.',
      en: 'Projects I built and ran, from the process to what came out of it.',
    },
    icon: 'lucide:folder-git-2',
    order: 2,
    metaPanel: 'project',
  },
  {
    id: 'notes',
    label: 'Notes',
    labelKo: '학습 노트',
    description: {
      ko: '논문과 프로젝트 사이에 남는 짧은 학습 기록입니다.',
      en: 'Short study notes that fall between the papers and the projects.',
    },
    icon: 'lucide:notebook-pen',
    order: 3,
    metaPanel: 'none',
  },
] as const satisfies readonly Category[];

/** `categories.ts` 하나에서 파생되는 카테고리 id 유니온 타입. */
export type CategoryId = (typeof CATEGORIES)[number]['id'];

/** Zod `z.enum()`에 그대로 넘길 수 있는 튜플. */
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as unknown as [CategoryId, ...CategoryId[]];

/** `order` 오름차순 정렬본. 내비게이션과 목록이 공통으로 쓴다. */
export const SORTED_CATEGORIES: readonly Category[] = [...CATEGORIES].sort(
  (a, b) => a.order - b.order,
);

/**
 * id로 카테고리를 찾는다. 존재하지 않는 id는 데이터 정합성이 깨진 상태이므로
 * 조용히 넘기지 않고 빌드를 실패시킨다.
 */
export function getCategory(id: string): Category {
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) {
    throw new Error(
      `[categories] 알 수 없는 카테고리 id: "${id}". src/config/categories.ts의 CATEGORIES에 항목을 추가하세요.`,
    );
  }
  return found;
}

/** 라우트 생성 전 방어용. `getStaticPaths`가 CATEGORIES 밖의 id를 만들지 않게 한다. */
export function isCategoryId(id: string): id is CategoryId {
  return CATEGORIES.some((c) => c.id === id);
}

/**
 * 카테고리의 언어별 표기.
 * 상단 바와 배지는 언제나 영문 `label`을 쓴다(양 언어 공통 표기). 이 함수는 목록 페이지
 * 부제처럼 **문장 안에 섞이는** 자리에서만 쓴다 — 한국어 문장에 'Paper Review'가 끼면 어색하다.
 */
export function categoryName(category: Category, lang: Lang): string {
  return lang === 'ko' ? category.labelKo : category.label;
}

/** 목록 헤더 부제. 한국어는 "논문 리뷰 · 설명", 영어는 설명만 (제목과 중복되므로). */
export function categorySubtitle(category: Category, lang: Lang): string {
  const description = category.description[lang];
  return lang === 'ko' ? `${category.labelKo} · ${description}` : description;
}
