# Qdrant Vector Search Architecture

## 1. Overview
Qdrant acts as the derived semantic retrieval layer for ScholarPilot. It enables exploratory semantic search across dense scholarship representations while keeping PostgreSQL as the authoritative single source of truth.

---

## 2. Collection Configuration

* **Collection Name:** `scholarships_v1`
* **Vector Dimension:** `384` (matching `BAAI/bge-small-en-v1.5` or multilingual MiniLM)
* **Distance Metric:** `Cosine`
* **Storage Engine:** Supports both Qdrant Cloud and local in-memory/disk mode.

---

## 3. Grounded Embedding Representation

### 3.1 Scheme Embedding Document
To ensure semantic embeddings capture all relevant eligibility and target student personas without fabricating information, each scheme is formatted into a dense structured document:

```text
Scholarship: {title}. 
Provider: {provider} ({scope} scope). 
Eligible States: {states}. 
Eligible Education Levels: {education_levels}. 
Eligible Courses: {courses}. 
Target Categories: {categories}. 
Income Criteria: Up to ₹{income} / No limit. 
Academic Criteria: Minimum {marks}% required / No cutoff. 
Award: ₹{award} financial aid. 
Required Documents: {required_documents}.
```

### 3.2 Student Profile Query
The student profile is mapped into a complementary semantic query:
```text
Scholarship recommendation request for student: 
State: {state}. Education Level: {education_level}. Course: {course}. 
Social Category: {category}. Income: ₹{income}. Academic Score: {marks}%. 
Status: {disability}, Gender: {gender}. 
Intent: Financial support, government schemes, tuition waiver, and higher education scholarships.
```

---

## 4. Idempotent Indexing Strategy

1. **Deterministic Point IDs:** Each point ID is generated using a deterministic UUID v5:
   ```python
   point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"scholarpilot:scheme:{scheme_id}"))
   ```
2. **Payload Preservation:** Points store rich filterable payloads:
   * `scheme_id`: Authoritative relational scheme ID
   * `title`, `provider`, `scope`
   * `eligible_states`, `education_levels`, `courses`, `category_rules`
   * `income_limit_inr`, `minimum_marks_percent`, `award_amount_inr`, `deadline`
   * `verification_status`
3. **Re-indexing:** Upserting points with identical point IDs overwrites existing vectors and payloads idempotently without duplicating records.

---

## 5. Candidate Retrieval & Normalization

* Retrieved raw cosine scores $\in [-1, 1]$ are normalized to similarity values $S_{\text{norm}} \in [0, 1]$:
  $$S_{\text{norm}} = \max\left(0.0, \min\left(1.0, \frac{\text{raw\_score} + 1.0}{2.0}\right)\right)$$
* Cosine similarity is passed directly into the ranking formula and **never** used as a proxy for eligibility.
