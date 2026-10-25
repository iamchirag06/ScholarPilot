"""Automated unit and integration tests for /api/rank endpoint and CandidateRanker engine."""

from starlette.testclient import TestClient
from src.scholarpilot_ai.services.ranker import CandidateRanker


def test_rank_candidates_descending_order(client: TestClient):
    """POST /api/rank must rank candidates in strictly descending order of rank_score."""
    payload = [
        {
            "id": "scheme-low",
            "scheme_name": "Book Grant Scheme",
            "provider": "State Library Board",
            "award_amount": 5000.0,
            "deadline": "2026-11-30",
            "required_documents": ["id_card"],
            "eligibility_score": 0.60,
        },
        {
            "id": "scheme-high",
            "scheme_name": "National Excellence Fellowship",
            "provider": "Ministry of Science & Technology",
            "award_amount": 180000.0,
            "deadline": "2026-12-31",
            "required_documents": ["transcript", "caste_cert", "income_cert"],
            "eligibility_score": 0.95,
        },
        {
            "id": "scheme-mid",
            "scheme_name": "State Merit Support",
            "provider": "Higher Education Dept",
            "award_amount": 40000.0,
            "deadline": "2026-11-15",
            "required_documents": ["marksheet"],
            "eligibility_score": 0.80,
        },
    ]

    response = client.post("/api/rank", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    assert len(data) == 3

    # Check ranks 1, 2, 3
    assert data[0]["rank"] == 1
    assert data[0]["id"] == "scheme-high"
    assert data[1]["rank"] == 2
    assert data[1]["id"] == "scheme-mid"
    assert data[2]["rank"] == 3
    assert data[2]["id"] == "scheme-low"

    # Strictly descending rank_score
    assert data[0]["rank_score"] >= data[1]["rank_score"] >= data[2]["rank_score"]

    # Check score explanation and disclaimer
    for item in data:
        assert 0.0 <= item["rank_score"] <= 1.0
        assert "score_explanation" in item
        assert "disclaimer" in item
        assert "High ranking does not guarantee" in item["disclaimer"]


def test_rank_score_normalization_and_formula():
    """Verify exact formula: score = (award_amount_score * 0.5) + (eligibility_score * 0.5)."""
    # Max award benchmark is ₹200,000 -> award_score = 1.0
    candidates = [
        {
            "id": "scheme-test",
            "scheme_name": "Test Scheme",
            "award_amount": 200000.0,
            "eligibility_score": 1.0,
        }
    ]
    ranked = CandidateRanker.score_and_rank(candidates)
    assert len(ranked) == 1
    item = ranked[0]
    # (1.0 * 0.5) + (1.0 * 0.5) = 1.0
    assert item.rank_score == 1.0
    assert item.score_explanation.award_amount_score == 1.0
    assert item.score_explanation.eligibility_score == 1.0


def test_rank_handles_empty_candidate_list(client: TestClient):
    """Empty list [] input must return empty list [] with HTTP 200 without crashing."""
    response = client.post("/api/rank", json=[])
    assert response.status_code == 200
    assert response.json() == []

    # Object format with empty candidates list
    res_obj = client.post("/api/rank", json={"candidates": []})
    assert res_obj.status_code == 200
    assert res_obj.json()["total"] == 0
    assert res_obj.json()["ranked_candidates"] == []


def test_rank_handles_missing_optional_fields(client: TestClient):
    """Missing optional fields (None award_amount, None deadline, etc.) must not crash."""
    payload = [
        {
            "scheme_name": "Minimal Scheme Without ID or Award",
        },
        {
            "id": "scheme-sparse",
            "scheme_name": "Sparse Scheme",
            "award_amount": None,
            "deadline": None,
            "required_documents": [],
            "confidence_score": None,
            "eligibility_score": None,
        },
    ]

    response = client.post("/api/rank", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    for item in data:
        assert item["rank"] in [1, 2]
        assert item["rank_score"] > 0.0


def test_rank_deterministic_tie_breaking():
    """Identical rank_score must tie-break deterministically using award_amount, confidence, then ID."""
    candidates = [
        {
            "id": "scheme-z",
            "scheme_name": "Scheme Z",
            "award_amount": 50000.0,
            "eligibility_score": 0.80,
            "confidence_score": 0.90,
        },
        {
            "id": "scheme-a",
            "scheme_name": "Scheme A",
            "award_amount": 50000.0,
            "eligibility_score": 0.80,
            "confidence_score": 0.90,
        },
    ]

    ranked_1 = CandidateRanker.score_and_rank(candidates)
    ranked_2 = CandidateRanker.score_and_rank(candidates)

    # Identical score, identical award, identical confidence -> ID ASC ('scheme-a' < 'scheme-z')
    assert ranked_1[0].id == "scheme-a"
    assert ranked_1[1].id == "scheme-z"

    # Must be 100% deterministic across multiple runs
    assert [r.id for r in ranked_1] == [r.id for r in ranked_2]


def test_rank_request_object_wrapper_format(client: TestClient):
    """POST /api/rank accepting an object wrapper {"candidates": [...]} returns RankResponse."""
    payload = {
        "candidates": [
            {
                "id": "scheme-01",
                "title": "Scholarship 1",
                "award_amount_inr": 25000.0,
                "eligibility_score": 0.75,
            },
            {
                "id": "scheme-02",
                "title": "Scholarship 2",
                "award_amount_inr": 75000.0,
                "eligibility_score": 0.85,
            },
        ]
    }

    response = client.post("/api/rank", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "total" in data
    assert data["total"] == 2
    assert "ranked_candidates" in data
    assert data["ranked_candidates"][0]["id"] == "scheme-02"
    assert data["ranked_candidates"][1]["id"] == "scheme-01"


def test_rank_v1_alias_endpoint(client: TestClient):
    """POST /api/v1/rank alias functions identically."""
    payload = [
        {"id": "s1", "scheme_name": "S1", "award_amount": 10000.0, "eligibility_score": 0.5}
    ]
    response = client.post("/api/v1/rank", json=payload)
    assert response.status_code == 200
    assert response.json()[0]["id"] == "s1"


def test_rank_preserves_custom_and_extra_fields():
    """Custom fields like apply_link or custom metadata must be preserved in ranked output."""
    candidates = [
        {
            "id": "custom-01",
            "scheme_name": "Custom Portal Scheme",
            "apply_link": "https://scholarships.gov.in/apply/123",
            "raw_eligibility_text": "Sample text",
            "llm_summary": "Sample summary",
            "custom_metadata_tag": "tech_students_only",
            "award_amount": 50000.0,
            "eligibility_score": 0.70,
        }
    ]
    ranked = CandidateRanker.score_and_rank(candidates)
    item = ranked[0]
    assert item.apply_link == "https://scholarships.gov.in/apply/123"
    assert item.raw_eligibility_text == "Sample text"
    assert item.llm_summary == "Sample summary"
    assert item.extra_fields.get("custom_metadata_tag") == "tech_students_only"
