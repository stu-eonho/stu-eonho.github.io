/**
 * 홈 화면의 데이터 소스.
 *
 * 여기 있는 값은 전부 사용자가 직접 채웁니다. 꺾쇠(`<...>`)로 감싼 값이 아직 채우지
 * 않은 자리입니다. 공개하고 싶지 않은 항목은 값을 지우거나 줄 전체를 삭제하세요 —
 * 각 필드 주석에 "비우면 화면이 어떻게 되는지"를 적어 두었습니다.
 *
 * 플레이스홀더 상태로도 빌드는 성공합니다. 사이트를 먼저 띄워 본 뒤 채워도 됩니다.
 * 미기입 항목이 남아 있으면 빌드 로그에 경고 한 줄이 나옵니다(에러가 아닙니다).
 *
 * ## 한국어 / 영어
 *
 * 글자가 들어가는 필드는 대부분 두 가지 방식으로 쓸 수 있습니다.
 *
 *   school: 'KAIST'                                  // 두 언어에서 똑같이 나옵니다
 *   school: { ko: '서울대학교', en: 'Seoul National University' }   // 언어별로 다르게
 *
 * 고유명사처럼 번역할 필요가 없는 값은 그냥 문자열로 두세요. `{ ko, en }` 형태로 쓰면
 * `/`(한국어)와 `/en/`(영어) 화면이 각각 해당 값을 씁니다.
 */
import type { MaybeLocalized } from './i18n';

/** 학위 과정 구분. UI 표기는 EducationList가 담당한다. */
export type Degree = 'BS' | 'MS' | 'PhD' | 'Exchange' | 'Other';

export interface EducationEntry {
  degree: Degree;
  /** 학교명 */
  school: MaybeLocalized;
  /** 학과 */
  department: MaybeLocalized;
  /** 연구실명 — 비우면 해당 줄만 생략 */
  lab?: MaybeLocalized;
  /** 지도교수 — 공개 여부는 자유. 비우면 해당 줄만 생략 */
  advisor?: MaybeLocalized;
  /** "YYYY-MM" */
  startDate: string;
  /** "YYYY-MM" 또는 재학 중이면 null → 화면에 "현재"로 표시 */
  endDate: string | null;
  /** 예: "학부 연구생" — 비우면 해당 줄만 생략 */
  note?: MaybeLocalized;
}

/** 고용 형태. UI 표기는 CareerList가 담당한다. */
export type Employment = 'Full-time' | 'Intern' | 'Contract' | 'Freelance' | 'Other';

export interface CareerEntry {
  /** 회사·기관·연구실명 */
  company: MaybeLocalized;
  /** 직함·역할. 예: "백엔드 엔지니어", "연구 인턴" */
  role: MaybeLocalized;
  /** 팀·부서 — 비우면 해당 줄만 생략 */
  team?: MaybeLocalized;
  /** 고용 형태 — 비우면 해당 표기만 생략 */
  employment?: Employment;
  /** "YYYY-MM" */
  startDate: string;
  /** "YYYY-MM" 또는 재직 중이면 null → 화면에 "현재"로 표시 */
  endDate: string | null;
  /** 한 줄 설명 — 무엇을 했는지. 비우면 해당 줄만 생략 */
  description?: MaybeLocalized;
}

export interface SkillGroup {
  /** 그룹명. 예: "Languages", "ML/DL", "Infra" */
  name: MaybeLocalized;
  /** 항목당 24자 이내 */
  items: MaybeLocalized[];
}

/** 아이콘 매핑 키. 목록에 없는 서비스는 `homepage`를 쓴다. */
export type SocialType = 'github' | 'scholar' | 'linkedin' | 'x' | 'email' | 'orcid' | 'homepage';

export interface SocialLink {
  type: SocialType;
  /** 절대 URL. type이 email이면 `mailto:` 스킴 */
  url: string;
  /** aria-label 및 툴팁 텍스트 */
  label: MaybeLocalized;
}

export interface Profile {
  name: MaybeLocalized;
  /** 영문 표기. 한국어 화면에서 이름 옆에 병기됩니다 */
  nameEn?: string;
  photoAlt: MaybeLocalized;
  tagline: MaybeLocalized;
  bio: MaybeLocalized;
  email?: string;
  location?: MaybeLocalized;
  education: EducationEntry[];
  career: CareerEntry[];
  skillGroups: SkillGroup[];
  interests: MaybeLocalized[];
  links: SocialLink[];
  /** 언어별로 다른 파일을 두려면 `{ ko: '/cv-ko.pdf', en: '/cv-en.pdf' }` */
  cvUrl?: MaybeLocalized;
}

/**
 * 프로필 사진.
 *
 * `src/assets/profile.jpg`(또는 .jpeg/.png/.webp)를 넣으면 자동으로 잡힙니다.
 * 파일이 없으면 홈 화면은 이름 이니셜 원형 플레이스홀더를 대신 그립니다 —
 * 이 파일을 편집할 필요가 없습니다. 정사각형 640x640 이상을 권장하며 원형으로 잘립니다.
 */
