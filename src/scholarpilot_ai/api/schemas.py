"""Pydantic schemas for request and response API contracts."""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    service: str = "ScholarPilot AI/ML Recommendation Engine"
    version: str = "1.0.0"
    database_connected: bool
    qdrant_connected: bool
    embedding_model_loaded: bool


class SchemeCreate(BaseModel):
    id: str
    title: str
    provider: str
    scope: str = "CENTRAL"
    eligible_states: List[str] = Field(default_factory=list)
    education_levels: List[str] = Field(default_factory=list)
    courses: List[str] = Field(default_factory=list)
    category_rules: List[str] = Field(default_factory=list)
    income_limit_inr: Optional[int] = None
    minimum_marks_percent: Optional[float] = None
    award_amount_inr: Optional[int] = None
    deadline: Optional[str] = None
    required_documents: List[str] = Field(default_factory=list)
    official_url: Optional[str] = None
    source_checked_at: Optional[str] = None
    verification_status: str = "VERIFIED"
    unknown_fields: List[str] = Field(default_factory=list)


class IndexRequest(BaseModel):
    schemes: Optional[List[SchemeCreate]] = None  # If None, indexes existing schemes from DB


class IndexResponse(BaseModel):
    indexed_count: int
    collection_name: str
    status: str = "success"


class MatchRequest(BaseModel):
    profile_id: str
    top_k: int = Field(default=20, ge=1, le=100)
    include_not_eligible: bool = False
    refresh: bool = False  # If True, re-executes matching even if cached score rows exist


class RecommendationItem(BaseModel):
    scheme_id: str
    title: str
    provider: str
    match_score: float
    eligibility_status: str
    summary: str
    why_relevant: str
    criteria_satisfied: List[str]
    criteria_failed: List[str]
    unknown_or_unverified: List[str]
    award_summary: str
    required_documents: List[str]
    deadline: Optional[str] = None
    official_url: Optional[str] = None
    verification_status: str


class MatchResponse(BaseModel):
    profile_id: str
    total_candidates: int
    eligible_count: int
    needs_review_count: int
    recommendations: List[RecommendationItem]


class ScoreItem(BaseModel):
    id: str
    profile_id: str
    scheme_id: str
    match_score: float
    eligibility_status: str
    reasons: Dict[str, Any]
    missing_fields: List[str]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ScoresListResponse(BaseModel):
    profile_id: str
    total: int
    limit: int
    offset: int
    items: List[ScoreItem]
