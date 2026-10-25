"""Qdrant vector search integration for scholarship indexing and candidate retrieval."""

import uuid
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from src.scholarpilot_ai.config import get_settings
from src.scholarpilot_ai.vector.embeddings import EmbeddingPipeline

settings = get_settings()


class QdrantService:
    """Manages collection lifecycle, idempotent indexing, and vector candidate search."""

    def __init__(self, client: Optional[QdrantClient] = None) -> None:
        self.embedding_pipeline = EmbeddingPipeline()
        self.collection_name = settings.QDRANT_COLLECTION_NAME

        if client is not None:
            self.client = client
        else:
            self.client = self._init_client()

    def _init_client(self) -> QdrantClient:
        """Initialize Qdrant client from settings (cloud endpoint, in-memory, or local)."""
        location = settings.QDRANT_LOCATION
        endpoint = settings.effective_qdrant_endpoint
        api_key = settings.effective_qdrant_api_key

        if location:
            return QdrantClient(location=location)

        if endpoint:
            try:
                return QdrantClient(
                    url=endpoint,
                    api_key=api_key,
                    timeout=settings.QDRANT_TIMEOUT_SEC,
                )
            except Exception:
                # Safe in-memory fallback if remote connection encounters network drop
                return QdrantClient(location=":memory:")

        return QdrantClient(location=":memory:")

    def ensure_collection(self) -> None:
        """Create versioned scholarship collection if it does not already exist."""
        try:
            collections_res = self.client.get_collections()
            existing_names = [c.name for c in collections_res.collections]
            if self.collection_name not in existing_names:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=qmodels.VectorParams(
                        size=settings.EMBEDDING_DIMENSION,
                        distance=qmodels.Distance.COSINE,
                    ),
                )
        except Exception as e:
            # Re-initialize local fallback if cloud collection probe fails
            self.client = QdrantClient(location=":memory:")
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=qmodels.VectorParams(
                    size=settings.EMBEDDING_DIMENSION,
                    distance=qmodels.Distance.COSINE,
                ),
            )

    @staticmethod
    def _deterministic_point_id(scheme_id: str) -> str:
        """Generate consistent UUID from scheme_id for idempotent upserts."""
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"scholarpilot:scheme:{scheme_id}"))

    def index_schemes(self, schemes: List[Dict[str, Any]]) -> int:
        """Idempotently index scholarship records into Qdrant."""
        if not schemes:
            return 0

        self.ensure_collection()
        points: List[qmodels.PointStruct] = []

        for scheme in schemes:
            scheme_id = str(scheme.get("id"))
            if not scheme_id:
                continue

            vector = self.embedding_pipeline.embed_scheme(scheme)
            point_id = self._deterministic_point_id(scheme_id)

            payload = {
                "scheme_id": scheme_id,
                "title": scheme.get("title", ""),
                "provider": scheme.get("provider", ""),
                "scope": scheme.get("scope", "CENTRAL"),
                "eligible_states": scheme.get("eligible_states") or [],
                "education_levels": scheme.get("education_levels") or [],
                "courses": scheme.get("courses") or [],
                "category_rules": scheme.get("category_rules") or [],
                "income_limit_inr": scheme.get("income_limit_inr"),
                "minimum_marks_percent": scheme.get("minimum_marks_percent"),
                "award_amount_inr": scheme.get("award_amount_inr"),
                "deadline": scheme.get("deadline"),
                "verification_status": scheme.get("verification_status", "VERIFIED"),
                "required_documents": scheme.get("required_documents") or [],
                "official_url": scheme.get("official_url"),
            }

            points.append(
                qmodels.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload,
                )
            )

        if points:
            self.client.upsert(
                collection_name=self.collection_name,
                points=points,
                wait=True,
            )

        return len(points)

    def search_candidates(
        self,
        query_vector: List[float],
        top_k: int = 20,
        filter_scope: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve semantically relevant candidate schemes from Qdrant."""
        self.ensure_collection()

        q_filter = None
        if filter_scope:
            q_filter = qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="scope",
                        match=qmodels.MatchValue(value=filter_scope),
                    )
                ]
            )

        try:
            # Support both query_points (newer qdrant-client) and search
            if hasattr(self.client, "query_points"):
                response = self.client.query_points(
                    collection_name=self.collection_name,
                    query=query_vector,
                    limit=top_k,
                    query_filter=q_filter,
                    with_payload=True,
                )
                hits = response.points
            else:
                hits = self.client.search(
                    collection_name=self.collection_name,
                    query_vector=query_vector,
                    limit=top_k,
                    query_filter=q_filter,
                    with_payload=True,
                )
        except Exception:
            return []

        candidates: List[Dict[str, Any]] = []
        for hit in hits:
            payload = hit.payload or {}
            # Normalize cosine score from [-1, 1] to [0, 1]
            raw_score = float(hit.score)
            normalized_similarity = max(0.0, min(1.0, (raw_score + 1.0) / 2.0))

            candidates.append(
                {
                    "scheme_id": payload.get("scheme_id"),
                    "payload": payload,
                    "vector_similarity": normalized_similarity,
                    "raw_score": raw_score,
                }
            )

        return candidates
