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
