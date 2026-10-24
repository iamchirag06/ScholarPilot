"""Eligibility and recommendation engine package."""
from src.scholarpilot_ai.engine.eligibility import (
    DeterministicEligibilityEngine,
    EligibilityResult,
    EligibilityStatus,
    RuleStatus,
    RuleEvaluation,
)
from src.scholarpilot_ai.engine.ranker import (
    RecommendationRanker,
    ScoredRecommendation,
)
from src.scholarpilot_ai.engine.explanation import (
    ExplanationService,
    GroundedExplanation,
)

__all__ = [
    "DeterministicEligibilityEngine",
    "EligibilityResult",
    "EligibilityStatus",
    "RuleStatus",
    "RuleEvaluation",
    "RecommendationRanker",
    "ScoredRecommendation",
    "ExplanationService",
    "GroundedExplanation",
]
