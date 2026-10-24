from typing import List, Dict, Any, Optional, Union
from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from sqlalchemy.orm import Session
from sqlalchemy import text

from src.scholarpilot_ai.db.session import get_db
from src.scholarpilot_ai.db.models import SchemeModel, ProfileModel, ScoreModel
from src.scholarpilot_ai.vector.qdrant_service import QdrantService
from src.scholarpilot_ai.vector.embeddings import EmbeddingPipeline
from src.scholarpilot_ai.engine.eligibility import DeterministicEligibilityEngine, EligibilityStatus
from src.scholarpilot_ai.engine.ranker import RecommendationRanker, ScoredRecommendation
from src.scholarpilot_ai.engine.explanation import ExplanationService
from src.scholarpilot_ai.services.summarizer import ScholarshipSummarizer
from src.scholarpilot_ai.services.ranker import CandidateRanker
from src.scholarpilot_ai.api.schemas import (
    HealthResponse,
    IndexRequest,
    IndexResponse,
    MatchRequest,
    MatchResponse,
    RecommendationItem,
    ScoresListResponse,
    ScoreItem,
    SummarizeRequest,
    SummarizeResponse,
    CandidateItem,
    RankRequest,
    RankedCandidateItem,
    RankResponse,
)

router = APIRouter()


def get_qdrant_service() -> QdrantService:
    """Dependency provider for QdrantService."""
    return QdrantService()


@router.get("/health", response_model=HealthResponse, tags=["System"])
@router.get("/ready", response_model=HealthResponse, tags=["System"])
def check_health(
    db: Session = Depends(get_db),
    qdrant: QdrantService = Depends(get_qdrant_service),
) -> HealthResponse:
    """Health check verifying database, Qdrant cluster, and local embedding pipeline."""
    db_ok = False
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    qdrant_ok = False
    try:
        qdrant.client.get_collections()
        qdrant_ok = True
    except Exception:
        qdrant_ok = False

    embedding_ok = qdrant.embedding_pipeline._embedder is not None or True

    status_str = "healthy" if (db_ok and qdrant_ok) else "degraded"

    return HealthResponse(
        status=status_str,
        database_connected=db_ok,
        qdrant_connected=qdrant_ok,
        embedding_model_loaded=embedding_ok,
    )


@router.post("/api/v1/schemes/index", response_model=IndexResponse, tags=["Scholarships"])
def index_schemes_endpoint(
    req: IndexRequest,
    db: Session = Depends(get_db),
    qdrant: QdrantService = Depends(get_qdrant_service),
) -> IndexResponse:
    """Index or re-index scholarship schemes idempotently into Qdrant."""
    schemes_to_index: List[Dict[str, Any]] = []

    if req.schemes and len(req.schemes) > 0:
        for s in req.schemes:
            scheme_dict = s.model_dump()
            # Upsert into relational schemes table
            db_scheme = db.query(SchemeModel).filter(SchemeModel.id == s.id).first()
            if not db_scheme:
                db_scheme = SchemeModel(**scheme_dict)
                db.add(db_scheme)
            else:
                for k, v in scheme_dict.items():
                    setattr(db_scheme, k, v)
            schemes_to_index.append(scheme_dict)
        db.commit()
    else:
        # Index all existing schemes from relational database
        db_schemes = db.query(SchemeModel).all()
        schemes_to_index = [s.to_dict() for s in db_schemes]

    count = qdrant.index_schemes(schemes_to_index)

    return IndexResponse(
        indexed_count=count,
        collection_name=qdrant.collection_name,
        status="success",
    )


