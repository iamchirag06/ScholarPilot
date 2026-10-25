"""Unit tests for the deterministic eligibility engine."""

import pytest
from src.scholarpilot_ai.engine.eligibility import (
    DeterministicEligibilityEngine,
    EligibilityStatus,
    RuleStatus,
)


@pytest.fixture
def base_scheme():
    return {
        "id": "scheme-test-01",
        "title": "Test Technical Merit Scholarship",
        "provider": "Ministry of Education",
        "scope": "STATE",
        "eligible_states": ["BR", "BIHAR"],
        "education_levels": ["UG"],
        "courses": ["BTECH"],
        "category_rules": ["SC", "ST"],
        "income_limit_inr": 250000,
        "minimum_marks_percent": 60.0,
        "award_amount_inr": 25000,
        "deadline": "2026-12-31",
        "required_documents": ["income_cert", "marksheet"],
        "verification_status": "VERIFIED",
        "unknown_fields": [],
    }


@pytest.fixture
def base_profile():
    return {
        "id": "prof-test-01",
        "state": "BR",
        "education_level": "UG",
        "course": "BTECH",
        "category": "SC",
        "annual_family_income_inr": 180000,
        "marks_percent": 75.0,
        "disability": False,
        "gender": "MALE",
        "consent_to_process_profile": True,
    }


def test_income_boundary_conditions(base_scheme, base_profile):
    """Test income below ceiling (PASS), exactly at ceiling (PASS), and above ceiling (FAIL)."""
    # 1. Below ceiling
    base_profile["annual_family_income_inr"] = 249999
    res = DeterministicEligibilityEngine.evaluate(base_scheme, base_profile)
    assert res.status == EligibilityStatus.ELIGIBLE

    # 2. Exactly at ceiling
    base_profile["annual_family_income_inr"] = 250000
    res = DeterministicEligibilityEngine.evaluate(base_scheme, base_profile)
    assert res.status == EligibilityStatus.ELIGIBLE

    # 3. Above ceiling
    base_profile["annual_family_income_inr"] = 250001
    res = DeterministicEligibilityEngine.evaluate(base_scheme, base_profile)
    assert res.status == EligibilityStatus.NOT_ELIGIBLE
    income_rule = next(r for r in res.rule_evaluations if r.rule_name == "annual_family_income")
    assert income_rule.status == RuleStatus.FAIL


def test_missing_student_fields_yield_unknown_and_needs_review(base_scheme, base_profile):
    """Missing required facts must never be interpreted as PASS; they must yield UNKNOWN and NEEDS_REVIEW."""
    # Missing income
    base_profile["annual_family_income_inr"] = None
    res = DeterministicEligibilityEngine.evaluate(base_scheme, base_profile)
    assert res.status == EligibilityStatus.NEEDS_REVIEW
    assert "annual_family_income_inr" in res.missing_student_fields

    # Missing marks
    base_profile["marks_percent"] = None
    res = DeterministicEligibilityEngine.evaluate(base_scheme, base_profile)
    assert res.status == EligibilityStatus.NEEDS_REVIEW
    assert "marks_percent" in res.missing_student_fields

    # Missing state
    base_profile["state"] = None
    res = DeterministicEligibilityEngine.evaluate(base_scheme, base_profile)
    assert res.status == EligibilityStatus.NEEDS_REVIEW
    assert "state" in res.missing_student_fields

    # Missing course
    base_profile["course"] = None
    res = DeterministicEligibilityEngine.evaluate(base_scheme, base_profile)
    assert res.status == EligibilityStatus.NEEDS_REVIEW
    assert "course" in res.missing_student_fields

    # Missing category
    base_profile["category"] = None
    res = DeterministicEligibilityEngine.evaluate(base_scheme, base_profile)
    assert res.status == EligibilityStatus.NEEDS_REVIEW
    assert "category" in res.missing_student_fields


def test_mandatory_state_and_category_mismatches(base_scheme, base_profile):
    """Mandatory mismatches must fail immediately."""
    # State mismatch
    base_profile["state"] = "HR"  # Scheme is for BR
    res = DeterministicEligibilityEngine.evaluate(base_scheme, base_profile)
    assert res.status == EligibilityStatus.NOT_ELIGIBLE
    state_rule = next(r for r in res.rule_evaluations if r.rule_name == "state_domicile")
    assert state_rule.status == RuleStatus.FAIL

    # Category mismatch
    base_profile["state"] = "BR"
    base_profile["category"] = "GEN"  # Scheme is for SC/ST
    res = DeterministicEligibilityEngine.evaluate(base_scheme, base_profile)
    assert res.status == EligibilityStatus.NOT_ELIGIBLE
    cat_rule = next(r for r in res.rule_evaluations if r.rule_name == "category")
    assert cat_rule.status == RuleStatus.FAIL


def test_central_scope_applies_pan_india(base_scheme, base_profile):
    """Schemes with CENTRAL scope must PASS state evaluation regardless of student state."""
    base_scheme["scope"] = "CENTRAL"
    base_scheme["eligible_states"] = []
    base_profile["state"] = "KA"  # Karnataka
    res = DeterministicEligibilityEngine.evaluate(base_scheme, base_profile)
    state_rule = next(r for r in res.rule_evaluations if r.rule_name == "state_domicile")
    assert state_rule.status == RuleStatus.PASS


def test_unverified_scheme_status_forces_needs_review(base_scheme, base_profile):
    """Stale or unverified schemes (verification_status=NEEDS_REVIEW) must flag as NEEDS_REVIEW."""
    base_scheme["verification_status"] = "NEEDS_REVIEW"
    base_scheme["unknown_fields"] = ["guidelines_link", "quota_details"]
    res = DeterministicEligibilityEngine.evaluate(base_scheme, base_profile)
    assert res.status == EligibilityStatus.NEEDS_REVIEW
    assert len(res.unverified_scheme_fields) > 0


def test_scheme_with_no_criteria_restrictions_passes(base_profile):
    """Schemes without specific category or course restrictions should pass without inventing barriers."""
    open_scheme = {
        "id": "scheme-open-01",
        "title": "Open Innovation Award",
        "provider": "Tech Foundation",
        "scope": "CENTRAL",
        "eligible_states": [],
        "education_levels": [],
        "courses": [],
        "category_rules": [],
        "income_limit_inr": None,
        "minimum_marks_percent": None,
        "verification_status": "VERIFIED",
    }
    res = DeterministicEligibilityEngine.evaluate(open_scheme, base_profile)
    assert res.status == EligibilityStatus.ELIGIBLE
