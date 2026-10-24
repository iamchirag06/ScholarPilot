"""Unit tests for grounded explanation layer and deterministic fallback."""

from src.scholarpilot_ai.engine.eligibility import (
    DeterministicEligibilityEngine,
    EligibilityStatus,
)
from src.scholarpilot_ai.engine.explanation import (
    ExplanationService,
    GroundedExplanation,
)


def test_deterministic_explanation_fidelity():
    """Deterministic explanation strictly includes factual scheme attributes and evaluated rule evidence."""
    scheme = {
        "id": "scheme-demo-01",
        "title": "National Technical Award",
        "provider": "Ministry of Education",
        "scope": "CENTRAL",
        "eligible_states": [],
        "education_levels": ["UG"],
        "courses": ["BTECH"],
        "category_rules": ["SC"],
        "income_limit_inr": 250000,
        "minimum_marks_percent": 60.0,
        "award_amount_inr": 50000,
        "deadline": "2026-12-31",
        "official_url": "https://official.example/scheme",
        "required_documents": ["income_certificate", "marksheet"],
        "verification_status": "VERIFIED",
    }
    profile = {
        "id": "prof-01",
        "state": "BR",
        "education_level": "UG",
        "course": "BTECH",
        "category": "SC",
        "annual_family_income_inr": 180000,
        "marks_percent": 75.0,
    }

    eligibility = DeterministicEligibilityEngine.evaluate(scheme, profile)
    explanation = ExplanationService.generate_explanation(
        scheme=scheme,
        profile=profile,
        eligibility=eligibility,
        ranking_score=88.5,
    )

    assert isinstance(explanation, GroundedExplanation)
    assert explanation.scheme_id == "scheme-demo-01"
    assert explanation.official_url == "https://official.example/scheme"
    assert "₹50,000" in explanation.award_summary
    assert "income_certificate" in explanation.required_documents
    assert len(explanation.criteria_satisfied) > 0
    assert len(explanation.criteria_failed) == 0


def test_explanation_fallback_when_llm_is_unconfigured(monkeypatch):
    """When GEMINI_API_KEY is not configured, explanation generation still succeeds with deterministic fallback."""
    from src.scholarpilot_ai.engine import explanation as exp_module
    monkeypatch.setattr(exp_module.settings, "GEMINI_API_KEY", None)

    scheme = {
        "id": "scheme-demo-02",
        "title": "State Merit Grant",
        "provider": "State Department",
        "scope": "STATE",
        "eligible_states": ["BR"],
        "education_levels": ["UG"],
        "courses": ["BTECH"],
        "category_rules": ["SC"],
        "income_limit_inr": 200000,
        "minimum_marks_percent": 60.0,
        "verification_status": "VERIFIED",
    }
    profile = {
        "state": "BR",
        "education_level": "UG",
        "course": "BTECH",
        "category": "SC",
        "annual_family_income_inr": 150000,
        "marks_percent": 70.0,
    }

    eligibility = DeterministicEligibilityEngine.evaluate(scheme, profile)
    explanation = ExplanationService.generate_explanation(scheme, profile, eligibility, 80.0)

    assert explanation is not None
    assert "State Merit Grant" in explanation.summary
