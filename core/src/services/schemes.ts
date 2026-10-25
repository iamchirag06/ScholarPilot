import { Scheme } from '../types/index.ts';
import { apiFetch, isMockMode, getStoredUserId } from './api.ts';
import { MOCK_SCHEMES } from '../mockData.ts';

/**
 * Defensive normalizer for raw backend scheme objects.
 * Handles missing fields, null rank_score, empty required_documents,
 * and camelCase vs snake_case keys.
 */
export function normalizeScheme(raw: any): Scheme {
  if (!raw) {
    return {
      id: Math.random().toString(36).substring(2, 9),
      source_portal: 'National Portal',
      scheme_name: 'Scholarship Scheme',
      provider: 'Government of India',
      award_amount: 15000,
      deadline: '2026-12-31',
      apply_link: '#',
      raw_eligibility_text: '',
      llm_summary: 'Verified matching opportunity for your profile.',
      required_documents: [],
      confidence_score: 0.95,
      rank_score: 95,
    };
  }

  // Award amount
  let award = 0;
  if (typeof raw.award_amount === 'number') {
    award = raw.award_amount;
  } else if (typeof raw.awardAmount === 'number') {
    award = raw.awardAmount;
  } else if (raw.award_amount) {
    award = Number(raw.award_amount) || 0;
  } else if (raw.awardAmount) {
    award = Number(raw.awardAmount) || 0;
  }

  // Documents
  const rawDocs = raw.required_documents ?? raw.requiredDocuments;
  const docs: string[] = Array.isArray(rawDocs)
    ? rawDocs.filter((d: any) => typeof d === 'string')
    : [];

  // Confidence & Rank score
  let confidence =
    typeof raw.confidence_score === 'number'
      ? raw.confidence_score
      : typeof raw.confidenceScore === 'number'
      ? raw.confidenceScore
      : 0.95;

  if (confidence > 1) {
    confidence = confidence / 100;
  }

  const rank =
    typeof raw.rank_score === 'number'
      ? raw.rank_score
      : typeof raw.rankScore === 'number'
      ? raw.rankScore
      : Math.round(confidence * 100);

  return {
    id: String(raw.id ?? raw._id ?? Math.random().toString(36).substring(2, 9)),
    source_portal: raw.source_portal ?? raw.sourcePortal ?? 'Govt Portal',
    scheme_name: raw.scheme_name ?? raw.schemeName ?? 'Higher Education Scholarship',
    provider: raw.provider ?? 'Ministry / Trust',
    award_amount: award,
    deadline: raw.deadline ?? '2026-12-31',
    apply_link: raw.apply_link ?? raw.applyLink ?? '#',
    raw_eligibility_text: raw.raw_eligibility_text ?? raw.rawEligibilityText ?? '',
    llm_summary:
      raw.llm_summary ??
      raw.llmSummary ??
      raw.raw_eligibility_text ??
      raw.rawEligibilityText ??
      'Matched based on your academic and demographic criteria.',
    required_documents: docs,
    confidence_score: confidence,
    rank_score: rank,
  };
}

/**
 * 7. Get Matched Schemes (Dashboard) -> GET /api/schemes/matched/{userId}
 * What to send: The userId in the URL.
 * What it returns: An array of eligible schemes, already sorted by AI rank (highest priority first). Render these as cards.
 */
export async function getMatchedSchemes(userIdParam?: string | number): Promise<Scheme[]> {
  const userId = userIdParam || getStoredUserId();

  if (isMockMode()) {
    await new Promise((res) => setTimeout(res, 400));
    return MOCK_SCHEMES;
  }

  if (!userId) {
    console.warn('getMatchedSchemes called without userId');
    return MOCK_SCHEMES;
  }

  try {
    const rawList = await apiFetch<any>(`/api/schemes/matched/${userId}`);
    let listData: any[] = [];
    if (Array.isArray(rawList)) {
      listData = rawList;
    } else if (rawList && typeof rawList === 'object' && Array.isArray(rawList.schemes)) {
      listData = rawList.schemes;
    } else if (rawList && typeof rawList === 'object' && Array.isArray(rawList.data)) {
      listData = rawList.data;
    } else {
      return MOCK_SCHEMES;
    }
    return listData.map(normalizeScheme);
  } catch (err) {
    console.warn('Failed to load matched schemes, falling back to mock schemes', err);
    return MOCK_SCHEMES;
  }
}

/**
 * 8. Get All Schemes -> GET /api/schemes/all
 * What to send: Nothing.
 * What it returns: An array of all schemes in the database.
 */
export async function getAllSchemes(): Promise<Scheme[]> {
  if (isMockMode()) {
    await new Promise((res) => setTimeout(res, 300));
    return MOCK_SCHEMES;
  }

  try {
    const rawList = await apiFetch<any>('/api/schemes/all');
    let listData: any[] = [];
    if (Array.isArray(rawList)) {
      listData = rawList;
    } else if (rawList && typeof rawList === 'object' && Array.isArray(rawList.schemes)) {
      listData = rawList.schemes;
    } else if (rawList && typeof rawList === 'object' && Array.isArray(rawList.data)) {
      listData = rawList.data;
    } else {
      return MOCK_SCHEMES;
    }
    return listData.map(normalizeScheme);
  } catch (err) {
    console.warn('Failed to load all schemes from backend, falling back to mock schemes', err);
    return MOCK_SCHEMES;
  }
}

/**
 * 9. Auto-Fill Form Data (The "Apply" Button) -> GET /api/schemes/{schemeId}/auto-fill/{profileId}
 * What to send: The schemeId and profileId (Note: This uses the Profile ID, not the User ID) in the URL.
 * What it returns: A JSON object with pre-filled form fields (e.g., "Full Name": "Arjun", "Annual Income": 200000). Map these exact keys to your React input fields.
 */
export async function getAutoFillData(
  schemeId: string,
  profileId: string | number
): Promise<Record<string, any>> {
  if (isMockMode()) {
    await new Promise((res) => setTimeout(res, 200));
    return {
      'Full Name': 'Student',
      'Gender': 'Female',
      'Category': 'GENERAL',
      'Annual Income': 200000,
      'State': 'Delhi',
      'Course Level': 'UG',
      'Marks Percentage': 85,
    };
  }

  try {
    return await apiFetch<Record<string, any>>(`/api/schemes/${schemeId}/auto-fill/${profileId}`);
  } catch (err) {
    console.warn('Failed to fetch auto-fill payload from backend, fallback to client-side mapping', err);
    return {};
  }
}
