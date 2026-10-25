"""Automated unit and integration tests for LangChain scholarship chatbot endpoint and streaming responses."""

from unittest.mock import patch
import pytest
from starlette.testclient import TestClient
from src.scholarpilot_ai.services.chatbot import ScholarshipChatbotService


def test_chat_missing_userid_returns_422(client: TestClient):
    """Chat request without userid must return HTTP 422."""
    res = client.post("/api/chat", json={"message": "Which scholarship has the highest award?"})
    assert res.status_code == 422
    assert "userId" in str(res.json()["detail"])


def test_chat_empty_message_returns_422(client: TestClient):
    """Chat request without message or with empty message must return HTTP 422."""
    res = client.post("/api/chat", json={"userId": "prof-arjun-001", "message": ""})
    assert res.status_code == 422
    assert "message" in str(res.json()["detail"]).lower()


def test_chat_userid_and_message_only_success(client: TestClient):
    """User sends 'userid' and 'message' ONLY: must return HTTP 200 streaming response."""
    payload = {
        "userid": "prof-arjun-001",
        "message": "Which scholarship has the highest award?",
    }
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    assert response.headers.get("ngrok-skip-browser-warning") == "true"
    content = response.text
    assert len(content) > 30
    assert "scholarship" in content.lower() or "award" in content.lower()


def test_chat_userId_camel_case_success(client: TestClient):
    """Endpoint also cleanly accepts camelCase 'userId' and 'message' only."""
    payload = {
        "userId": "prof-arjun-001",
        "message": "What documents do I need to submit?",
    }
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    assert response.headers.get("ngrok-skip-browser-warning") == "true"
    content = response.text
    assert len(content) > 20
    assert "document" in content.lower() or "certificate" in content.lower()


def test_chat_text_streaming_format(client: TestClient):
    """Response must stream text/plain content."""
    payload = {
        "userId": "prof-arjun-001",
        "message": "What are my deadlines?",
    }
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    assert "text/plain" in response.headers.get("content-type", "")
    assert len(response.text) > 10


def test_chat_v1_and_chatbot_aliases(client: TestClient):
    """Aliases /api/v1/chat, /api/chatbot, and /api/v1/chatbot must function identically with userid and message."""
    for endpoint in ["/api/v1/chat", "/api/chatbot", "/api/v1/chatbot"]:
        res = client.post(endpoint, json={"userid": "prof-arjun-001", "message": "Hello, can you help me find scholarships?"})
        assert res.status_code == 200
        assert len(res.text) > 10


@pytest.mark.asyncio
async def test_fetch_profile_and_schemes_fallback_to_local(db_session):
    """When remote backend is unreachable, service gracefully falls back to local database / seed records."""
    prof = await ScholarshipChatbotService.fetch_user_profile("prof-arjun-001", db=db_session)
    assert prof is not None
    assert prof.get("id") == "prof-arjun-001"

    schemes = await ScholarshipChatbotService.fetch_matched_schemes("prof-arjun-001", db=db_session)
    assert isinstance(schemes, list)
    assert len(schemes) > 0


@patch("src.scholarpilot_ai.services.chatbot.httpx.AsyncClient.get")
@pytest.mark.asyncio
async def test_fetch_from_remote_backend_success(mock_get):
    """When remote Spring Boot backend responds, fetch functions return remote JSON data."""
    class MockResponse:
        status_code = 200
        def json(self):
            return {
                "id": "prof-remote-999",
                "name": "Remote Student",
                "state": "DL",
                "category": "GEN",
            }

    mock_get.return_value = MockResponse()

    prof = await ScholarshipChatbotService.fetch_user_profile("prof-remote-999")
    assert prof is not None
    assert prof["id"] == "prof-remote-999"
    assert prof["name"] == "Remote Student"
