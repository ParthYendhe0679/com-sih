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
- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript. `frontend/AGENTS.md` is authoritative — consult `node_modules/next/dist/docs/` before writing framework code, as APIs differ from Next 14.
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

### SAMANVAYA Hardcoded Dark Classes on a Light-Default Theme
- **Gotcha**: The app's default theme is **light** (`uiSlice.theme = 'light'`; `--surface-1: #FFFFFF`). Components written with hardcoded Tailwind dark classes (`text-white`, `text-gray-400`, `bg-black/30`, `border-white/10`) render white-on-white and read as "empty, washed-out, low-hierarchy" pages rather than as broken ones — so the failure is easy to misdiagnose as a design problem.
- **Fix**: Style every surface through the theme tokens the rest of the app uses — `text-[var(--ink-primary)]`, `text-[var(--ink-secondary)]`, `text-[var(--ink-tertiary)]`, `background: var(--surface-1|2|3)`, `borderColor: var(--border|--border-strong)`. Derive accent tints from a hex at runtime (`tint(hex, alpha)`) instead of committing to a fixed light or dark palette.

### Read Endpoints Must Not Trigger Expensive Pipelines
- **Gotcha**: `GET /intelligence/cases/{id}/results` (and `/graph`, `/tree`, `/agents`, `/report`) previously ran the full 5-agent pipeline when nothing was cached. The frontend called `getFinalResults` on every case selection, so merely *picking a case in the dropdown* silently started a ~75s multi-LLM run — repeatedly, and invisibly.
- **Fix**: Read endpoints return `null` plus an explanatory message when no analysis exists; only `POST /start` executes the pipeline. The UI renders an explicit empty state and the officer starts the run deliberately.

### FastAPI BackgroundTasks and Detached ORM Instances
- **Gotcha**: Passing the request-scoped `current_user` ORM object into a background task that opens its own `AsyncSessionLocal()` leaves it detached; touching `user.id` / `user.username` inside the task raises at attribute access.
- **Fix**: Capture identity as primitives in the request handler (`officer_id: uuid.UUID`, `officer_name: str`) and pass those into the background coroutine. `run_investigation_pipeline` accepts both the primitives and the legacy `user=` argument.

### Data File Paths Resolved Relative to the Wrong Package Root
- **Gotcha**: `samanvaya_service._load_historical_cases()` resolved `os.path.dirname(__file__)/../data/synthetic/...` → `backend/app/data/synthetic`, which does not exist. The real archive lives at `backend/data/synthetic`. The loader caught the miss and returned `[]`, so Agent 4 searched a **silently empty** 0-record archive while the UI still reported it as a data source.
- **Fix**: Resolve two levels up (`../../data/synthetic`), keep the one-level path as a fallback, cache the parsed list on the service instance (it is 1,000 records re-read per agent pass), and log a warning when the archive genuinely cannot be found rather than degrading quietly.

### Empty Agent Output Is Itself a Finding
- **Gotcha**: When the historical archive contains no case of the current crime type, Agent 4 correctly returns zero matches — but the agent card then rendered completely blank, which reads as "broken" rather than "searched and found nothing".
- **Fix**: On an empty result, emit an explicit highlight stating that no precedent matched and how many records were searched, plus the nearest retrieved records clearly labelled as *lexical overlap, not an MO match*. The prefilter carries `_retrieval_score` / `_retrieval_rank` forward so this fallback uses real retrieval data.

### Pydantic Schema Evolution vs. Cached Dossiers
- **Gotcha**: Cached SAMANVAYA dossiers in Valkey are validated back into `SamanvayaFinalDossier`. After a schema change (loose `List[Dict]` → typed `GeoIntelPoint` / `TimelineEvent`), stale cache entries fail validation and surface as a 500.
- **Fix**: `get_case_results` wraps `model_validate` in a try/except, deletes the unreadable key and returns `None`, so the UI falls back to its empty state and the officer simply re-runs.

### Frontend/Backend Contract Drift on Nested Payloads
- **Gotcha**: The frontend `SamanvayaFinalDossier` declared `timeline: {time,title,agent,type,desc}[]` and `geographicRoute: {label,evidenceSource}[]`, while the backend emitted `{id,timestamp,event,confidence,evidence}` and `{name,address,latitude,...}`. TypeScript could not catch it (the API client returns the declared type unchecked), so the timeline tab rendered rows of `undefined` — visible features that silently displayed nothing.
- **Fix**: Define the payload as typed Pydantic models on the backend and mirror the field names exactly in `frontend/src/lib/api/samanvaya.ts`. Loose `List[Dict[str, Any]]` on a response schema is where this drift hides.

### React 19 `set-state-in-effect` on Prop-Change Resets
- **Gotcha**: Resetting derived state in a `useEffect` keyed on an id (`useEffect(() => { setCollapsed(...); setSelected(root); }, [root.id])`) trips `react-hooks/set-state-in-effect` and paints one stale frame before the reset commits.
- **Fix**: Use React's documented adjust-state-during-render pattern — hold the last-seen id in state and reset inside the render body when it differs. Applied to the investigation tree (`seenRootId`) and the workspace case switch (`loadedCaseId`).

### Two-Tier Caching & Consolidated SQL Aggregations for Live Telemetry
- **Gotcha**: Dashboard and analytics endpoints previously executed 6–8 sequential WAN queries to remote Neon DB in Ohio on every poll, while relying on an ultra-short 10s TTL in remote Valkey (Aiven Cloud). High-frequency 10-second frontend polling caused continuous cache misses, 5–11s roundtrip stalls, and connection pool saturation that timed out browser requests, leaving cards on "Synchronizing..." and charts empty. Additionally, `lazy="selectin"` on `FIR` relationships triggered cascading user lookups on every list fetch.
- **Fix**:
  1. **Two-Tier In-Memory L1 Cache**: Added an in-memory process cache (`_L1_DASHBOARD_CACHE` with 60s TTL, `_L1_ANALYTICS_CACHE` with 120s TTL) ahead of Valkey. Warm requests respond in **0.01s (<15ms)** instead of 11s.
  2. **Consolidated SQL Queries**: Replaced separate status, priority, and investigator count queries with a single `COUNT(*) FILTER (...)` statement, reducing WAN database round trips by 60%.
  3. **Relationship Hygiene**: Switched `FIR` model relationships from `lazy="selectin"` to `lazy="select"` and added `.options(noload("*"))` to list queries to prevent cascading WAN round trips.
  4. **Frontend SWR Instant Hydration**: Implemented `sessionStorage` caching on `/analytics` and `/dashboard` for instant 0ms rendering on tab switches, relaxed polling intervals to 30s, and dynamically wired live AI pattern alerts and network entities into dashboard widgets.


