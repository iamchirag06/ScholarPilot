# AI/ML Module Handover Report

**Project:** ScholarPilot (HackIIITD 2026 / Esya'26)  
**Assigned Track:** AI/ML Lead Module (`aiml-llm` branch)  
**Date of Completion:** October 24, 2026  
**Status:** All 5 Sprints Completed, Verified, and Documented  

---

## 1. Summary of Completed Sprints

* **Sprint 1 (Discovery & Architecture Approval):**
  * Inspected repository structure, Git branches, environment variables, and local system services (PostgreSQL 17).
  * Validated live Qdrant cloud cluster connectivity.
  * Formulated transparent multi-factor ranking formula and tri-state deterministic eligibility rules.
* **Sprint 2 (Qdrant & Scheme Indexing):**
  * Installed `qdrant-client` and `fastembed` (ONNX Runtime, local CPU execution, zero cost).
  * Created versioned Qdrant collection `scholarships_v1` with 384-dimensional cosine distance.
  * Implemented deterministic point ID generation and idempotent re-indexing.
* **Sprint 3 (Eligibility & Recommendation Engine):**
  * Built `DeterministicEligibilityEngine` with pure Python `PASS`, `FAIL`, `UNKNOWN` evaluation across 8 criteria.
  * Implemented `RecommendationRanker` enforcing strict eligibility priority (`ELIGIBLE` $\rightarrow$ `NEEDS_REVIEW` $\rightarrow$ `NOT_ELIGIBLE`).
  * Built `ExplanationService` with structured Gemini integration and guaranteed deterministic factual fallback.
* **Sprint 4 (Persistence & REST API Integration):**
  * Defined SQLAlchemy declarative models for `schemes`, `profile`, and the new `score` table with `UNIQUE (profile_id, scheme_id)` constraint.
  * Implemented atomic upsert matching persistence to prevent duplicate rows across retries.
  * Developed FastAPI routes for `/health`, `/schemes/index`, `/matches`, and `/profiles/{profile_id}/scores`.
* **Sprint 5 (Strict Verification & Documentation):**
  * Built comprehensive automated test suite with 22 tests in `tests/`.
  * Verified 100% test pass rate (`22 passed in 18.10s`).
  * Created exhaustive technical documentation in `docs/ai-ml/`.

---

## 2. Inventory of Created Files

| File Path | Description |
| :--- | :--- |
| `src/scholarpilot_ai/__init__.py` | Package root metadata |
| `src/scholarpilot_ai/config.py` | Environment and settings management |
| `src/scholarpilot_ai/db/models.py` | SQLAlchemy schemas for schemes, profile, and score |
| `src/scholarpilot_ai/db/session.py` | Database engine, sessionmaker, and table initializer |
| `src/scholarpilot_ai/vector/embeddings.py` | Local FastEmbed ONNX embedding pipeline |
| `src/scholarpilot_ai/vector/qdrant_service.py` | Qdrant client, collection manager, and vector search |
| `src/scholarpilot_ai/engine/eligibility.py` | Deterministic tri-state eligibility engine |
| `src/scholarpilot_ai/engine/ranker.py` | Transparent multi-factor ranking formula |
| `src/scholarpilot_ai/engine/explanation.py` | Grounded explanation layer + deterministic fallback |
| `src/scholarpilot_ai/api/schemas.py` | Pydantic request and response contracts |
| `src/scholarpilot_ai/api/routes.py` | FastAPI route handlers |
| `src/scholarpilot_ai/api/app.py` | FastAPI application factory and startup lifecycle |
| `src/scholarpilot_ai/data/seed_schemes.py` | Benchmark Indian scholarship dataset |
| `src/scholarpilot_ai/data/seed_profiles.py` | Synthetic student personas for testing |
| `tests/conftest.py` | Isolated pytest fixtures (SQLite in-memory, Qdrant in-memory) |
| `tests/test_eligibility.py` | Boundary and rule evaluation unit tests |
| `tests/test_ranking.py` | Ranking formula and consistency unit tests |
| `tests/test_qdrant_indexing.py` | Qdrant indexing and retrieval unit tests |
| `tests/test_explanation.py` | Explanation fidelity and fallback unit tests |
| `tests/test_api.py` | End-to-end integration and API tests |
| `docs/ai-ml/README.md` | Quickstart and run instructions |
| `docs/ai-ml/ARCHITECTURE.md` | System design and sequence diagrams |
| `docs/ai-ml/DATABASE.md` | Schema definitions and migration DDL |
| `docs/ai-ml/QDRANT.md` | Vector database configuration and payload specs |
| `docs/ai-ml/ELIGIBILITY_AND_RANKING.md`| Eligibility rules and mathematical scoring formula |
| `docs/ai-ml/API.md` | Full OpenAPI route specifications |
| `docs/ai-ml/TESTING.md` | Executed test run log and coverage matrix |
| `docs/ai-ml/HANDOVER.md` | This handover report |
| `requirements.txt` | Pinned Python dependencies |
| `.env.example` | Documented environment variable template |

---

## 3. Verification & Compliance
* **Free Resource Policy:** Compliant. Zero paid API keys, zero paid hosting. Runs completely free on local CPU via ONNX and free Qdrant.
* **Deterministic Fallback:** Tested and confirmed. System operates without error even if LLM keys are completely absent.
* **Idempotency:** Tested and confirmed. Multiple matching runs for the same student update existing records rather than producing duplicates.
* **No Broken Conventions:** Java (`java-backend`) and Go (`go-backend`) branches left untouched.

---

## 4. Next Steps for Cross-Team Integration
1. **Spring Boot (Chirag):** Connect tracker and profile endpoints to `POST http://localhost:8001/api/v1/matches` and `GET http://localhost:8001/api/v1/profiles/{id}/scores`.
2. **Go Orchestrator (Bharat):** Post extracted TinyFish JSON schemas directly to `POST http://localhost:8001/api/v1/schemes/index`.
3. **Frontend (Abhishek):** Render returned `criteria_satisfied`, `criteria_failed`, `unknown_or_unverified`, and `match_score` into the dashboard recommendation cards.
