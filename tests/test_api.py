"""Integration tests for REST API endpoints and database score persistence."""

from starlette.testclient import TestClient
from sqlalchemy.orm import Session
from src.scholarpilot_ai.db.models import ScoreModel, ProfileModel


def test_health_check_endpoint(client: TestClient):
    """GET /health must return HTTP 200 with service status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert data["database_connected"] is True


def test_scheme_indexing_endpoint(client: TestClient):
    """POST /api/v1/schemes/index re-indexes existing schemes into Qdrant."""
    response = client.post("/api/v1/schemes/index", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["indexed_count"] > 0


def test_matching_flow_and_score_persistence_for_arjun(client: TestClient, db_session: Session):
    """POST /api/v1/matches generates recommendations and persists them atomically to 'score' table."""
    payload = {
        "profile_id": "prof-arjun-001",
        "top_k": 10,
        "include_not_eligible": False,
    }

    # Run match
    response = client.post("/api/v1/matches", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["profile_id"] == "prof-arjun-001"
    assert data["total_candidates"] > 0
    assert data["eligible_count"] > 0

    recs = data["recommendations"]
    assert len(recs) > 0
    top_rec = recs[0]
    assert top_rec["eligibility_status"] == "ELIGIBLE"
    assert top_rec["match_score"] > 0
    assert len(top_rec["criteria_satisfied"]) > 0

    # Verify atomic persistence in 'score' table
    persisted_scores = (
        db_session.query(ScoreModel)
        .filter(ScoreModel.profile_id == "prof-arjun-001")
        .all()
    )
    initial_count = len(persisted_scores)
    assert initial_count > 0

    # Idempotency check: Re-running match must NOT create duplicate rows
    response_retry = client.post("/api/v1/matches", json=payload)
    assert response_retry.status_code == 200

    persisted_scores_retry = (
        db_session.query(ScoreModel)
        .filter(ScoreModel.profile_id == "prof-arjun-001")
        .all()
    )
    assert len(persisted_scores_retry) == initial_count


def test_match_missing_consent_forbidden(client: TestClient, db_session: Session):
    """Profile without consent_to_process_profile must return HTTP 403 Forbidden."""
    # Revoke consent for Arjun temporarily
    profile = db_session.query(ProfileModel).filter(ProfileModel.id == "prof-arjun-001").first()
    profile.consent_to_process_profile = False
    db_session.commit()

    response = client.post(
        "/api/v1/matches",
        json={"profile_id": "prof-arjun-001", "top_k": 5},
    )
    assert response.status_code == 403
    assert "consent" in response.json()["detail"].lower()


def test_match_nonexistent_profile_not_found(client: TestClient):
    """Requesting matching for a non-existent profile ID must return HTTP 404."""
    response = client.post(
        "/api/v1/matches",
        json={"profile_id": "prof-does-not-exist", "top_k": 5},
    )
    assert response.status_code == 404


def test_get_profile_scores_pagination_and_filter(client: TestClient):
    """GET /api/v1/profiles/{profile_id}/scores returns persisted scores with pagination."""
    # First generate scores
    client.post(
        "/api/v1/matches",
        json={"profile_id": "prof-riya-002", "top_k": 10, "include_not_eligible": True},
    )

    # Fetch all scores
    res_all = client.get("/api/v1/profiles/prof-riya-002/scores?status=ALL&limit=5&offset=0")
    assert res_all.status_code == 200
    data_all = res_all.json()
    assert data_all["total"] > 0
    assert len(data_all["items"]) <= 5

    # Fetch with ELIGIBLE filter
    res_eligible = client.get("/api/v1/profiles/prof-riya-002/scores?status=ELIGIBLE")
    assert res_eligible.status_code == 200
    for item in res_eligible.json()["items"]:
        assert item["eligibility_status"] == "ELIGIBLE"


def test_get_single_scheme_score_detail(client: TestClient):
    """GET /api/v1/profiles/{profile_id}/scores/{scheme_id} returns detailed single result."""
    client.post(
        "/api/v1/matches",
        json={"profile_id": "prof-arjun-001", "top_k": 5},
    )

    scheme_id = "scheme-bihar-postmatric-sc-002"
    res = client.get(f"/api/v1/profiles/prof-arjun-001/scores/{scheme_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["profile_id"] == "prof-arjun-001"
    assert data["scheme_id"] == scheme_id
    assert "rule_evaluations" in data["reasons"]
