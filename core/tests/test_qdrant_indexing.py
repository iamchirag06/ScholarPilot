"""Unit tests for Qdrant indexing, versioned collection, and semantic retrieval."""

import pytest
from qdrant_client import QdrantClient
from src.scholarpilot_ai.vector.qdrant_service import QdrantService
from src.scholarpilot_ai.data.seed_schemes import SEED_SCHEMES


def test_idempotent_indexing():
    """Re-indexing schemes must update points rather than duplicating or failing."""
    client = QdrantClient(location=":memory:")
    service = QdrantService(client=client)

    # First indexing run
    count_1 = service.index_schemes(SEED_SCHEMES)
    assert count_1 == len(SEED_SCHEMES)

    info_1 = client.get_collection(service.collection_name)
    assert info_1.points_count == len(SEED_SCHEMES)

    # Second indexing run (re-index)
    count_2 = service.index_schemes(SEED_SCHEMES)
    assert count_2 == len(SEED_SCHEMES)

    info_2 = client.get_collection(service.collection_name)
    assert info_2.points_count == len(SEED_SCHEMES)  # Idempotent: point count remains identical


def test_semantic_candidate_retrieval():
    """Retrieve semantically relevant schemes matching a student vector query."""
    client = QdrantClient(location=":memory:")
    service = QdrantService(client=client)
    service.index_schemes(SEED_SCHEMES)

    # Student query vector for Bihar BTech SC student
    query_profile = {
        "state": "BR",
        "education_level": "UG",
        "course": "BTECH",
        "category": "SC",
        "annual_family_income_inr": 180000,
        "marks_percent": 75.0,
    }
    q_vec = service.embedding_pipeline.embed_student_query(query_profile)

    candidates = service.search_candidates(query_vector=q_vec, top_k=5)
    assert len(candidates) > 0

    top_cand = candidates[0]
    assert "scheme_id" in top_cand
    assert "payload" in top_cand
    assert 0.0 <= top_cand["vector_similarity"] <= 1.0


def test_empty_collection_search():
    """Searching an empty collection returns an empty list without raising exceptions."""
    client = QdrantClient(location=":memory:")
    service = QdrantService(client=client)
    service.ensure_collection()

    dummy_vec = [0.1] * 384
    candidates = service.search_candidates(query_vector=dummy_vec, top_k=5)
    assert candidates == []
