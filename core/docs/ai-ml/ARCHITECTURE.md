# ScholarPilot AI/ML Architecture

## 1. System Overview
The AI/ML service functions as an autonomous decision support engine within ScholarPilot. It operates downstream of TinyFish/Go portal extractors and upstream of the Spring Boot tracker and React user interface.

```
+-------------------------------------------------------------------------+
|                              ScholarPilot                               |
+-------------------------------------------------------------------------+
|                                                                         |
|  [React Frontend] <---> [Spring Boot Backend] <---> [PostgreSQL DB]     |
|          ^                         ^                        ^           |
|          |                         | (REST API)             | (Persist) |
|          v                         v                        v           |
|  +-------------------------------------------------------------------+  |
|  |                     AI/ML Recommendation Engine                   |  |
|  |                                                                   |  |
|  |  +-------------------+   +--------------------+   +-------------+ |  |
|  |  | FastEmbed (Local) |   | Qdrant Vector DB   |   | SQL Engine  | |  |
|  |  | ONNX BGE-Small    |-->| Collection         |---| Persistence | |  |
|  |  +-------------------+   | 'scholarships_v1'  |   | Score Table | |  |
|  |                          +--------------------+   +-------------+ |  |
|  |                                    |                              |  |
|  |                                    v                              |  |
|  |  +--------------------------------------------------------------+ |  |
|  |  |          Deterministic Eligibility Engine (Non-LLM)          | |  |
|  |  |               Tri-State: PASS | FAIL | UNKNOWN               | |  |
|  |  +--------------------------------------------------------------+ |  |
|  |                                    |                              |  |
|  |                                    v                              |  |
|  |  +--------------------------------------------------------------+ |  |
|  |  |                 Multi-Factor Transparent Ranker              | |  |
|  |  |    Final Score = (0.35*Sem + 0.25*Cov + 0.2*Awd + 0.2*Urg)*M | |  |
|  |  +--------------------------------------------------------------+ |  |
|  |                                    |                              |  |
|  |                                    v                              |  |
|  |  +--------------------------------------------------------------+ |  |
|  |  |          Grounded LLM Explainer + Deterministic Fallback     | |  |
|  |  +--------------------------------------------------------------+ |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## 2. Recommendation Flow Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student Profile
    participant API as FastAPI Gateway
    participant DB as Relational Database
    participant Embed as FastEmbed Pipeline
    participant Qdrant as Qdrant Vector DB
    participant Engine as Eligibility Engine
    participant Ranker as Multi-Factor Ranker
    participant Explainer as Grounded Explainer

    Student->>API: POST /api/v1/matches (profile_id)
    API->>DB: Fetch Profile(profile_id) & check consent
    API->>Embed: Embed student intent & profile attributes
    Embed-->>API: 384-d dense query vector
    API->>Qdrant: Search top-K nearest schemes
    Qdrant-->>API: Candidate scheme IDs + vector similarity
    API->>DB: Fetch authoritative Scheme records
    loop For each candidate scheme
        API->>Engine: Evaluate rules (income, state, category, marks, course)
        Engine-->>API: Tri-State Evaluation (PASS, FAIL, UNKNOWN)
        API->>Ranker: Score candidate (Formula 0-100)
        Ranker-->>API: Scored Candidate + Multiplier
    end
    API->>Ranker: Sort (ELIGIBLE -> NEEDS_REVIEW -> NOT_ELIGIBLE)
    loop For each ranked survivor
        API->>Explainer: Generate factual summary & evidence
        Explainer-->>API: Grounded explanation
        API->>DB: Atomic upsert into score table (UNIQUE profile_id, scheme_id)
    end
    API-->>Student: Return ranked recommendation response
```

---

## 3. Key Design Principles

1. **Semantic Similarity != Eligibility:** Cosine distance is used only as an exploratory retrieval filter. A 99% vector similarity will **never** override a failed mandatory eligibility rule.
2. **Deterministic Sovereignty:** The rule engine is written in pure Python. The LLM is never permitted to evaluate eligibility or alter scores.
3. **Graceful Degradation:** When the LLM is absent or times out, the deterministic explainer seamlessly synthesizes natural language copy from evaluated rule evidence.
4. **Zero Paid Resources:** Uses local CPU ONNX embeddings (`BAAI/bge-small-en-v1.5`) and free local/cloud Qdrant.