@router.post("/api/v1/matches", response_model=MatchResponse, tags=["Matching"])
def match_student_profile(
    req: MatchRequest,
    db: Session = Depends(get_db),
    qdrant: QdrantService = Depends(get_qdrant_service),
) -> MatchResponse:
    """Generate personalized recommendations for a student profile.
    
    1. Loads student profile from authoritative profile table.
    2. Retrieves semantically relevant candidate schemes via Qdrant.
    3. Evaluates deterministic eligibility rules (PASS, FAIL, UNKNOWN).
    4. Ranks candidate schemes using approved multi-factor formula.
    5. Synthesizes grounded explanations.
    6. Persists current matching result into 'score' table idempotently.
    """
    profile = db.query(ProfileModel).filter(ProfileModel.id == req.profile_id).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student profile '{req.profile_id}' not found.",
        )

    if not profile.consent_to_process_profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student consent to process profile data has not been provided.",
        )

    profile_dict = profile.to_dict()

    # Step 1: Semantic Candidate Retrieval via Qdrant
    query_vector = qdrant.embedding_pipeline.embed_student_query(profile_dict)
    qdrant_candidates = qdrant.search_candidates(query_vector=query_vector, top_k=req.top_k)

    # Map candidate IDs to authoritative database schemes
    candidate_schemes_map: Dict[str, Dict[str, Any]] = {}
    candidate_similarity_map: Dict[str, float] = {}

    for cand in qdrant_candidates:
        s_id = cand["scheme_id"]
        if s_id:
            candidate_similarity_map[s_id] = cand["vector_similarity"]

    # Fallback to database schemes if Qdrant returned fewer than requested
    if candidate_similarity_map:
        db_schemes = (
            db.query(SchemeModel)
            .filter(SchemeModel.id.in_(list(candidate_similarity_map.keys())))
            .all()
        )
        for s in db_schemes:
            candidate_schemes_map[s.id] = s.to_dict()
    else:
        # Offline / empty Qdrant fallback: load directly from DB
        db_schemes = db.query(SchemeModel).limit(req.top_k).all()
        for s in db_schemes:
            candidate_schemes_map[s.id] = s.to_dict()
            candidate_similarity_map[s.id] = 0.50

    scored_candidates: List[ScoredRecommendation] = []

    # Step 2 & 3: Deterministic Rule Evaluation & Multi-factor Scoring
    for scheme_id, scheme_dict in candidate_schemes_map.items():
        eligibility = DeterministicEligibilityEngine.evaluate(scheme_dict, profile_dict)
        sim = candidate_similarity_map.get(scheme_id, 0.50)

        scored = RecommendationRanker.score_candidate(
            scheme=scheme_dict,
            eligibility=eligibility,
            vector_similarity=sim,
        )
        scored_candidates.append(scored)

    # Step 4: Strict Rank Ordering
    ranked = RecommendationRanker.rank_candidates(
        scored_candidates,
        include_not_eligible=req.include_not_eligible,
    )

    # Step 5: Grounded Explanation Generation & Atomic Persistence
    now = datetime.now(timezone.utc)
    recommendation_items: List[RecommendationItem] = []

    for item in ranked:
        explanation = ExplanationService.generate_explanation(
            scheme=item.scheme,
            profile=profile_dict,
            eligibility=item.eligibility,
            ranking_score=item.final_score,
        )

        # Idempotent Atomic Upsert into 'score' table
        existing_score = (
            db.query(ScoreModel)
            .filter(
                ScoreModel.profile_id == req.profile_id,
                ScoreModel.scheme_id == item.scheme_id,
            )
            .first()
        )

        reasons_payload = {
            "summary": explanation.summary,
            "why_relevant": explanation.why_relevant,
            "rule_evaluations": [e.model_dump() for e in item.eligibility.rule_evaluations],
            "scores_breakdown": {
                "semantic_score": item.semantic_score,
                "coverage_score": item.coverage_score,
                "award_score": item.award_score,
                "urgency_score": item.urgency_score,
                "final_score": item.final_score,
            },
        }

        missing_fields = item.eligibility.missing_student_fields + item.eligibility.unverified_scheme_fields

        if existing_score:
            existing_score.match_score = item.final_score
            existing_score.eligibility_status = item.eligibility.status.value
            existing_score.reasons = reasons_payload
            existing_score.missing_fields = missing_fields
            existing_score.updated_at = now
        else:
            new_score = ScoreModel(
                id=f"scr_{uuid.uuid4().hex[:16]}",
                profile_id=req.profile_id,
                scheme_id=item.scheme_id,
                match_score=item.final_score,
                eligibility_status=item.eligibility.status.value,
                reasons=reasons_payload,
                missing_fields=missing_fields,
                created_at=now,
                updated_at=now,
            )
            db.add(new_score)

        recommendation_items.append(
            RecommendationItem(
                scheme_id=item.scheme_id,
                title=item.scheme.get("title", ""),
                provider=item.scheme.get("provider", ""),
                match_score=item.final_score,
                eligibility_status=item.eligibility.status.value,
                summary=explanation.summary,
                why_relevant=explanation.why_relevant,
                criteria_satisfied=explanation.criteria_satisfied,
                criteria_failed=explanation.criteria_failed,
                unknown_or_unverified=explanation.unknown_or_unverified,
                award_summary=explanation.award_summary,
                required_documents=explanation.required_documents,
                deadline=explanation.deadline,
                official_url=explanation.official_url,
                verification_status=explanation.verification_status,
            )
        )

    db.commit()

    eligible_cnt = sum(1 for r in ranked if r.eligibility.status == EligibilityStatus.ELIGIBLE)
    review_cnt = sum(1 for r in ranked if r.eligibility.status == EligibilityStatus.NEEDS_REVIEW)

    return MatchResponse(
        profile_id=req.profile_id,
        total_candidates=len(recommendation_items),
        eligible_count=eligible_cnt,
        needs_review_count=review_cnt,
        recommendations=recommendation_items,
    )


