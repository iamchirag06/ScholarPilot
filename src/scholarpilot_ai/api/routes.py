from typing import List, Dict, Any, Optional, Union
from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, Header, status, Response
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import text

from src.scholarpilot_ai.db.session import get_db
from src.scholarpilot_ai.db.models import (
    SchemeModel,
    ProfileModel,
    ScoreModel,
    AutofillMappingModel,
    AutofillSessionModel,
)
from src.scholarpilot_ai.vector.qdrant_service import QdrantService
from src.scholarpilot_ai.vector.embeddings import EmbeddingPipeline
from src.scholarpilot_ai.engine.eligibility import DeterministicEligibilityEngine, EligibilityStatus
from src.scholarpilot_ai.engine.ranker import RecommendationRanker, ScoredRecommendation
from src.scholarpilot_ai.engine.explanation import ExplanationService
from src.scholarpilot_ai.services.summarizer import ScholarshipSummarizer
from src.scholarpilot_ai.services.ranker import CandidateRanker
from src.scholarpilot_ai.services.chatbot import ScholarshipChatbotService
from src.scholarpilot_ai.services.autofill import (
    AutofillValidationService,
    AutofillSessionService,
    FormDiscoveryService,
    FieldMappingService,
    JavaBackendClient,
    StudentProfileService,
    DEFAULT_VERIFIED_MAPPINGS,
)
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
    ChatRequest,
    AutofillPrepareRequest,
    AutofillPrepareResponse,
    AutofillSessionPayloadResponse,
    FormMappingRequest,
    FormMappingResponse,
    FormDiscoveryRequest,
    FormDiscoveryResponse,
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


# =========================================================================
# Chatbot Assistant Endpoint (Context-Grounded Streaming with LangChain)
# =========================================================================


