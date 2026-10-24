# ScholarPilot AI/ML Recommendation Service

Welcome to the **ScholarPilot AI/ML Recommendation Engine**. This service powers personalized, trustworthy scholarship discovery for Indian students across national portals (NSP), state welfare departments, and private foundations.

---

## 1. Quick Start

### 1.1 Prerequisites
* Python 3.10+ (tested on Python 3.12)
* Local environment or virtual environment (`.venv`)
* No paid APIs required — 100% free and open-source

### 1.2 Installation
```bash
# Clone and navigate to repository
git checkout aiml-llm

# Install dependencies
pip install -r requirements.txt
```

### 1.3 Environment Setup
Copy the environment template:
```bash
cp .env.example .env
```
Ensure your `.env` contains:
```env
DATABASE_URL=sqlite:///./scholarpilot.db
QDRANT_ENDPOINT=https://your-cluster-id.eu-west-2-0.aws.cloud.qdrant.io
QDRANT_API_KEY=your_key_here
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
QDRANT_COLLECTION_NAME=scholarships_v1
API_HOST=0.0.0.0
API_PORT=8001
```
*(For offline or CI testing, you can omit `QDRANT_ENDPOINT` to automatically use local in-memory Qdrant).*

---

## 2. Running the Service

### 2.1 Start Development Server
```bash
uvicorn src.scholarpilot_ai.api.app:app --host 0.0.0.0 --port 8001 --reload
```
Interactive Swagger API documentation will be available at:
`http://localhost:8001/docs`

### 2.2 Ingest & Index Schemes
```bash
curl -X POST http://localhost:8001/api/v1/schemes/index -H "Content-Type: application/json" -d "{}"
```

### 2.3 Match a Student Profile
```bash
curl -X POST http://localhost:8001/api/v1/matches \
  -H "Content-Type: application/json" \
  -d '{"profile_id": "prof-arjun-001", "top_k": 10}'
```

---

## 3. Running Automated Tests
Execute the full pytest suite:
```bash
python -m pytest -v
```
All 22 unit, integration, and API tests will execute in isolated in-memory environments.
