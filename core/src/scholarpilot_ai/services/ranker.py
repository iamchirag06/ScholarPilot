"""Deterministic scholarship ranking engine for candidates surviving Java hard-rule eligibility matching."""

import math
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ScoreExplanation(BaseModel):
    award_amount_score: float
    eligibility_score: float
    formula: str = "rank_score = (award_amount_score * 0.5) + (eligibility_score * 0.5)"
    summary: str


class RankedCandidate(BaseModel):
    id: Optional[str] = None
    scheme_name: str
    provider: Optional[str] = None
    award_amount: Optional[float] = None
    deadline: Optional[str] = None
    apply_link: Optional[str] = None
    raw_eligibility_text: Optional[str] = None
    llm_summary: Optional[str] = None
    required_documents: List[str] = Field(default_factory=list)
    confidence_score: Optional[float] = None
    eligibility_score: Optional[float] = None
    rank: int
    rank_score: float
    score_explanation: ScoreExplanation
    disclaimer: str = (
        "High ranking does not guarantee scholarship approval. "
        "Ranking score reflects relative financial and eligibility fit among hard-rule survivors."
    )
    extra_fields: Dict[str, Any] = Field(default_factory=dict)


class CandidateRanker:
    """Computes transparent, deterministic ranking scores for scholarship candidates."""

    BENCHMARK_MAX_AWARD = 200000.0  # ₹2,00,000 benchmark for 1.0 award score
    BASELINE_AWARD_SCORE = 0.20     # Baseline for non-monetary, tuition waiver, or missing award

    @classmethod
    def calculate_award_amount_score(cls, award_amount: Optional[float]) -> float:
        """Calculate log-normalized award score in 0.0 - 1.0 range."""
        if award_amount is None:
            return cls.BASELINE_AWARD_SCORE

        try:
            val = float(award_amount)
        except (ValueError, TypeError):
            return cls.BASELINE_AWARD_SCORE

        if val <= 0:
            return 0.0

        # Log10 normalization: log10(val + 1) / log10(200000)
        score = math.log10(val + 1.0) / math.log10(cls.BENCHMARK_MAX_AWARD)
        return round(max(0.0, min(1.0, score)), 4)

    @classmethod
    def calculate_eligibility_score(
        cls,
        explicit_score: Optional[float],
        required_documents: Optional[List[str]],
        deadline: Optional[str],
        confidence_score: Optional[float],
    ) -> float:
        """Determine normalized eligibility score (0.0 - 1.0) from explicit input or structured signals."""
        # Case 1: Explicit eligibility score provided by caller (e.g. Java backend)
        if explicit_score is not None:
            try:
                score = float(explicit_score)
                # Normalize if passed as percentage (e.g. 85.0 instead of 0.85)
                if score > 1.0:
                    score = score / 100.0
                return round(max(0.0, min(1.0, score)), 4)
            except (ValueError, TypeError):
                pass

        # Case 2: Derive eligibility score from structured candidate metadata
        # All incoming candidates already survived Java's hard-rule eligibility engine
        derived = 0.50  # Base survivor score

        # Document completeness bonus
        if required_documents and len(required_documents) > 0:
            derived += 0.20

        # Deadline viability assessment
        if deadline:
            try:
                # Attempt to parse ISO date YYYY-MM-DD
                d_str = str(deadline)[:10]
                dl_date = datetime.strptime(d_str, "%Y-%m-%d").date()
                today = date.today()
                days_left = (dl_date - today).days

                if days_left < 0:
                    # Expired scholarship
                    derived = 0.10
                elif days_left <= 14:
                    derived += 0.15  # Urgent priority window
                else:
                    derived += 0.10  # Open window
            except Exception:
                derived += 0.05  # Formatted string present but non-standard date
        else:
            derived += 0.05  # Rolling/unspecified deadline

        # Confidence score weighting if provided
        if confidence_score is not None:
            try:
                conf = float(confidence_score)
                conf = max(0.0, min(1.0, conf))
                # Scale derived score by confidence (0.50 weight for base, 0.50 weight for conf)
                derived = derived * (0.5 + 0.5 * conf)
            except (ValueError, TypeError):
                pass

        return round(max(0.0, min(1.0, derived)), 4)

    @classmethod
    def score_and_rank(cls, candidates: List[Dict[str, Any]]) -> List[RankedCandidate]:
        """Score each candidate using approved formula and sort deterministically in descending order."""
        if not candidates:
            return []

        scored_items: List[Dict[str, Any]] = []

        for c in candidates:
            # Map canonical and alias names
            c_id = c.get("id") or c.get("scheme_id")
            scheme_name = c.get("scheme_name") or c.get("title") or "Unnamed Scholarship Scheme"
            provider = c.get("provider") or c.get("authority")
            award_amount = c.get("award_amount") if c.get("award_amount") is not None else c.get("award_amount_inr")
            deadline = c.get("deadline")
            apply_link = c.get("apply_link") or c.get("official_url")
            raw_text = c.get("raw_eligibility_text")
            llm_summary = c.get("llm_summary") or c.get("summary")
            docs = c.get("required_documents") or []
            if not isinstance(docs, list):
                docs = [str(docs)]

            conf_score = c.get("confidence_score")
            elig_score_in = c.get("eligibility_score")

            # 1. Calculate component scores (0.0 - 1.0)
            award_score = cls.calculate_award_amount_score(award_amount)
            elig_score = cls.calculate_eligibility_score(
                explicit_score=elig_score_in,
                required_documents=docs,
                deadline=deadline,
                confidence_score=conf_score,
            )

            # 2. Approved formula: score = (award_amount_score * 0.5) + (eligibility_score * 0.5)
            rank_score = round((award_score * 0.5) + (elig_score * 0.5), 4)

            # Award description for explanation
            if award_amount and float(award_amount) > 0:
                award_desc = f"₹{float(award_amount):,.0f} (award score: {award_score:.4f})"
            elif award_amount == 0:
                award_desc = f"₹0 or non-monetary (award score: {award_score:.4f})"
            else:
                award_desc = f"unspecified/tuition grant (baseline score: {award_score:.4f})"

            explanation_text = (
                f"Award benefit: {award_desc}; "
                f"Eligibility fit: {elig_score:.4f}; "
                f"Combined rank_score: {rank_score:.4f}."
            )

            explanation = ScoreExplanation(
                award_amount_score=award_score,
                eligibility_score=elig_score,
                formula="rank_score = (award_amount_score * 0.5) + (eligibility_score * 0.5)",
                summary=explanation_text,
            )

            # Extra metadata preservation
            known_keys = {
                "id", "scheme_id", "scheme_name", "title", "provider", "authority",
                "award_amount", "award_amount_inr", "deadline", "apply_link",
                "official_url", "raw_eligibility_text", "llm_summary", "summary",
                "required_documents", "confidence_score", "eligibility_score",
            }
            extras = {k: v for k, v in c.items() if k not in known_keys}

            scored_items.append({
                "id": str(c_id) if c_id is not None else None,
                "scheme_name": str(scheme_name),
                "provider": str(provider) if provider is not None else None,
                "award_amount": float(award_amount) if award_amount is not None else None,
                "deadline": str(deadline) if deadline is not None else None,
                "apply_link": str(apply_link) if apply_link is not None else None,
                "raw_eligibility_text": str(raw_text) if raw_text is not None else None,
                "llm_summary": str(llm_summary) if llm_summary is not None else None,
                "required_documents": docs,
                "confidence_score": float(conf_score) if conf_score is not None else None,
                "eligibility_score": elig_score,
                "rank_score": rank_score,
                "award_score": award_score,
                "score_explanation": explanation,
                "extra_fields": extras,
            })

        # Deterministic sorting:
        # 1. rank_score DESC
        # 2. award_amount DESC (treat None as -1.0)
        # 3. confidence_score DESC (treat None as -1.0)
        # 4. id ASC (string tie-breaker)
        def sort_key(item: Dict[str, Any]):
            r_score = item["rank_score"]
            awd = item["award_amount"] if item["award_amount"] is not None else -1.0
            conf = item["confidence_score"] if item["confidence_score"] is not None else -1.0
            item_id = item["id"] or ""
            return (-r_score, -awd, -conf, item_id)

        scored_items.sort(key=sort_key)

        # Assign 1-indexed ranks
        ranked_candidates: List[RankedCandidate] = []
        for idx, item in enumerate(scored_items, start=1):
            ranked_candidates.append(
                RankedCandidate(
                    id=item["id"],
                    scheme_name=item["scheme_name"],
                    provider=item["provider"],
                    award_amount=item["award_amount"],
                    deadline=item["deadline"],
                    apply_link=item["apply_link"],
                    raw_eligibility_text=item["raw_eligibility_text"],
                    llm_summary=item["llm_summary"],
                    required_documents=item["required_documents"],
                    confidence_score=item["confidence_score"],
                    eligibility_score=item["eligibility_score"],
                    rank=idx,
                    rank_score=item["rank_score"],
                    score_explanation=item["score_explanation"],
                    extra_fields=item["extra_fields"],
                )
            )

        return ranked_candidates
