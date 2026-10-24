# Test Suite & Verification Evidence

## 1. Test Command & Execution
The automated test suite runs via `pytest`:
```bash
python -m pytest -v
```

---

## 2. Test Execution Results (Actual Run Evidence)

```text
============================= test session starts =============================
platform win32 -- Python 3.12.4, pytest-8.4.2, pluggy-1.6.0
rootdir: C:\Users\dpk41\OneDrive\Docs\ScholarPilot
collected 22 items

tests/test_api.py::test_health_check_endpoint PASSED                     [  4%]
tests/test_api.py::test_scheme_indexing_endpoint PASSED                  [  9%]
tests/test_api.py::test_matching_flow_and_score_persistence_for_arjun PASSED [ 13%]
tests/test_api.py::test_match_missing_consent_forbidden PASSED           [ 18%]
tests/test_api.py::test_match_nonexistent_profile_not_found PASSED       [ 22%]
tests/test_api.py::test_get_profile_scores_pagination_and_filter PASSED  [ 27%]
tests/test_api.py::test_get_single_scheme_score_detail PASSED            [ 31%]
tests/test_eligibility.py::test_income_boundary_conditions PASSED        [ 36%]
tests/test_eligibility.py::test_missing_student_fields_yield_unknown_and_needs_review PASSED [ 40%]
tests/test_eligibility.py::test_mandatory_state_and_category_mismatches PASSED [ 45%]
tests/test_eligibility.py::test_central_scope_applies_pan_india PASSED   [ 50%]
tests/test_eligibility.py::test_unverified_scheme_status_forces_needs_review PASSED [ 54%]
tests/test_eligibility.py::test_scheme_with_no_criteria_restrictions_passes PASSED [ 59%]
tests/test_explanation.py::test_deterministic_explanation_fidelity PASSED [ 63%]
tests/test_explanation.py::test_explanation_fallback_when_llm_is_unconfigured PASSED [ 68%]
tests/test_qdrant_indexing.py::test_idempotent_indexing PASSED           [ 72%]
tests/test_qdrant_indexing.py::test_semantic_candidate_retrieval PASSED  [ 77%]
tests/test_qdrant_indexing.py::test_empty_collection_search PASSED       [ 81%]
tests/test_ranking.py::test_semantic_similarity_never_compensates_for_ineligibility PASSED [ 86%]
tests/test_ranking.py::test_eligible_outranks_needs_review PASSED        [ 90%]
tests/test_ranking.py::test_deadline_urgency_scoring PASSED              [ 95%]
tests/test_ranking.py::test_ranking_consistency_across_runs PASSED       [100%]

============================= 22 passed in 18.10s =============================
```

---

## 3. Coverage of Mandatory Minimum Requirements

| Requirement | Test Function | Result |
| :--- | :--- | :--- |
| **Income below/at/above boundary** | `test_income_boundary_conditions` | **PASS** |
| **Missing income, marks, category, state, course** | `test_missing_student_fields_yield_unknown_and_needs_review` | **PASS** |
| **State & category mismatches** | `test_mandatory_state_and_category_mismatches` | **PASS** |
| **Central schemes open pan-India** | `test_central_scope_applies_pan_india` | **PASS** |
| **Unverified schemes force review** | `test_unverified_scheme_status_forces_needs_review` | **PASS** |
| **Similarity cannot compensate for failed rules** | `test_semantic_similarity_never_compensates_for_ineligibility`| **PASS** |
| **Status multiplier (ELIGIBLE > NEEDS_REVIEW)** | `test_eligible_outranks_needs_review` | **PASS** |
| **Deadline urgency decay (<=14d, 15-60d, expired)**| `test_deadline_urgency_scoring` | **PASS** |
| **Ranking consistency across runs** | `test_ranking_consistency_across_runs` | **PASS** |
| **Idempotent Qdrant indexing** | `test_idempotent_indexing` | **PASS** |
| **Semantic vector candidate retrieval** | `test_semantic_candidate_retrieval` | **PASS** |
| **Empty collection candidate safety** | `test_empty_collection_search` | **PASS** |
| **Deterministic explanation fidelity** | `test_deterministic_explanation_fidelity` | **PASS** |
| **LLM fallback on missing key or timeout** | `test_explanation_fallback_when_llm_is_unconfigured` | **PASS** |
| **End-to-end matching & score persistence** | `test_matching_flow_and_score_persistence_for_arjun` | **PASS** |
| **Match retry idempotency (no duplicate rows)** | `test_matching_flow_and_score_persistence_for_arjun` | **PASS** |
| **Missing profile consent returns 403** | `test_match_missing_consent_forbidden` | **PASS** |
| **Invalid profile ID returns 404** | `test_match_nonexistent_profile_not_found` | **PASS** |
| **Score list pagination & status filters** | `test_get_profile_scores_pagination_and_filter` | **PASS** |
| **Single scheme score detail endpoint** | `test_get_single_scheme_score_detail` | **PASS** |
