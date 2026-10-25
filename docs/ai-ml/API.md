# REST API Specification

Base URL: `http://localhost:8000` (or gateway path `/api/v1`)

---

## 1. System Health

### `GET /health` / `GET /ready`
Verifies readiness of the database, Qdrant cluster, and local embedding models.

#### Response `200 OK`
```json
{
  "status": "healthy",
  "service": "ScholarPilot AI/ML Recommendation Engine",
  "version": "1.0.0",
  "database_connected": true,
  "qdrant_connected": true,
  "embedding_model_loaded": true
}
```

---

## 2. Scholarship Scheme Indexing

### `POST /api/v1/schemes/index`
Idempotently indexes scholarship schemes into the Qdrant vector database.

#### Request Body (Optional - if empty, indexes all existing DB schemes)
```json
{
  "schemes": [
    {
      "id": "scheme-demo-001",
      "title": "Central Sector Scheme for College Students",
      "provider": "Ministry of Education",
      "scope": "CENTRAL",
      "eligible_states": [],
      "education_levels": ["UG"],
      "courses": ["BTECH"],
      "category_rules": ["SC", "ST", "OBC", "GEN"],
      "income_limit_inr": 450000,
      "minimum_marks_percent": 80.0,
      "award_amount_inr": 20000,
      "deadline": "2026-12-31",
      "required_documents": ["income_certificate", "class_12_marksheet"],
      "official_url": "https://scholarships.gov.in",
      "verification_status": "VERIFIED",
      "unknown_fields": []
    }
  ]
}
```

#### Response `200 OK`
```json
{
  "indexed_count": 6,
  "collection_name": "scholarships_v1",
  "status": "success"
}
```

---

## 3. Student Profile Matching

### `POST /api/v1/matches`
Generates personalized recommendations, evaluates deterministic eligibility, computes transparent scores, and persists results atomically into the `score` table.

#### Request Body
```json
{
  "profile_id": "prof-arjun-001",
  "top_k": 10,
  "include_not_eligible": false,
  "refresh": false
}
```

#### Response `200 OK`
```json
{
  "profile_id": "prof-arjun-001",
  "total_candidates": 2,
  "eligible_count": 2,
  "needs_review_count": 0,
  "recommendations": [
    {
      "scheme_id": "scheme-bihar-postmatric-sc-002",
      "title": "Bihar Post-Matric Scholarship for SC/ST Students",
      "provider": "SC & ST Welfare Department, Govt of Bihar",
      "match_score": 83.25,
      "eligibility_status": "ELIGIBLE",
      "summary": "You are verified as ELIGIBLE for 'Bihar Post-Matric Scholarship for SC/ST Students'...",
      "why_relevant": "Directly matches your profile for BTECH in BR with a high compatibility score of 83.3/100.",
      "criteria_satisfied": [
        "Family income of ₹180,000 is within the required ceiling of ₹300,000.",
        "Education level 'UG' matches scheme requirements.",
        "Course 'BTECH' matches eligible courses.",
        "Social category 'SC' matches scheme criteria.",
        "State 'BR' is eligible for this scheme.",
        "Academic score of 78.0% meets the minimum requirement of 50.0%."
      ],
      "criteria_failed": [],
      "unknown_or_unverified": [],
      "award_summary": "₹35,000 financial grant per academic year",
      "required_documents": [
        "caste_certificate",
        "income_certificate",
        "residential_certificate_bihar",
        "fee_receipt",
        "bonafide_certificate"
      ],
      "deadline": "2026-11-30",
      "official_url": "https://pmsonline.bih.nic.in",
      "verification_status": "VERIFIED"
    }
  ]
}
```

---

## 4. Persisted Score Retrieval

### `GET /api/v1/profiles/{profile_id}/scores`
Retrieves persisted matching score records from the `score` table with pagination.

* **Query Parameters:**
  * `status`: `ELIGIBLE`, `NEEDS_REVIEW`, `NOT_ELIGIBLE`, or `ALL` (default: `ALL`)
  * `limit`: Integer (1-100, default: 20)
  * `offset`: Integer (default: 0)

### `GET /api/v1/profiles/{profile_id}/scores/{scheme_id}`
Retrieves detailed breakdown of a single persisted score record including complete rule evaluation breakdown and scores breakdown.

