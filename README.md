# ScholarPilot

ScholarPilot is an end-to-end, artificial intelligence-powered scholarship discovery, semantic matching, and automated ingestion ecosystem designed for Indian students.

The platform is designed as a distributed, polyglot microservice system where each language and runtime is matched to its core competency:

- **TypeScript / React 19** for the student user experience and responsive dashboard.
- **Java 21 / Spring Boot 3** as the central orchestrator, API gateway, and transactional system of record.
- **Go 1.26 / Redis** for asynchronous job queueing, high-concurrency web crawling, and automated extraction.
- **Python 3.11 / FastAPI** for natural language processing, text summarization, and vector-based semantic ranking.

---

## Table of Contents

- [Polyglot System Architecture](#polyglot-system-architecture)
  - [Service Roles and Technology Stack](#service-roles-and-technology-stack)
  - [Inter-Service Communication Matrix](#inter-service-communication-matrix)
  - [Architecture and Data Flow Diagram](#architecture-and-data-flow-diagram)
- [End-to-End Operational Workflows](#end-to-end-operational-workflows)
  - [Workflow 1: Portal Crawling, Ingestion, and AI Summarization](#workflow-1-portal-crawling-ingestion-and-ai-summarization)
  - [Workflow 2: Student Profiling, Hard-Filtering, and AI Ranking](#workflow-2-student-profiling-hard-filtering-and-ai-ranking)
- [Redis Queue Architecture in the Go Engine](#redis-queue-architecture-in-the-go-engine)
  - [Queue Topology and Key Conventions](#queue-topology-and-key-conventions)
  - [Producer Flow: Atomic Job Ingestion](#producer-flow-atomic-job-ingestion)
  - [Consumer Flow: Blocking Dequeue Loop](#consumer-flow-blocking-dequeue-loop)
  - [State Machine and Progress Telemetry](#state-machine-and-progress-telemetry)
  - [Result Storage and Webhook Dispatch](#result-storage-and-webhook-dispatch)
- [Subsystem Roles and Responsibilities](#subsystem-roles-and-responsibilities)
  - [1. Frontend Web Client (React 19)](#1-frontend-web-client-react-19)
  - [2. Central Orchestrator & Backend (Java Spring Boot 3)](#2-central-orchestrator--backend-java-spring-boot-3)
  - [3. Crawling & Extraction Microservice (Go 1.26)](#3-crawling--extraction-microservice-go-126)
  - [4. AI/ML Summarization & Ranking Engine (Python FastAPI)](#4-aiml-summarization--ranking-engine-python-fastapi)
- [API Contracts and Data Models](#api-contracts-and-data-models)
  - [Frontend to Java Gateway Endpoints](#frontend-to-java-gateway-endpoints)
  - [Java to Go Crawling Endpoints](#java-to-go-crawling-endpoints)
  - [Go to Java Webhook Contract](#go-to-java-webhook-contract)
  - [Java to Python AI Endpoints](#java-to-python-ai-endpoints)
  - [Data Schemas](#data-schemas)
- [Environment Configuration](#environment-configuration)
  - [Frontend Environment](#frontend-environment)
  - [Java Backend Environment](#java-backend-environment)
  - [Go Scraping Service Environment](#go-scraping-service-environment)
  - [Python AI Service Environment](#python-ai-service-environment)
- [Installation and Execution Guide](#installation-and-execution-guide)
  - [Prerequisites](#prerequisites)
  - [Starting the Core Java Backend](#starting-the-core-java-backend)
  - [Starting the Go Scraping Engine](#starting-the-go-scraping-engine)
  - [Starting the Python AI Service](#starting-the-python-ai-service)
  - [Starting the Frontend Application](#starting-the-frontend-application)
- [Security, Privacy, and Data Governance](#security-privacy-and-data-governance)

---

## Polyglot System Architecture

ScholarPilot operates as a decoupled polyglot architecture where services communicate over HTTP REST contracts and in-memory Redis message queues.

The Java Spring Boot backend functions as the **central API gateway and coordinator** for the client application. The frontend communicates exclusively with the Java backend, while the Java backend delegates asynchronous scraping workloads to Go and heavy NLP/vector operations to Python.

### Service Roles and Technology Stack

| Service Name            | Language & Runtime    | Framework / Tools                                     | Primary Role and Responsibility                                                                                                         |
| ----------------------- | --------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend Client**     | TypeScript / Node 18+ | React 19, Vite, Tailwind CSS, Motion                  | Single-page student dashboard, multi-step profile builder, real-time crawling progress bar, and opportunity catalog.                    |
| **Central Backend**     | Java 21               | Spring Boot 3, Spring Data JPA, Hibernate, PostgreSQL | Central API Gateway, authentication provider, student profile storage, deterministic hard-rule matcher, and inter-service orchestrator. |
| **Scraping Engine**     | Go 1.26+              | Gorilla Mux, go-redis v9, TinyFish AI API             | Asynchronous batch crawling engine, non-blocking Redis task queue, worker goroutines, adaptive JSON parsing, and retry backoff.         |
| **AI/ML Engine**        | Python 3.11+          | FastAPI, Qdrant, FastEmbed, Uvicorn                   | Natural language summarization of complex eligibility text and semantic vector-space ranking.                                           |
| **In-Memory Store**     | C / In-Memory         | Redis 6+                                              | Asynchronous job queue (`LPUSH`/`BRPOP`), crawling percentage telemetry, and extraction result caching.                                 |
| **Relational Database** | SQL                   | PostgreSQL 14+ / H2                                   | Authoritative persistence for users, profiles, normalized scholarship schemes, and application records.                                 |

---

### Inter-Service Communication Matrix

The table below defines every communication channel in ScholarPilot, specifying caller, callee, protocol, and payload semantics:

| Source (Caller)       | Destination (Callee)  | Protocol / Method | Endpoint / Channel                               | Data Exchanged & Purpose                                                            |
| --------------------- | --------------------- | ----------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| **Frontend (React)**  | **Java Backend**      | HTTP POST         | `/api/auth/signup`, `/api/auth/login`            | Student credentials. Returns authentication token and user ID.                      |
| **Frontend (React)**  | **Java Backend**      | HTTP POST / PUT   | `/api/profiles/create`, `/api/profiles/{id}`     | Student educational tier, marks, caste category, domicile state, and income.        |
| **Frontend (React)**  | **Java Backend**      | HTTP GET          | `/api/schemes/matched/{userId}`                  | Requests personalized scholarships. Triggers Java hard-filter and Python ranking.   |
| **Frontend (React)**  | **Java Backend**      | HTTP POST         | `/api/crawl/start`                               | Submits portal URLs to crawl. Java proxies this to Go.                              |
| **Frontend (React)**  | **Java Backend**      | HTTP GET          | `/api/crawl/status/{jobId}`                      | Polls crawling progress (0-100%). Java proxies query to Go.                         |
| **Java Backend**      | **Go Microservice**   | HTTP POST         | `/api/crawl`                                     | Forwards batch URLs and extraction goal from Java to Go. Returns `job_id`.          |
| **Java Backend**      | **Go Microservice**   | HTTP GET          | `/api/crawl/status/{jobId}`                      | Queries live percentage progress and execution status from Go.                      |
| **Go Microservice**   | **Redis Store**       | Redis Protocol    | `LPUSH crawl:jobs`                               | Pushes serialized crawl job into FIFO queue.                                        |
| **Go Worker**         | **Redis Store**       | Redis Protocol    | `BRPOP crawl:jobs`                               | Blocking dequeue of crawl tasks with 5-second timeout.                              |
| **Go Worker**         | **Redis Store**       | Redis Protocol    | `SET crawl:status:{id}`, `SET crawl:result:{id}` | Stores live progress percentages and caches extracted scheme payloads (1-hour TTL). |
| **Go Worker**         | **TinyFish AI**       | HTTPS POST        | `/v1/automation/run`                             | Dispatches headless browser instructions to extract scholarship data into JSON.     |
| **Go Microservice**   | **Java Backend**      | HTTP POST         | `/api/schemes/save-from-go`                      | Outbound webhook pushing extracted scholarship arrays to Java for persistence.      |
| **Java Backend**      | **Python AI Service** | HTTP POST         | `/api/summarize`                                 | Sends raw eligibility text. Python returns a concise 2-sentence summary.            |
| **Java Backend**      | **Python AI Service** | HTTP POST         | `/api/rank`                                      | Sends hard-filtered candidate schemes. Python returns semantic ranking scores.      |
| **Python AI Service** | **Qdrant DB**         | gRPC / HTTP       | Collections: `scholarships`                      | Vector upserts and cosine similarity nearest-neighbor queries.                      |

---

### Architecture and Data Flow Diagram

```mermaid
graph TD
    subgraph Client Layer
        ReactClient[Frontend Web Application<br/>React 19 / TypeScript / Vite]
    end

    subgraph Central Gateway and Orchestrator
        JavaBackend[Core Backend Service<br/>Java 21 / Spring Boot 3<br/>Port 8080]
        PostgreSQL[(PostgreSQL Database<br/>Users, Profiles, Schemes)]
    end

    subgraph Distributed Scraping Layer
        GoService[Scraping Microservice<br/>Go 1.26 / Gorilla Mux<br/>Port 8082]
        RedisStore[(Redis Broker & Cache<br/>Queues, Status & Payloads)]
        TinyFish[TinyFish AI Automation<br/>Headless Agentic Browser]
    end

    subgraph AI/ML Reasoning Layer
        PythonAI[AI/ML Engine<br/>Python FastAPI<br/>Port 8000]
        QdrantStore[(Qdrant Vector DB<br/>Dense Embeddings)]
    end

    subgraph External Portals
        NSP[National Scholarship Portal]
        StatePortals[State Welfare Portals]
    end

    %% Client communicates solely with Java Backend Gateway
    ReactClient -->|1. Auth, Profile CRUD, Scheme Queries| JavaBackend
    ReactClient -->|2. Trigger Crawl /api/crawl/start| JavaBackend
    ReactClient -->|3. Poll Progress /api/crawl/status| JavaBackend

    %% Java proxies crawling to Go
    JavaBackend -->|4. Forward Crawl POST /api/crawl| GoService
    JavaBackend -->|5. Forward Status GET /api/crawl/status| GoService
    JavaBackend <-->|Read / Write| PostgreSQL

    %% Go uses Redis and TinyFish
    GoService -->|6. LPUSH job| RedisStore
    RedisStore -->|7. BRPOP job| GoService
    GoService -->|8. Store Progress & Result| RedisStore
    GoService -->|9. Automation Request| TinyFish
    TinyFish -->|Crawl & Extract DOM| NSP
    TinyFish -->|Crawl & Extract DOM| StatePortals

    %% Go pushes back to Java via Webhook
    GoService -->|10. Webhook POST /api/schemes/save-from-go| JavaBackend

    %% Java calls Python for NLP Summarization and Ranking
    JavaBackend -->|11. POST /api/summarize raw text| PythonAI
    JavaBackend -->|12. POST /api/rank filtered schemes| PythonAI
    PythonAI <-->|Vector Index & Search| QdrantStore
```

---

## End-to-End Operational Workflows

### Workflow 1: Portal Crawling, Ingestion, and AI Summarization

```mermaid
sequenceDiagram
    autonumber
    actor User as Admin / Client
    participant React as React Frontend
    participant Java as Java Backend (:8080)
    participant Go as Go Service (:8082)
    participant Redis as Redis Queue
    participant TinyFish as TinyFish AI Engine
    participant Python as Python AI Service (:8000)
    participant DB as PostgreSQL

    User->>React: Click "Run Live Portal Crawl"
    React->>Java: POST /api/crawl/start { urls: ["NSP", "Haryana"] }
    Java->>Go: POST /api/crawl { urls: [...], goal: "..." }
    Go->>Redis: LPUSH crawl:jobs { job_id, urls, goal }
    Go->>Redis: SET crawl:status:{id} (state: queued, progress: 0)
    Go-->>Java: 202 Accepted { job_id: "uuid", status: "queued" }
    Java-->>React: 200 OK { job_id: "uuid", status: "started" }

    par Polling Loop
        loop Every 2 Seconds
            React->>Java: GET /api/crawl/status/{jobId}
            Java->>Go: GET /api/crawl/status/{jobId}
            Go->>Redis: GET crawl:status:{jobId}
            Redis-->>Go: { state: "crawling", progress: 45 }
            Go-->>Java: { status: "crawling", progress: 45 }
            Java-->>React: Update Progress Bar (45%)
        end
    and Worker Execution Loop
        Go->>Redis: BRPOP crawl:jobs (5s timeout)
        Redis-->>Go: Dequeued Job
        Go->>Redis: SET crawl:status:{id} (state: crawling)
        Go->>TinyFish: POST /v1/automation/run (URL + Goal)
        TinyFish-->>Go: Extracted JSON scholarship objects
        Go->>Redis: SET crawl:result:{id} (JSON dataset, 1h TTL)
        Go->>Redis: SET crawl:status:{id} (state: completed, progress: 100)
        Go->>Java: POST /api/schemes/save-from-go { job_id, schemes: [...] }

        loop For Each Ingested Scheme
            Java->>Python: POST /api/summarize { raw_text: scheme.rawEligibilityText }
            Python-->>Java: { summary: "2-sentence plain English summary" }
            Java->>DB: Save Scheme to PostgreSQL
        end
        Java-->>Go: 200 OK
    end

    React->>Java: GET /api/crawl/status/{jobId}
    Java-->>React: { status: "completed", progress: 100 }
    React-->>User: Display "Crawl Complete - New Schemes Available"
```

---

### Workflow 2: Student Profiling, Hard-Filtering, and AI Ranking

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student
    participant React as React Frontend
    participant Java as Java Backend (:8080)
    participant DB as PostgreSQL
    participant Python as Python AI Service (:8000)

    Student->>React: Fill 4-Step Onboarding Form
    React->>Java: POST /api/profiles/create { name, state, category, income, marks }
    Java->>DB: INSERT into profiles
    DB-->>Java: Profile Saved (UUID)
    Java-->>React: 200 OK { id: "prof-uuid" }

    React->>Java: GET /api/schemes/matched/{userId}
    Java->>DB: SELECT * FROM profiles WHERE user_id = {userId}
    DB-->>Java: Student Profile Record
    Java->>DB: SELECT * FROM schemes
    DB-->>Java: All Available Schemes

    Note over Java: Step 1: Deterministic Hard Filtering<br/>1. Caste Category Check (SC/ST/OBC/General/PWD)<br/>2. Gender Match (Male/Female/All)<br/>3. State Domicile Match (Specific State/NER/All)<br/>4. Income Limit Verification (Strict Overrides & Merit Bypasses)

    Java->>Python: POST /api/rank { schemes: [eligibleSchemes] }
    Note over Python: Step 2: Semantic Vector Ranking<br/>1. Embed scheme criteria and student context<br/>2. Compute cosine similarity scores<br/>3. Assign relative ranks and rank_score
    Python-->>Java: { ranked_candidates: [{ id: "...", rank: 1, rank_score: 0.96 }, ...] }

    Note over Java: Sort eligibleSchemes by Python rank order
    Java-->>React: Sorted, Matched Schemes Array
    React-->>Student: Display Ranked Recommendations with Badges and Deadlines
```

---

## Redis Queue Architecture in the Go Engine

The Go microservice uses Redis to decouple ingestion from crawling execution, preventing connection exhaustion and ensuring system responsiveness.

### Queue Topology and Key Conventions

The implementation in `go-backend/internal/queue/redis.go` defines three distinct key formats:

| Key Format              | Redis Type | Responsibility                                                          | Lifecycle / Expiration                 |
| ----------------------- | ---------- | ----------------------------------------------------------------------- | -------------------------------------- |
| `crawl:jobs`            | List       | FIFO queue storing pending crawl tasks serialized as JSON.              | Persistent until dequeued by a worker. |
| `crawl:status:{job_id}` | String     | JSON tracking current state (`state`, `attempts`, `progress`, `error`). | 1-hour Time-To-Live (`time.Hour`).     |
| `crawl:result:{job_id}` | String     | Full JSON array of normalized scholarship DTOs.                         | 1-hour Time-To-Live (`time.Hour`).     |

### Producer Flow: Atomic Job Ingestion

1. The Java backend (or an authorized internal caller) sends a crawl request to `POST /api/crawl`.
2. The Go handler creates a UUID `job_id`.
3. The job payload containing `job_id`, `urls`, and the extraction `goal` is marshaled into JSON.
4. `queue.Push` pushes the job to the queue using `LPUSH crawl:jobs <payload>`.
5. `queue.SetStatus` initializes the status at `crawl:status:{job_id}` with `state: "queued"` and `progress: 0`.
6. The handler immediately returns HTTP `202 Accepted` with the `job_id`.

### Consumer Flow: Blocking Dequeue Loop

1. The consumer loop runs in a dedicated goroutine (`worker.Run`).
2. It calls `queue.Pop`, which executes `BRPop(ctx, 5*time.Second, "crawl:jobs")`.
3. `BRPop` blocks without consuming CPU cycles until an item is pushed to the list.
4. If the 5-second timeout expires and the queue is empty, the loop verifies that the context is not cancelled (`ctx.Done()`) and waits again.
5. Combining `LPUSH` on the producer side with `BRPop` on the consumer side enforces strict First-In, First-Out (FIFO) queue processing.

### State Machine and Progress Telemetry

Once dequeued, the worker manages states according to the following transitions:

```
[queued] ---> [crawling] ---> [completed]
                   |
                   v
               [failed]
```

- **queued**: The job is stored in Redis awaiting an available worker thread.
- **crawling**: The worker has dequeued the task. For each URL in the batch, a worker goroutine executes. As each URL completes, a mutex updates the counter and recalculates progress:
  ```go
  progress := int((float64(completedCount) / float64(totalURLs)) * 100)
  queue.SetStatus(ctx, rdb, job.JobID, queue.Status{
      State:    "crawling",
      Progress: progress,
      Attempts: attempt,
  })
  ```
- **completed**: All URLs in the batch have completed extraction. Progress is set to `100%`, and results are committed.
- **failed**: Triggered if all retry attempts fail, no URLs were supplied, or shutdown interrupted processing.

### Result Storage and Webhook Dispatch

1. When extraction completes, the worker serializes all extracted scholarships and saves them to `crawl:result:{job_id}` using a detached `context.Background()` to guarantee persistence even if the request context expired.
2. A separate background goroutine sends an asynchronous HTTP POST webhook to the Java backend (`JAVA_BACKEND_URL`).
3. External clients can poll `GET /api/crawl/status/{jobID}` at any time during the 1-hour retention window to inspect live progress or retrieve the extracted data directly.

---

## Subsystem Roles and Responsibilities

### 1. Frontend Web Client (React 19)

**Directory**: `/src`, `/public`  
**Runtime**: React 19, TypeScript, Vite, Tailwind CSS, Motion

- Serves as the interactive portal for students.
- Communicates **only with the Java backend gateway** via `NEXT_PUBLIC_API_BASE_URL`.
- Provides authentication flows (signup/login), multi-step profile builder, and personalized opportunity dashboard.
- Executes client-side differential updates on profile changes to minimize network overhead.
- Features a real-time progress bar that polls `/api/crawl/status/{jobId}` during live crawl sessions.
- Displays scheme details with required document checklists, eligibility criteria, and direct links to official portals.

### 2. Central Orchestrator & Backend (Java Spring Boot 3)

**Directory**: `/backend/backend`  
**Runtime**: Java 21, Spring Boot 3, Spring Data JPA, Hibernate, PostgreSQL

- Acts as the central system of record and API gateway.
- Manages user authentication, session verification, and profile CRUD operations.
- Coordinates the crawling process by forwarding start/status calls from React to the Go microservice via `CrawlController.java`.
- Receives extracted scholarship records from Go through `POST /api/schemes/save-from-go` in `SchemeController.java`.
- Calls Python `POST /api/summarize` to generate 2-sentence plain-English summaries before persisting schemes.
- Executes Stage 1 deterministic hard-rule matching (checking category, gender, domicile, and income ceilings with merit overrides) when matching scholarships for a student profile.
- Delegates Stage 2 candidate ranking to Python `POST /api/rank` and returns the final sorted recommendations to the frontend.

### 3. Crawling & Extraction Microservice (Go 1.26)

**Directory**: `/go-backend`  
**Runtime**: Go 1.26+, Redis (`github.com/redis/go-redis/v9`), Gorilla Mux

- Operates as a headless, asynchronous background extraction engine.
- Manages non-blocking task queueing using Redis lists (`LPUSH` / `BRPop`).
- Runs concurrent goroutines (`sync.WaitGroup`, `sync.Mutex`) to scrape multiple portal URLs simultaneously.
- Formulates structured prompts for TinyFish AI to parse dynamic web pages into typed scholarship records.
- Handles HTTP 429 rate limits and intermittent failures with quadratic backoff retries (`attempt * attempt` seconds).
- Delivers completed scholarship records to the Java backend via HTTP webhook.

### 4. AI/ML Summarization & Ranking Engine (Python FastAPI)

**Directory**: `/src/scholarpilot_ai`, `/docs/ai-ml`  
**Runtime**: Python 3.11+, FastAPI, Qdrant, FastEmbed, Uvicorn

- Serves as the internal reasoning and vector processing engine, called by the Java backend.
- Provides `POST /api/summarize` to condense complex governmental clauses into readable 2-sentence summaries.
- Provides `POST /api/rank` to compute cross-encoder similarity between student profile attributes and candidate scholarship requirements.
- Interfaces with Qdrant vector database for high-dimensional vector similarity operations.

---

## API Contracts and Data Models

### Frontend to Java Gateway Endpoints

Base URL: `http://localhost:8080` (or configured `NEXT_PUBLIC_API_BASE_URL`)

#### Profile Creation (`POST /api/profiles/create`)

```json
{
  "fullName": "Aarav Sharma",
  "email": "aarav.sharma@example.com",
  "gender": "Male",
  "dob": "2004-05-15",
  "state": "Maharashtra",
  "casteCategory": "OBC",
  "familyIncome": 200000,
  "currentEducation": "Undergraduate",
  "course": "B.Tech Computer Science",
  "marksPercentage": 86.5
}
```

#### Get Matched Schemes (`GET /api/schemes/matched/{userId}`)

Returns schemes that have passed Java hard-rule filters and Python AI ranking:

```json
[
  {
    "id": "scheme-nsp-001",
    "schemeName": "Post-Matric Scholarship for OBC Students",
    "provider": "Ministry of Social Justice and Empowerment",
    "awardAmount": 12000,
    "deadline": "2026-10-31",
    "applyLink": "https://scholarships.gov.in/",
    "llmSummary": "Financial assistance for OBC students pursuing post-matriculation studies.",
    "requiredDocuments": [
      "Aadhaar Card",
      "Income Certificate",
      "Caste Certificate",
      "Previous Marksheet"
    ]
  }
]
```

#### Trigger Crawl (`POST /api/crawl/start`)

```json
{
  "urls": ["NSP", "Haryana", "AICTE"]
}
```

Response:

```json
{
  "job_id": "crawl-f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "started"
}
```

#### Poll Crawl Progress (`GET /api/crawl/status/{jobId}`)

```json
{
  "job_id": "crawl-f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "crawling",
  "progress": 65
}
```

---

### Java to Go Crawling Endpoints

Base URL: Configured via `GO_BACKEND_URL` in Java (Default port: `8082`)

#### Enqueue Job (`POST /api/crawl`)

```json
{
  "urls": ["https://scholarships.gov.in/", "https://socialjusticehry.gov.in/"],
  "goal": "TASK: Extract ALL scholarships listed on this page..."
}
```

Response (`202 Accepted`):

```json
{
  "job_id": "crawl-f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "queued"
}
```

#### Query Status (`GET /api/crawl/status/{jobID}`)

Response (`200 OK`):

```json
{
  "job_id": "crawl-f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "crawling",
  "progress": 65,
  "attempts": 0
}
```

---

### Go to Java Webhook Contract

- **Method**: `POST`
- **Path**: `/api/schemes/save-from-go`
- **Headers**:
  - `Content-Type: application/json`
  - `ngrok-skip-browser-warning: true`

#### Request Payload:

```json
{
  "job_id": "crawl-f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "schemes": [
    {
      "id": "crawl-f47ac10b-0-0",
      "sourcePortal": "https://scholarships.gov.in/",
      "schemeName": "PRAGATI Scholarship Scheme for Girl Students",
      "provider": "AICTE",
      "awardAmount": 50000,
      "deadline": "2026-10-31",
      "applyLink": "https://scholarships.gov.in/",
      "rawEligibilityText": "Girl students admitted to AICTE approved technical degree courses with family income under Rs 8 lakh per annum.",
      "llmSummary": "Financial assistance for girl students in accredited technical degree courses.",
      "requiredDocuments": [
        "Class 12 Marksheet",
        "Income Certificate",
        "Aadhaar Card",
        "Admission Letter"
      ],
      "confidenceScore": 0.98
    }
  ]
}
```

---

### Java to Python AI Endpoints

Base URL: Configured in Java `SchemeController.java` (Default: `http://localhost:8000`)

#### 1. Summarization (`POST /api/summarize`)

Request:

```json
{
  "raw_text": "OBC students studying at post-matriculation level with parental income not exceeding Rs. 2.50 lakh per annum..."
}
```

Response:

```json
{
  "summary": "Financial support for OBC students in higher education with family income under 2.5 lakh per year."
}
```

#### 2. Candidate Ranking (`POST /api/rank`)

Request:

```json
{
  "schemes": [
    {
      "id": "scheme-001",
      "schemeName": "PRAGATI Scheme",
      "awardAmount": 50000
    },
    {
      "id": "scheme-002",
      "schemeName": "CSSS Merit Scheme",
      "awardAmount": 12000
    }
  ]
}
```

Response:

```json
{
  "ranked_candidates": [
    { "id": "scheme-001", "rank": 1, "rank_score": 0.94 },
    { "id": "scheme-002", "rank": 2, "rank_score": 0.82 }
  ]
}
```

---

### Data Schemas

#### Student Profile (`backend/backend/src/main/java/com/scholarpilot/backend/models/Profile.java`)

- `id` (UUID): Primary key.
- `userId` (UUID): Owning user reference.
- `fullName` (String): Legal student name.
- `gender` (String): Male, Female, Other.
- `state` (String): Legal domicile state.
- `category` (String): Social category (SC, ST, OBC, GENERAL, PWD).
- `annualIncome` (Integer): Total annual family income in INR.
- `courseLevel` (String): Undergraduate, Postgraduate, Diploma, School.
- `marksPercentage` (Double): Previous qualifying marks.
- `isDisabled` (Boolean): Disability status.

#### Scholarship Scheme (`backend/backend/src/main/java/com/scholarpilot/backend/models/Scheme.java`)

- `id` (UUID / String): Synthetic or system identifier.
- `schemeName` (String): Scholarship title.
- `provider` (String): Sponsoring department or agency.
- `awardAmount` (Integer): Annual grant amount in INR.
- `deadline` (String): YYYY-MM-DD.
- `applyLink` (String): Application URL.
- `sourcePortal` (String): Source portal origin.
- `targetCategory` (String): Target social category or "ALL".
- `targetGender` (String): Target gender or "ALL".
- `targetState` (String): Target state, "NER" (North Eastern Region), or "ALL".
- `maxIncome` (Integer): Ceiling income limit in INR.
- `rawEligibilityText` (String): Verbatim extracted portal text.
- `llmSummary` (String): Generated plain-English summary.
- `requiredDocuments` (List of Strings): Required verification proofs.

---

## Environment Configuration

### Frontend Environment

Create `.env` or `.env.local` in the project root:

```env
# Application Host Port
PORT=3000

# Central Java Gateway URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
VITE_API_BASE_URL=http://localhost:8080
```

---

### Java Backend Environment

Configure in `backend/backend/src/main/resources/application.properties`:

```properties
server.port=8080

# PostgreSQL Connection
spring.datasource.url=jdbc:postgresql://localhost:5432/scholarpilot
spring.datasource.username=postgres
spring.datasource.password=your_password
spring.jpa.hibernate.ddl-auto=update

# Internal Microservice Destinations
go.backend.url=http://localhost:8082
python.ai.url=http://localhost:8000
```

---

### Go Scraping Service Environment

Configure in `go-backend/.env`:

```env
PORT=8082
REDIS_ADDR=localhost:6379
TINYFISH_API_KEY=your_tinyfish_api_key_here
JAVA_BACKEND_URL=http://localhost:8080/api/schemes/save-from-go
```

---

### Python AI Service Environment

Configure in `src/scholarpilot_ai/.env` or root `.env`:

```env
HOST=0.0.0.0
PORT=8000
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_COLLECTION=scholarships
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/scholarpilot
```

---

## Installation and Execution Guide

### Prerequisites

- **Node.js**: Version 18.0 or higher
- **Java Development Kit (JDK)**: Version 21
- **Go**: Version 1.22 or higher
- **Python**: Version 3.11 or higher
- **Redis Server**: Version 6.0 or higher
- **PostgreSQL Database**: Version 14 or higher
- **Qdrant Vector Database**: Running on port 6333

---

### Starting the Core Java Backend

The Java backend should be launched first as the central system of record and API gateway:

1. Navigate to the backend directory:
   ```bash
   cd backend/backend
   ```
2. Run with Maven:

   ```bash
   # On Linux/macOS
   ./mvnw spring-boot:run

   # On Windows
   .\mvnw.cmd spring-boot:run
   ```

3. The server will start on port `8080`.

---

### Starting the Go Scraping Engine

1. Navigate to the Go backend directory:
   ```bash
   cd go-backend
   ```
2. Verify Redis is running at `REDIS_ADDR` (e.g. `localhost:6379`).
3. Download Go modules:
   ```bash
   go mod download
   ```
4. Start the API server and background consumer loop:
   ```bash
   go run ./cmd/api
   ```
5. The service will verify Redis connectivity, launch the background queue consumer, and listen on port `8082`.

---

### Starting the Python AI Service

1. Create and activate a Python virtual environment:

   ```bash
   python -m venv venv

   # On Linux/macOS
   source venv/bin/activate

   # On Windows
   .\venv\Scripts\activate
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the FastAPI service:
   ```bash
   uvicorn src.scholarpilot_ai.api.main:app --host 0.0.0.0 --port 8000 --reload
   ```

---

### Starting the Frontend Application

1. Install npm dependencies in the root directory:
   ```bash
   npm install
   ```
2. Start the Vite local development server:
   ```bash
   npm run dev
   ```
3. Open your browser at `http://localhost:3000`.

---

## Security, Privacy, and Data Governance

1. **Centralized Gateway Security**:
   The frontend communicates only with the Java Spring Boot gateway. Internal microservices (Go scraping service, Python AI engine, Redis, PostgreSQL, and Qdrant) are isolated behind the gateway and not directly exposed to public client traffic.

2. **Ephemeral Queue and Payload Storage**:
   Crawl tasks and raw extraction results stored in Redis expire automatically after 1 hour (`time.Hour`), preventing unnecessary in-memory data accumulation.

3. **Input Validation and Header Enforcement**:
   Requests across services are validated with strict content-type enforcement and payload size limits. The Go scraper limits request bodies to 1 MB (`http.MaxBytesReader`) to protect worker nodes against memory exhaustion.

4. **Transparent Explainability**:
   The two-stage matching pipeline ensures that students receive clear, explainable match justifications based on explicit criteria (academic qualifications, domicile, income ceilings, and reservation categories) rather than opaque black-box scoring.
