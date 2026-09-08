# KRITAGAS — System Memory & Architecture Ledger

This document serves as the persistent context ledger and architectural memory for the KRITAGAS Intelligence & Investigation Platform. All AI agents and developers must consult this ledger before implementing or refactoring system components.

---

## 1. System Architecture & Stack

### Backend Stack
- **Framework**: FastAPI (Python 3.13) with asynchronous request handlers.
- **Relational Database**: PostgreSQL 16 via `asyncpg` and SQLAlchemy 2.0 (`AsyncSession`).
- **Graph Database**: Neo4j Aura Cloud (`neo4j+s://7fb5bcab.databases.neo4j.io`), using Python `neo4j` driver with query-level transactions.
- **Cache & Key-Value Store**: Valkey / Redis 7 via `redis-py` async client with standardized TTLs (`CACHE_TTL_SHORT`, `CACHE_TTL_MEDIUM`, `CACHE_TTL_LONG`).
- **Vector & ML Engine**: Sentence-Transformers (SBERT), ChromaDB for dense vector search, scikit-learn for multi-attribute matching, and NetworkX for graph centrality.
- **Security & Auth**: JWT (RS256/HS256) access tokens, Argon2 password hashing, RBAC (`SUPER_ADMIN`, `ADMIN`, `POLICE`, `CITIZEN`).

### Frontend Stack
- **Framework**: Next.js 14 (App Router) + React 18 + TypeScript.
- **Styling**: Tailwind CSS v3/v4 utility design tokens with customized CSS variables (`--surface-1`, `--accent`, `--border`, `--ink-primary`).
- **State Management**: Redux Toolkit for UI drawers, active cases, and live monitoring.
- **Data Visualization**: Recharts (interactive metrics), React Leaflet (spatial hotspots), dynamic SVG network graph engines.

---

## 2. Multi-Database Topology & Integration Map

```
┌────────────────────────────────────────────────────────┐
│                   Next.js Frontend                     │
└───────────────────────────┬────────────────────────────┘
                            │ REST / JSON (JWT Auth)
┌───────────────────────────▼────────────────────────────┐
│                    FastAPI Backend                     │
└─────┬──────────────┬──────────────┬──────────────┬─────┘
      │              │              │              │
┌─────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
│ PostgreSQL │ │ Neo4j Aura │ │ Valkey 7   │ │ ChromaDB   │
│  (Relational│ │ (Graph /   │ │ (Cache /   │ │ (Vector /  │
│  Entities) │ │  Edges)    │ │  RateLimit)│ │  Embeddings│
└────────────┘ └────────────┘ └────────────┘ └────────────┘
```

---

## 3. Critical Lessons Learned & Regression Prevention

### Neo4j Aura Cloud Connection
- **Gotcha**: Neo4j Aura free/cloud instances use a specific database name matching the instance prefix (`7fb5bcab`), NOT the standard `neo4j` default. Connecting without specifying `database="7fb5bcab"` results in routing or authentication errors.
- **Fix**: Always configure `NEO4J_DATABASE=7fb5bcab` in `backend/.env` and `app/core/config.py`.

### SQLAlchemy 2.0 Async Relationship Loading
- **Gotcha**: Calling `.options(selectinload(...))` requires importing from `sqlalchemy.orm`. Importing from `sqlalchemy` raises an `AttributeError`.
- **Fix**: Keep imports explicit: `from sqlalchemy.orm import selectinload`.

### Valkey / Redis Session Cleanup
- **Gotcha**: Redis test fixtures that write to keys like `case:*` can collide with production cache namespaces if not scoped with prefixes or flushed during test teardown.
- **Fix**: Use namespaced cache fixtures with cleanup handlers in `conftest.py`.

### Frontend API Contract Parity
- **Gotcha**: Backend endpoints return snake_case attributes (`total_cases`, `open_cases`, `assigned_cases`), whereas older mock services used camelCase.
- **Fix**: Define interfaces in `frontend/src/lib/api/*` that accept backend schemas with optional aliases, preventing `undefined` metric cards.

### Zero Mock Fallback Principle
- **Gotcha**: Silently falling back to static mock data when an API call fails or when an ID doesn't exist masks network failures and leads to misleading investigation data (e.g., showing wrong person dossier).
- **Fix**: Display dedicated, styled empty states and 404 error boundaries rather than silently falling back to mock fixtures.

### Case Ingestion Zero-State Defensiveness
- **Gotcha**: When dummy data is purged and the case database is empty (`[]`), dereferencing active case metadata (`currentCase.id`, `currentCase.title`) in intelligence dashboards causes runtime `TypeError: Cannot read properties of undefined (reading 'id')`.
- **Fix**: Use optional chaining (`currentCase?.id`) or safe fallback strings (`currentCase?.id || 'FIR Scope'`) in all UI nodes, and guard action dispatchers so navigation only triggers if an active case exists.