---

## 5. Scholarship Eligibility Summarization (Chirag's Spring Boot Integration)

### `POST /api/summarize` (Alias: `POST /api/v1/summarize`)
Processes messy crawled scholarship text, defends against prompt injection, detects data quality/truncation, and returns an eligibility summary in clear, simple English.

#### Request Body
```json
{
  "raw_text": "Pragati Scholarship Scheme for Girl Students pursuing Technical Degree (B.Tech). Family income ceiling is Rs. 8,00,000 per annum. Applicants must have secured admission into a degree program. Documents needed: income certificate, 10th marksheet, admission letter. Last date to apply is 2026-12-15."
}
```

#### Minimum Response Contract (Java Deserialization)
```json
{
  "summary": "Eligibility Summary: This scholarship supports UG students belonging to Female categories.\n\nKey Eligibility Requirements:\n• Family Income: Rs. 8,00,000 per annum.\n• Category / Social Group: Female.\n• Eligible Courses / Levels: UG.\n• Academic Requirement: Not specified in provided excerpt.\n• Application Deadline: 2026-12-15.\n• Required Documents: Income Certificate, Marksheet.\n",
  "confidence_score": 0.85,
  "warnings": [
    "No academic marks requirement specified in source text."
  ],
  "extracted_facts": {
    "income_limit": "Rs. 8,00,000 per annum",
    "categories": ["Female"],
    "education_levels": ["UG"],
    "courses": [],
    "minimum_marks": null,
    "deadline": "2026-12-15",
    "required_documents": ["income_certificate", "marksheet"],
    "domicile_state": null
  },
  "is_fallback": true,
  "provider": "deterministic-fallback"
}
```

---

## 6. Deterministic Scholarship Ranking (Chirag's Spring Boot Integration)

### `POST /api/rank` (Alias: `POST /api/v1/rank`)
Ranks candidates that have already survived Java's hard-rule eligibility engine using the transparent formula:
$$\text{rank\_score} = (\text{award\_amount\_score} \times 0.5) + (\text{eligibility\_score} \times 0.5)$$

Accepts either a **JSON Array** `[...]` or an **Object Wrapper** `{"candidates": [...]}`.

#### Request Body (JSON Array)
```json
[
  {
    "id": "scheme-high",
    "scheme_name": "National Excellence Fellowship",
    "provider": "Ministry of Science & Technology",
    "award_amount": 180000.0,
    "deadline": "2026-12-31",
    "apply_link": "https://scholarships.gov.in/fellowship",
    "required_documents": ["transcript", "income_cert"],
    "confidence_score": 0.95,
    "eligibility_score": 0.90
  },
  {
    "id": "scheme-mid",
    "scheme_name": "State Merit Support",
    "provider": "Higher Education Dept",
    "award_amount": 40000.0,
    "deadline": "2026-11-15",
    "required_documents": ["marksheet"],
    "confidence_score": 0.85,
    "eligibility_score": 0.80
  }
]
```

#### Response `200 OK` (JSON Array)
```json
[
  {
    "id": "scheme-high",
    "scheme_name": "National Excellence Fellowship",
    "provider": "Ministry of Science & Technology",
    "award_amount": 180000.0,
    "deadline": "2026-12-31",
    "apply_link": "https://scholarships.gov.in/fellowship",
    "raw_eligibility_text": null,
    "llm_summary": null,
    "required_documents": ["transcript", "income_cert"],
    "confidence_score": 0.95,
    "eligibility_score": 0.9,
    "rank": 1,
    "rank_score": 0.9458,
    "score_explanation": {
      "award_amount_score": 0.9916,
      "eligibility_score": 0.9,
      "formula": "rank_score = (award_amount_score * 0.5) + (eligibility_score * 0.5)",
      "summary": "Award benefit: ₹180,000 (award score: 0.9916); Eligibility fit: 0.9000; Combined rank_score: 0.9458."
    },
    "disclaimer": "High ranking does not guarantee scholarship approval. Ranking score reflects relative financial and eligibility fit among hard-rule survivors."
  },
  {
    "id": "scheme-mid",
    "scheme_name": "State Merit Support",
    "provider": "Higher Education Dept",
    "award_amount": 40000.0,
    "deadline": "2026-11-15",
    "apply_link": null,
    "raw_eligibility_text": null,
    "llm_summary": null,
    "required_documents": ["marksheet"],
    "confidence_score": 0.85,
    "eligibility_score": 0.8,
    "rank": 2,
    "rank_score": 0.8354,
    "score_explanation": {
      "award_amount_score": 0.8708,
      "eligibility_score": 0.8,
      "formula": "rank_score = (award_amount_score * 0.5) + (eligibility_score * 0.5)",
      "summary": "Award benefit: ₹40,000 (award score: 0.8708); Eligibility fit: 0.8000; Combined rank_score: 0.8354."
    },
    "disclaimer": "High ranking does not guarantee scholarship approval. Ranking score reflects relative financial and eligibility fit among hard-rule survivors."
  }
]
```

