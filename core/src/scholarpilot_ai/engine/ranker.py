"""Recommendation ranker implementing the approved transparent multi-factor scoring formula."""

import math
from datetime import datetime, date, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from src.scholarpilot_ai.engine.eligibility import EligibilityStatus, EligibilityResult


class ScoredRecommendation(BaseModel):
    scheme_id: str
    scheme: Dict[str, Any]
    eligibility: EligibilityResult
    vector_similarity: float
    semantic_score: float  # 0 to 100
    coverage_score: float  # 0 to 100
    award_score: float     # 0 to 100
    urgency_score: float   # 0 to 100
    final_score: float     # 0 to 100
    explanation: Optional[Dict[str, Any]] = None


class RecommendationRanker:
    """Computes transparent ranking scores and enforces strict eligibility ordering."""

    WEIGHT_SEMANTIC = 0.35
    WEIGHT_COVERAGE = 0.25
    WEIGHT_AWARD = 0.20
    WEIGHT_URGENCY = 0.20

    STATUS_MULTIPLIERS = {
        EligibilityStatus.ELIGIBLE: 1.0,
        EligibilityStatus.NEEDS_REVIEW: 0.80,
        EligibilityStatus.NOT_ELIGIBLE: 0.0,
    }

    @classmethod
    def calculate_award_score(cls, award_amount: Optional[float]) -> float:
        """Log-normalized score for financial award (scaled to 100 for ₹2,00,000+)."""
        if not award_amount or award_amount <= 0:
            return 40.0  # Baseline credit for schemes with unverified or in-kind award

        max_benchmark = 200000.0
        score = (math.log10(award_amount + 1.0) / math.log10(max_benchmark)) * 100.0
        return max(0.0, min(100.0, score))

    @classmethod
    def calculate_urgency_score(cls, deadline_str: Optional[str]) -> float:
        """Calculate deadline urgency score based on remaining calendar days."""
        if not deadline_str:
            return 50.0  # Neutral score for rolling/unspecified deadlines

        try:
            deadline_date = datetime.strptime(deadline_str[:10], "%Y-%m-%d").date()
            today = date.today()
            days_left = (deadline_date - today).days

            if days_left < 0:
                return 0.0  # Expired
            elif days_left <= 14:
                return 100.0  # Urgent priority
            elif days_left <= 60:
                return 85.0   # Active window
            else:
                return 70.0   # Open long-term
        except Exception:
            return 50.0

    @classmethod
    def score_candidate(
        cls,
        scheme: Dict[str, Any],
        eligibility: EligibilityResult,
        vector_similarity: float,
    ) -> ScoredRecommendation:
        """Compute the composite ranking score for a single candidate scheme."""
        # 1. Semantic fit score (0-100)
        semantic_score = round(max(0.0, min(1.0, vector_similarity)) * 100.0, 2)

        # 2. Criteria coverage score (0-100)
        coverage_score = eligibility.coverage_percent

        # 3. Award benefit score (0-100)
        award_amount = scheme.get("award_amount_inr")
        award_score = round(cls.calculate_award_score(award_amount), 2)

        # 4. Deadline urgency score (0-100)
        deadline = scheme.get("deadline")
        urgency_score = round(cls.calculate_urgency_score(deadline), 2)

        # 5. Composite weighted calculation
        raw_weighted = (
            cls.WEIGHT_SEMANTIC * semantic_score
            + cls.WEIGHT_COVERAGE * coverage_score
            + cls.WEIGHT_AWARD * award_score
            + cls.WEIGHT_URGENCY * urgency_score
        )

        multiplier = cls.STATUS_MULTIPLIERS.get(eligibility.status, 0.0)
        final_score = round(raw_weighted * multiplier, 2)

        return ScoredRecommendation(
            scheme_id=str(scheme.get("id")),
            scheme=scheme,
            eligibility=eligibility,
            vector_similarity=vector_similarity,
            semantic_score=semantic_score,
            coverage_score=coverage_score,
            award_score=award_score,
            urgency_score=urgency_score,
            final_score=final_score,
        )

    @classmethod
    def rank_candidates(
        cls,
        scored_candidates: List[ScoredRecommendation],
        include_not_eligible: bool = False,
    ) -> List[ScoredRecommendation]:
        """Sort candidates: ELIGIBLE first, NEEDS_REVIEW second, NOT_ELIGIBLE last/hidden."""
        status_priority = {
            EligibilityStatus.ELIGIBLE: 0,
            EligibilityStatus.NEEDS_REVIEW: 1,
            EligibilityStatus.NOT_ELIGIBLE: 2,
        }

        filtered = scored_candidates
        if not include_not_eligible:
            filtered = [c for c in scored_candidates if c.eligibility.status != EligibilityStatus.NOT_ELIGIBLE]

        # Sort key: (priority ASC, final_score DESC, semantic_score DESC, scheme_id ASC)
        return sorted(
            filtered,
            key=lambda c: (
                status_priority.get(c.eligibility.status, 3),
                -c.final_score,
                -c.semantic_score,
                c.scheme_id,
            ),
        )
