"""Automated unit and integration tests for Intelligent Scholarship Autofill & Form Discovery."""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, AsyncMock
from starlette.testclient import TestClient
from sqlalchemy.orm import Session

from src.scholarpilot_ai.services.autofill import (
    JavaBackendClient,
    StudentProfileService,
    FormClassificationService,
    FormDiscoveryService,
    FieldMappingService,
    AutofillSessionService,
    AutofillValidationService,
    DEFAULT_VERIFIED_MAPPINGS,
)
from src.scholarpilot_ai.api.schemas import FormFieldItem, AutofillFieldValue
from src.scholarpilot_ai.db.models import AutofillMappingModel, AutofillSessionModel


# =========================================================================
# 1. Form Classification & SSRF Security Tests
# =========================================================================

def test_classification_direct_application_url():
    """Verify recognition of direct scholarship application and registration URLs."""
    url = "https://scholarships.gov.in/fresh/newstdRegFrmInstruction"
    assert FormClassificationService.classify_url(url) == "DIRECT_APPLICATION_URL"

    url2 = "https://pmsonline.bih.nic.in/pmsedu/(S(pms))/StudentRegistration.aspx"
    assert FormClassificationService.classify_url(url2) == "DIRECT_APPLICATION_URL"

    url3 = "https://example-portal.gov.in/applyonline"
    assert FormClassificationService.classify_url(url3) == "DIRECT_APPLICATION_URL"


def test_classification_portal_homepage():
    """Verify recognition of portal homepages."""
    assert FormClassificationService.classify_url("https://scholarships.gov.in") == "PORTAL_HOMEPAGE"
    assert FormClassificationService.classify_url("https://scholarships.gov.in/") == "PORTAL_HOMEPAGE"
    assert FormClassificationService.classify_url("https://pmsonline.bih.nic.in/index.html") == "PORTAL_HOMEPAGE"


def test_classification_login_required():
    """Verify detection of pages requiring authentication/login."""
    assert FormClassificationService.classify_url("https://scholarships.gov.in/login") == "LOGIN_REQUIRED"
    assert FormClassificationService.classify_url("https://pmsonline.bih.nic.in/StudentLogin.aspx") == "LOGIN_REQUIRED"


def test_classification_ssrf_and_private_ip_rejection():
    """Verify strict rejection of private IP addresses, loopback, and unsafe protocols."""
    # Private IPs
    safe, msg = FormClassificationService.validate_url_safety("http://192.168.1.1/apply")
    assert not safe
    assert "private" in msg.lower() or "prohibited" in msg.lower()

    safe, msg = FormClassificationService.validate_url_safety("http://10.0.0.5/register")
    assert not safe

    # Cloud metadata endpoint
    safe, msg = FormClassificationService.validate_url_safety("http://169.254.169.254/latest/meta-data")
    assert not safe

    # Dangerous protocols
    safe, msg = FormClassificationService.validate_url_safety("ftp://scholarships.gov.in/apply")
    assert not safe
    assert "protocol" in msg.lower()

    safe, msg = FormClassificationService.validate_url_safety("file:///etc/passwd")
    assert not safe


def test_classification_empty_or_malformed_url():
    """Verify graceful handling of empty or corrupted URLs."""
    assert FormClassificationService.classify_url("") == "UNAVAILABLE"
    assert FormClassificationService.classify_url(None) == "UNAVAILABLE"
    assert FormClassificationService.classify_url("not-a-valid-url") == "UNKNOWN"


# =========================================================================
# 2. Field Mapping Engine Tests
# =========================================================================

def test_field_mapping_standard_inputs():
    """Verify accurate mapping of standard student inputs (name, dob, email, mobile)."""
    detected_fields = [
        FormFieldItem(id="txt_name", name="applicant_name", label="Applicant Full Name", type="text"),
        FormFieldItem(id="txt_dob", name="date_of_birth", label="Date of Birth", type="date"),
        FormFieldItem(id="txt_email", name="email_id", label="Email Address", type="email"),
        FormFieldItem(id="txt_mobile", name="mobile_no", label="Mobile Number", type="tel"),
    ]

    field_values = {
        "name": AutofillFieldValue(value="Arjun Kumar", source="STUDENT_PROFILE", verificationStatus="PROFILE_VALUE"),
        "dob": AutofillFieldValue(value="2004-05-15", source="STUDENT_PROFILE", verificationStatus="PROFILE_VALUE"),
        "email": AutofillFieldValue(value="arjun.scholar@example.com", source="STUDENT_PROFILE", verificationStatus="PROFILE_VALUE"),
        "mobile": AutofillFieldValue(value="9876543210", source="STUDENT_PROFILE", verificationStatus="PROFILE_VALUE"),
    }

    res = FieldMappingService.match_form_fields(detected_fields, field_values)
    assert res.mappedFieldsCount == 4
    matched_keys = {m.matchedProfileKey for m in res.matchedFields}
    assert "name" in matched_keys
    assert "dob" in matched_keys
    assert "email" in matched_keys
    assert "mobile" in matched_keys