---

## 7. Contextual Scholarship Chatbot Assistant (Streaming)

### `POST /api/chat` (Aliases: `POST /api/v1/chat`, `POST /api/chatbot`, `POST /api/v1/chatbot`)
Streams answers to user queries grounded in real-time context fetched from:
1. Student Profile: `{BACKEND_URL}/api/profiles/{userid}`
2. Matched Schemes: `{BACKEND_URL}/api/schemes/matched/{userid}`

Includes automatic multi-model fallback (Groq / Gemini) and local database fallback if the remote backend is offline, and returns `ngrok-skip-browser-warning: true` in response headers.

#### Request Body (Frontend sends `userId` and `message` only)
```json
{
  "userId": "prof-arjun-001",
  "message": "Which scholarship offers the highest financial award and what documents do I need to prepare?"
}
```
*(Also cleanly accepts `userid` in lowercase, and aliases `user_id` / `profileId` / `profile_id`).*

#### Response `200 OK` (Streamed Content)
```text
Hello Arjun! Based on your profile and your 2 matched scholarships:

1. **Top Financial Award**: The **Bihar Post-Matric Scholarship for SC/ST Students** offers the highest grant of **₹35,000 per academic year**.

2. **Required Documents**:
   • Caste Certificate (SC/ST verification)
   • Income Certificate (verifying annual income under ₹3,00,000)
   • Residential / Domicile Certificate (Bihar)
   • College Bonafide Certificate & Fee Receipt

The application closing date is **2026-11-30**. Let me know if you would like step-by-step application guidance!
```
*(Response Headers include: `Content-Type: text/plain; charset=utf-8`, `Cache-Control: no-cache`, `ngrok-skip-browser-warning: true`).*

---

## 8. Intelligent Scholarship Form Discovery & Autofill Workflow

### `POST /api/v1/autofill/prepare` (Alias: `POST /api/autofill/prepare`)
Initiates scholarship autofill session, checks student eligibility, reuses verified portal mappings or performs bounded form discovery, and issues a cryptographically secure, short-lived session reference for the Chrome Extension.

#### Request Headers
* `X-User-Id`: Authenticated student ID (e.g. `prof-arjun-001`)
* `Authorization`: Optional Bearer token from Java backend

#### Request Body
```json
{
  "schemeId": "scheme-bihar-postmatric-sc-002",
  "userId": "prof-arjun-001"
}
```

#### Response `200 OK`
```json
{
  "success": true,
  "schemeId": "scheme-bihar-postmatric-sc-002",
  "schemeTitle": "Bihar Post-Matric Scholarship for SC/ST Students",
  "status": "READY",
  "applicationUrl": "https://pmsonline.bih.nic.in/pmsedu/(S(pms))/StudentRegistration.aspx",
  "autofillSession": {
    "sessionId": "sess_8c5f6e80b87c47d7920ab48596f9e218",
    "expiresAt": "2026-10-24T18:50:00Z",
    "status": "ACTIVE"
  },
  "discovery": {
    "status": "DIRECT_APPLICATION_URL",
    "classification": "DIRECT_APPLICATION_URL",
    "requiresUserNavigation": false,
    "discoveredCandidates": []
  },
  "validation": {
    "missingFields": [],
    "requiresManualReview": [
      "aadhaar_number",
      "bank_account_number",
      "ifsc_code",
      "income_certificate_number",
      "caste_certificate_number"
    ],
    "unsupportedFields": ["captcha", "aadhaar_otp", "biometric"],
    "passedRules": [
      "rule_annual_family_income",
      "rule_eligible_states",
      "rule_education_levels",
      "rule_courses",
      "rule_category",
      "rule_minimum_marks"
    ],
    "failedRules": []
  },
  "instructions": "ScholarPilot Extension is ready to autofill verified fields on the official portal."
}
```