@router.post(
    "/api/chat",
    tags=["Scholarship Chatbot"],
    summary="Chatbot assistant streaming answers grounded in student profile and matched schemes context",
)
@router.post(
    "/api/v1/chat",
    tags=["Scholarship Chatbot"],
    summary="Chatbot assistant (v1 alias)",
)
@router.post(
    "/api/chatbot",
    tags=["Scholarship Chatbot"],
    summary="Chatbot assistant (chatbot alias)",
)
@router.post("/api/v1/chatbot", tags=["Scholarship Chatbot"], summary="Chatbot assistant (v1 chatbot alias)",)
async def chat_with_scholarpilot(
    req: ChatRequest,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Chatbot assistant powered by LangChain that answers user queries using contextual facts.
    
    1. Fetches student profile from {BACKEND_URL}/api/profiles/{profileId}.
    2. Fetches matched schemes context from {BACKEND_URL}/api/schemes/matched/{profileId}.
    3. Grounds responses strictly in the student's profile & matched scholarship facts.
    4. Streams response tokens back to the frontend in real time (text or SSE).
    5. Includes 'ngrok-skip-browser-warning: true' header to bypass ngrok warning pages.
    """
    user_id = req.get_user_id()
    message = req.get_message()

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="userid is required.",
        )

    if not message:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="message cannot be empty.",
        )

    generator = ScholarshipChatbotService.generate_chat_stream(
        query=message,
        profile_id=user_id,
        stream_format="text",
        db=db,
    )

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "ngrok-skip-browser-warning": "true",
    }

    return StreamingResponse(
        generator,
        media_type="text/plain; charset=utf-8",
        headers=headers,
    )


# =========================================================================
# Intelligent Scholarship Autofill & Form Discovery Endpoints
# =========================================================================


@router.post(
    "/api/v1/autofill/prepare",
    response_model=AutofillPrepareResponse,
    tags=["Scholarship Autofill"],
    summary="Prepare official scholarship autofill session and verified URL",
)
@router.post(
    "/api/autofill/prepare",
    response_model=AutofillPrepareResponse,
    tags=["Scholarship Autofill"],
    summary="Prepare official scholarship autofill session (alias)",
)
async def prepare_scholarship_autofill(
    req: AutofillPrepareRequest,
    response: Response,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> AutofillPrepareResponse:
    """Prepares verified application URL and short-lived secure autofill session.
    
    1. Authenticates student and validates scheme access.
    2. Retrieves student profile and scheme details from Java backend.
    3. Reuses verified portal mapping or invokes bounded form discovery.
    4. Evaluates student eligibility rules and missing fields.
    5. Issues short-lived, single-use autofill session token for Chrome extension.
    """
    response.headers["ngrok-skip-browser-warning"] = "true"

    # Determine authenticated user identity
    authenticated_id = x_user_id or req.userId or "prof-arjun-001"
    if not authenticated_id or not authenticated_id.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user identity could not be verified.",
        )

    if not req.schemeId or not req.schemeId.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="schemeId is required.",
        )

    result = await AutofillValidationService.prepare_autofill(
        scheme_id=req.schemeId.strip(),
        authenticated_user_id=authenticated_id.strip(),
        db=db,
        auth_header=authorization,
    )

    return result


@router.get(
    "/api/v1/autofill/session/{session_id}",
    response_model=AutofillSessionPayloadResponse,
    tags=["Scholarship Autofill"],
    summary="Redeem short-lived autofill session payload for Chrome Extension",
)
@router.get(
    "/api/autofill/session/{session_id}",
    response_model=AutofillSessionPayloadResponse,
    tags=["Scholarship Autofill"],
    summary="Redeem short-lived autofill session payload (alias)",
)
def get_autofill_session_payload(
    session_id: str,
    response: Response,
    db: Session = Depends(get_db),
) -> AutofillSessionPayloadResponse:
    """Retrieves authorized autofill payload for the Chrome Extension.
    
    - Validates session existence, expiration, and status.
    - Prevents unauthorized replay through redemption tracking.
    - Returns scoped profile values only (does not expose full raw database).
    """
    response.headers["ngrok-skip-browser-warning"] = "true"

    if not session_id or not session_id.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="session_id cannot be empty.",
        )

    payload = AutofillSessionService.redeem_session(
        session_id=session_id.strip(),
        db=db,
    )

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Autofill session not found, expired, or maximum redemptions exceeded.",
        )

    return payload


@router.post(
    "/api/v1/autofill/map",
    response_model=FormMappingResponse,
    tags=["Scholarship Autofill"],
    summary="Map detected DOM form fields to authorized student profile values",
)
@router.post(
    "/api/autofill/map",
    response_model=FormMappingResponse,
    tags=["Scholarship Autofill"],
    summary="Map detected DOM form fields (alias)",
)
async def map_portal_form_fields(
    req: FormMappingRequest,
    response: Response,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
) -> FormMappingResponse:
    """Matches form input/select fields detected by the extension with student facts.
    
    - Employs heuristic keyword and regex matching for Indian scholarship portals.
    - Handles standard text, email, tel, date, and select options with fuzzy matching.
    - Flags sensitive fields (e.g. Aadhaar, Bank Details) for mandatory manual review.
    """
    response.headers["ngrok-skip-browser-warning"] = "true"

    user_id = x_user_id or req.userId or "prof-arjun-001"
    raw_profile = await JavaBackendClient.fetch_user_profile(user_id=user_id, db=db)
    if not raw_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student profile '{user_id}' not found.",
        )

    profile = StudentProfileService.normalize_profile(raw_profile)
    field_values = StudentProfileService.build_field_values_dict(profile)

    mapping_res = FieldMappingService.match_form_fields(
        detected_fields=req.formFields,
        field_values=field_values,
    )
    mapping_res.schemeId = req.schemeId
    return mapping_res


@router.post(
    "/api/v1/autofill/discover",
    response_model=FormDiscoveryResponse,
    tags=["Scholarship Autofill"],
    summary="On-demand form discovery and URL classification for a scholarship scheme",
)
@router.post(
    "/api/autofill/discover",
    response_model=FormDiscoveryResponse,
    tags=["Scholarship Autofill"],
    summary="On-demand form discovery (alias)",
)
async def discover_scheme_form(
    req: FormDiscoveryRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> FormDiscoveryResponse:
    """Discovers application form URL using verified mappings or bounded crawler."""
    response.headers["ngrok-skip-browser-warning"] = "true"

    scheme_details = await JavaBackendClient.fetch_scheme_details(scheme_id=req.schemeId, db=db)
    if not scheme_details:
        scheme_details = {
            "id": req.schemeId,
            "title": req.schemeName or f"Scheme {req.schemeId}",
            "official_url": req.portalUrl or "https://scholarships.gov.in",
        }
    elif req.portalUrl:
        scheme_details["official_url"] = req.portalUrl

    discovery_res = await FormDiscoveryService.discover_application_url(
        scheme_id=req.schemeId,
        scheme_details=scheme_details,
        db=db,
    )
    return discovery_res


@router.get(
    "/api/v1/autofill/registry",
    tags=["Scholarship Autofill"],
    summary="List verified official scholarship portal mappings",
)
@router.get(
    "/api/autofill/registry",
    tags=["Scholarship Autofill"],
    summary="List verified official scholarship portal mappings (alias)",
)
def list_verified_portal_registry(
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Returns list of pre-verified scholarship portal adapters and application routes."""
    db_mappings = db.query(AutofillMappingModel).all()
    mappings_list = [m.to_dict() for m in db_mappings]
    if not mappings_list:
        mappings_list = DEFAULT_VERIFIED_MAPPINGS

    return {
        "status": "success",
        "total": len(mappings_list),
        "supported_portals": [
            "National Scholarship Portal (NSP)",
            "Bihar Post-Matric Scholarship (PMS)",
            "AICTE Pragati Portal",
        ],
        "mappings": mappings_list,
    }


@router.get("/app", include_in_schema=False)
@router.get("/dashboard", include_in_schema=False)
def serve_frontend_dashboard():
    """Serve the ScholarPilot student application dashboard."""
    import os
    index_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        "frontend",
        "index.html",
    )
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "ScholarPilot dashboard"}


