"""Deterministic eligibility engine evaluating candidate scholarships against student profiles.

Implements strict tri-state logic (PASS, FAIL, UNKNOWN) independently of any LLM.
"""

from enum import Enum
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class RuleStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    UNKNOWN = "UNKNOWN"


class EligibilityStatus(str, Enum):
    ELIGIBLE = "ELIGIBLE"
    NOT_ELIGIBLE = "NOT_ELIGIBLE"
    NEEDS_REVIEW = "NEEDS_REVIEW"


class RuleEvaluation(BaseModel):
    rule_name: str
    status: RuleStatus
    reason: str
    student_value: Any = None
    required_value: Any = None


class EligibilityResult(BaseModel):
    scheme_id: str
    status: EligibilityStatus
    rule_evaluations: List[RuleEvaluation] = Field(default_factory=list)
    passed_rules_count: int = 0
    total_applicable_rules_count: int = 0
    missing_student_fields: List[str] = Field(default_factory=list)
    unverified_scheme_fields: List[str] = Field(default_factory=list)

    @property
    def coverage_percent(self) -> float:
        """Percentage of applicable rules satisfied by verified student facts."""
        if self.total_applicable_rules_count == 0:
            return 100.0
        return round((self.passed_rules_count / self.total_applicable_rules_count) * 100.0, 2)


