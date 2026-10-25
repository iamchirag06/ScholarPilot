"""SQLAlchemy database models for ScholarPilot.

Defines authoritative schemas for 'schemes', 'profile', and the new 'score' matching table.
Supports both PostgreSQL (JSONB) and SQLite (JSON) backends.
"""

from datetime import datetime, timezone
import uuid
from typing import Any, Dict, List
from sqlalchemy import (
    Column,
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Index,
    JSON,
    BigInteger,
    Integer,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SchemeModel(Base):
    """Authoritative scholarship scheme record."""

    __tablename__ = "schemes"

    id = Column(String(64), primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    provider = Column(String(255), nullable=False)
    scope = Column(String(32), nullable=False, default="CENTRAL")  # CENTRAL | STATE | PRIVATE
    eligible_states = Column(JSON, nullable=False, default=list)  # e.g. ["BR", "HR"]
    education_levels = Column(JSON, nullable=False, default=list)  # e.g. ["CLASS_12", "UG"]
    courses = Column(JSON, nullable=False, default=list)  # e.g. ["BTECH", "MBBS"]
    category_rules = Column(JSON, nullable=False, default=list)  # e.g. ["SC", "ST", "OBC", "GEN"]
    income_limit_inr = Column(BigInteger, nullable=True)  # Max annual family income
    minimum_marks_percent = Column(Float, nullable=True)  # Minimum qualifying percentage
    award_amount_inr = Column(BigInteger, nullable=True)  # Benefit amount
    deadline = Column(String(32), nullable=True)  # ISO Date string 'YYYY-MM-DD'
    required_documents = Column(JSON, nullable=False, default=list)  # ["income_certificate", ...]
    official_url = Column(String(512), nullable=True)
    source_checked_at = Column(String(64), nullable=True)
    verification_status = Column(String(32), nullable=False, default="VERIFIED")  # VERIFIED | NEEDS_REVIEW
    unknown_fields = Column(JSON, nullable=False, default=list)

    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    scores = relationship("ScoreModel", back_populates="scheme", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "provider": self.provider,
            "scope": self.scope,
            "eligible_states": self.eligible_states or [],
            "education_levels": self.education_levels or [],
            "courses": self.courses or [],
            "category_rules": self.category_rules or [],
            "income_limit_inr": self.income_limit_inr,
            "minimum_marks_percent": self.minimum_marks_percent,
            "award_amount_inr": self.award_amount_inr,
            "deadline": self.deadline,
            "required_documents": self.required_documents or [],
            "official_url": self.official_url,
            "source_checked_at": self.source_checked_at,
            "verification_status": self.verification_status,
            "unknown_fields": self.unknown_fields or [],
        }


class ProfileModel(Base):
    """Student profile record.
    
    The profile ID is strictly separate from the authentication user ID.
    """

    __tablename__ = "profile"

    id = Column(String(64), primary_key=True, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    state = Column(String(32), nullable=True)  # e.g. "BR"
    education_level = Column(String(32), nullable=True)  # e.g. "UG"
    course = Column(String(64), nullable=True)  # e.g. "BTECH"
    category = Column(String(32), nullable=True)  # e.g. "SC"
    annual_family_income_inr = Column(BigInteger, nullable=True)
    marks_percent = Column(Float, nullable=True)
    disability = Column(Boolean, nullable=False, default=False)
    gender = Column(String(32), nullable=False, default="NOT_PROVIDED")
    consent_to_process_profile = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    scores = relationship("ScoreModel", back_populates="profile", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "state": self.state,
            "education_level": self.education_level,
            "course": self.course,
            "category": self.category,
            "annual_family_income_inr": self.annual_family_income_inr,
            "marks_percent": self.marks_percent,
            "disability": self.disability,
            "gender": self.gender,
            "consent_to_process_profile": self.consent_to_process_profile,
        }


class ScoreModel(Base):
    """Persisted scholarship matching results.
    
    Unique constraint ensures one current result per (profile_id, scheme_id) pair.
    """

    __tablename__ = "score"

    id = Column(String(64), primary_key=True, default=lambda: f"scr_{uuid.uuid4().hex[:16]}")
    profile_id = Column(String(64), ForeignKey("profile.id", ondelete="CASCADE"), nullable=False, index=True)
    scheme_id = Column(String(64), ForeignKey("schemes.id", ondelete="CASCADE"), nullable=False, index=True)
    match_score = Column(Float, nullable=False)  # Normalized 0.0 to 100.0
    eligibility_status = Column(String(32), nullable=False)  # ELIGIBLE | NOT_ELIGIBLE | NEEDS_REVIEW
    reasons = Column(JSON, nullable=False, default=dict)  # Rule breakdown + evidence
    missing_fields = Column(JSON, nullable=False, default=list)  # Missing/unverified items

    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    profile = relationship("ProfileModel", back_populates="scores")
    scheme = relationship("SchemeModel", back_populates="scores")

    __table_args__ = (
        UniqueConstraint("profile_id", "scheme_id", name="uq_score_profile_scheme"),
        Index("idx_score_lookup", "profile_id", "eligibility_status"),
        Index("idx_score_ranking", "profile_id", "match_score"),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "profile_id": self.profile_id,
            "scheme_id": self.scheme_id,
            "match_score": round(self.match_score, 2),
            "eligibility_status": self.eligibility_status,
            "reasons": self.reasons or {},
            "missing_fields": self.missing_fields or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class AutofillMappingModel(Base):
    """Verified scheme application form URL mapping and field registry cache."""

    __tablename__ = "autofill_mappings"

    id = Column(String(64), primary_key=True, default=lambda: f"map_{uuid.uuid4().hex[:16]}")
    scheme_id = Column(String(64), nullable=False, index=True)
    portal_id = Column(String(64), nullable=False, index=True)  # e.g., 'nsp', 'bihar_pms', 'aicte_pragati'
    verified_application_url = Column(String(512), nullable=False)
    approved_domain = Column(String(255), nullable=False)  # e.g., 'scholarships.gov.in'
    form_fingerprint = Column(String(128), nullable=True)
    field_mappings = Column(JSON, nullable=False, default=dict)
    verification_status = Column(String(32), nullable=False, default="VERIFIED")  # VERIFIED | NEEDS_REVIEW | DEPRECATED
    last_verified_at = Column(DateTime(timezone=True), default=utcnow)
    discovery_metadata = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        Index("idx_autofill_scheme_portal", "scheme_id", "portal_id"),
        Index("idx_autofill_domain", "approved_domain"),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "scheme_id": self.scheme_id,
            "portal_id": self.portal_id,
            "verified_application_url": self.verified_application_url,
            "approved_domain": self.approved_domain,
            "form_fingerprint": self.form_fingerprint,
            "field_mappings": self.field_mappings or {},
            "verification_status": self.verification_status,
            "last_verified_at": self.last_verified_at.isoformat() if self.last_verified_at else None,
            "discovery_metadata": self.discovery_metadata or {},
        }


class AutofillSessionModel(Base):
    """Cryptographically referenced, short-lived student autofill session."""

    __tablename__ = "autofill_sessions"

    id = Column(String(64), primary_key=True)  # Short-lived token e.g. 'sess_...'
    student_id = Column(String(64), nullable=False, index=True)
    scheme_id = Column(String(64), nullable=False, index=True)
    application_url = Column(String(512), nullable=False)
    payload = Column(JSON, nullable=False, default=dict)  # Scoped student fields only
    status = Column(String(32), nullable=False, default="ACTIVE")  # ACTIVE | REDEEMED | EXPIRED | CANCELLED
    redemption_count = Column(Integer, nullable=False, default=0)
    max_redemptions = Column(Integer, nullable=False, default=5)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (
        Index("idx_session_lookup", "id", "status"),
        Index("idx_session_student", "student_id", "scheme_id"),
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "student_id": self.student_id,
            "scheme_id": self.scheme_id,
            "application_url": self.application_url,
            "payload": self.payload or {},
            "status": self.status,
            "redemption_count": self.redemption_count,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }

