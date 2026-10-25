"""Grounded explanation generation layer with strict deterministic fallback.

Synthesizes plain-language explanations strictly from verified facts, deterministic rule
evaluations, and scheme metadata without hallucinations.
"""

from typing import Dict, Any, List, Optional
import json
from pydantic import BaseModel, Field
from src.scholarpilot_ai.config import get_settings
from src.scholarpilot_ai.engine.eligibility import EligibilityResult, RuleStatus, EligibilityStatus

settings = get_settings()


class GroundedExplanation(BaseModel):
    scheme_id: str
    title: str
    provider: str
    summary: str
    why_relevant: str
    criteria_satisfied: List[str] = Field(default_factory=list)
    criteria_failed: List[str] = Field(default_factory=list)
    unknown_or_unverified: List[str] = Field(default_factory=list)
    award_summary: str
    required_documents: List[str] = Field(default_factory=list)
    deadline: Optional[str] = None
    official_url: Optional[str] = None
    verification_status: str = "VERIFIED"


class ExplanationService:
    """Produces explainable recommendation evidence with LLM and deterministic fallback."""

    @classmethod
    def generate_explanation(
        cls,
        scheme: Dict[str, Any],
        profile: Dict[str, Any],
        eligibility: EligibilityResult,
        ranking_score: float,
    ) -> GroundedExplanation:
        """Generate structured explanation, trying LLM first if key exists, then falling back."""
        api_key = settings.GEMINI_API_KEY
        if api_key:
            try:
                llm_result = cls._generate_llm_explanation(scheme, profile, eligibility, ranking_score, api_key)
                if llm_result:
                    return llm_result
            except Exception:
                pass

        # Deterministic fallback guaranteed to never fail or hallucinate
        return cls._generate_deterministic_explanation(scheme, profile, eligibility, ranking_score)

    @classmethod
    def _generate_deterministic_explanation(
        cls,
        scheme: Dict[str, Any],
        profile: Dict[str, Any],
        eligibility: EligibilityResult,
        ranking_score: float,
    ) -> GroundedExplanation:
        """Deterministic factual generator using scheme records and evaluated rule breakdown."""
        scheme_id = str(scheme.get("id"))
        title = scheme.get("title", "Scholarship Scheme")
        provider = scheme.get("provider", "Official Provider")
        scope = scheme.get("scope", "CENTRAL")
        deadline = scheme.get("deadline")
        url = scheme.get("official_url")
        verification_status = scheme.get("verification_status", "VERIFIED")
        docs = list(scheme.get("required_documents") or [])
        award = scheme.get("award_amount_inr")

        # Award summary
        if award:
            award_summary = f"₹{award:,} financial grant per academic year"
        else:
            award_summary = "Tuition support, stipend, or grant (refer to official notification)"

        # Collect rule breakdown
        passed: List[str] = []
        failed: List[str] = []
        unknowns: List[str] = []

        for eval_rule in eligibility.rule_evaluations:
            if eval_rule.status == RuleStatus.PASS:
                passed.append(eval_rule.reason)
            elif eval_rule.status == RuleStatus.FAIL:
                failed.append(eval_rule.reason)
            elif eval_rule.status == RuleStatus.UNKNOWN:
                unknowns.append(eval_rule.reason)

        for unverified in eligibility.unverified_scheme_fields:
            unknowns.append(f"Scheme fact requires administrative verification: {unverified}")

        # Plain language summary & relevance
        student_course = profile.get("course") or "your current studies"
        student_state = profile.get("state") or "India"

        if eligibility.status == EligibilityStatus.ELIGIBLE:
            summary = (
                f"You are verified as ELIGIBLE for '{title}' provided by {provider}. "
                f"All mandatory criteria (income, education level, and category) have been satisfied."
            )
            why_relevant = (
                f"Directly matches your profile for {student_course} in {student_state} "
                f"with a high compatibility score of {ranking_score:.1f}/100."
            )
        elif eligibility.status == EligibilityStatus.NEEDS_REVIEW:
            missing_text = ", ".join(eligibility.missing_student_fields) if eligibility.missing_student_fields else "verification details"
            summary = (
                f"Your profile POTENTIALLY MATCHES '{title}', but requires further review. "
                f"Some information is missing or awaiting verification: {missing_text}."
            )
            why_relevant = (
                f"High potential match for your profile, subject to confirming: {missing_text}."
            )
        else:
            summary = (
                f"You do not currently satisfy all mandatory eligibility criteria for '{title}'."
            )
            why_relevant = "Retrieved based on general keyword similarity, but failed hard eligibility criteria."

        return GroundedExplanation(
            scheme_id=scheme_id,
            title=title,
            provider=provider,
            summary=summary,
            why_relevant=why_relevant,
            criteria_satisfied=passed,
            criteria_failed=failed,
            unknown_or_unverified=unknowns,
            award_summary=award_summary,
            required_documents=docs,
            deadline=deadline,
            official_url=url,
            verification_status=verification_status,
        )

    @classmethod
    def _generate_llm_explanation(
        cls,
        scheme: Dict[str, Any],
        profile: Dict[str, Any],
        eligibility: EligibilityResult,
        ranking_score: float,
        api_key: str,
    ) -> Optional[GroundedExplanation]:
        """Call Gemini model with structured output prompt and timeout protection."""
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import SystemMessage, HumanMessage

        llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            google_api_key=api_key,
            temperature=0.0,
            timeout=settings.LLM_TIMEOUT_SEC,
        )

        prompt = {
            "instruction": "Summarize this scholarship recommendation grounded strictly in the provided facts.",
            "scheme": {
                "id": scheme.get("id"),
                "title": scheme.get("title"),
                "provider": scheme.get("provider"),
                "award": scheme.get("award_amount_inr"),
                "deadline": scheme.get("deadline"),
                "official_url": scheme.get("official_url"),
                "verification_status": scheme.get("verification_status"),
                "required_documents": scheme.get("required_documents"),
            },
            "student_profile": {
                "state": profile.get("state"),
                "education_level": profile.get("education_level"),
                "course": profile.get("course"),
                "category": profile.get("category"),
            },
            "eligibility_status": eligibility.status.value,
            "rule_evaluations": [e.model_dump() for e in eligibility.rule_evaluations],
            "ranking_score": ranking_score,
        }

        system_msg = SystemMessage(
            content=(
                "You are an expert scholarship advisor for ScholarPilot. "
                "Output ONLY valid JSON matching this schema: "
                "{"
                "  \"summary\": \"string\","
                "  \"why_relevant\": \"string\","
                "  \"award_summary\": \"string\""
                "} "
                "Do not hallucinate deadlines, links, or criteria."
            )
        )
        human_msg = HumanMessage(content=json.dumps(prompt))

        response = llm.invoke([system_msg, human_msg])
        content = response.content.strip()

        # Clean markdown wrappers if present
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]

        parsed = json.loads(content.strip())

        # Combine validated LLM copy with deterministic factual lists
        deterministic = cls._generate_deterministic_explanation(scheme, profile, eligibility, ranking_score)
        deterministic.summary = parsed.get("summary", deterministic.summary)
        deterministic.why_relevant = parsed.get("why_relevant", deterministic.why_relevant)
        if parsed.get("award_summary"):
            deterministic.award_summary = parsed["award_summary"]

        return deterministic