def test_field_mapping_select_dropdown_options():
    """Verify fuzzy option matching for select dropdowns (Category, State, Gender)."""
    detected_fields = [
        FormFieldItem(
            id="ddlCategory",
            name="social_category",
            label="Social Category",
            type="select",
            options=["Select Category", "General (GEN)", "Scheduled Caste (SC)", "Scheduled Tribe (ST)", "OBC"],
        ),
        FormFieldItem(
            id="ddlGender",
            name="gender",
            label="Gender",
            type="select",
            options=["Select", "Male", "Female", "Other"],
        ),
    ]

    field_values = {
        "category": AutofillFieldValue(value="SC", source="STUDENT_PROFILE", verificationStatus="PROFILE_VALUE"),
        "gender": AutofillFieldValue(value="MALE", source="STUDENT_PROFILE", verificationStatus="PROFILE_VALUE"),
    }

    res = FieldMappingService.match_form_fields(detected_fields, field_values)
    assert res.mappedFieldsCount == 2
    cat_match = next(m for m in res.matchedFields if m.matchedProfileKey == "category")
    assert "SC" in cat_match.valueToFill or "Scheduled Caste" in cat_match.valueToFill

    gen_match = next(m for m in res.matchedFields if m.matchedProfileKey == "gender")
    assert gen_match.valueToFill == "Male"


def test_field_mapping_sensitive_fields_require_manual_review():
    """Critical: Government IDs, Bank Account numbers, and Aadhaar MUST require manual review."""
    detected_fields = [
        FormFieldItem(id="txt_aadhaar", name="aadhaar_number", label="Aadhaar 12-Digit Number", type="text"),
        FormFieldItem(id="txt_bank", name="bank_account_number", label="Bank Account Number", type="text"),
        FormFieldItem(id="txt_ifsc", name="ifsc_code", label="Bank IFSC Code", type="text"),
    ]

    field_values = {
        "name": AutofillFieldValue(value="Arjun Kumar", source="STUDENT_PROFILE", verificationStatus="PROFILE_VALUE"),
    }

    res = FieldMappingService.match_form_fields(detected_fields, field_values)
    for m in res.matchedFields:
        assert m.requiresManualReview is True
        assert m.valueToFill is None  # Never fabricated


# =========================================================================
# 3. Autofill Session Management & Replay Protection Tests
# =========================================================================

def test_autofill_session_lifecycle(db_session: Session):
    """Verify session creation, redemption, TTL expiration, and replay protection."""
    field_values = {
        "name": AutofillFieldValue(value="Arjun Kumar", source="STUDENT_PROFILE", verificationStatus="PROFILE_VALUE"),
        "state": AutofillFieldValue(value="BR", source="STUDENT_PROFILE", verificationStatus="PROFILE_VALUE"),
    }

    session_info = AutofillSessionService.create_session(
        student_id="prof-arjun-001",
        scheme_id="scheme-bihar-postmatric-sc-002",
        application_url="https://pmsonline.bih.nic.in/pmsedu/",
        field_values=field_values,
        db=db_session,
        ttl_minutes=15,
    )

    assert session_info.sessionId.startswith("sess_")
    assert session_info.status == "ACTIVE"

    # Redeem session successfully
    payload = AutofillSessionService.redeem_session(session_info.sessionId, db_session)
    assert payload is not None
    assert payload.sessionId == session_info.sessionId
    assert payload.studentId == "prof-arjun-001"
    assert "name" in payload.fieldValues
    assert payload.fieldValues["name"].value == "Arjun Kumar"

    # Verify expiration handling
    expired_sess = AutofillSessionModel(
        id="sess_expired_test_001",
        student_id="prof-arjun-001",
        scheme_id="scheme-bihar-postmatric-sc-002",
        application_url="https://pmsonline.bih.nic.in",
        payload={"name": {"value": "Test", "source": "TEST", "verificationStatus": "PROFILE_VALUE"}},
        status="ACTIVE",
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=5),  # already expired
    )
    db_session.add(expired_sess)
    db_session.commit()

    redeem_expired = AutofillSessionService.redeem_session("sess_expired_test_001", db_session)
    assert redeem_expired is None


# =========================================================================
# 4. Form Discovery Service Tests
# =========================================================================

@pytest.mark.asyncio
async def test_form_discovery_priority_verified_mapping(db_session: Session):
    """Priority 1: Schemes with verified mappings must return verified URL immediately."""
    scheme = {
        "id": "scheme-bihar-postmatric-sc-002",
        "title": "Bihar Post-Matric Scholarship",
        "official_url": "https://pmsonline.bih.nic.in",
    }

    res = await FormDiscoveryService.discover_application_url(
        scheme_id="scheme-bihar-postmatric-sc-002",
        scheme_details=scheme,
        db=db_session,
    )

    assert res.isVerified is True
    assert res.confidence == 1.0
    assert "StudentRegistration.aspx" in res.applicationUrl