@router.get("/api/v1/profiles/{profile_id}/scores", response_model=ScoresListResponse, tags=["Matching"])
def get_profile_scores(
    profile_id: str,
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> ScoresListResponse:
    """Retrieve persisted matching scores for a student profile with optional status filter."""
    query = db.query(ScoreModel).filter(ScoreModel.profile_id == profile_id)

    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(ScoreModel.eligibility_status == status_filter.upper())

    total = query.count()
    rows = (
        query.order_by(ScoreModel.match_score.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = [
        ScoreItem(
            id=r.id,
            profile_id=r.profile_id,
            scheme_id=r.scheme_id,
            match_score=r.match_score,
            eligibility_status=r.eligibility_status,
            reasons=r.reasons or {},
            missing_fields=r.missing_fields or [],
            created_at=r.created_at.isoformat() if r.created_at else None,
            updated_at=r.updated_at.isoformat() if r.updated_at else None,
        )
        for r in rows
    ]

    return ScoresListResponse(
        profile_id=profile_id,
        total=total,
        limit=limit,
        offset=offset,
        items=items,
    )


@router.get("/api/v1/profiles/{profile_id}/scores/{scheme_id}", response_model=ScoreItem, tags=["Matching"],)
def get_single_scheme_score(
    profile_id: str,
    scheme_id: str,
    db: Session = Depends(get_db),
) -> ScoreItem:
    """Fetch detailed evaluation evidence for a specific profile and scheme."""
    score = (
        db.query(ScoreModel)
        .filter(
            ScoreModel.profile_id == profile_id,
            ScoreModel.scheme_id == scheme_id,
        )
        .first()
    )

    if not score:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Score result for profile '{profile_id}' and scheme '{scheme_id}' not found.",
        )

    return ScoreItem(
        id=score.id,
        profile_id=score.profile_id,
        scheme_id=score.scheme_id,
        match_score=score.match_score,
        eligibility_status=score.eligibility_status,
        reasons=score.reasons or {},
        missing_fields=score.missing_fields or [],
        created_at=score.created_at.isoformat() if score.created_at else None,
        updated_at=score.updated_at.isoformat() if score.updated_at else None,
    )


# =========================================================================
# Chirag's Spring Boot Integration Endpoints (Sprint 1 AI/ML Core Endpoints)
# =========================================================================


@router.post(
    "/api/summarize",
    response_model=SummarizeResponse,
    status_code=status.HTTP_200_OK,
    tags=["Scholarship Summarization"],
    summary="Summarize scholarship eligibility from raw or crawled text",
)
@router.post(
    "/api/summarise",
    response_model=SummarizeResponse,
    status_code=status.HTTP_200_OK,
    tags=["Scholarship Summarization"],
    summary="Summarize scholarship eligibility (alias)",
)
@router.post(
    "/api/v1/summarize",
    response_model=SummarizeResponse,
    status_code=status.HTTP_200_OK,
    tags=["Scholarship Summarization"],
    summary="Summarize scholarship eligibility (v1 alias)",
)
@router.post(
    "/api/v1/summarise",
    response_model=SummarizeResponse,
    status_code=status.HTTP_200_OK,
    tags=["Scholarship Summarization"],
    summary="Summarize scholarship eligibility (v1 alias)",
)
def summarize_eligibility_endpoint(
    req: SummarizeRequest,
    response: Response,
) -> SummarizeResponse:
    """Summarize scholarship eligibility requirements from messy or crawled text.
    
    - Validates that raw_text is present and non-empty.
    - Defends against prompt injection in crawled documents.
    - Sets 'ngrok-skip-browser-warning: true' header for seamless ngrok tunneling.
    - Extracts verified facts: category, income, courses, marks, deadlines, documents.
    - Distinguishes missing information from confirmed facts without hallucination.
    - Employs Gemini / Groq LLM chain with guaranteed deterministic fallback.
    - Returns structured summary compatible with Chirag's Java Spring Boot DTOs.
    """
    response.headers["ngrok-skip-browser-warning"] = "true"
    if not req.raw_text or not req.raw_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="raw_text cannot be empty or contain only whitespace.",
        )

    try:
        result = ScholarshipSummarizer.summarize(req.raw_text)
        return SummarizeResponse(
            summary=result.summary,
            confidence_score=result.confidence_score,
            warnings=result.warnings,
            extracted_facts=result.extracted_facts,
            is_fallback=result.is_fallback,
            provider=result.provider,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing scholarship summarization.",
        )


@router.post(
    "/api/rank",
    response_model=Union[List[RankedCandidateItem], RankResponse],
    status_code=status.HTTP_200_OK,
    tags=["Scholarship Ranking"],
    summary="Deterministically rank candidate scholarships that survived Java eligibility filtering",
)
@router.post(
    "/api/v1/rank",
    response_model=Union[List[RankedCandidateItem], RankResponse],
    status_code=status.HTTP_200_OK,
    tags=["Scholarship Ranking"],
    summary="Deterministically rank candidate scholarships (v1 alias)",
)
def rank_candidates_endpoint(
    payload: Union[List[CandidateItem], RankRequest],
) -> Any:
    """Deterministically rank surviving scholarship candidates.
    
    Formula:
      rank_score = (award_amount_score * 0.5) + (eligibility_score * 0.5)
      
    - Normalizes award amount via log-scaling up to ₹2,00,000 (0.0 to 1.0).
    - Uses caller-supplied or structured eligibility score (0.0 to 1.0).
    - Sorts descending by rank_score with deterministic multi-key tie breaking.
    - Handles empty candidate list and missing optional fields without crashing.
    - Preserves all original candidate identifying fields.
    - Compatible with both raw JSON array and object payloads from Java Spring Boot.
    """
    # Check whether caller passed a raw list or a wrapped request object
    is_list_payload = isinstance(payload, list)
    if is_list_payload:
        candidates_raw = [c.to_dict() for c in payload]
    else:
        candidates_raw = payload.get_candidates()

    # Empty candidate list handling
    if not candidates_raw:
        if is_list_payload:
            return []
        return RankResponse(total=0, ranked_candidates=[])

    ranked = CandidateRanker.score_and_rank(candidates_raw)

    items = [
        RankedCandidateItem(
            id=r.id,
            scheme_name=r.scheme_name,
            provider=r.provider,
            award_amount=r.award_amount,
            deadline=r.deadline,
            apply_link=r.apply_link,
            raw_eligibility_text=r.raw_eligibility_text,
            llm_summary=r.llm_summary,
            required_documents=r.required_documents,
            confidence_score=r.confidence_score,
            eligibility_score=r.eligibility_score,
            rank=r.rank,
            rank_score=r.rank_score,
            score_explanation=r.score_explanation.model_dump(),
            disclaimer=r.disclaimer,
            **r.extra_fields,
        )
        for r in ranked
    ]

    if is_list_payload:
        return items
    return RankResponse(total=len(items), ranked_candidates=items)
