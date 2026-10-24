import { Scheme } from '../types/index.ts';
import { apiFetch, isMockMode } from './api.ts';
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
  const confidence =
    typeof raw.confidence_score === 'number'
      ? raw.confidence_score
      : typeof raw.confidenceScore === 'number'
      ? raw.confidenceScore
      : 0.95;

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
 * 5. getMatchedSchemes(id) -> GET /api/schemes/matched/{id}
 * Returns ranked schemes for that user.
 */
export async function getMatchedSchemes(id: string | number): Promise<Scheme[]> {
  if (isMockMode()) {
    await new Promise((res) => setTimeout(res, 400));
    return MOCK_SCHEMES;
  }

  const rawList = await apiFetch<any[]>(`/api/schemes/matched/${id}`);
  if (!Array.isArray(rawList)) return [];
  return rawList.map(normalizeScheme);
}