class DeterministicEligibilityEngine:
    """Evaluates candidate scholarship eligibility deterministically."""

    @classmethod
    def evaluate(cls, scheme: Dict[str, Any], profile: Dict[str, Any]) -> EligibilityResult:
        scheme_id = str(scheme.get("id", ""))
        evaluations: List[RuleEvaluation] = []
        missing_fields: List[str] = []
        unverified_fields: List[str] = list(scheme.get("unknown_fields") or [])

        if scheme.get("verification_status") == "NEEDS_REVIEW":
            unverified_fields.append("verification_status:NEEDS_REVIEW")

        # 1. Annual Family Income Limit
        cls._evaluate_income(scheme, profile, evaluations, missing_fields)

        # 2. Education Level
        cls._evaluate_education_level(scheme, profile, evaluations, missing_fields)

        # 3. Course Eligibility
        cls._evaluate_courses(scheme, profile, evaluations, missing_fields)

        # 4. Social Category / Caste Rules
        cls._evaluate_category(scheme, profile, evaluations, missing_fields)

        # 5. Domicile State / Scope
        cls._evaluate_state(scheme, profile, evaluations, missing_fields)

        # 6. Minimum Academic Marks Percentage
        cls._evaluate_marks(scheme, profile, evaluations, missing_fields)

        # 7. Disability Status
        cls._evaluate_disability(scheme, profile, evaluations, missing_fields)

        # 8. Gender Specificity
        cls._evaluate_gender(scheme, profile, evaluations, missing_fields)

        # Synthesize Overall Status
        has_fail = any(e.status == RuleStatus.FAIL for e in evaluations)
        has_unknown = any(e.status == RuleStatus.UNKNOWN for e in evaluations)
        is_scheme_unverified = scheme.get("verification_status") == "NEEDS_REVIEW"

        if has_fail:
            overall_status = EligibilityStatus.NOT_ELIGIBLE
        elif has_unknown or is_scheme_unverified:
            overall_status = EligibilityStatus.NEEDS_REVIEW
        else:
            overall_status = EligibilityStatus.ELIGIBLE

        passed_count = sum(1 for e in evaluations if e.status == RuleStatus.PASS)
        total_count = len(evaluations)

        return EligibilityResult(
            scheme_id=scheme_id,
            status=overall_status,
            rule_evaluations=evaluations,
            passed_rules_count=passed_count,
            total_applicable_rules_count=total_count,
            missing_student_fields=sorted(list(set(missing_fields))),
            unverified_scheme_fields=sorted(list(set(unverified_fields))),
        )

    @staticmethod
    def _evaluate_income(
        scheme: Dict[str, Any],
        profile: Dict[str, Any],
        evaluations: List[RuleEvaluation],
        missing: List[str],
    ) -> None:
        limit = scheme.get("income_limit_inr")
        if limit is None:
            return  # No income ceiling restriction

        income = profile.get("annual_family_income_inr")
        if income is None:
            evaluations.append(
                RuleEvaluation(
                    rule_name="annual_family_income",
                    status=RuleStatus.UNKNOWN,
                    reason=f"Scheme has an income ceiling of ₹{limit:,}, but student income is not provided.",
                    student_value=None,
                    required_value=f"<= {limit}",
                )
            )
            missing.append("annual_family_income_inr")
        elif income <= limit:
            evaluations.append(
                RuleEvaluation(
                    rule_name="annual_family_income",
                    status=RuleStatus.PASS,
                    reason=f"Family income of ₹{income:,} is within the required ceiling of ₹{limit:,}.",
                    student_value=income,
                    required_value=f"<= {limit}",
                )
            )
        else:
            evaluations.append(
                RuleEvaluation(
                    rule_name="annual_family_income",
                    status=RuleStatus.FAIL,
                    reason=f"Family income of ₹{income:,} exceeds the maximum limit of ₹{limit:,}.",
                    student_value=income,
                    required_value=f"<= {limit}",
                )
            )

    @staticmethod
    def _evaluate_education_level(
        scheme: Dict[str, Any],
        profile: Dict[str, Any],
        evaluations: List[RuleEvaluation],
        missing: List[str],
    ) -> None:
        levels = scheme.get("education_levels") or []
        if not levels:
            return

        student_level = profile.get("education_level")
        if not student_level:
            evaluations.append(
                RuleEvaluation(
                    rule_name="education_level",
                    status=RuleStatus.UNKNOWN,
                    reason=f"Scheme requires education level ({', '.join(levels)}), but student level is not provided.",
                    student_value=None,
                    required_value=levels,
                )
            )
            missing.append("education_level")
        elif student_level.upper() in [lvl.upper() for lvl in levels]:
            evaluations.append(
                RuleEvaluation(
                    rule_name="education_level",
                    status=RuleStatus.PASS,
                    reason=f"Education level '{student_level}' matches scheme requirements ({', '.join(levels)}).",
                    student_value=student_level,
                    required_value=levels,
                )
            )
        else:
            evaluations.append(
                RuleEvaluation(
                    rule_name="education_level",
                    status=RuleStatus.FAIL,
                    reason=f"Education level '{student_level}' is not in the eligible levels ({', '.join(levels)}).",
                    student_value=student_level,
                    required_value=levels,
                )
            )

    @staticmethod
    def _evaluate_courses(
        scheme: Dict[str, Any],
        profile: Dict[str, Any],
        evaluations: List[RuleEvaluation],
        missing: List[str],
    ) -> None:
        courses = scheme.get("courses") or []
        if not courses:
            return

        student_course = profile.get("course")
        if not student_course:
            evaluations.append(
                RuleEvaluation(
                    rule_name="course",
                    status=RuleStatus.UNKNOWN,
                    reason=f"Scheme specifies eligible courses ({', '.join(courses)}), but student course is missing.",
                    student_value=None,
                    required_value=courses,
                )
            )
            missing.append("course")
        elif student_course.upper() in [c.upper() for c in courses]:
            evaluations.append(
                RuleEvaluation(
                    rule_name="course",
                    status=RuleStatus.PASS,
                    reason=f"Course '{student_course}' matches eligible courses.",
                    student_value=student_course,
                    required_value=courses,
                )
            )
        else:
            evaluations.append(
                RuleEvaluation(
                    rule_name="course",
                    status=RuleStatus.FAIL,
                    reason=f"Course '{student_course}' is not eligible. Allowed: {', '.join(courses)}.",
                    student_value=student_course,
                    required_value=courses,
                )
            )

    @staticmethod
    def _evaluate_category(
        scheme: Dict[str, Any],
        profile: Dict[str, Any],
        evaluations: List[RuleEvaluation],
        missing: List[str],
    ) -> None:
        cat_rules = scheme.get("category_rules") or []
        if not cat_rules:
            return

        student_category = profile.get("category")
        if not student_category:
            evaluations.append(
                RuleEvaluation(
                    rule_name="category",
                    status=RuleStatus.UNKNOWN,
                    reason=f"Scheme is restricted to categories ({', '.join(cat_rules)}), but student category is not provided.",
                    student_value=None,
                    required_value=cat_rules,
                )
            )
            missing.append("category")
        elif student_category.upper() in [c.upper() for c in cat_rules]:
            evaluations.append(
                RuleEvaluation(
                    rule_name="category",
                    status=RuleStatus.PASS,
                    reason=f"Social category '{student_category}' matches scheme criteria ({', '.join(cat_rules)}).",
                    student_value=student_category,
                    required_value=cat_rules,
                )
            )
        else:
            evaluations.append(
                RuleEvaluation(
                    rule_name="category",
                    status=RuleStatus.FAIL,
                    reason=f"Category '{student_category}' is not eligible for this scheme (Targeted: {', '.join(cat_rules)}).",
                    student_value=student_category,
                    required_value=cat_rules,
                )
            )

    @staticmethod
    def _evaluate_state(
        scheme: Dict[str, Any],
        profile: Dict[str, Any],
        evaluations: List[RuleEvaluation],
        missing: List[str],
    ) -> None:
        scope = (scheme.get("scope") or "CENTRAL").upper()
        if scope == "CENTRAL":
            evaluations.append(
                RuleEvaluation(
                    rule_name="state_domicile",
                    status=RuleStatus.PASS,
                    reason="Scheme is under Central scope and open to all states in India.",
                    student_value=profile.get("state"),
                    required_value="CENTRAL_ALL_STATES",
                )
            )
            return

        states = scheme.get("eligible_states") or []
        if not states:
            return

        student_state = profile.get("state")
        if not student_state:
            evaluations.append(
                RuleEvaluation(
                    rule_name="state_domicile",
                    status=RuleStatus.UNKNOWN,
                    reason=f"Scheme is restricted to states ({', '.join(states)}), but student state is not provided.",
                    student_value=None,
                    required_value=states,
                )
            )
            missing.append("state")
        elif student_state.upper() in [s.upper() for s in states]:
            evaluations.append(
                RuleEvaluation(
                    rule_name="state_domicile",
                    status=RuleStatus.PASS,
                    reason=f"State '{student_state}' is eligible for this scheme.",
                    student_value=student_state,
                    required_value=states,
                )
            )
        else:
            evaluations.append(
                RuleEvaluation(
                    rule_name="state_domicile",
                    status=RuleStatus.FAIL,
                    reason=f"State '{student_state}' is not among the eligible states ({', '.join(states)}).",
                    student_value=student_state,
                    required_value=states,
                )
            )

    @staticmethod
    def _evaluate_marks(
        scheme: Dict[str, Any],
        profile: Dict[str, Any],
        evaluations: List[RuleEvaluation],
        missing: List[str],
    ) -> None:
        min_marks = scheme.get("minimum_marks_percent")
        if min_marks is None:
            return

        student_marks = profile.get("marks_percent")
        if student_marks is None:
            evaluations.append(
                RuleEvaluation(
                    rule_name="minimum_marks",
                    status=RuleStatus.UNKNOWN,
                    reason=f"Scheme requires minimum {min_marks}% marks, but student marks are not provided.",
                    student_value=None,
                    required_value=f">= {min_marks}%",
                )
            )
            missing.append("marks_percent")
        elif student_marks >= min_marks:
            evaluations.append(
                RuleEvaluation(
                    rule_name="minimum_marks",
                    status=RuleStatus.PASS,
                    reason=f"Academic score of {student_marks}% meets the minimum requirement of {min_marks}%.",
                    student_value=student_marks,
                    required_value=f">= {min_marks}%",
                )
            )
        else:
            evaluations.append(
                RuleEvaluation(
                    rule_name="minimum_marks",
                    status=RuleStatus.FAIL,
                    reason=f"Academic score of {student_marks}% is below the required {min_marks}%.",
                    student_value=student_marks,
                    required_value=f">= {min_marks}%",
                )
            )

    @staticmethod
    def _evaluate_disability(
        scheme: Dict[str, Any],
        profile: Dict[str, Any],
        evaluations: List[RuleEvaluation],
        missing: List[str],
    ) -> None:
        # Check if scheme explicitly targets students with disabilities in title/rules
        title = (scheme.get("title") or "").lower()
        if "disabilit" in title or "pwd" in title or "divyang" in title:
            student_disability = profile.get("disability")
            if student_disability is None:
                evaluations.append(
                    RuleEvaluation(
                        rule_name="disability_status",
                        status=RuleStatus.UNKNOWN,
                        reason="Scheme targets persons with disabilities; student disability status is unprovided.",
                        student_value=None,
                        required_value=True,
                    )
                )
                missing.append("disability")
            elif student_disability is True:
                evaluations.append(
                    RuleEvaluation(
                        rule_name="disability_status",
                        status=RuleStatus.PASS,
                        reason="Student meets the disability criteria for this scheme.",
                        student_value=True,
                        required_value=True,
                    )
                )
            else:
                evaluations.append(
                    RuleEvaluation(
                        rule_name="disability_status",
                        status=RuleStatus.FAIL,
                        reason="Scheme is dedicated to persons with disabilities (Divyangjan/PwD).",
                        student_value=False,
                        required_value=True,
                    )
                )

    @staticmethod
    def _evaluate_gender(
        scheme: Dict[str, Any],
        profile: Dict[str, Any],
        evaluations: List[RuleEvaluation],
        missing: List[str],
    ) -> None:
        # Check if scheme explicitly targets female/girl students
        title = (scheme.get("title") or "").lower()
        is_female_specific = any(k in title for k in ["girl", "female", "pragati", "hazrat mahal", "women"])

        if is_female_specific:
            student_gender = (profile.get("gender") or "NOT_PROVIDED").upper()
            if student_gender in ["NOT_PROVIDED", "UNKNOWN", ""]:
                evaluations.append(
                    RuleEvaluation(
                        rule_name="gender_restriction",
                        status=RuleStatus.UNKNOWN,
                        reason="Scheme is designated for girl/female students; student gender was not provided.",
                        student_value=student_gender,
                        required_value="FEMALE",
                    )
                )
                missing.append("gender")
            elif student_gender in ["FEMALE", "GIRL", "WOMAN"]:
                evaluations.append(
                    RuleEvaluation(
                        rule_name="gender_restriction",
                        status=RuleStatus.PASS,
                        reason="Gender criteria satisfied (scheme is for female students).",
                        student_value=student_gender,
                        required_value="FEMALE",
                    )
                )
            else:
                evaluations.append(
                    RuleEvaluation(
                        rule_name="gender_restriction",
                        status=RuleStatus.FAIL,
                        reason="Scheme is designated exclusively for female students.",
                        student_value=student_gender,
                        required_value="FEMALE",
                    )
                )
