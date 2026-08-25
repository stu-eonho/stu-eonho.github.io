/**
 * 프로필 화면 — `PROFILE` 값을 폼과 오가게 한다.
 *
 * CRITICAL: `undefined`인 선택 프로퍼티는 방출하지 않고, `null`(진행 중을 뜻하는
 * `endDate`)은 그대로 `null`로 남긴다. 이 둘을 섞으면 "재직 중"이 사라진다.
 */
import { get, put, reportError, toast } from './api';
import { need, qs, qsa } from './dom';
import {
  bindLocalizedToggles,
  getChecked,
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
import { bindCounters, createForm, notifyChanged } from './forms';
import { initRepeatable } from './repeatable';
import { uploadFile } from './uploader';
import { L } from '../labels';

interface EducationEntry {
  degree: string;
  school: MaybeLocalized;
  department: MaybeLocalized;
  lab?: MaybeLocalized;
  advisor?: MaybeLocalized;
  startDate: string;
  /** CRITICAL: `null`은 "재학 중"이다. `undefined`와 섞으면 그 표기가 사라진다 */
  endDate: string | null;
  note?: MaybeLocalized;
}

interface CareerEntry {
  company: MaybeLocalized;
  role: MaybeLocalized;
  team?: MaybeLocalized;
  employment?: string;
  startDate: string;
  endDate: string | null;
  description?: MaybeLocalized;
}

interface SkillGroup {
  name: MaybeLocalized;
  items: string[];
}

interface SocialLink {
  type: string;
  url: string;
  label: MaybeLocalized;
}

interface Profile {
  name: MaybeLocalized;
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
  cvUrl?: MaybeLocalized;
}

function localizedIn(row: ParentNode, path: string): HTMLElement {
  return need(`[data-localized-field="${CSS.escape(path)}"]`, row);
}

/** `MaybeLocalized`를 화면 표시용 문자열 하나로 접는다(칩 등 단일 입력용). */
function flatten(value: MaybeLocalized | undefined): string {
  if (value === undefined || value === null) return '';
  return typeof value === 'string' ? value : (value.ko ?? '');
}

export async function initProfile(): Promise<void> {
  const interestsChips = need('[data-chips="interests"]');
  initChips(interestsChips, { maxItems: 8, maxLength: 40 });

  bindLocalizedToggles();
  bindCounters();

  const education = initRepeatable<EducationEntry>(need('[data-repeatable="education"]'), {
    create: () => ({ degree: 'BS', school: '', department: '', startDate: '', endDate: null }),
    fill(row, value) {
      setValue(row, 'degree', value.degree ?? 'BS');
      writeLocalized(localizedIn(row, 'school'), value.school);
      writeLocalized(localizedIn(row, 'department'), value.department);
      writeLocalized(localizedIn(row, 'lab'), value.lab);
      writeLocalized(localizedIn(row, 'advisor'), value.advisor);
      writeLocalized(localizedIn(row, 'note'), value.note);
      setValue(row, 'startDate', value.startDate ?? '');
      setValue(row, 'endDate', value.endDate ?? '');
      setValue(row, 'ongoing', value.endDate === null);
    },
    read(row) {
      const ongoing = getChecked(row, 'ongoing');
      const entry: EducationEntry = {
        degree: getValue(row, 'degree') || 'BS',
        school: readLocalized(localizedIn(row, 'school')) ?? '',
        department: readLocalized(localizedIn(row, 'department')) ?? '',
        lab: readLocalized(localizedIn(row, 'lab')),
        advisor: readLocalized(localizedIn(row, 'advisor')),
        startDate: getValue(row, 'startDate').trim(),
        // CRITICAL: null은 "재학 중"이다. undefined로 접으면 키가 사라져 스키마가 깨진다.
        endDate: ongoing ? null : (optional(getValue(row, 'endDate')) ?? null),
        note: readLocalized(localizedIn(row, 'note')),
      };
      return entry;
    },
  });

  const career = initRepeatable<CareerEntry>(need('[data-repeatable="career"]'), {
    create: () => ({ company: '', role: '', startDate: '', endDate: null }),
    fill(row, value) {
      writeLocalized(localizedIn(row, 'company'), value.company);
      writeLocalized(localizedIn(row, 'role'), value.role);
      writeLocalized(localizedIn(row, 'team'), value.team);
      writeLocalized(localizedIn(row, 'description'), value.description);
      setValue(row, 'employment', value.employment ?? '');
      setValue(row, 'startDate', value.startDate ?? '');
      setValue(row, 'endDate', value.endDate ?? '');
      setValue(row, 'ongoing', value.endDate === null);
    },
    read(row) {
      const ongoing = getChecked(row, 'ongoing');
      return {
        company: readLocalized(localizedIn(row, 'company')) ?? '',
        role: readLocalized(localizedIn(row, 'role')) ?? '',
        team: readLocalized(localizedIn(row, 'team')),
        employment: optional(getValue(row, 'employment')),
        startDate: getValue(row, 'startDate').trim(),
        endDate: ongoing ? null : (optional(getValue(row, 'endDate')) ?? null),
        description: readLocalized(localizedIn(row, 'description')),
      };
    },
  });

  const skills = initRepeatable<SkillGroup>(need('[data-repeatable="skillGroups"]'), {
    create: () => ({ name: '', items: [] }),
    onMount(row) {
      const chips = qs<HTMLElement>('[data-chips="items"]', row);
      if (chips) initChips(chips, { maxLength: 24 });
    },
    fill(row, value) {
      writeLocalized(localizedIn(row, 'name'), value.name);
      const chips = qs<HTMLElement>('[data-chips="items"]', row);
      if (chips) writeChips(chips, (value.items ?? []).map(flatten));
    },
    read(row) {
      const chips = qs<HTMLElement>('[data-chips="items"]', row);
      return {
        name: readLocalized(localizedIn(row, 'name')) ?? '',
        items: chips ? readChips(chips) : [],
      };
    },
  });

  const links = initRepeatable<SocialLink>(need('[data-repeatable="links"]'), {
    create: () => ({ type: 'github', url: '', label: '' }),
    fill(row, value) {
      setValue(row, 'type', value.type ?? 'github');
      setValue(row, 'url', value.url ?? '');
      writeLocalized(localizedIn(row, 'label'), value.label);
    },
    read(row) {
      const url = getValue(row, 'url').trim();
      if (url === '') return undefined;
      return {
        type: getValue(row, 'type') || 'homepage',
        url,
        label: readLocalized(localizedIn(row, 'label')) ?? '',
      };
    },
  });

  const form = createForm<Profile>({
    read() {
      return {
        name: readLocalized(need('[data-localized-field="name"]')) ?? '',
        nameEn: optional(getValue(document, 'nameEn')),
        photoAlt: readLocalized(need('[data-localized-field="photoAlt"]')) ?? '',
        tagline: readLocalized(need('[data-localized-field="tagline"]')) ?? '',
        bio: readLocalized(need('[data-localized-field="bio"]')) ?? '',
        email: optional(getValue(document, 'email')),
        location: readLocalized(need('[data-localized-field="location"]')),
        education: education.read(),
        career: career.read(),
        skillGroups: skills.read(),
        interests: readChips(interestsChips),
        links: links.read(),
        cvUrl: optional(getValue(document, 'cvUrl')),
      };
    },
    write(value) {
      writeLocalized(need('[data-localized-field="name"]'), value.name);
      setValue(document, 'nameEn', value.nameEn ?? '');
      writeLocalized(need('[data-localized-field="photoAlt"]'), value.photoAlt);
      writeLocalized(need('[data-localized-field="tagline"]'), value.tagline);
      writeLocalized(need('[data-localized-field="bio"]'), value.bio);
      setValue(document, 'email', value.email ?? '');
      writeLocalized(need('[data-localized-field="location"]'), value.location);
      setValue(document, 'cvUrl', flatten(value.cvUrl));
      education.write(value.education ?? []);
      career.write(value.career ?? []);
      skills.write(value.skillGroups ?? []);
      links.write(value.links ?? []);
      writeChips(interestsChips, (value.interests ?? []).map(flatten));
      bindCounters();
    },
    async save(value, baseMtime) {
      const result = await put<{ mtime: number }>('/profile', { profile: value, baseMtime });
      // 저장하면 미기입 목록이 달라진다 — 화면 표시를 다시 맞춘다.
      void refreshPlaceholders();
      return result;
    },
  });

  async function refreshPlaceholders(): Promise<void> {
    try {
      const data = await get<{ placeholders: string[] }>('/profile');
      const total = data.placeholders.length;
      const hint = qs('[data-placeholder-count]');
      if (hint) hint.textContent = total === 0 ? '' : `미기입 ${total}건`;
    } catch {
      /* 표시용이다. 실패해도 편집을 막지 않는다 */
    }
  }

  /* ---------- 프로필 사진 ---------- */

  const photoInput = qs<HTMLInputElement>('[data-photo-input]');
  const photoDrop = qs<HTMLElement>('[data-photo-drop]');
  const photoImg = qs<HTMLImageElement>('[data-photo-img]');
  const photoFallback = qs<HTMLElement>('[data-photo-fallback]');
  const photoName = qs<HTMLElement>('[data-photo-name]');

  function showPhoto(name: string | null): void {
    if (name && photoImg) {
      // dev 서버가 src 아래 파일을 그대로 서빙한다. 캐시 무효화용 쿼리를 붙인다.
      photoImg.src = `/src/assets/${encodeURIComponent(name)}?t=${Date.now()}`;
      photoImg.alt = L.profile.photo;
      photoImg.classList.remove('admin-row-hidden');
      photoFallback?.classList.add('admin-row-hidden');
    } else {
      photoImg?.classList.add('admin-row-hidden');
      photoFallback?.classList.remove('admin-row-hidden');
    }
    if (photoName) photoName.textContent = name ?? L.profile.photoEmpty;
  }

  photoDrop?.addEventListener('click', () => photoInput?.click());
  photoInput?.addEventListener('change', async () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    try {
      const result = await uploadFile(file, 'profile-photo');
      showPhoto(result.name);
      toast('success', `프로필 사진을 교체했습니다: ${result.name}`);
    } catch (error) {
      reportError(error);
    } finally {
      photoInput.value = '';
    }
  });

  /* ---------- 로드 ---------- */

  try {
    const data = await get<{
      profile: Profile;
      placeholders: string[];
      photo: string | null;
      photoDuplicates: string[];
      mtime: number | null;
    }>('/profile');

    form.reset(data.profile, data.mtime);
    showPhoto(data.photo);

    if (data.photoDuplicates.length > 0) {
      toast(
        'error',
        `src/assets에 프로필 사진이 ${data.photoDuplicates.length + 1}개 있습니다. 하나만 남겨야 합니다.`,
      );
    }

    // 자리표시 값이 들어 있는 입력에 점선 테두리가 붙었는지 확인 겸 재적용
    for (const input of qsa<HTMLInputElement | HTMLTextAreaElement>(
      '.admin-input, .admin-textarea',
    )) {
      input.setAttribute('data-placeholder', String(input.value.trimStart().startsWith('<')));
    }
    notifyChanged();
  } catch (error) {
    reportError(error);
  }
}
