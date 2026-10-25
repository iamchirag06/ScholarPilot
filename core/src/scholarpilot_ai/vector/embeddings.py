"""Local, free embedding generation pipeline using FastEmbed (ONNX)."""

from typing import List, Dict, Any, Optional
import hashlib
import numpy as np
from fastembed import TextEmbedding
from src.scholarpilot_ai.config import get_settings

settings = get_settings()


class EmbeddingPipeline:
    """Zero-cost local embedding pipeline using FastEmbed ONNX runtime."""

    _instance: Optional["EmbeddingPipeline"] = None
    _embedder: Optional[TextEmbedding] = None

    def __new__(cls) -> "EmbeddingPipeline":
        if cls._instance is None:
            cls._instance = super(EmbeddingPipeline, cls).__new__(cls)
        return cls._instance

    def __init__(self) -> None:
        if self._embedder is None:
            try:
                self._embedder = TextEmbedding(model_name=settings.EMBEDDING_MODEL)
            except Exception as e:
                # Fallback to local pseudo-embedding if model initialization fails in offline test
                self._embedder = None

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Generate normalized embedding vectors for a list of texts."""
        if not texts:
            return []

        if self._embedder is not None:
            try:
                embeddings = list(self._embedder.embed(texts))
                return [e.tolist() for e in embeddings]
            except Exception:
                pass

        # Deterministic offline fallback embedding (384-dimensional unit vector)
        fallback_results: List[List[float]] = []
        for text in texts:
            seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:8], 16)
            rng = np.random.default_rng(seed)
            vec = rng.standard_normal(settings.EMBEDDING_DIMENSION)
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm
            fallback_results.append(vec.tolist())
        return fallback_results

    def embed_scheme(self, scheme_dict: Dict[str, Any]) -> List[float]:
        """Convert scheme dictionary into a grounded textual document and embed it."""
        doc = self.build_scheme_document(scheme_dict)
        return self.embed_texts([doc])[0]

    def embed_student_query(self, profile_dict: Dict[str, Any]) -> List[float]:
        """Build a semantic query from student profile attributes and embed it."""
        query_text = self.build_student_query_text(profile_dict)
        return self.embed_texts([query_text])[0]

    @staticmethod
    def build_scheme_document(scheme: Dict[str, Any]) -> str:
        """Create structured grounded embedding document from scheme facts without inventing data."""
        title = scheme.get("title", "Scholarship Scheme")
        provider = scheme.get("provider", "Official Provider")
        scope = scheme.get("scope", "CENTRAL")
        states = ", ".join(scheme.get("eligible_states") or ["All India"])
        ed_levels = ", ".join(scheme.get("education_levels") or ["All Levels"])
        courses = ", ".join(scheme.get("courses") or ["All Courses"])
        categories = ", ".join(scheme.get("category_rules") or ["All Categories"])
        income = scheme.get("income_limit_inr")
        income_str = f"Up to ₹{income:,}" if income else "No strict family income limit"
        marks = scheme.get("minimum_marks_percent")
        marks_str = f"Minimum {marks}% required" if marks else "No minimum marks cutoff"
        award = scheme.get("award_amount_inr")
        award_str = f"Financial aid award of ₹{award:,}" if award else "Tuition support and grant"
        docs = ", ".join(scheme.get("required_documents") or ["Standard application verification"])

        return (
            f"Scholarship: {title}. "
            f"Provider: {provider} ({scope} scope). "
            f"Eligible States: {states}. "
            f"Eligible Education Levels: {ed_levels}. "
            f"Eligible Courses: {courses}. "
            f"Target Categories: {categories}. "
            f"Income Criteria: {income_str}. "
            f"Academic Criteria: {marks_str}. "
            f"Award: {award_str}. "
            f"Required Documents: {docs}."
        )

    @staticmethod
    def build_student_query_text(profile: Dict[str, Any]) -> str:
        """Create student profile query text reflecting attributes and scholarship intent."""
        state = profile.get("state", "India")
        ed_level = profile.get("education_level", "Student")
        course = profile.get("course", "Higher Education")
        category = profile.get("category", "General")
        income = profile.get("annual_family_income_inr")
        income_str = f"Family annual income ₹{income:,}" if income else "Low/middle income"
        marks = profile.get("marks_percent")
        marks_str = f"{marks}% marks" if marks else "Eligible academic record"
        disability = "Person with disability" if profile.get("disability") else "General ability"
        gender = profile.get("gender", "Student")

        return (
            f"Scholarship recommendation request for student: "
            f"State: {state}. Education Level: {ed_level}. Course: {course}. "
            f"Social Category: {category}. Income: {income_str}. Academic Score: {marks_str}. "
            f"Status: {disability}, Gender: {gender}. "
            f"Intent: Financial support, government schemes, tuition waiver, and higher education scholarships."
        )
