# ScholarPilot

> Every eligible student. Every scheme. One click.  
> Scholarship & Govt Scheme Finder + Auto-Filler (HackIIITD 2026 / Esya'26)

---

## AI/ML Recommendation Service (`aiml-llm` branch)

The ScholarPilot AI/ML Recommendation Engine is implemented in Python with semantic vector search, deterministic eligibility rules, transparent ranking, and grounded explanations.

### Features
* **Semantic Retrieval:** Qdrant vector search using free local ONNX embeddings (`BAAI/bge-small-en-v1.5`).
* **Deterministic Eligibility Engine:** Pure Python tri-state evaluation (`PASS`, `FAIL`, `UNKNOWN`) across income, state, category, course, education level, and marks. Semantic similarity never overrides eligibility cutoffs.
* **Transparent Multi-Factor Ranking:** Computes auditable scores from 0–100 combining semantic fit, rule coverage, award amount, and deadline urgency.
* **Grounded Explanations:** Fact-grounded summaries with guaranteed deterministic fallback (zero hallucinations, zero downtime when LLM is unavailable).
* **Atomic Persistence:** Persists matching results into the `score` table with idempotency guarantees (`UNIQUE (profile_id, scheme_id)`).
* **REST API:** FastAPI service exposing `/health`, `/schemes/index`, `/matches`, and `/profiles/{id}/scores`.

---

## Documentation
* [AI/ML Setup & Run Guide](docs/ai-ml/README.md)
* [System Architecture & Data Flow](docs/ai-ml/ARCHITECTURE.md)
* [Database Schema & Migrations](docs/ai-ml/DATABASE.md)
* [Qdrant Vector Search Specification](docs/ai-ml/QDRANT.md)
* [Eligibility Rules & Ranking Formula](docs/ai-ml/ELIGIBILITY_AND_RANKING.md)
* [REST API Specification](docs/ai-ml/API.md)
* [Test Suite & Execution Evidence](docs/ai-ml/TESTING.md)
* [Handover Report](docs/ai-ml/HANDOVER.md)

---

## Quick Run
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run test suite
python -m pytest -v

# 3. Start API server
uvicorn src.scholarpilot_ai.api.app:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation: `http://localhost:8001/docs`