const photoModules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/profile.{jpg,jpeg,png,webp}',
  { eager: true },
);
export const PROFILE_PHOTO: ImageMetadata | null = Object.values(photoModules)[0]?.default ?? null;

export const PROFILE: Profile = {
  /** 표기명. 프로필 카드 제목과 저작권 표기에 쓰입니다. */
  name: { ko: '<이름>', en: '<Name>' },

  /** 영문 표기. 비우면 해당 줄만 생략됩니다. */
  nameEn: '<English Name>',

  /** 사진 설명. 스크린리더가 읽는 문구이므로 사진을 넣었다면 반드시 바꾸세요. */
  photoAlt: { ko: '<프로필 사진 설명>', en: '<Describe the profile photo>' },

  /** 한 줄 소개 (80자 이내). 이름 바로 아래에 큰 글씨로 나옵니다. */
  tagline: { ko: '<한 줄 소개>', en: '<One-line introduction>' },

  /** 2~3문장 자기소개 (400자 이내). */
  bio: {
    ko: '<자기소개 두세 문장. 무엇을 연구하고 무엇에 관심이 있는지 적습니다.>',
    en: '<Two or three sentences: what you research and what you care about.>',
  },

  /** 이메일. 비우면 소셜 아이콘 행에서 이메일 아이콘만 사라집니다. */
  email: '<you@example.com>',

  /** 예: "Seoul, Korea". 비우면 해당 줄만 생략됩니다. */
  location: { ko: '<도시, 국가>', en: '<City, Country>' },

  /**
   * 학적. 최신 항목이 배열 앞에 옵니다.
   * 배열을 비우면 학적 섹션 전체와 프로필 카드의 소속 한 줄이 함께 사라집니다.
   */
  education: [
    {
      degree: 'BS',
      school: { ko: '<학교명>', en: '<University>' },
      department: { ko: '<학과명>', en: '<Department>' },
      lab: { ko: '<연구실명>', en: '<Lab>' },
      advisor: { ko: '<지도교수명>', en: '<Advisor>' },
      startDate: '2024-03',
      endDate: null, // 재학 중이면 null → "현재"로 표시됩니다
      note: { ko: '<비고>', en: '<Note>' },
    },
  ],

  /**
   * 경력. 최신 항목이 배열 앞에 옵니다.
   * 배열을 비우면 경력 섹션 전체가 사라집니다 — 경력이 없으면 `career: []`로 두세요.
   */
  career: [
    {
      company: { ko: '<회사·기관명>', en: '<Company / Institution>' },
      role: { ko: '<직함·역할>', en: '<Job title>' },
      team: { ko: '<팀·부서>', en: '<Team>' },
      employment: 'Intern',
      startDate: '2025-06',
      endDate: null, // 재직 중이면 null → "현재"로 표시됩니다
      description: { ko: '<무엇을 했는지 한 줄로>', en: '<One line on what you did>' },
    },
  ],

  /** 스킬 그룹 (최대 5그룹 권장). 비우면 스킬 섹션 전체가 사라집니다. */
  skillGroups: [
    {
      // 그룹명과 항목은 대개 두 언어에서 같습니다 — 그럴 땐 문자열 하나로 둡니다.
      name: '<Group name>',
      items: ['<Skill 1>', '<Skill 2>'],
    },
  ],

  /** 연구 관심 분야 (최대 8개). 비우면 관심 분야 섹션 전체가 사라집니다. */
  interests: [{ ko: '<관심 분야>', en: '<Research interest>' }],

  /**
   * 외부 링크 (최대 6개).
   * 비우면 소셜 아이콘 행 전체가 사라집니다.
   */
  links: [
    {
      type: 'github',
      url: '<https://github.com/username>',
      label: 'GitHub',
    },
  ],

  /**
   * CV 링크. 게시하려면 `public/cv.pdf`에 파일을 넣고 '/cv.pdf'로 두세요.
   * 게시하지 않으면 이 줄을 지웁니다 — CV 링크가 화면에서 사라집니다.
   */
  cvUrl: '</cv.pdf 로 바꾸거나 이 줄을 삭제하세요>',
  // 언어별로 다른 CV를 두려면:
  //   cvUrl: { ko: '/cv-ko.pdf', en: '/cv-en.pdf' },
};

/**
 * 값이 아직 꺾쇠 플레이스홀더인지 판정한다.
 * CRITICAL: 판정 결과는 경고에만 쓰인다. 빌드를 실패시키지 않는다.
 */
export function isPlaceholder(value: unknown): boolean {
  return typeof value === 'string' && value.trimStart().startsWith('<');
}

/** 미기입 필드 경로 목록을 수집한다. */
export function collectPlaceholderFields(profile: Profile = PROFILE): string[] {
  const found: string[] = [];
  const walk = (value: unknown, path: string): void => {
    if (isPlaceholder(value)) {
      found.push(path);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`);
    }
  };
  for (const [key, value] of Object.entries(profile)) walk(value, key);
  return found;
}
