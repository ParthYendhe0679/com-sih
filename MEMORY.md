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

### Cytoscape Lifecycle & Zero-Node Race Guard
- **Gotcha**: When a case has 0 graph nodes, the UI unmounts the `<div ref={containerRef} />` container to display the "No Intelligence Network" empty state. If an asynchronous `import('cytoscape')` is pending concurrently, Cytoscape attempts to instantiate with `container: null`, throwing `Cannot read properties of null (reading 'className')`.
- **Fix**: Check `if (!containerRef.current || caseNodes.length === 0) return;` before and after all async imports, and immediately before invoking `cytoscapeLib(...)`.

### asyncpg Multi-Statement DDL Constraints
- **Gotcha**: `asyncpg` does not support executing multiple SQL statements delimited by semicolons inside a single prepared statement (`cannot insert multiple commands into a prepared statement`).
- **Fix**: Split multi-statement DDL migrations by `;` and execute each DDL command individually through `conn.execute(text(cmd))`.

### Neo4j Aura Cloud Batched UNWIND Pattern
- **Gotcha**: Executing hundreds of individual sequential Cypher queries (e.g. `MATCH (s {id: ...}), (t {id: ...}) MERGE (s)-[:REL]->(t)`) over remote Aura SSL without indexing causes Cartesian graph scans, high network latency, and unconsumed result buffer stalls.
- **Fix**: Group graph edges by relationship type and execute batched transactions using `UNWIND $batch AS r MATCH (s {id: r.src_id}) MATCH (t {id: r.tgt_id}) MERGE (s)-[rel:TYPE]->(t)` followed by explicit `await res.consume()`.

### Windows Python User Scripts PATH & Uvicorn Invocation
- **Gotcha**: On Windows systems where Python is installed globally in `Program Files`, `pip install` installs executables (like `uvicorn.exe`) into the per-user script directory `C:\Users\<user>\AppData\Roaming\Python\Python313\Scripts`. If this directory is not in User `PATH`, running `uvicorn` in PowerShell fails with `CommandNotFoundException`.
- **Fix**: Add `C:\Users\<user>\AppData\Roaming\Python\Python313\Scripts` to User PATH. In PowerShell, invoke via `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload` or use the included `backend/uvicorn.cmd` / `backend/run_server.bat` scripts.

### SQLAlchemy Recursive `selectin` Cascading over WAN (Neon DB)
- **Gotcha**: Configuring `lazy="selectin"` across bidirectional relationships (e.g. `User -> investigated_cases -> FIR -> Case`) causes a single entity fetch to trigger 8+ cascading remote roundtrips over WAN (16–20 seconds per request). If the frontend awaits multiple endpoints sequentially (case, entities, relationships), initial page load can exceed several minutes.
- **Fix**: 
  1. Default reverse collection relationships in SQLAlchemy models to `lazy="select"` or use `select(Model).options(noload("*"))` on primary lookups to eliminate over-fetching.
  2. Implement a two-tier caching pattern (local in-memory process cache + Valkey distributed cache) on read-heavy detail endpoints (`/cases/{id}`, `/cases/{id}/entities`, `/cases/{id}/relationships`).
  3. On the frontend, immediately render optimistic case metadata so loading spinners dismiss in <1s, and hydrate entities/relationships concurrently via `Promise.allSettled`.

### SQLAlchemy AsyncSession Concurrent Query Prohibition
- **Gotcha**: Executing concurrent queries using `asyncio.gather` on the same `AsyncSession` (e.g. running `case_service.list_cases` and `case_service.count_cases` simultaneously) raises `sqlalchemy.exc.InvalidRequestError: This session is provisioning a new connection; concurrent operations are not permitted` and leaves requests in an illegal state or hanging.
- **Fix**: Run queries sequentially on the same `AsyncSession`. For pagination, shortcut `total = len(cases)` when `page == 1 and len(cases) < size` to save unnecessary WAN roundtrips.

### SWR Zero-Skeleton Table Hydration
- **Gotcha**: Starting frontend list views with `loading: true` and an empty array forces an unnecessary skeleton flash on every page revisit, navigation, or tab switch, leaving users waiting even when case records were already fetched earlier.
- **Fix**: Hydrate list views synchronously on mount from `sessionStorage` / memory cache with `loading: false` for instant 0ms rendering, and execute background revalidation silently (`isSilent: true`) without layout shifts or skeleton flickers.

### Endpoint Model Imports & Detached Attribute Guard
- **Gotcha**: Using ORM models like `CaseNote` or `Evidence` in route handlers without explicit top-level imports raises unhandled `NameError` exceptions, causing FastAPI to return 500 Internal Server Errors. In response, frontend clients cascade through multiple fallbacks, stalling screens indefinitely on loading spinners.
- **Fix**: Always verify top-level model imports in route modules (`from app.models.case_note import CaseNote`, `from app.models.evidence import Evidence`). Compute related counts using database aggregations (`select(func.count()).where(...)`) rather than dereferencing detached relationship attributes like `len(case.evidence)`.

### Case Map Intelligence Pipeline & Spatial Graph Validation
- **Gotcha**: Bleeding unstructured FIR character windows across sentences causes spatial role confusion (e.g., misclassifying a vehicle spotting as the primary kidnapping scene, or hardcoding synthetic coordinate offsets). Moreover, Neo4j `graph_repository.py` strictly whitelists Cypher edge types in `ALLOWED_REL_TYPES` to block injection; unlisted spatial relationships (`LAST_SEEN_AT`, `OCCURRED_AT`, `LIVES_AT`, `SEEN_AT`, `TRANSFERRED_AT`, `MOVED_TO`) are silently rejected.
- **Fix**: 
  1. Use isolated sentence-clause parsing (`re.split(r"[.\n;!]", text)`) for targeted locus role assignment.
  2. Maintain a deterministic Indian Metropolitan Geocoding Registry (`geocoding_service.py`) with strict physical boundary validation. Any loci lacking physical verification are flagged as `"Location identified but coordinates unavailable"` and routed to the entity drawer rather than plotted as synthetic map points.
  3. Whitelist spatial relationship types in `ALLOWED_REL_TYPES`.
  4. Cache synthesized map topologies in Valkey (`case:{case_id}:map-intelligence`, TTL 15m) and invalidate on case/entity/FIR mutations.
  5. Render high-contrast, dark navy/charcoal connection lines (`#0F172A` / `#1E293B`, thickness 3.5–5.5) with relationship badge labels and interactive dossiers.

