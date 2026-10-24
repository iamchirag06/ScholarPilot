import { Profile } from '../types/index.ts';
import { apiFetch, isMockMode, ApiError, getStoredUserId } from './api.ts';
import { DEMO_PROFILE } from '../mockData.ts';

// In-memory / localStorage cache for mock fallback
const getMockProfiles = (): Profile[] => {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('scholarpilot_mock_profiles');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
  }
  return [DEMO_PROFILE];
};

const saveMockProfiles = (profiles: Profile[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('scholarpilot_mock_profiles', JSON.stringify(profiles));
  }
};

/**
 * Normalizes raw backend profile data to ensure clean camelCase Profile fields.
 */
export function normalizeProfile(raw: any): Profile {
  if (!raw) return DEMO_PROFILE;
  return {
    id: raw.id ?? raw.profileId ?? raw._id,
    fullName: raw.fullName ?? raw.full_name ?? '',
    category: raw.category ?? 'GENERAL',
    annualIncome: typeof raw.annualIncome === 'number' ? raw.annualIncome : Number(raw.annual_income ?? 0),
    state: raw.state ?? '',
    courseLevel: raw.courseLevel ?? raw.course_level ?? 'UG',
    gender: raw.gender ?? 'OTHER',
    isDisabled: Boolean(raw.isDisabled ?? raw.is_disabled ?? false),
    marksPercentage: typeof raw.marksPercentage === 'number' ? raw.marksPercentage : Number(raw.marks_percentage ?? 0),
  };
}

/**
 * 3. Create Profile (Submit Form) -> POST /api/profiles/create
 * What to send: JSON with userId (from login), fullName, category, annualIncome, state, courseLevel, gender, isDisabled, marksPercentage.
 * What it returns: The saved profile object. (If you send a duplicate name+state or forget the userId, it returns a 400 Bad Request).
 */
export async function createProfile(
  data: Omit<Profile, 'id'>,
  userIdParam?: string
): Promise<Profile> {
  const userId = userIdParam || getStoredUserId();

  if (!userId && !isMockMode()) {
    throw new ApiError(400, 'User ID is required. Please sign in or create an account first.');
  }

  const payload: Record<string, any> = {
    userId: userId || 'mock-user-id',
    fullName: data.fullName?.trim() || '',
    category: data.category,
    annualIncome: Number(data.annualIncome) || 0,
    state: data.state,
    courseLevel: data.courseLevel,
    gender: data.gender,
    isDisabled: Boolean(data.isDisabled),
    marksPercentage: Number(data.marksPercentage) || 0,
  };

  if (isMockMode()) {
    await new Promise((res) => setTimeout(res, 400));
    const list = getMockProfiles();
    // Simulate duplicate check: fullName + state
    const duplicate = list.find(
      (p) =>
        p.fullName.trim().toLowerCase() === payload.fullName.toLowerCase() &&
        p.state.toLowerCase() === payload.state.toLowerCase()
    );
    if (duplicate) {
      throw new ApiError(400, 'A profile with this name and state already exists');
    }
    const newId = `prof-${Date.now()}`;
    const newProfile: Profile = {
      id: newId,
      ...payload,
    };
    list.push(newProfile);
    saveMockProfiles(list);
    if (typeof window !== 'undefined') {
      localStorage.setItem('scholarpilot_profile_id', String(newId));
    }
    return newProfile;
  }

  try {
    const raw = await apiFetch<any>('/api/profiles/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const saved = normalizeProfile(raw);
    if (typeof window !== 'undefined' && saved.id) {
      localStorage.setItem('scholarpilot_profile_id', String(saved.id));
    }
    return saved;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(err.status || 400, err.message || 'Failed to create profile');
  }
}

/**
 * 4. Get All Profiles (Dev/Testing) -> GET /api/profiles/all
 * What to send: Nothing.
 * What it returns: An array of all profile objects. Use this to easily grab real UUIDs for testing.
 */
export async function getAllProfiles(): Promise<Profile[]> {
  if (isMockMode()) {
    await new Promise((res) => setTimeout(res, 300));
    return getMockProfiles();
  }

  try {
    const list = await apiFetch<any[]>('/api/profiles/all');
    if (!Array.isArray(list)) return [];
    return list.map(normalizeProfile);
  } catch (err) {
    console.warn('Failed to fetch all profiles, fallback to mock list if available', err);
    return getMockProfiles();
  }
}

/**
 * 5. Get Specific Profile -> GET /api/profiles/{id}
 * What to send: The Profile ID in the URL.
 * What it returns: The specific profile object. Use this to pre-fill the edit profile form.
 */
export async function getProfile(id: string | number): Promise<Profile> {
  if (isMockMode()) {
    await new Promise((res) => setTimeout(res, 300));
    const list = getMockProfiles();
    const found = list.find((p) => String(p.id) === String(id));
    if (found) return found;
    return DEMO_PROFILE;
  }

  const raw = await apiFetch<any>(`/api/profiles/${id}`);
  return normalizeProfile(raw);
}

/**
 * Computes a diff between the original profile and edited values.
 * Returns only changed fields.
 */
export function computeProfileDiff(
  original: Profile,
  updated: Partial<Profile>
): Partial<Profile> {
  const diff: Partial<Profile> = {};
  const fields: (keyof Omit<Profile, 'id'>)[] = [
    'fullName',
    'category',
    'annualIncome',
    'state',
    'courseLevel',
    'gender',
    'isDisabled',
    'marksPercentage',
  ];

  for (const field of fields) {
    if (updated[field] !== undefined && updated[field] !== original[field]) {
      (diff as any)[field] = updated[field];
    }
  }

  return diff;
}

/**
 * 6. Update Profile -> PUT /api/profiles/{id}
 * What to send: The Profile ID in the URL. JSON with only the fields you want to change (e.g., { "annualIncome": 900000 }).
 * What it returns: The updated profile object.
 */
export async function updateProfile(
  id: string | number,
  partialOrDiff: Partial<Profile>,
  originalProfile?: Profile
): Promise<Profile> {
  // If original profile is provided, compute precise diff
  const diff = originalProfile ? computeProfileDiff(originalProfile, partialOrDiff) : partialOrDiff;

  // Skip if nothing changed
  if (Object.keys(diff).length === 0) {
    if (originalProfile) return originalProfile;
    return getProfile(id);
  }

  if (isMockMode()) {
    await new Promise((res) => setTimeout(res, 300));
    const list = getMockProfiles();
    const idx = list.findIndex((p) => String(p.id) === String(id));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...diff };
      saveMockProfiles(list);
      return list[idx];
    }
    const updated = { ...DEMO_PROFILE, ...diff, id };
    list.push(updated);
    saveMockProfiles(list);
    return updated;
  }

  const raw = await apiFetch<any>(`/api/profiles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(diff),
  });

  return normalizeProfile(raw);
}
