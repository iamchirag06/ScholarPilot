"""Unit tests for transparent ranking formula and eligibility-priority ordering."""

from datetime import date, timedelta
from src.scholarpilot_ai.engine.eligibility import (
    EligibilityResult,
    EligibilityStatus,
    RuleEvaluation,
    RuleStatus,
)
from src.scholarpilot_ai.engine.ranker import (
    RecommendationRanker,
    ScoredRecommendation,
)


def _make_eligibility(status: EligibilityStatus, passed: int = 4, total: int = 4) -> EligibilityResult:
    return EligibilityResult(
        scheme_id="scheme-dummy",
        status=status,
        rule_evaluations=[
            RuleEvaluation(rule_name=f"r_{i}", status=RuleStatus.PASS, reason="ok")
            for i in range(passed)
        ],
        passed_rules_count=passed,
        total_applicable_rules_count=total,
    )


def test_semantic_similarity_never_compensates_for_ineligibility():
    """A scheme with perfect 1.0 (100%) vector similarity that fails mandatory criteria gets score 0.0."""
    scheme = {
        "id": "scheme-ineligible-high-sim",
        "title": "Unmatched Scheme",
        "award_amount_inr": 100000,
        "deadline": (date.today() + timedelta(days=10)).isoformat(),
    }
    eligibility = _make_eligibility(EligibilityStatus.NOT_ELIGIBLE, passed=2, total=4)

    scored = RecommendationRanker.score_candidate(
        scheme=scheme,
        eligibility=eligibility,
        vector_similarity=1.0,  # 100% similarity
    )

    assert scored.semantic_score == 100.0
    # Final score must be 0.0 due to status multiplier
    assert scored.final_score == 0.0


def test_eligible_outranks_needs_review():
    """Eligible scheme always receives higher score than needs-review scheme with equal raw attributes."""
    scheme = {
        "id": "scheme-test",
        "title": "Scholarship",
        "award_amount_inr": 50000,
        "deadline": (date.today() + timedelta(days=20)).isoformat(),
    }

    scored_eligible = RecommendationRanker.score_candidate(
        scheme=scheme,
        eligibility=_make_eligibility(EligibilityStatus.ELIGIBLE),
        vector_similarity=0.85,
    )

    scored_review = RecommendationRanker.score_candidate(
        scheme=scheme,
        eligibility=_make_eligibility(EligibilityStatus.NEEDS_REVIEW),
        vector_similarity=0.85,
    )

    assert scored_eligible.final_score > scored_review.final_score
    # Status multiplier for review is 0.80
    assert abs(scored_review.final_score - round(scored_eligible.final_score * 0.80, 2)) <= 0.05


def test_deadline_urgency_scoring():
    """Urgency score reflects remaining time window."""
    today = date.today()

    # Urgency <= 14 days
    urgent_date = (today + timedelta(days=7)).isoformat()
    assert RecommendationRanker.calculate_urgency_score(urgent_date) == 100.0

    # Active window 15 to 60 days
    active_date = (today + timedelta(days=30)).isoformat()
    assert RecommendationRanker.calculate_urgency_score(active_date) == 85.0

    # Distant deadline > 60 days
    distant_date = (today + timedelta(days=90)).isoformat()
    assert RecommendationRanker.calculate_urgency_score(distant_date) == 70.0

    # Expired deadline
    expired_date = (today - timedelta(days=5)).isoformat()
    assert RecommendationRanker.calculate_urgency_score(expired_date) == 0.0


def test_ranking_consistency_across_runs():
    """Ranking order must be completely deterministic and stable across multiple runs."""
    candidates = []
    for i in range(5):
        s = {
            "id": f"scheme-{i}",
            "title": f"Scheme {i}",
            "award_amount_inr": 20000 * (i + 1),
            "deadline": (date.today() + timedelta(days=15 + i * 5)).isoformat(),
        }
        st = EligibilityStatus.ELIGIBLE if i % 2 == 0 else EligibilityStatus.NEEDS_REVIEW
        scored = RecommendationRanker.score_candidate(
            scheme=s,
            eligibility=_make_eligibility(st),
            vector_similarity=0.60 + (i * 0.05),
        )
        candidates.append(scored)

    run_1 = [c.scheme_id for c in RecommendationRanker.rank_candidates(candidates)]
    run_2 = [c.scheme_id for c in RecommendationRanker.rank_candidates(candidates)]
    assert run_1 == run_2