---

### `GET /api/v1/autofill/session/{session_id}` (Alias: `GET /api/autofill/session/{session_id}`)
Redeems authorized autofill session payload for the Chrome Extension. Enforces single-use / replay limits and TTL expiration.

#### Response `200 OK`
```json
{
  "sessionId": "sess_8c5f6e80b87c47d7920ab48596f9e218",
  "schemeId": "scheme-bihar-postmatric-sc-002",
  "schemeName": "Bihar Post-Matric Scholarship for SC/ST Students",
  "studentId": "prof-arjun-001",
  "applicationUrl": "https://pmsonline.bih.nic.in/pmsedu/(S(pms))/StudentRegistration.aspx",
  "fieldValues": {
    "name": {
      "value": "Arjun Kumar",
      "source": "STUDENT_PROFILE",
      "verificationStatus": "PROFILE_VALUE"
    },
    "state": {
      "value": "BR",
      "source": "STUDENT_PROFILE",
      "verificationStatus": "PROFILE_VALUE"
    },
    "category": {
      "value": "SC",
      "source": "STUDENT_PROFILE",
      "verificationStatus": "PROFILE_VALUE"
    },
    "course": {
      "value": "BTECH",
      "source": "STUDENT_PROFILE",
      "verificationStatus": "PROFILE_VALUE"
    }
  },
  "missingFields": [],
  "manualReviewFields": ["aadhaar_number", "bank_account_number"],
  "unsupportedFields": ["captcha", "otp"],
  "expiresAt": "2026-10-24T18:50:00Z",
  "instructions": "Review pre-filled fields carefully. Enter any missing official document numbers manually before submission."
}
```

---

### `POST /api/v1/autofill/map` (Alias: `POST /api/autofill/map`)
Analyzes raw DOM fields detected by the Chrome Extension and matches them with authorized profile facts.

#### Request Body
```json
{
  "schemeId": "scheme-nsp-central-001",
  "userId": "prof-arjun-001",
  "formFields": [
    {"id": "applicant_name", "name": "applicant_name", "label": "Full Name", "type": "text"},
    {"id": "state", "name": "state", "label": "Domicile State", "type": "text"},
    {"id": "aadhaar_no", "name": "aadhaar_no", "label": "Aadhaar Number", "type": "text"}
  ]
}
```

#### Response `200 OK`
```json
{
  "schemeId": "scheme-nsp-central-001",
  "matchedFields": [
    {
      "fieldId": "applicant_name",
      "fieldName": "applicant_name",
      "label": "Full Name",
      "matchedProfileKey": "name",
      "valueToFill": "Arjun Kumar",
      "confidence": 0.95,
      "requiresManualReview": false,
      "reason": "Matched to profile fact 'name'."
    },
    {
      "fieldId": "state",
      "fieldName": "state",
      "label": "Domicile State",
      "matchedProfileKey": "state",
      "valueToFill": "BR",
      "confidence": 0.95,
      "requiresManualReview": false,
      "reason": "Matched to profile fact 'state'."
    },
    {
      "fieldId": "aadhaar_no",
      "fieldName": "aadhaar_no",
      "label": "Aadhaar Number",
      "matchedProfileKey": null,
      "valueToFill": null,
      "confidence": 0.0,
      "requiresManualReview": true,
      "reason": "Government identity or banking field. Must be entered manually."
    }
  ],
  "unmatchedFields": [],
  "missingRequiredFields": [],
  "totalFieldsDetected": 3,
  "mappedFieldsCount": 3
}
```

---

### `GET /api/v1/autofill/registry`
Lists supported official scholarship portals, domain allowlists, and pre-verified application routes.

