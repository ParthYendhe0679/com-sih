# KRITAGAS — Criminal Intelligence & Investigation Platform (Backend Core)

KRITAGAS is an advanced criminal intelligence and investigation platform designed to assist law enforcement agencies, cybercrime divisions, and investigative authorities in managing First Information Reports (FIRs), criminal Cases, chain-of-custody Evidence metadata, Audit Logs, and User Access Controls.

This repository hosts the **Backend Core** foundation, architected cleanly to support future plug-and-play integrations with OCR, NLP, Knowledge Graphs (Neo4j), Distributed Task Queues (Celery/Redis), and Multi-Agent AI systems.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [User Roles & Access Boundaries (RBAC)](#user-roles--access-boundaries-rbac)
4. [FIR & Case Workflows](#fir--case-workflows)
5. [Future Integration Interfaces](#future-integration-interfaces)
6. [Project Directory Structure](#project-directory-structure)
7. [Installation & Setup](#installation--setup)
8. [Database Migrations (Alembic)](#database-migrations-alembic)
9. [Development Seed System](#development-seed-system)
10. [Running the Application](#running-the-application)
11. [Running Automated Tests](#running-automated-tests)
12. [Docker & Containerization](#docker--containerization)
13. [API Documentation](#api-documentation)

---

## Architecture Overview

KRITAGAS follows a **Clean Layered Architecture** with strict separation of concerns:

```
CLIENT (Next.js / Swagger / Mobile Client)
   │
   ▼
API ROUTES (/api/v1/...) [Zero business logic]
   │
   ▼
DEPENDENCIES (deps.py - Database sessions, JWT Auth, Role RBAC)
   │
   ▼
SERVICES (Business logic, state machines, auditing, notifications)
   │
   ▼
REPOSITORIES (SQLAlchemy 2.0 Async queries, parameterization, encapsulation)
   │
   ▼
DATABASE (PostgreSQL / asyncpg / Alembic)
   │
   ▼
FUTURE INTEGRATION INTERFACES (Storage, Intelligence, Knowledge Graph)
```

### Architectural Principles
- **No business logic in routes**: API endpoints only receive validated schemas, invoke service methods, and wrap responses in standardized envelopes.
- **No SQL queries in services or routes**: All database queries are strictly encapsulated in dedicated repositories.
- **Standardized API Envelope**: All API endpoints return a predictable JSON envelope:
  ```json
  {
    "success": true,
    "message": "Operation completed successfully.",
    "data": {},
    "error": null
  }
  ```
- **Strict State Machines**: Status transitions for FIRs and Cases are strictly validated to prevent illegal workflow jumps.

---

## Tech Stack

| Component | Technology |
|---|---|
| **Language** | Python 3.12+ (tested on Python 3.13.1) |
| **Framework** | FastAPI |
| **ORM** | SQLAlchemy 2.0 (Async) |
| **Database Driver** | `asyncpg` (PostgreSQL) / `aiosqlite` (Testing) |
| **Database** | PostgreSQL 16 |
| **Migrations** | Alembic (configured for async engines) |
| **Validation** | Pydantic v2 + `pydantic-settings` |
| **Authentication** | JSON Web Tokens (JWT) via `python-jose` + `bcrypt` |
| **Containerization** | Docker + Docker Compose |
| **Testing** | `pytest`, `pytest-asyncio`, `httpx` |

---

## User Roles & Access Boundaries (RBAC)

The system enforces 3 primary roles:

1. **CITIZEN**
   - Self-registration and login.
   - Lodge online complaints/FIRs (draft or submit).
   - View **only their own** complaints and track real-time status.
   - Attach supporting evidence metadata to their complaints.
   - Respond to police requests for additional information.
   - Receive in-app notifications.
   - *Restricted*: Cannot view other citizens' complaints, cannot access police case files, notes, or admin endpoints.

2. **POLICE**
   - Review triage queue of submitted complaints.
   - Accept or reject FIRs (rejection requires mandatory documented reason).
   - Request additional details from complainants.
   - Convert accepted FIRs into official investigation Cases.
   - Register physical walk-in offline FIRs with scanned document metadata.
   - Update Case statuses through the investigative lifecycle.
   - Add confidential investigative case notes.
   - Upload and attach evidence metadata to Cases.
   - Access chronological Case timelines.

3. **ADMIN**
   - User account lifecycle management (activate/deactivate users).
   - Onboard and provision Police Officer accounts (with badge numbers, department, and ranks).
   - View system-wide operational metrics and distributions.
   - Inspect immutable, tamper-evident audit logs.
   - *Audit Rule*: Admin actions are strictly audited and cannot bypass logging.

---

## FIR & Case Workflows

### 1. FIR Workflow
```
[DRAFT] ──(Citizen submits)──> [SUBMITTED] ──(Police review begins)──> [UNDER_REVIEW]
                                                                        │
        ┌───────────────────────────────────────────────────────────────┴───────────────────────────────┐
        ▼                                                               ▼                               ▼
   [ACCEPTED]                                                  [REJECTED (with reason)]    [MORE_INFO_REQUIRED]
        │                                                                                           │
        ▼ (Police action)                                                                           ▼ (Citizen responds)
 [CONVERTED_TO_CASE]                                                                          [UNDER_REVIEW]
```

### 2. Case Workflow
```
[ACCEPTED FIR or OFFLINE FIR]
             │
             ▼
          [OPEN] ──(Investigator assigned)──> [UNDER_INVESTIGATION] ──> [ACTIVE]
                                                                          │
                                                                          ├────> [ON_HOLD]
                                                                          │        │
                                                                          │        ▼
                                                                          └────> [CLOSED]
```

---

## Future Integration Interfaces

To ensure zero architectural rewrites when advanced AI modules are integrated, abstract interfaces with non-blocking default providers are built into the core:

- **Storage Service** (`app/integrations/storage/`):
  - Interface: `upload()`, `download()`, `delete()`
  - Active: `LocalStorageService` (saves to `./uploads`)
  - Future: MinIO / AWS S3
- **Intelligence Service** (`app/integrations/intelligence/`):
  - Interface: `process_case()`, `process_offline_document()`, `extract_entities()`
  - Active: `NoOpIntelligenceService` (structured event logging)
  - Future: PaddleOCR, spaCy NER, HuggingFace Transformers, Multi-Agent swarm
- **Knowledge Graph Service** (`app/integrations/graph/`):
  - Interface: `sync_case_node()`, `sync_relationship()`
  - Active: `NoOpGraphService` (structured synchronization hooks)
  - Future: Neo4j Cypher graph sync

---

## Project Directory Structure

```
kritagas-backend/
├── app/
│   ├── main.py                      # FastAPI application bootstrap & middleware
│   ├── api/
│   │   ├── deps.py                  # Database, Auth, and RBAC dependencies
│   │   └── v1/
│   │       ├── router.py            # Version 1 aggregated router
│   │       └── endpoints/
│   │           ├── auth.py          # /api/v1/auth
│   │           ├── users.py         # /api/v1/users
│   │           ├── firs.py          # /api/v1/firs
│   │           ├── cases.py         # /api/v1/cases
│   │           ├── evidence.py      # /api/v1/evidence
│   │           ├── police.py        # /api/v1/police
│   │           ├── admin.py         # /api/v1/admin
│   │           ├── notifications.py # /api/v1/notifications
│   │           ├── dashboard.py     # /api/v1/dashboard
│   │           ├── search.py        # /api/v1/search
│   │           └── health.py        # /api/v1/health
│   ├── core/
│   │   ├── config.py                # Pydantic Settings (.env)
│   │   ├── constants.py             # Domain Enums & Constants
│   │   ├── security.py              # Password hashing & JWT tokens
│   │   ├── permissions.py           # Role authorization checks
│   │   ├── exceptions.py            # Custom HTTP domain exceptions
│   │   └── logging.py               # Structured logging & parameter sanitization
│   ├── db/
│   │   ├── base.py                  # Declarative base & metadata aggregation
│   │   ├── session.py               # Async SQLAlchemy engine & session factory
│   │   └── init_db.py               # Database health and ping utilities
│   ├── models/
│   │   ├── base.py                  # Base, GUID type decorator, TimestampMixin
│   │   ├── user.py                  # User model
│   │   ├── fir.py                   # First Information Report model
│   │   ├── case.py                  # Criminal investigation Case model
│   │   ├── case_note.py             # Investigation notes model
│   │   ├── evidence.py              # Evidence metadata model
│   │   ├── notification.py          # In-app notifications model
│   │   └── audit_log.py             # Immutable audit log model
│   ├── schemas/
│   │   ├── common.py                # Standard API response & pagination schemas
│   │   ├── auth.py                  # Auth request & token schemas
│   │   ├── user.py                  # User and profile schemas
│   │   ├── fir.py                   # FIR intake & review schemas
│   │   ├── case.py                  # Case lifecycle & timeline schemas
│   │   ├── evidence.py              # Evidence metadata schemas
│   │   ├── notification.py          # Notification schemas
│   │   ├── dashboard.py             # Analytical dashboard schemas
│   │   └── search.py                # Multi-entity search schemas
│   ├── repositories/
│   │   ├── base_repository.py       # Generic async repository CRUD
│   │   ├── user_repository.py       # User queries
│   │   ├── fir_repository.py        # FIR queries & status distributions
│   │   ├── case_repository.py       # Case queries & note management
│   │   ├── evidence_repository.py   # Evidence metadata queries
│   │   ├── notification_repository.py # Notification queries & unread count
│   │   └── audit_repository.py      # Immutable audit trail queries
│   ├── services/
│   │   ├── auth_service.py          # Registration, login, token refresh
│   │   ├── user_service.py          # User management & police onboarding
│   │   ├── fir_service.py           # FIR triage & citizen interactions
│   │   ├── case_service.py          # Case workflow & timeline aggregation
│   │   ├── evidence_service.py      # Evidence chain of custody
│   │   ├── notification_service.py  # In-app notification dispatcher
│   │   ├── dashboard_service.py     # Live analytical queries
│   │   ├── search_service.py        # Unified cross-entity search
│   │   └── audit_service.py         # System audit logger
│   ├── middleware/
│   │   ├── request_logging.py       # Request latency & telemetry logger
│   │   └── error_handler.py         # Centralized HTTP exception handlers
│   ├── utils/
│   │   ├── helpers.py               # Identifier generators (FIR/CASE) & SHA-256
│   │   ├── pagination.py            # Pagination models
│   │   ├── response.py              # APIResponse envelope helpers
│   │   └── validators.py            # State machine transition rules
│   └── integrations/
│       ├── storage/                 # StorageService interface & LocalStorage
│       ├── intelligence/            # IntelligenceService interface & NoOp
│       └── graph/                   # GraphService interface & NoOp
├── alembic/
│   ├── env.py                       # Async Alembic environment
│   └── versions/
│       └── 001_initial_schema.py    # Initial database migration
├── scripts/
│   └── seed_db.py                   # Development data seeder
├── tests/
│   ├── conftest.py                  # Test database fixtures & auth clients
│   ├── api/                         # Endpoint test suites
│   └── services/                    # Unit & state machine tests
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── pyproject.toml
└── requirements.txt
```

---

## Installation & Setup

### Prerequisites
- Python 3.12 or higher
- PostgreSQL 16 (or Docker)

### 1. Environment Configuration
Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```

Review the `.env` settings:
```ini
DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/kritagas_db"
SECRET_KEY="your-long-secure-secret-key"
FRONTEND_URL="http://localhost:3000"
```

### 2. Install Dependencies
```powershell
pip install -r requirements.txt
```

---

## Database Migrations (Alembic)

Run migrations to create database tables:
```powershell
alembic upgrade head
```

To rollback a migration:
```powershell
alembic downgrade -1
```

To generate a new auto-detected migration:
```powershell
alembic revision --autogenerate -m "description_of_changes"
```

---

## Development Seed System

Initialize the database with default test accounts, sample complaints, and an active Case:
```powershell
python scripts/seed_db.py
```

### Default Development Credentials
| Role | Email | Username | Password | Notes |
|---|---|---|---|---|
| **Admin** | `admin@kritagas.gov.in` | `admin` | `Admin@123456` | Full platform administration |
| **Police** | `inspector.sharma@police.gov.in` | `inspector_sharma` | `Police@123456` | Badge: `DL-POL-8042` |
| **Citizen** | `citizen.rahul@example.com` | `citizen_rahul` | `Citizen@123456` | Complainant account |

---

## Running the Application

Start the FastAPI development server:
```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## Running Automated Tests

KRITAGAS includes a comprehensive automated test suite with 100% pass rate using in-memory async SQLite:

```powershell
python -m pytest -v
```

Tests verify:
- Citizen registration & login
- Duplicate user detection
- Token refresh lifecycle
- Citizen complaints submission & privacy boundaries
- Police review decisions (Accept, Reject with reason, Request Info)
- State machine transition validation & illegal transition rejection
- Official Case creation from accepted FIRs
- Investigator assignment & Case notes
- Case chronological timeline aggregation
- Evidence metadata registering & SHA-256 hashes
- Admin user activation / deactivation & audit log queries
- Citizen, Police, and Admin dashboard metrics computation
- Application & database health probes

---

## Docker & Containerization

To run the complete platform (PostgreSQL 16 + FastAPI Backend) with Docker Compose:

```powershell
docker compose up --build -d
```

Check running container status:
```powershell
docker compose ps
```

View logs:
```powershell
docker compose logs -f backend
```

---

## API Documentation

When the server is running, explore interactive OpenAPI documentation:

- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **OpenAPI JSON**: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)
- **Health Probe**: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

### Frontend Connection
The Next.js TypeScript frontend can connect directly via:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```
All CORS headers are pre-configured to allow local frontend access on `http://localhost:3000`.