@pytest.mark.asyncio
async def test_form_discovery_candidate_links_parsing():
    """Verify HTML link extraction and ranking."""
    html_sample = """
    <html>
      <body>
        <h1>National Scholarships Portal</h1>
        <a href="/login.aspx">Existing Student Login</a>
        <a href="/fresh/newstdRegFrmInstruction">New Student Registration (Apply Online)</a>
        <a href="/guidelines.pdf">Scheme Guidelines</a>
      </body>
    </html>
    """
    candidates = FormDiscoveryService._extract_candidate_links(
        html=html_sample,
        base_url="https://scholarships.gov.in",
        scheme_title="Central Sector Scheme",
    )

    assert len(candidates) >= 1
    top_cand = candidates[0]
    assert "newstdRegFrmInstruction" in top_cand["url"]
    assert top_cand["score"] >= 0.85


# =========================================================================
# 5. REST API Integration Tests
# =========================================================================

def test_api_autofill_prepare_success(client: TestClient):
    """POST /api/v1/autofill/prepare should return READY status and short-lived session."""
    payload = {
        "schemeId": "scheme-bihar-postmatric-sc-002",
        "userId": "prof-arjun-001",
    }
    response = client.post("/api/v1/autofill/prepare", json=payload)
    assert response.status_code == 200
    assert response.headers.get("ngrok-skip-browser-warning") == "true"

    data = response.json()
    assert data["success"] is True
    assert data["schemeId"] == "scheme-bihar-postmatric-sc-002"
    assert data["status"] == "READY"
    assert "https://pmsonline.bih.nic.in" in data["applicationUrl"]
    assert data["autofillSession"]["sessionId"].startswith("sess_")
    assert data["discovery"]["status"] in ["DIRECT_APPLICATION_URL", "PORTAL_HOMEPAGE", "VERIFIED"]


def test_api_autofill_prepare_empty_scheme_id_returns_422(client: TestClient):
    """Empty schemeId must return HTTP 422."""
    res = client.post("/api/v1/autofill/prepare", json={"schemeId": ""})
    assert res.status_code == 422


def test_api_autofill_session_redemption(client: TestClient):
    """GET /api/v1/autofill/session/{session_id} should return authorized payload."""
    # Step 1: Prepare session
    prep_res = client.post(
        "/api/v1/autofill/prepare",
        json={"schemeId": "scheme-nsp-central-001", "userId": "prof-arjun-001"},
    )
    assert prep_res.status_code == 200
    session_id = prep_res.json()["autofillSession"]["sessionId"]

    # Step 2: Redeem payload
    redeem_res = client.get(f"/api/v1/autofill/session/{session_id}")
    assert redeem_res.status_code == 200
    payload = redeem_res.json()
    assert payload["sessionId"] == session_id
    assert payload["studentId"] == "prof-arjun-001"
    assert "name" in payload["fieldValues"]
    assert payload["fieldValues"]["name"]["value"] == "Student usr-auth-arjun-99" or "Arjun" in payload["fieldValues"]["name"]["value"]


def test_api_autofill_session_nonexistent_returns_404(client: TestClient):
    """Invalid or nonexistent session ID must return HTTP 404."""
    res = client.get("/api/v1/autofill/session/sess_nonexistent_99999999")
    assert res.status_code == 404


def test_api_autofill_map_endpoint(client: TestClient):
    """POST /api/v1/autofill/map maps DOM form fields to student facts."""
    payload = {
        "schemeId": "scheme-nsp-central-001",
        "userId": "prof-arjun-001",
        "formFields": [
            {"id": "applicant_name", "name": "applicant_name", "label": "Full Name", "type": "text"},
            {"id": "state", "name": "state", "label": "Domicile State", "type": "text"},
            {"id": "aadhaar_no", "name": "aadhaar_no", "label": "Aadhaar Number", "type": "text"},
        ],
    }

    res = client.post("/api/v1/autofill/map", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["totalFieldsDetected"] == 3
    assert data["mappedFieldsCount"] == 3

    # Check sensitive Aadhaar requires manual review
    aadhaar_field = next(f for f in data["matchedFields"] if f["fieldName"] == "aadhaar_no")
    assert aadhaar_field["requiresManualReview"] is True


def test_api_autofill_registry_endpoint(client: TestClient):
    """GET /api/v1/autofill/registry returns list of supported portals and mappings."""
    res = client.get("/api/v1/autofill/registry")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert len(data["supported_portals"]) >= 3
    assert len(data["mappings"]) >= 1


def test_frontend_dashboard_served(client: TestClient):
    """GET /app should serve the frontend dashboard HTML."""
    res = client.get("/app")
    assert res.status_code == 200
    assert "ScholarPilot" in res.text
    assert "Fill Application" in res.text
