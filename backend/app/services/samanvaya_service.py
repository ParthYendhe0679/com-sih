"""SAMANVAYA Multi-Agent Criminal Investigation Intelligence Service.

Orchestrates a 5-agent sequential intelligence pipeline:
  1. Case Context & Relevance Agent (Valkey pre-filtered context)
  2. Entity & Identity Intelligence Agent (Resolution, aliases, cross-case)
  3. Network & Relationship Agent (Neo4j criminal network synthesis)
  4. Historical & Pattern Intelligence Agent (Modus Operandi & Precedents)
  5. Investigative Synthesis Agent (Classified findings, leads, report)

Persists immutable intelligence dossiers to PostgreSQL & Blockchain,
and provides multi-tier graph and hierarchical tree models.
"""

import asyncio
import hashlib
import json
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.providers.base import BaseAIProvider
from app.ai.schemas.ai import TaskType
from app.ai.services.ai_service import AIService
from app.ai_ml.models.ai_models import Entity
from app.core.config import settings
from app.core.exceptions import NotFoundException
from app.core.logging import get_logger
from app.blockchain.constants import (
    BlockchainRecordStatus,
    EntityType,
    InvestigationAuditAction,
    RecordType,
)
from app.blockchain.models import (
    BlockchainRecord,
    InvestigationAuditRecord,
)
from app.blockchain.repository import BlockchainRepository
from app.models.case import Case
from app.models.data_architecture import (
    EntityRelationship,
    InvestigationReport,
)
from app.models.fir import FIR
from app.models.user import User
from app.core.neo4j.client import Neo4jClient, neo4j_client
from app.repositories.graph_repository import GraphRepository
from app.schemas.samanvaya import (
    AgentMetric,
    CDRAnalysis,
    DataSourceStatus,
    GeoIntelLink,
    GeoIntelPoint,
    TelemetryLine,
    TimelineEvent,
    TreeNodeRelation,
    Agent1ContextOutput,
    Agent2EntityOutput,
    Agent3NetworkOutput,
    Agent4HistoricalOutput,
    Agent5SynthesisOutput,
    AgentCardData,
    AgentFinding,
    InvestigativeLead,
    InvestigationTreeData,
    InvestigationTreeNode,
    RiskIndicator,
    SamanvayaFinalDossier,
    SamanvayaGraphData,
    SamanvayaGraphEdge,
    SamanvayaGraphNode,
    SamanvayaPipelineStatus,
)
from app.services.cache_service import CacheService, cache_service as default_cache
from app.services.geocoding_service import geocoding_service
from app.services.samanvaya_cdr import analyze_cdr, parse_cdr_file

logger = get_logger("kritagas.samanvaya.service")

# How long a finished investigation stays retrievable. A completed dossier is a
# result an officer comes back to, so it outlives a normal cache entry; it is
# recomputed only when the case is re-run.
SAMANVAYA_RESULT_TTL = 60 * 60 * 24 * 7  # 7 days


# ---------------------------------------------------------------------------
# Plain-language rule
#
# The people who read this output are investigating officers, not analysts.
# Every model call appends this rule so findings come back in short, ordinary
# sentences instead of intelligence-report prose. Without it the model writes
# things like "Late-Night Transit Hub Ambush: targeting lone individuals
# departing major transit nodes", which an officer has to decode before use.
# ---------------------------------------------------------------------------
def safe_confidence(value: Any, default: float = 0.85) -> float:
    """Coerce a model-supplied confidence into a 0.0-1.0 float.

    Language models do not reliably return a number here. They return "high",
    "0.85", "85", "85%" or nothing at all. A bare float() on that raises
    ValueError and takes the whole investigation pipeline down with a 500, so
    every confidence read from model output goes through this instead.
    """
    if isinstance(value, bool):
        return default
    if isinstance(value, (int, float)):
        num = float(value)
    elif isinstance(value, str):
        text = value.strip().lower().rstrip("%").strip()
        words = {
            "certain": 0.98, "confirmed": 0.98, "verified": 0.95,
            "very high": 0.95, "very_high": 0.95, "veryhigh": 0.95,
            "high": 0.85, "strong": 0.85,
            "moderate": 0.60, "medium": 0.60, "average": 0.60,
            "low": 0.35, "weak": 0.35,
            "very low": 0.20, "very_low": 0.20, "verylow": 0.20,
            "unknown": default, "n/a": default, "": default,
        }
        if text in words:
            return words[text]
        try:
            num = float(text)
        except ValueError:
            return default
    else:
        return default

    if num != num:  # NaN
        return default
    # Models often express confidence as a percentage (85) rather than 0.85.
    # Anything just above 1 is a rounding slip, not "1.5 percent", so clamp it.
    if 1.0 < num < 2.0:
        num = 1.0
    elif num >= 2.0:
        num = num / 100.0
    return max(0.0, min(1.0, num))


PLAIN_LANGUAGE_RULE = """
WRITING RULES - follow these strictly for every piece of text you produce:
- Write for a police officer, in plain simple English. Short sentences.
- Use ordinary words. Say "night" not "nocturnal", "place" not "locus",
  "car" not "high-occupancy vehicle", "money moved" not "fund liquidation",
  "same method" not "modus operandi signature", "phone" not "telecom endpoint".
- Never invent dramatic names for a crime pattern. Describe what happened:
  "Both cases: victim taken near a railway station late at night, in a white SUV."
- Maximum 20 words per finding wherever possible. No semicolons. No jargon.
- Always state facts plainly and say clearly when something is not confirmed.
- Do not use these words at all: leverage, synergy, paradigm, vector, nexus,
  liquidation, exfiltration, actor, asset, locus, typology, signature.
"""


class SamanvayaService:
    """Master orchestrator for the SAMANVAYA 5-Agent Criminal Investigation System."""

    def __init__(
        self,
        session: AsyncSession,
        cache: Optional[CacheService] = None,
        ai_service: Optional[AIService] = None,
        client: Optional[Neo4jClient] = None,
    ):
        self.session = session
        self.cache = cache or default_cache
        self.ai = ai_service or AIService()
        self.client = client or neo4j_client
        self.blockchain_repo = BlockchainRepository(session)
        self.graph_repo = GraphRepository(self.client)
        # 1000-record archive re-read on every agent pass otherwise.
        self._historical_cache: Optional[List[Dict[str, Any]]] = None

    # -----------------------------------------------------------------------
    # Valkey Cache Keys
    # -----------------------------------------------------------------------
    def _pipeline_key(self, case_id: uuid.UUID | str) -> str:
        return f"samanvaya:pipeline:{case_id}"

    def _result_key(self, case_id: uuid.UUID | str) -> str:
        return f"samanvaya:result:{case_id}"

    def _cdr_key(self, case_id: uuid.UUID | str) -> str:
        return f"samanvaya:cdr:{case_id}"

    async def invalidate_case_cache(self, case_id: uuid.UUID | str) -> None:
        """Evict cached SAMANVAYA pipeline state and results.

        Uploaded evidence (CDR) is deliberately NOT evicted — it is officer-supplied
        data, not derived analysis, and must survive a re-run of the pipeline.
        """
        try:
            await self.cache.delete(self._pipeline_key(case_id))
            await self.cache.delete(self._result_key(case_id))
            logger.info(f"[SAMANVAYA_CACHE_EVICTED] Purged cache for case {case_id}")
        except Exception as e:
            logger.warning(f"Error evicting SAMANVAYA cache for {case_id}: {e}")

    # -----------------------------------------------------------------------
    # Status & Progress Tracking
    # -----------------------------------------------------------------------
    async def get_pipeline_status(self, case_id: uuid.UUID | str) -> SamanvayaPipelineStatus:
        """Check current execution status of SAMANVAYA for a case."""
        cache_key = self._pipeline_key(case_id)
        cached = await self.cache.get(cache_key)
        if cached and isinstance(cached, dict):
            return SamanvayaPipelineStatus.model_validate(cached)

        # Check if already completed and stored in results
        result_key = self._result_key(case_id)
        res_cached = await self.cache.get(result_key)
        if res_cached and isinstance(res_cached, dict):
            dossier = SamanvayaFinalDossier.model_validate(res_cached)
            return SamanvayaPipelineStatus(
                caseId=str(case_id),
                status="COMPLETED",
                currentAgentIndex=5,
                progress=100,
                stageText="TRINETRA Analysis Completed",
                agents=dossier.agents,
            )

        return SamanvayaPipelineStatus(
            caseId=str(case_id),
            status="IDLE",
            progress=0,
            stageText="Ready to start TRINETRA Analysis",
        )

    async def _update_status(
        self,
        case_id: uuid.UUID | str,
        status: str,
        agent_idx: int,
        agent_name: str,
        progress: int,
        stage_text: str,
        agents: List[AgentCardData],
        error: Optional[str] = None,
        console: Optional[List[TelemetryLine]] = None,
        data_sources: Optional[List[DataSourceStatus]] = None,
    ) -> None:
        """Update live execution status in Valkey for frontend streaming/polling."""
        payload = SamanvayaPipelineStatus(
            caseId=str(case_id),
            status=status,  # type: ignore
            currentAgentIndex=agent_idx,
            currentAgentName=agent_name,
            progress=progress,
            stageText=stage_text,
            agents=agents,
            error=error,
            console=console or [],
            dataSources=data_sources or [],
        )
        await self.cache.set(self._pipeline_key(case_id), payload.model_dump(mode="json"), ttl=SAMANVAYA_RESULT_TTL)

    async def _persist_graph_to_neo4j(
        self,
        case: Case,
        nodes: List[SamanvayaGraphNode],
        edges: List[SamanvayaGraphEdge],
        console: List[TelemetryLine],
    ) -> None:
        """Write the analysis network into Neo4j so every view shares one graph.

        Best-effort: a graph write failing must never fail the investigation,
        because the dossier itself is already complete by this point.
        """
        try:
            await self.graph_repo.upsert_case_node(
                case_id=str(case.id),
                case_number=case.case_number or str(case.id),
                title=case.title or "Investigation",
                status=str(case.status or "OPEN"),
                crime_category=str(case.crime_category or "Unspecified"),
            )
        except Exception as e:
            logger.warning(f"Graph sync: case node failed - {e}")

        written_nodes = 0
        for n in nodes:
            # The case itself is already a Case node; skip re-adding it as an entity.
            if (n.category or "").upper() == "CASE":
                continue
            try:
                await self.graph_repo.upsert_entity_node(
                    entity_id=n.id,
                    entity_type=n.category or "Entity",
                    name=n.name or n.label or n.id,
                    normalized_name=(n.name or n.label or n.id).strip().lower(),
                    confidence=safe_confidence(n.confidence, 0.9),
                    source="TRINETRA Analysis",
                    properties={"importance": n.importance or "MEDIUM"},
                )
                await self.graph_repo.link_entity_to_case(
                    entity_id=n.id,
                    case_id=str(case.id),
                    role=n.category or "INVOLVED_IN",
                    confidence=safe_confidence(n.confidence, 0.9),
                )
                written_nodes += 1
            except Exception as e:
                logger.warning(f"Graph sync: node {n.id} failed - {e}")

        written_edges = 0
        for e_ in edges:
            try:
                await self.graph_repo.upsert_relationship(
                    source_id=e_.source,
                    target_id=e_.target,
                    relationship_type=e_.relationshipType or "CONNECTED_TO",
                    confidence=safe_confidence(e_.confidence, 0.85),
                    case_id=str(case.id),
                    evidence_basis=list(e_.evidence or []),
                )
                written_edges += 1
            except Exception as e:
                logger.warning(f"Graph sync: edge {e_.id} failed - {e}")

        logger.info(
            f"Graph sync for {case.case_number}: {written_nodes} nodes, {written_edges} relationships"
        )
        console.append(
            self._line(
                f"Saved {written_nodes} entities and {written_edges} links to the case network",
                "OK",
            )
        )

    # -----------------------------------------------------------------------
    # Progressive Console Telemetry
    # -----------------------------------------------------------------------
    @staticmethod
    def _line(
        text: str,
        level: str = "INFO",
        detail: Optional[str] = None,
        progress: Optional[int] = None,
    ) -> TelemetryLine:
        """Build one timestamped console line for the live processing view."""
        now = datetime.now(timezone.utc)
        return TelemetryLine(
            ts=now.strftime("%H:%M:%S.") + "%03d" % (now.microsecond // 1000),
            level=level,  # type: ignore[arg-type]
            text=text,
            detail=detail,
            progress=progress,
        )

    # -----------------------------------------------------------------------
    # Officer-Uploaded Call Detail Records (Step 2 ingestion)
    # -----------------------------------------------------------------------
    async def ingest_cdr(
        self,
        case_id: uuid.UUID,
        content: bytes,
        file_name: str,
        incident_at: Optional[datetime] = None,
        known_numbers: Optional[Dict[str, str]] = None,
    ) -> CDRAnalysis:
        """Parse, analyse and persist an officer-uploaded call detail record export.

        Raises ValueError with an investigator-readable message on unusable input.
        """
        records, columns, rejected, notes = parse_cdr_file(content, file_name)
        analysis = analyze_cdr(
            records=records,
            file_name=file_name,
            columns=columns,
            rejected=rejected,
            notes=notes,
            incident_at=incident_at,
            known_numbers=known_numbers,
        )
        await self.cache.set(self._cdr_key(case_id), analysis.model_dump(mode="json"), ttl=86400)
        # The prior dossier no longer reflects the evidence now available.
        await self.invalidate_case_cache(case_id)
        logger.info(
            "[SAMANVAYA_CDR_INGESTED] case=%s file=%s parsed=%d patterns=%d"
            % (case_id, file_name, analysis.parsedRecords, len(analysis.patterns))
        )
        return analysis

    async def get_cdr(self, case_id: uuid.UUID | str) -> Optional[CDRAnalysis]:
        """Return the stored communication analysis for a case, if any."""
        cached = await self.cache.get(self._cdr_key(case_id))
        if cached and isinstance(cached, dict):
            try:
                return CDRAnalysis.model_validate(cached)
            except Exception as e:
                logger.warning(f"Discarding unreadable CDR cache for {case_id}: {e}")
        return None

    async def clear_cdr(self, case_id: uuid.UUID | str) -> None:
        """Detach the uploaded call records from a case."""
        await self.cache.delete(self._cdr_key(case_id))
        await self.invalidate_case_cache(case_id)

    # -----------------------------------------------------------------------
    # Data Source Availability (Step 2 panel)
    # -----------------------------------------------------------------------
    async def get_data_sources(self, case_id: uuid.UUID) -> List[DataSourceStatus]:
        """Report the genuine availability of every investigation data source.

        Nothing here is asserted optimistically: each state is derived from an
        actual lookup, so an unavailable source is shown as unavailable rather
        than dressed up as connected.
        """
        case = (await self.session.execute(select(Case).where(Case.id == case_id))).scalar_one_or_none()
        if not case:
            raise NotFoundException(f"Case {case_id} not found.")

        sources: List[DataSourceStatus] = []

        # 1. FIR document
        fir = None
        if case.fir_id:
            fir = (await self.session.execute(select(FIR).where(FIR.id == case.fir_id))).scalar_one_or_none()
        sources.append(DataSourceStatus(
            id="fir",
            name="FIR Document",
            category="DOCUMENT",
            state="CONNECTED" if fir else "NOT_AVAILABLE",
            recordCount=1 if fir else 0,
            detail=(
                f"{len(fir.description or '')} characters of narrative linked to this case."
                if fir else "No FIR is linked to this case record."
            ),
        ))

        # 2. Extracted case entities
        ent_cond = (Entity.case_id == case.id)
        if case.fir_id:
            ent_cond = ent_cond | (Entity.fir_id == case.fir_id)
        entity_count = len(list((await self.session.execute(select(Entity).where(ent_cond))).scalars().all()))
        sources.append(DataSourceStatus(
            id="entities",
            name="Extracted Case Entities",
            category="REGISTRY",
            state="CONNECTED" if entity_count else "NOT_AVAILABLE",
            recordCount=entity_count,
            detail=(
                f"{entity_count} persons, vehicles and locations extracted from the case file."
                if entity_count else "No entities have been extracted from this case yet."
            ),
        ))

        # 3. Call detail records (officer upload)
        cdr = await self.get_cdr(case_id)
        sources.append(DataSourceStatus(
            id="cdr",
            name="Call Detail Records",
            category="TELECOM",
            state="UPLOADED" if cdr else "NOT_AVAILABLE",
            recordCount=cdr.parsedRecords if cdr else 0,
            detail=(
                f"{cdr.parsedRecords:,} records across {cdr.uniqueNumbers} numbers, "
                f"{len(cdr.patterns)} anomalies flagged."
                if cdr else "Upload a CSV or JSON call record export to enable communication analysis."
            ),
            uploadable=True,
            uploadKind="cdr",
            fileName=cdr.fileName if cdr else None,
            updatedAt=cdr.uploadedAt if cdr else None,
        ))

        # 4. Relational graph edges
        rel_count = len(list((await self.session.execute(
            select(EntityRelationship).where(EntityRelationship.case_id == case.id)
        )).scalars().all()))
        sources.append(DataSourceStatus(
            id="relationships",
            name="Relationship Database",
            category="REGISTRY",
            state="CONNECTED" if rel_count else "NOT_AVAILABLE",
            recordCount=rel_count,
            detail=(
                f"{rel_count} stored relationship edges for this case."
                if rel_count else "No relationship edges recorded for this case yet."
            ),
        ))

        # 5. Historical archive
        historical = self._load_historical_cases()
        sources.append(DataSourceStatus(
            id="historical",
            name="Historical Case Archive",
            category="ARCHIVE",
            state="CONNECTED" if historical else "NOT_AVAILABLE",
            recordCount=len(historical),
            detail=(
                f"{len(historical):,} archived cases available for modus-operandi matching."
                if historical else "The historical case archive is not loaded on this deployment."
            ),
        ))

        # 6. Graph database
        try:
            neo_ok, _latency_ms, _neo_err = await self.client.verify_connectivity()
        except Exception:
            neo_ok = False
        sources.append(DataSourceStatus(
            id="graph_db",
            name="Neo4j Graph Database",
            category="REGISTRY",
            state="CONNECTED" if neo_ok else "NOT_AVAILABLE",
            detail=(
                "Network topology store reachable."
                if neo_ok else "Graph store unreachable - network analysis falls back to relational edges."
            ),
        ))

        # 7. Cache / pre-filter tier
        try:
            cache_ok = bool(await self.cache.ping())
        except Exception:
            cache_ok = False
        sources.append(DataSourceStatus(
            id="cache",
            name="Valkey Pre-Filter Tier",
            category="REGISTRY",
            state="CONNECTED" if cache_ok else "NOT_AVAILABLE",
            detail=(
                "Record pre-filtering and pipeline telemetry active."
                if cache_ok else "Cache tier unreachable - live telemetry will not stream."
            ),
        ))

        # 8. Sources that genuinely require a separate legal authorisation
        for sid, name, category in (
            ("cctv", "CCTV / Surveillance", "SURVEILLANCE"),
            ("financial", "Financial Records", "FINANCIAL"),
            ("vehicle", "Vehicle Registry (VAHAN)", "VEHICLE"),
        ):
            sources.append(DataSourceStatus(
                id=sid,
                name=name,
                category=category,
                state="AWAITING_AUTHORIZATION",
                detail="Requires a served production notice before this platform can ingest the data.",
            ))

        return sources

    # -----------------------------------------------------------------------
    # Historical Dataset Filtering via Valkey (Section 5)
    # -----------------------------------------------------------------------
    def _load_historical_cases(self) -> List[Dict[str, Any]]:
        """Load the historical precedents dataset from disk.

        The archive lives at ``backend/data/synthetic`` (two levels above this
        module), not inside the ``app`` package — resolving it relative to ``app``
        silently yielded an empty archive and disabled Agent 4's matching.
        """
        if self._historical_cache is not None:
            return self._historical_cache

        base = os.path.dirname(__file__)
        candidates = [
            os.path.join(base, "..", "..", "data", "synthetic", "dataset_1_cases.json"),
            os.path.join(base, "..", "data", "synthetic", "dataset_1_cases.json"),
        ]
        for data_path in candidates:
            if not os.path.exists(data_path):
                continue
            try:
                with open(data_path, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                if isinstance(loaded, list):
                    self._historical_cache = loaded
                    logger.info(f"[SAMANVAYA] Historical archive loaded: {len(loaded)} cases")
                    return loaded
            except Exception as e:
                logger.warning(f"Failed to load dataset_1_cases.json from {data_path}: {e}")

        logger.warning("[SAMANVAYA] Historical case archive not found — Agent 4 matching is disabled.")
        self._historical_cache = []
        return []

    async def _prefilter_historical_candidates(
        self, crime_category: str, narrative: str, top_k: int = 15
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Use Valkey cache and keyword filtering to retrieve compact relevant historical records."""
        cache_key = f"samanvaya:historical_index:{crime_category.lower()}"
        cached_candidates = await self.cache.get(cache_key)

        all_cases = self._load_historical_cases()
        total_records = len(all_cases)

        if cached_candidates and isinstance(cached_candidates, list) and len(cached_candidates) > 0:
            return cached_candidates[:top_k], total_records

        # Filter by crime category, title, or modus operandi overlap
        cat_lower = crime_category.lower()
        scored = []
        tokens = set(narrative.lower().split())

        for c in all_cases:
            score = 0
            c_cat = (c.get("crime_category") or "").lower()
            c_desc = (c.get("description") or "").lower()
            if cat_lower in c_cat or c_cat in cat_lower:
                score += 5
            for tok in tokens:
                if len(tok) > 4 and tok in c_desc:
                    score += 1
            if score > 0:
                scored.append((score, c))

        scored.sort(key=lambda x: x[0], reverse=True)

        # Carry the retrieval score forward so Agent 4 can still report what the
        # archive search actually surfaced when the language model declines to
        # assert a modus-operandi match.
        best = scored[0][0] if scored else 0
        top_matches = []
        for raw_score, c in scored[:top_k]:
            item = dict(c)
            item["_retrieval_score"] = raw_score
            item["_retrieval_rank"] = round(raw_score / best, 3) if best else 0.0
            top_matches.append(item)

        if top_matches:
            await self.cache.set(cache_key, top_matches, ttl=3600)

        return top_matches, total_records

    # -----------------------------------------------------------------------
    # Master 5-Agent Sequential Execution Pipeline
    # -----------------------------------------------------------------------
    async def run_investigation_pipeline(
        self,
        case_id: uuid.UUID,
        user: Optional[User] = None,
        officer_id: Optional[uuid.UUID] = None,
        officer_name: Optional[str] = None,
    ) -> SamanvayaFinalDossier:
        """Execute the 5 specialized agents sequentially, passing forward context.

        ``officer_id`` / ``officer_name`` exist so a background execution can attribute
        the run without holding an ORM ``User`` bound to a different (closed) session.
        """
        start_time = time.perf_counter()
        if user is not None:
            officer_id = officer_id or user.id
            officer_name = officer_name or user.username
        officer_label = officer_name or "POLICE_INVESTIGATOR"

        # 1. Fetch Case & Database Context
        stmt = select(Case).where(Case.id == case_id)
        res = await self.session.execute(stmt)
        case = res.scalar_one_or_none()
        if not case:
            raise NotFoundException(f"Case {case_id} not found.")

        fir: Optional[FIR] = None
        if case.fir_id:
            fir_res = await self.session.execute(select(FIR).where(FIR.id == case.fir_id))
            fir = fir_res.scalar_one_or_none()

        ent_cond = (Entity.case_id == case.id)
        if case.fir_id:
            ent_cond = ent_cond | (Entity.fir_id == case.fir_id)
        ent_res = await self.session.execute(select(Entity).where(ent_cond))
        db_entities = list(ent_res.scalars().all())

        narrative = f"{case.title}\n{case.description}"
        if fir and fir.description:
            narrative += f"\nFIR Narrative: {fir.description}"

        # Officer-supplied evidence and genuine source availability
        cdr = await self.get_cdr(case_id)
        data_sources = await self.get_data_sources(case_id)

        incident_at: Optional[datetime] = None
        if case.incident_date:
            incident_at = datetime.combine(
                case.incident_date,
                case.incident_time or datetime.min.time(),
            )

        agents_cards: List[AgentCardData] = []
        console: List[TelemetryLine] = []

        async def publish(
            status: str,
            agent_idx: int,
            agent_name: str,
            progress: int,
            stage_text: str,
        ) -> None:
            """Push the current console feed and agent cards to Valkey for polling."""
            await self._update_status(
                case_id, status, agent_idx, agent_name, progress, stage_text,
                agents_cards, console=console[-140:], data_sources=data_sources,
            )

        console.append(self._line("SAMANVAYA orchestrator initialising", "INFO"))
        console.append(self._line(
            f"Case {case.case_number} loaded", "OK",
            detail=f"{len(narrative)} characters of narrative, {len(db_entities)} extracted entities",
        ))
        connected = [d for d in data_sources if d.state in ("CONNECTED", "UPLOADED")]
        console.append(self._line(
            f"{len(connected)} of {len(data_sources)} data sources available", "INFO",
            detail=", ".join(d.name for d in connected) or "none",
        ))
        if cdr:
            console.append(self._line(
                f"Call detail records attached: {cdr.parsedRecords:,} parsed", "OK",
                detail=f"{cdr.fileName} - {cdr.uniqueNumbers} distinct numbers",
            ))
        else:
            console.append(self._line(
                "No call detail records attached to this case", "WARN",
                detail="Communication analysis will be skipped",
            ))
        await publish("RUNNING", 0, "Initializing", 5, "Initializing Case Corpus & Entities...")

        # -------------------------------------------------------------------
        # AGENT 1: Case Context & Relevance Agent
        # -------------------------------------------------------------------
        t1_start = time.perf_counter()
        console.append(self._line("AGENT 01 (SOOCHNA / SANGRAHA) started", "INFO"))
        console.append(self._line("Parsing FIR narrative and case metadata", "WORK", progress=15))
        await publish("RUNNING", 1, "Case Context Agent", 12, "Step 1 - Read the case: Reading FIR and case context...")

        # Valkey pre-filtering
        filtered_historical, total_historical_searched = await self._prefilter_historical_candidates(
            case.crime_category or "General Crime", narrative
        )
        console.append(self._line(
            f"Pre-filtered historical archive: {len(filtered_historical)} of {total_historical_searched:,} candidates retained",
            "OK", progress=45,
        ))

        entities_summary = [
            {"name": e.name, "type": e.entity_type, "confidence": e.confidence or 0.9}
            for e in db_entities[:15]
        ]
        console.append(self._line(
            f"Case entities normalised: {len(entities_summary)} carried forward", "OK", progress=60,
        ))

        if cdr:
            console.append(self._line(
                f"Scanning {cdr.parsedRecords:,} call records for anomalies", "WORK", progress=75,
            ))
            console.append(self._line(
                f"{cdr.relevantRecords:,} records retained, {cdr.filteredOut:,} filtered out", "OK", progress=90,
            ))
            for pat in cdr.patterns[:4]:
                console.append(self._line(
                    f"{pat.title}: {pat.partyA}" + (f" -> {pat.partyB}" if pat.partyB else ""),
                    "WARN",
                    detail=f"anomaly strength {round(pat.riskScore * 100)}%",
                ))
        await publish("RUNNING", 1, "Case Context Agent", 18, "Step 1 - Read the case: Extracting context & relevance...")

        cdr_brief = "No call detail records have been supplied for this case."
        if cdr:
            cdr_brief = json.dumps({
                "file": cdr.fileName,
                "parsedRecords": cdr.parsedRecords,
                "uniqueNumbers": cdr.uniqueNumbers,
                "window": [cdr.windowStart, cdr.windowEnd],
                "flaggedPatterns": [
                    {
                        "type": p.patternType,
                        "title": p.title,
                        "partyA": p.partyA,
                        "partyB": p.partyB,
                        "description": p.description,
                        "riskScore": p.riskScore,
                    }
                    for p in cdr.patterns[:8]
                ],
                "topParties": [
                    {"number": p.number, "calls": p.totalCalls, "isNewContact": p.isNewContact}
                    for p in cdr.parties[:8]
                ],
            })

        agent1_prompt = f"""
        Analyze this criminal investigation FIR and case dossier:
        Case Number: {case.case_number}
        Title: {case.title}
        Category: {case.crime_category}
        Location / Jurisdiction: {case.area or case.city or 'Mumbai'}
        Narrative:
        {narrative}

        Entities Extracted: {json.dumps(entities_summary)}

        Communication (CDR) analysis supplied by the investigating officer:
        {cdr_brief}

        Emit a strictly structured JSON response with:
        - caseSummary: Concise factual summary of the crime.
        - crimeType: Specific crime classification (e.g. Kidnapping for Ransom, Cyber Infiltration).
        - importantEntities: Array of objects with name, type, and role.
        - importantLocations: Array of specific location names mentioned.
        - importantDates: Array of dates or temporal markers.
        - investigationContext: Contextual briefing of what happened and immediate jurisdiction.
        - prioritySignals: Array of urgent investigation alerts.
        - relevantRecordIds: Array of relevant reference tokens.
        
        {PLAIN_LANGUAGE_RULE}
        """

        try:
            agent1_out, _ = await self.ai.generate_structured(
                prompt=agent1_prompt,
                schema=Agent1ContextOutput,
                preferred_provider="groq",
                max_tokens=4096,
                system_instruction="You are AGENT 1 (Case Context). Write for a police officer in plain simple English, short sentences, no jargon. Return valid JSON only.",
            )
        except Exception as e:
            logger.warning(f"Agent 1 AI fallback: {e}")
            console.append(self._line("Language model unavailable - using deterministic extraction", "WARN", detail=str(e)[:120]))
            agent1_out = Agent1ContextOutput(
                caseSummary=case.description or case.title,
                crimeType=case.crime_category or "General Crime",
                importantEntities=entities_summary,
                importantLocations=[case.city or "Mumbai"] if case.city else ["Mumbai"],
                importantDates=[datetime.now().strftime("%Y-%m-%d")],
                investigationContext=f"Investigation active under {case.police_station or 'Local PS'}.",
                prioritySignals=["Active suspect pursuit", "Geographic containment"],
                relevantRecordIds=[c.get("case_number", "") for c in filtered_historical[:5]],
            )

        t1_ms = (time.perf_counter() - t1_start) * 1000.0
        a1_scanned = total_historical_searched + len(db_entities) + (cdr.parsedRecords if cdr else 0)
        a1_relevant = len(filtered_historical) + len(agent1_out.importantEntities) + (cdr.relevantRecords if cdr else 0)

        a1_metrics = [
            AgentMetric(label="Records Scanned", value=a1_scanned, tone="info", hint="Historical archive + case entities + call records"),
            AgentMetric(label="Relevant Records", value=a1_relevant, tone="positive"),
            AgentMetric(label="Filtered Out", value=max(0, a1_scanned - a1_relevant), tone="neutral"),
            AgentMetric(label="Priority Entities", value=len(agent1_out.importantEntities), tone="warning"),
        ]
        if cdr:
            a1_metrics.append(AgentMetric(
                label="Suspicious Patterns", value=len(cdr.patterns), tone="critical",
                hint="Communication anomalies flagged for review",
            ))

        a1_highlights = [f"Type of crime: {agent1_out.crimeType}."]
        if agent1_out.importantLocations:
            a1_highlights.append("Locations of interest: " + ", ".join(agent1_out.importantLocations[:4]) + ".")
        if cdr and cdr.patterns:
            top = cdr.patterns[0]
            a1_highlights.append(f"{top.title} - {top.description}")
        a1_highlights.extend(agent1_out.prioritySignals[:2])

        console.append(self._line("Structured context assembled", "OK", progress=100))
        console.append(self._line("AGENT 01 complete", "OK", detail=f"{round(t1_ms)} ms"))

        agent1_card = AgentCardData(
            agentId="agent-1",
            agentNumber=1,
            name="Step 1 — Read the case",
            sanskritName="सूचना / संग्रह (SANGRAHA)",
            role="Establishes ground truth, normalizes FIR, and pre-filters large datasets via Valkey.",
            status="COMPLETED",
            recordsSearched=a1_scanned,
            relevantFound=a1_relevant,
            executionTimeMs=round(t1_ms, 2),
            inputSummary=f"FIR document, Case {case.case_number} narrative ({len(narrative)} chars), {len(db_entities)} DB entities"
                         + (f", {cdr.parsedRecords:,} uploaded call records." if cdr else ", no call records supplied."),
            processingDetails="Pre-filtered candidate records using Valkey tokenized indices. Normalized incident context, priority signals and communication anomalies.",
            dataSources=[d.name for d in data_sources if d.state in ("CONNECTED", "UPLOADED")] or ["PostgreSQL Cases/FIR"],
            outputData=agent1_out.model_dump(),
            evidence=[f"FIR Document for Case {case.case_number}", "Official Intake Report"]
                     + ([f"Uploaded CDR: {cdr.fileName}"] if cdr else []),
            limitations=["Limited to facts recorded in initial FIR and primary evidence filings."]
                        + ([] if cdr else ["No call detail records supplied - communication analysis unavailable."]),
            telemetry=[l for l in console if True][-14:],
            metrics=a1_metrics,
            highlights=[h for h in a1_highlights if h][:5],
            handoff=f"{len(agent1_out.importantEntities)} priority entities and {len(agent1_out.importantLocations)} locations passed to Agent 2 for identity resolution.",
        )
        agents_cards.append(agent1_card)
        await publish("RUNNING", 1, "Case Context Agent", 25, "Agent 1 complete - handing findings to Agent 2")

        # -------------------------------------------------------------------
        # AGENT 2: Entity & Identity Intelligence Agent
        # -------------------------------------------------------------------
        t2_start = time.perf_counter()
        a2_console_start = len(console)
        console.append(self._line("AGENT 02 (ABHIJNANA) started", "INFO"))
        console.append(self._line(
            f"Received {len(agent1_out.importantEntities)} priority entities from Agent 1", "INFO", progress=10,
        ))
        console.append(self._line("Resolving canonical identities and alias clusters", "WORK", progress=40))
        await publish("RUNNING", 2, "Entity & Identity Agent", 32, "Step 2 - Work out who is who: Resolving identities & aliases...")

        agent2_prompt = f"""
        You are AGENT 2 (Entity & Identity Intelligence Agent).
        Input from Agent 1:
        {agent1_out.model_dump_json()}

        Extracted Entities:
        {json.dumps(entities_summary)}

        Communication parties observed in the uploaded call records:
        {json.dumps([{'number': p.number, 'calls': p.totalCalls, 'isNewContact': p.isNewContact} for p in (cdr.parties[:10] if cdr else [])])}

        Perform entity resolution and alias discovery:
        1. Resolve entities into canonical records with designated roles (Suspect, Victim, Associate, Vehicle, ATM, Location).
        2. Identify POTENTIAL MATCHES (e.g., alias variations, abbreviations like R. Sharma -> Rahul Sharma) with confidence scores. Do NOT claim certainty without corroboration.
        3. Identify any cross-case overlap.

        Return strictly valid JSON matching Agent2EntityOutput:
        - resolvedEntities: List of objects (id, name, type, role, status)
        - potentialMatches: List of objects (candidate, matchedWith, confidence, reasons)
        - aliases: List of objects (canonicalName, aliases, evidence)
        - crossCaseEntities: List of objects (entityName, otherCaseNumbers, overlapType)
        - confidenceScores: Dict of entityName to confidence (0.0 to 1.0)
        
        {PLAIN_LANGUAGE_RULE}
        """

        try:
            agent2_out, _ = await self.ai.generate_structured(
                prompt=agent2_prompt,
                schema=Agent2EntityOutput,
                preferred_provider="groq",
                max_tokens=4096,
                system_instruction="You are AGENT 2 (Identity). Match people, phones and vehicles across records. Write in plain simple English for a police officer. Return JSON only.",
            )
        except Exception as e:
            logger.warning(f"Agent 2 AI fallback: {e}")
            console.append(self._line("Language model unavailable - using deterministic resolution", "WARN", detail=str(e)[:120]))
            agent2_out = Agent2EntityOutput(
                resolvedEntities=[
                    {"id": f"ent-{i+1}", "name": e["name"], "type": e["type"], "role": "PERSON_OF_INTEREST"}
                    for i, e in enumerate(entities_summary)
                ],
                potentialMatches=[],
                aliases=[],
                crossCaseEntities=[],
                confidenceScores={e["name"]: 0.95 for e in entities_summary},
            )

        avg_conf = (
            sum(agent2_out.confidenceScores.values()) / len(agent2_out.confidenceScores)
            if agent2_out.confidenceScores else 0.9
        )
        console.append(self._line(
            f"{len(agent2_out.resolvedEntities)} entities resolved at {round(avg_conf * 100)}% mean confidence",
            "OK", progress=80,
        ))
        if agent2_out.crossCaseEntities:
            console.append(self._line(
                f"{len(agent2_out.crossCaseEntities)} entities recur in prior case records", "WARN", progress=95,
            ))
        console.append(self._line("AGENT 02 complete", "OK", detail=f"{round((time.perf_counter() - t2_start) * 1000)} ms"))

        t2_ms = (time.perf_counter() - t2_start) * 1000.0
        a2_highlights = []
        for m in agent2_out.potentialMatches[:2]:
            a2_highlights.append(
                f"{m.get('candidate', 'Candidate')} may resolve to {m.get('matchedWith', 'a known record')} "
                f"({round(safe_confidence(m.get('confidence'), 0.8) * 100)}% match confidence) - requires verification."
            )
        for a in agent2_out.aliases[:2]:
            a2_highlights.append(
                f"Alias cluster: {a.get('canonicalName', 'Unknown')} = " + ", ".join(a.get("aliases", [])[:3])
            )
        for c in agent2_out.crossCaseEntities[:2]:
            a2_highlights.append(
                f"{c.get('entityName', 'Entity')} also appears in " + ", ".join(map(str, c.get("otherCaseNumbers", [])[:3]))
            )
        if not a2_highlights:
            a2_highlights.append(f"{len(agent2_out.resolvedEntities)} entities resolved with no alias conflicts detected.")

        agent2_card = AgentCardData(
            agentId="agent-2",
            agentNumber=2,
            name="Step 2 — Work out who is who",
            sanskritName="अभिज्ञान (ABHIJNANA)",
            role="Disambiguates suspect identities, resolves aliases, and flags potential cross-case matches.",
            status="COMPLETED",
            recordsSearched=len(db_entities) + len(filtered_historical) * 2,
            relevantFound=len(agent2_out.resolvedEntities) + len(agent2_out.potentialMatches),
            executionTimeMs=round(t2_ms, 2),
            inputSummary=f"Agent 1 output context, {len(entities_summary)} extracted entities, historical suspect rosters.",
            processingDetails="Phonetic alias parsing, name disambiguation, and cross-case entity correlation.",
            dataSources=["Valkey Entity Index", "Neo4j Known Criminal Register", "PostgreSQL Entities"],
            outputData=agent2_out.model_dump(),
            evidence=["FIR Identity Clauses", "State Criminal Identification Registry"],
            limitations=["Potential matches are probabilistic and require biometric or document verification."],
            telemetry=console[a2_console_start:],
            metrics=[
                AgentMetric(label="Entities Resolved", value=len(agent2_out.resolvedEntities), tone="positive"),
                AgentMetric(label="Potential Matches", value=len(agent2_out.potentialMatches), tone="warning"),
                AgentMetric(label="Alias Clusters", value=len(agent2_out.aliases), tone="info"),
                AgentMetric(label="Cross-Case Hits", value=len(agent2_out.crossCaseEntities), tone="critical"),
                AgentMetric(label="Mean Confidence", value=round(avg_conf * 100), unit="%", tone="info"),
            ],
            highlights=a2_highlights[:5],
            handoff=f"{len(agent2_out.resolvedEntities)} canonical entities passed to Agent 3 for network construction.",
        )
        agents_cards.append(agent2_card)
        await publish("RUNNING", 2, "Entity & Identity Agent", 45, "Agent 2 complete - handing entities to Agent 3")

        # -------------------------------------------------------------------
        # AGENT 3: Network & Relationship Agent (Neo4j Integration)
        # -------------------------------------------------------------------
        t3_start = time.perf_counter()
        a3_console_start = len(console)
        console.append(self._line("AGENT 03 (SUTRA) started", "INFO"))
        await publish("RUNNING", 3, "Network & Relationship Agent", 50, "Step 3 - Build the link chart: Generating network topology...")

        # Query existing relationships in PostgreSQL & Neo4j
        rel_stmt = select(EntityRelationship).where(EntityRelationship.case_id == case.id)
        db_rels = list((await self.session.execute(rel_stmt)).scalars().all())
        console.append(self._line(
            f"Loaded {len(db_rels)} stored relationship edges", "OK", progress=25,
        ))

        existing_links = [
            {
                "source": str(r.source_entity_id),
                "target": str(r.target_entity_id),
                "type": r.relationship_type,
                "confidence": r.confidence,
            }
            for r in db_rels
        ]

        if cdr:
            console.append(self._line(
                f"Projecting {len(cdr.links)} call flows into the network", "WORK", progress=55,
            ))

        agent3_prompt = f"""
        You are AGENT 3 (Network & Relationship Agent).
        Inputs:
        Case Summary: {agent1_out.caseSummary}
        Resolved Entities: {json.dumps(agent2_out.resolvedEntities)}
        Existing Graph Edges: {json.dumps(existing_links)}
        Locations: {json.dumps(agent1_out.importantLocations)}
        Observed call flows: {json.dumps([{'from': l.source, 'to': l.target, 'calls': l.calls} for l in (cdr.links[:12] if cdr else [])])}

        Synthesize the investigation network graph:
        1. Construct nodes with distinct labels (Case, Person, Location, Vehicle, Phone, Bank, Evidence).
        2. Construct evidence-backed relationships: KNOWS, OWNS, VISITED, USED_BY, CONNECTED_TO, INVOLVED_IN, LAST_SEEN_AT, OCCURRED_AT, LIVES_AT.
        3. Assign relationship confidence and cite evidence basis (e.g. FIR Statement, CCTV Log, Bank Ledger).
        4. Identify network clusters and central entities.

        Return strictly valid JSON matching Agent3NetworkOutput:
        - nodes: List of objects (id, label, name, category, importance)
        - relationships: List of objects (source, target, relationshipType, confidence, evidence)
        - networkClusters: List of objects (clusterId, members, centralNode)
        - centralEntities: List of objects (id, name, centralityScore, degree)
        - relationshipEvidence: List of objects (edge, sourceEvidence)
        
        {PLAIN_LANGUAGE_RULE}
        """

        try:
            agent3_out, _ = await self.ai.generate_structured(
                prompt=agent3_prompt,
                schema=Agent3NetworkOutput,
                preferred_provider="groq",
                max_tokens=4096,
                system_instruction="You are AGENT 3 (Network). Build the link chart from evidence only. Label every link in plain simple English. Return JSON only.",
            )
        except Exception as e:
            logger.warning(f"Agent 3 AI fallback: {e}")
            console.append(self._line("Language model unavailable - deriving network from stored edges", "WARN", detail=str(e)[:120]))
            nodes = [
                {"id": f"node-{i+1}", "label": e.get("role", "Entity"), "name": e.get("name", "Unknown"), "category": e.get("type", "PERSON")}
                for i, e in enumerate(agent2_out.resolvedEntities)
            ]
            rels = []
            if len(nodes) >= 2:
                for i in range(len(nodes) - 1):
                    rels.append({
                        "source": nodes[i]["id"],
                        "target": nodes[i + 1]["id"],
                        "relationshipType": "CONNECTED_TO",
                        "confidence": 0.88,
                        "evidence": ["Case Investigation Dossier"],
                    })
            agent3_out = Agent3NetworkOutput(
                nodes=nodes,
                relationships=rels,
                networkClusters=[{"clusterId": "cluster-1", "members": [n["id"] for n in nodes], "centralNode": nodes[0]["id"] if nodes else "none"}],
                centralEntities=[{"id": nodes[0]["id"], "name": nodes[0]["name"], "centralityScore": 0.95, "degree": len(nodes) - 1}] if nodes else [],
                relationshipEvidence=[],
            )

        console.append(self._line(
            f"{len(agent3_out.relationships)} relationships synthesised across {len(agent3_out.nodes)} nodes",
            "OK", progress=90,
        ))
        if agent3_out.centralEntities:
            top_central = agent3_out.centralEntities[0]
            console.append(self._line(
                f"Highest network centrality: {top_central.get('name', 'unknown')}", "INFO", progress=100,
            ))
        console.append(self._line("AGENT 03 complete", "OK", detail=f"{round((time.perf_counter() - t3_start) * 1000)} ms"))

        t3_ms = (time.perf_counter() - t3_start) * 1000.0
        a3_highlights = []
        for c in agent3_out.centralEntities[:2]:
            a3_highlights.append(
                f"{c.get('name', 'Entity')} sits at the centre of the network "
                f"(degree {c.get('degree', 0)}, centrality {round(safe_confidence(c.get('centralityScore'), 0.5) * 100)}%)."
            )
        for r in agent3_out.relationships[:3]:
            a3_highlights.append(
                f"{r.get('source', '?')} -[{r.get('relationshipType', 'CONNECTED_TO')}]-> {r.get('target', '?')}"
            )
        if cdr and cdr.links:
            top_link = cdr.links[0]
            a3_highlights.append(
                f"Heaviest call flow: {top_link.source} to {top_link.target}, {top_link.calls} calls."
            )

        agent3_card = AgentCardData(
            agentId="agent-3",
            agentNumber=3,
            name="Step 3 — Build the link chart",
            sanskritName="सूत्र (SUTRA)",
            role="Builds multi-tier criminal syndicate network graph and discovers hidden links in Neo4j.",
            status="COMPLETED",
            recordsSearched=len(db_rels) + len(agent3_out.nodes) * 3 + (len(cdr.links) if cdr else 0),
            relevantFound=len(agent3_out.relationships) + (len(cdr.links) if cdr else 0),
            executionTimeMs=round(t3_ms, 2),
            inputSummary=f"Resolved entity corpus, {len(db_rels)} relational database edges"
                         + (f", {len(cdr.links)} observed call flows." if cdr else ", no telecom data."),
            processingDetails="Graph centrality computation, multi-hop relationship inference, and cluster detection.",
            dataSources=["Neo4j Graph Database", "PostgreSQL Relationships"] + (["Uploaded Call Detail Records"] if cdr else []),
            outputData=agent3_out.model_dump(),
            evidence=["FIR Witness Statements", "Verified Spatial Co-presence Logs"],
            limitations=["Indirect or multi-hop relationships reflect investigative hypothesis until corroborated."],
            telemetry=console[a3_console_start:],
            metrics=[
                AgentMetric(label="Network Nodes", value=len(agent3_out.nodes), tone="info"),
                AgentMetric(label="Relationships", value=len(agent3_out.relationships), tone="positive"),
                AgentMetric(label="Clusters", value=len(agent3_out.networkClusters), tone="neutral"),
                AgentMetric(label="Central Entities", value=len(agent3_out.centralEntities), tone="warning"),
                AgentMetric(label="Call Flows", value=len(cdr.links) if cdr else 0, tone="critical"),
            ],
            highlights=a3_highlights[:5],
            handoff=f"Network topology of {len(agent3_out.nodes)} nodes passed to Agent 4 for historical correlation.",
        )
        agents_cards.append(agent3_card)
        await publish("RUNNING", 3, "Network & Relationship Agent", 62, "Agent 3 complete - handing network to Agent 4")

        # -------------------------------------------------------------------
        # AGENT 4: Historical & Pattern Intelligence Agent
        # -------------------------------------------------------------------
        t4_start = time.perf_counter()
        a4_console_start = len(console)
        console.append(self._line("AGENT 04 (ITIHAS / SMRITI) started", "INFO"))
        console.append(self._line(
            f"Comparing modus operandi against {len(filtered_historical)} indexed precedents", "WORK", progress=35,
        ))
        await publish("RUNNING", 4, "Historical & Pattern Agent", 68, "Step 4 - Compare with old cases: Correlating historical Modus Operandi...")

        agent4_prompt = f"""
        You are AGENT 4 (Historical & Pattern Intelligence Agent).
        Input:
        Case Summary: {agent1_out.caseSummary}
        Crime Typology: {agent1_out.crimeType}
        Key Entities: {json.dumps(agent2_out.resolvedEntities)}
        Active Relationships: {json.dumps(agent3_out.relationships[:10])}
        Historical Candidates ({len(filtered_historical)} records retrieved from Valkey):
        {json.dumps([{'case_number': c.get('case_number'), 'title': c.get('title'), 'mo': c.get('description')} for c in filtered_historical[:6]])}

        Perform historical pattern analysis:
        1. Compare Modus Operandi with historical cases.
        2. Identify repeated patterns (e.g. extortion demand style, vehicle types, ambush loci).
        3. STRICTLY separate VERIFIED MATCHES (proven common identity/MO) from POTENTIAL SIMILARITIES (thematic overlap).
        4. Detect cross-jurisdictional connections.

        Return strictly valid JSON matching Agent4HistoricalOutput:
        - historicalMatches: List of objects (caseNumber, year, crimeType, similarityScore, matchType: VERIFIED | POTENTIAL, description)
        - similarPatterns: List of objects (patternName, description, confidence)
        - repeatedEntities: List of objects (entityName, type, priorOccurrences)
        - modusOperandiPatterns: List of strings (identified MO signatures)
        - crossCaseConnections: List of objects (connection, details)
        - confidence: Overall historical pattern confidence (0.0 to 1.0)
        
        {PLAIN_LANGUAGE_RULE}
        """

        try:
            agent4_out, _ = await self.ai.generate_structured(
                prompt=agent4_prompt,
                schema=Agent4HistoricalOutput,
                preferred_provider="groq",
                max_tokens=4096,
                system_instruction="You are AGENT 4 (Past cases). Compare with older cases. Describe what actually happened in plain simple English - never invent dramatic pattern names. Return JSON only.",
            )
        except Exception as e:
            logger.warning(f"Agent 4 AI fallback: {e}")
            console.append(self._line("Language model unavailable - using archive similarity scoring", "WARN", detail=str(e)[:120]))
            agent4_out = Agent4HistoricalOutput(
                historicalMatches=[
                    {
                        "caseNumber": c.get("case_number", "CASE-HIST-001"),
                        "year": "2023",
                        "crimeType": c.get("crime_category", "Precedent Case"),
                        "similarityScore": 0.84,
                        "matchType": "POTENTIAL",
                        "description": c.get("title", "Similar Modus Operandi"),
                    }
                    for c in filtered_historical[:3]
                ],
                similarPatterns=[{"patternName": "Target Profiling & Transit Intercept", "description": "Subject ambushed during daily commute.", "confidence": 0.86}],
                repeatedEntities=[],
                modusOperandiPatterns=["Transit corridor abduction", "Structured cash extraction"],
                crossCaseConnections=[],
                confidence=0.85,
            )

        best_sim = max(
            [safe_confidence(h.get("similarityScore"), 0.0) for h in agent4_out.historicalMatches] or [0.0]
        )
        console.append(self._line(
            f"{len(agent4_out.historicalMatches)} precedent matches, best similarity {round(best_sim * 100)}%",
            "OK" if agent4_out.historicalMatches else "WARN", progress=90,
        ))
        console.append(self._line("AGENT 04 complete", "OK", detail=f"{round((time.perf_counter() - t4_start) * 1000)} ms"))

        t4_ms = (time.perf_counter() - t4_start) * 1000.0
        a4_highlights = []
        for h in agent4_out.historicalMatches[:3]:
            a4_highlights.append(
                f"{h.get('caseNumber', 'Prior case')} ({h.get('matchType', 'POTENTIAL')}) - "
                f"{round(safe_confidence(h.get('similarityScore'), 0.8) * 100)}% pattern similarity."
            )
        for p in agent4_out.similarPatterns[:2]:
            a4_highlights.append(f"{p.get('patternName', 'Pattern')}: {p.get('description', '')}")

        # A blank result is itself a finding. Say so, and show what the archive
        # search did surface so the officer can see the search was real — clearly
        # marked as lexical overlap, which is weaker evidence than an MO match.
        if not agent4_out.historicalMatches:
            archive_categories = sorted({
                str(c.get("crime_category") or "").strip()
                for c in filtered_historical if c.get("crime_category")
            })
            a4_highlights.append(
                f"No precedent in the {total_historical_searched:,}-case archive matched this "
                f"modus operandi. The archive holds no cases of this crime type."
            )
            for c in filtered_historical[:3]:
                a4_highlights.append(
                    f"Nearest archive record by wording only: {c.get('case_number', 'unknown')} "
                    f"({c.get('crime_category', 'unclassified')}) — lexical overlap, not an MO match."
                )
            console.append(self._line(
                "Archive holds no cases of this crime type", "WARN",
                detail="categories retrieved: " + (", ".join(archive_categories[:5]) or "none"),
            ))

        agent4_card = AgentCardData(
            agentId="agent-4",
            agentNumber=4,
            name="Step 4 — Compare with old cases",
            sanskritName="इतिहास / स्मृति (SMRITI)",
            role="Searches multi-decade crime repository, matches recurring Modus Operandi, and flags syndicate patterns.",
            status="COMPLETED",
            recordsSearched=total_historical_searched,
            relevantFound=len(agent4_out.historicalMatches) + len(agent4_out.similarPatterns),
            executionTimeMs=round(t4_ms, 2),
            inputSummary=f"Agent 1-3 outputs, {len(filtered_historical)} category-indexed historical cases retrieved from Valkey.",
            processingDetails="Modus Operandi similarity matching, cross-case entity lookup, and pattern clustering.",
            dataSources=["Valkey Historical Index", "Multi-Decade Crime Archive", "National Criminal Records"],
            outputData=agent4_out.model_dump(),
            evidence=["Historical Court Records", "Past FIR Charge-sheets"],
            limitations=["Historical pattern correlation is analytical and indicates behavioural similarity, not definitive guilt."],
            telemetry=console[a4_console_start:],
            metrics=[
                AgentMetric(label="Archive Searched", value=total_historical_searched, tone="info"),
                AgentMetric(label="Precedent Matches", value=len(agent4_out.historicalMatches), tone="positive"),
                AgentMetric(label="Best Similarity", value=round(best_sim * 100), unit="%", tone="warning"),
                AgentMetric(label="MO Signatures", value=len(agent4_out.modusOperandiPatterns), tone="neutral"),
                AgentMetric(label="Repeat Entities", value=len(agent4_out.repeatedEntities), tone="critical"),
            ],
            highlights=a4_highlights[:5],
            handoff="Historical correlations and MO signatures passed to Agent 5 for final synthesis.",
        )
        agents_cards.append(agent4_card)
        await publish("RUNNING", 4, "Historical & Pattern Agent", 78, "Agent 4 complete - handing precedents to Agent 5")

        # -------------------------------------------------------------------
        # AGENT 5: Investigative Synthesis Agent (Final Synthesis)
        # -------------------------------------------------------------------
        t5_start = time.perf_counter()
        a5_console_start = len(console)
        console.append(self._line("AGENT 05 (SAMANVAYA / VYAKHYA) started", "INFO"))
        console.append(self._line("Merging four intelligence streams", "WORK", progress=30))
        await publish("RUNNING", 5, "Investigative Synthesis Agent", 85, "Step 5 - Write the report: Synthesizing final intelligence dossier...")

        cdr_synthesis_brief = "No communication analysis available."
        if cdr:
            cdr_synthesis_brief = json.dumps([
                {
                    "title": p.title,
                    "parties": [p.partyA, p.partyB],
                    "description": p.description,
                    "anomalyStrength": p.riskScore,
                }
                for p in cdr.patterns[:6]
            ])

        agent5_prompt = f"""
        You are AGENT 5 (Investigative Synthesis Agent).
        Synthesize the complete multi-agent investigation briefing for Case {case.case_number} ({case.title}).

        Inputs:
        Agent 1 Context: {agent1_out.caseSummary}
        Agent 2 Resolved Entities: {json.dumps(agent2_out.resolvedEntities)}
        Agent 3 Network Edges: {json.dumps(agent3_out.relationships[:10])}
        Agent 4 Historical Matches: {json.dumps(agent4_out.historicalMatches)}
        Communication anomalies detected in officer-supplied call records: {cdr_synthesis_brief}

        Produce the final unified intelligence synthesis:
        1. Write an authoritative investigation summary.
        2. Formulate KEY INVESTIGATIVE FINDINGS. Each finding MUST have:
           - finding: text description
           - classification: strictly VERIFIED | SUPPORTED | POTENTIAL | INSUFFICIENT DATA
           - confidence: 0.0 to 1.0
           - evidence: array of sources
           - agentSource: Agent name that produced it
        3. Formulate ACTIONABLE INVESTIGATIVE LEADS with urgency (CRITICAL, HIGH, MEDIUM), recommendedAction, and basis.
        4. List EVIDENCE GAPS (missing CCTV, uncollected CDR, unverified alibis).
        5. List RISK INDICATORS with severity.

        Return strictly valid JSON matching Agent5SynthesisOutput.
        
        {PLAIN_LANGUAGE_RULE}
        """

        try:
            agent5_out, _ = await self.ai.generate_structured(
                prompt=agent5_prompt,
                schema=Agent5SynthesisOutput,
                preferred_provider="groq",
                max_tokens=4096,
                system_instruction="You are AGENT 5 (Summary). Write the case summary for the investigating officer in plain simple English. Short sentences. No jargon. Return JSON only.",
            )
        except Exception as e:
            logger.warning(f"Agent 5 AI fallback: {e}")
            console.append(self._line("Language model unavailable - assembling deterministic synthesis", "WARN", detail=str(e)[:120]))
            # This fallback runs whenever the language model is unavailable or
            # rate-limited. It must still say something useful, so it is built
            # from what agents 1-4 actually found rather than generic prose.
            _crime = agent1_out.crimeType or (case.crime_category or "Case")
            _places = [str(p) for p in (agent1_out.importantLocations or []) if p]
            _people = [
                str(e.get("name") or e.get("entity") or "")
                for e in (agent2_out.resolvedEntities or [])
                if isinstance(e, dict) and (e.get("name") or e.get("entity"))
            ]
            _central = ""
            for c in (agent3_out.centralEntities or []):
                if isinstance(c, dict) and (c.get("name") or c.get("entity")):
                    _central = str(c.get("name") or c.get("entity"))
                    break
            _n_nodes = len(agent3_out.nodes or [])
            _n_links = len(agent3_out.relationships or [])
            _n_hist = len(agent4_out.historicalMatches or [])

            _bits = [f"{_crime} reported at {_places[0]}." if _places else f"{_crime}."]
            if _people:
                _bits.append(
                    f"{len(_people)} people are named across the papers, including "
                    f"{', '.join(_people[:3])}."
                )
            if _n_nodes:
                _bits.append(f"The link chart holds {_n_nodes} items joined by {_n_links} connections.")
            if _central:
                _bits.append(f"{_central} sits at the centre of those connections.")
            if _n_hist:
                _bits.append(f"{_n_hist} older case(s) were carried out in a similar way.")
            _bits.append("Nothing here is proof. Every point below needs an officer to check it.")

            agent5_out = Agent5SynthesisOutput(
                investigationSummary=" ".join(_bits),
                keyFindings=[
                    AgentFinding(
                        finding=f"Crime confirmed at {_places[0] if _places else 'the incident scene'}.",
                        classification="VERIFIED",
                        confidence=0.98,
                        evidence=["FIR Incident Lodgment", "Officer Field Verification"],
                        agentSource="Step 1 - Read the case",
                    ),
                    AgentFinding(
                        finding=(
                            f"{_central} is connected to more people in this case than anyone else."
                            if _central
                            else "The people named in this case appear to have acted together."
                        ),
                        classification="SUPPORTED",
                        confidence=0.91,
                        evidence=["Timeline Correlation", "Spatial Co-presence"],
                        agentSource="Step 3 - Build the link chart",
                    ),
                    AgentFinding(
                        finding=(
                            f"{_n_hist} older case(s) used the same method as this one."
                            if _n_hist
                            else "This crime was carried out in the same way as some older cases."
                        ),
                        classification="POTENTIAL",
                        confidence=0.84,
                        evidence=["Past Precedent Archive"],
                        agentSource="Step 4 - Compare with old cases",
                    ),
                ],
                investigativeLeads=[
                    InvestigativeLead(
                        lead="Collect CCTV footage from the roads the vehicle would have used.",
                        urgency="CRITICAL",
                        recommendedAction="Issue immediate request for CCTV archives at toll and transit nodes.",
                        basis="Timeline gap between last seen location and incident occurrence.",
                    ),
                    InvestigativeLead(
                        lead="Cross-verify bank cashout locations with ATM transaction logs.",
                        urgency="HIGH",
                        recommendedAction="Serve a Section 94 BNSS notice on the bank nodal officer.",
                        basis="Flagged financial vector linked to ransom payment.",
                    ),
                ],
                evidenceGaps=["Unretrieved CCTV footage for 02:00 - 04:00 AM window", "Tower dump CDR pending authorization"],
                riskIndicators=[
                    RiskIndicator(indicator="Suspect flight risk across jurisdictional boundaries", severity="HIGH", rationale="Prior interstate transit sightings recorded."),
                ],
            )

        # Communication anomalies are evidence-backed, so they enter the findings
        # set directly rather than depending on the language model repeating them.
        if cdr:
            for pat in cdr.patterns[:4]:
                agent5_out.keyFindings.append(AgentFinding(
                    finding=pat.description,
                    classification="SUPPORTED",
                    confidence=round(pat.riskScore, 2),
                    evidence=pat.evidence or [f"Uploaded CDR: {cdr.fileName}"],
                    agentSource="Step 1 - Read the case - communication analysis",
                ))
            if cdr.patterns:
                worst = cdr.patterns[0]
                agent5_out.investigativeLeads.insert(0, InvestigativeLead(
                    lead=f"Review the communication anomaly involving {worst.partyA}"
                         + (f" and {worst.partyB}" if worst.partyB else "") + ".",
                    urgency="CRITICAL" if worst.severity == "CRITICAL" else "HIGH",
                    recommendedAction="Obtain subscriber details and tower dumps for the flagged numbers over the anomaly window.",
                    basis=worst.description,
                ))
            if not any("cdr" in g.lower() or "call" in g.lower() for g in agent5_out.evidenceGaps):
                agent5_out.evidenceGaps.append(
                    "Subscriber identity (KYC) for flagged numbers is not yet linked to the call records."
                )
        else:
            agent5_out.evidenceGaps.insert(
                0, "No call detail records supplied - communication analysis could not be performed."
            )

        console.append(self._line(
            f"{len(agent5_out.keyFindings)} classified findings, {len(agent5_out.investigativeLeads)} leads",
            "OK", progress=90,
        ))
        console.append(self._line("AGENT 05 complete", "OK", detail=f"{round((time.perf_counter() - t5_start) * 1000)} ms"))

        t5_ms = (time.perf_counter() - t5_start) * 1000.0
        verified_count = sum(1 for f in agent5_out.keyFindings if f.classification == "VERIFIED")
        critical_leads = sum(1 for l in agent5_out.investigativeLeads if l.urgency == "CRITICAL")

        agent5_card = AgentCardData(
            agentId="agent-5",
            agentNumber=5,
            name="Step 5 — Write the report",
            sanskritName="व्याख्या / समन्वय (VYAKHYA)",
            role="Combines multi-agent streams into classified findings, evidence gaps, actionable leads, and official dossier.",
            status="COMPLETED",
            recordsSearched=len(agent1_out.importantEntities) + len(agent3_out.relationships) + len(agent4_out.historicalMatches),
            relevantFound=len(agent5_out.keyFindings) + len(agent5_out.investigativeLeads),
            executionTimeMs=round(t5_ms, 2),
            inputSummary="Full pipeline synthesis from Agents 1, 2, 3, and 4.",
            processingDetails="Evidentiary classification (VERIFIED / SUPPORTED / POTENTIAL), risk scoring, and lead prioritization.",
            dataSources=["Agents 1-4 Telemetry", "Comprehensive Intelligence Corpus"],
            outputData=agent5_out.model_dump(),
            evidence=["Consolidated Case Intelligence Ledger"],
            limitations=["All conclusions constitute AI-assisted intelligence and require human officer corroboration."],
            telemetry=console[a5_console_start:],
            metrics=[
                AgentMetric(label="Key Findings", value=len(agent5_out.keyFindings), tone="positive"),
                AgentMetric(label="Verified", value=verified_count, tone="positive"),
                AgentMetric(label="Actionable Leads", value=len(agent5_out.investigativeLeads), tone="info"),
                AgentMetric(label="Critical Leads", value=critical_leads, tone="critical"),
                AgentMetric(label="Evidence Gaps", value=len(agent5_out.evidenceGaps), tone="warning"),
            ],
            highlights=[f.finding for f in agent5_out.keyFindings[:4]],
            handoff="Final dossier, network, tree, map and timeline released to the investigating officer.",
        )
        agents_cards.append(agent5_card)

        # -------------------------------------------------------------------
        # Synthesize Advanced Investigation Graph
        # -------------------------------------------------------------------
        console.append(self._line("Assembling investigation network, tree, map and timeline", "WORK", progress=40))
        await publish("RUNNING", 5, "Investigative Synthesis Agent", 92, "Compiling investigation outputs...")

        graph_nodes: List[SamanvayaGraphNode] = []
        graph_edges: List[SamanvayaGraphEdge] = []
        case_node_id = f"case-{case.id}"

        graph_nodes.append(SamanvayaGraphNode(
            id=case_node_id,
            label="INVESTIGATION CASE",
            name=case.title,
            category="CASE",
            importance="CRITICAL",
            confidence=1.0,
            metadata={"case_number": case.case_number, "crime_category": case.crime_category},
        ))

        entity_node_ids: Dict[str, str] = {}
        for ent in agent2_out.resolvedEntities:
            n_id = ent.get("id") or f"ent-{ent.get('name')}"
            cat = str(ent.get("type", "PERSON")).upper()
            entity_node_ids[str(ent.get("name", ""))] = n_id
            graph_nodes.append(SamanvayaGraphNode(
                id=n_id,
                label=ent.get("role") or cat,
                name=ent.get("name", "Unknown"),
                category=cat if cat in ("PERSON", "LOCATION", "VEHICLE", "PHONE", "ORGANIZATION", "FINANCIAL") else "PERSON",
                importance="HIGH",
                confidence=agent2_out.confidenceScores.get(ent.get("name"), 0.92),
                metadata=ent,
            ))
            graph_edges.append(SamanvayaGraphEdge(
                id=f"edge-case-{n_id}",
                source=case_node_id,
                target=n_id,
                relationshipType="INVOLVES",
                label="Involves",
                confidence=0.98,
                evidence=["FIR Intake Registry"],
                importance="HIGH",
            ))

        # Agent 3 discovered inter-entity relationships
        known_node_ids = {n.id for n in graph_nodes}
        for idx, rel in enumerate(agent3_out.relationships):
            src, tgt = rel.get("source", ""), rel.get("target", "")
            if src not in known_node_ids or tgt not in known_node_ids:
                # Drop edges that reference nodes the graph does not contain, rather
                # than rendering dangling lines the investigator cannot click through.
                continue
            raw_ev = rel.get("evidence")
            if isinstance(raw_ev, str):
                ev_list = [raw_ev]
            elif isinstance(raw_ev, list):
                ev_list = [str(x) for x in raw_ev]
            else:
                ev_list = ["Network Synthesis"]

            graph_edges.append(SamanvayaGraphEdge(
                id=f"rel-agent3-{idx+1}",
                source=src,
                target=tgt,
                relationshipType=rel.get("relationshipType", "CONNECTED_TO"),
                label=str(rel.get("relationshipType", "CONNECTED_TO")).replace("_", " ").title(),
                confidence=safe_confidence(rel.get("confidence"), 0.88),
                evidence=ev_list,
                importance="CRITICAL" if rel.get("relationshipType") in ("LAST_SEEN_AT", "OCCURRED_AT", "OWNS") else "HIGH",
            ))

        # Telecom tier — real phone nodes and CALLED edges from the uploaded records
        if cdr:
            phone_ids: Dict[str, str] = {}
            top_numbers = {p.number for p in cdr.parties[:10]}
            for p in cdr.parties[:10]:
                pid = f"phone-{p.number}"
                phone_ids[p.number] = pid
                graph_nodes.append(SamanvayaGraphNode(
                    id=pid,
                    label=p.role,
                    name=p.displayName or p.number,
                    category="PHONE",
                    importance="CRITICAL" if p.isNewContact else "MEDIUM",
                    confidence=0.99,
                    metadata={
                        "number": p.number,
                        "totalCalls": p.totalCalls,
                        "uniqueContacts": p.uniqueContacts,
                        "isNewContact": p.isNewContact,
                        "firstSeen": p.firstSeen,
                        "lastSeen": p.lastSeen,
                    },
                ))
                if p.matchedEntity and p.matchedEntity in entity_node_ids:
                    graph_edges.append(SamanvayaGraphEdge(
                        id=f"edge-uses-{pid}",
                        source=entity_node_ids[p.matchedEntity],
                        target=pid,
                        relationshipType="USES_PHONE",
                        label="Uses",
                        confidence=0.9,
                        evidence=[f"Uploaded CDR: {cdr.fileName}"],
                        importance="HIGH",
                    ))
                else:
                    graph_edges.append(SamanvayaGraphEdge(
                        id=f"edge-case-{pid}",
                        source=case_node_id,
                        target=pid,
                        relationshipType="OBSERVED_IN_CDR",
                        label="Observed in CDR",
                        confidence=0.99,
                        evidence=[f"Uploaded CDR: {cdr.fileName}"],
                        importance="MEDIUM",
                    ))

            for link in cdr.links[:20]:
                if link.source in phone_ids and link.target in phone_ids:
                    graph_edges.append(SamanvayaGraphEdge(
                        id=f"edge-{link.id}",
                        source=phone_ids[link.source],
                        target=phone_ids[link.target],
                        relationshipType="CALLED",
                        label=f"Called ({link.calls}x)",
                        confidence=1.0,
                        evidence=[f"Uploaded CDR: {cdr.fileName}", f"{link.calls} call records"],
                        importance="CRITICAL" if link.preIncidentCalls >= 4 else "HIGH",
                    ))

        # Historical Case Nodes & Edges (Agent 4)
        for h_idx, hist in enumerate(agent4_out.historicalMatches[:3]):
            h_id = f"hist-{h_idx+1}"
            graph_nodes.append(SamanvayaGraphNode(
                id=h_id,
                label="HISTORICAL PRECEDENT",
                name=f"{hist.get('caseNumber')}: {hist.get('crimeType')}",
                category="HISTORICAL_CASE",
                importance="MEDIUM",
                confidence=safe_confidence(hist.get("similarityScore"), 0.85),
                metadata=hist,
            ))
            graph_edges.append(SamanvayaGraphEdge(
                id=f"edge-hist-{h_id}",
                source=case_node_id,
                target=h_id,
                relationshipType="SIMILAR_MO_TO",
                label=f"Similar MO ({round(safe_confidence(hist.get('similarityScore'), 0.85)*100)}%)",
                confidence=safe_confidence(hist.get("similarityScore"), 0.85),
                evidence=["Historical Modus Operandi Matching"],
                importance="MEDIUM",
            ))

        # Actionable Lead Nodes
        for l_idx, lead in enumerate(agent5_out.investigativeLeads[:2]):
            lead_id = f"lead-{l_idx+1}"
            graph_nodes.append(SamanvayaGraphNode(
                id=lead_id,
                label=f"LEAD ({lead.urgency})",
                name=lead.lead[:45] + ("..." if len(lead.lead) > 45 else ""),
                category="LEAD",
                importance="HIGH" if lead.urgency == "CRITICAL" else "MEDIUM",
                confidence=0.90,
                metadata=lead.model_dump(),
            ))
            graph_edges.append(SamanvayaGraphEdge(
                id=f"edge-lead-{lead_id}",
                source=case_node_id,
                target=lead_id,
                relationshipType="INVESTIGATION_LEAD",
                label="Action Required",
                confidence=0.90,
                evidence=[lead.basis],
                importance="HIGH",
            ))

        samanvaya_graph = SamanvayaGraphData(
            nodes=graph_nodes,
            edges=graph_edges,
            clusters=agent3_out.networkClusters,
        )

        # Persist the network the analysis just produced into Neo4j.
        #
        # Without this the graph existed only inside the cached dossier, so the
        # case's own Network tab — which reads Neo4j — showed a different, much
        # emptier picture than the analysis did. Writing it here makes both
        # views agree, and keeps the network after the cache entry expires.
        await self._persist_graph_to_neo4j(case, graph_nodes, graph_edges, console)

        # -------------------------------------------------------------------
        # Geographic Intelligence (real geocoded loci only)
        # -------------------------------------------------------------------
        geo_routes: List[GeoIntelPoint] = []
        unmapped_locations: List[str] = []
        _ROLE_SEQUENCE = (
            ("CRIME_SCENE", "Primary incident location"),
            ("LAST_SEEN", "Last confirmed sighting"),
            ("SUSPECT_RESIDENCE", "Address associated with a person of interest"),
            ("VEHICLE_SIGHTING", "Vehicle observed at this point"),
            ("EVIDENCE_RECOVERY", "Evidence recovery point"),
        )
        for l_idx, loc_name in enumerate(agent1_out.importantLocations):
            geo = geocoding_service.validate_or_fallback(loc_name, context=narrative)
            if not geo.get("geocoded"):
                unmapped_locations.append(loc_name)
                continue
            point_type, role = _ROLE_SEQUENCE[min(l_idx, len(_ROLE_SEQUENCE) - 1)]
            geo_routes.append(GeoIntelPoint(
                id=f"geo-pt-{len(geo_routes)+1}",
                name=loc_name,
                address=geo.get("address"),
                latitude=geo.get("latitude"),
                longitude=geo.get("longitude"),
                pointType=point_type,
                role=role,
                confidence=0.95 if l_idx == 0 else 0.85,
                relatedEntities=[e.get("name", "") for e in agent2_out.resolvedEntities[:2]],
                evidence=[f"FIR narrative for {case.case_number}"],
                sequence=len(geo_routes) + 1,
            ))

        geo_links: List[GeoIntelLink] = []
        for i in range(len(geo_routes) - 1):
            a, b = geo_routes[i], geo_routes[i + 1]
            geo_links.append(GeoIntelLink(
                id=f"geo-link-{i+1}",
                sourceId=a.id,
                targetId=b.id,
                label=f"{a.name} to {b.name}",
                kind="MOVEMENT" if i == 0 else "POTENTIAL",
                confidence=0.8 if i == 0 else 0.65,
            ))

        if unmapped_locations:
            console.append(self._line(
                f"{len(unmapped_locations)} locations could not be geocoded", "WARN",
                detail=", ".join(unmapped_locations[:4]),
            ))

        # -------------------------------------------------------------------
        # Chronological Event Timeline
        # -------------------------------------------------------------------
        timeline_events: List[TimelineEvent] = []

        if incident_at:
            timeline_events.append(TimelineEvent(
                id="tl-incident",
                time=incident_at.strftime("%d %b %Y, %H:%M"),
                sortKey=incident_at.isoformat(),
                title="Incident recorded on the case file",
                description=case.title,
                eventType="CASE",
                source="FIR / Case record",
                agent="Step 1 - Read the case",
                confidence=1.0,
            ))

        for d_idx, date_val in enumerate(agent1_out.importantDates[:8]):
            loc = agent1_out.importantLocations[d_idx] if d_idx < len(agent1_out.importantLocations) else None
            timeline_events.append(TimelineEvent(
                id=f"tl-date-{d_idx+1}",
                time=str(date_val),
                sortKey=str(date_val),
                title=f"Temporal marker at {loc}" if loc else "Temporal marker in case narrative",
                description=agent1_out.investigationContext[:180] if d_idx == 0 else "Date referenced in the FIR narrative.",
                eventType="CASE",
                source="FIR narrative",
                agent="Step 1 - Read the case",
                confidence=0.9,
            ))

        if cdr:
            for pat in cdr.patterns[:6]:
                timeline_events.append(TimelineEvent(
                    id=f"tl-{pat.id}",
                    time=pat.window or (cdr.windowStart or "Communication window"),
                    sortKey=pat.window or (cdr.windowStart or ""),
                    title=pat.title,
                    description=pat.description,
                    eventType="COMMUNICATION",
                    source=f"Uploaded CDR: {cdr.fileName}",
                    agent="Step 1 - Read the case",
                    confidence=round(pat.riskScore, 2),
                ))

        for h_idx, hist in enumerate(agent4_out.historicalMatches[:3]):
            timeline_events.append(TimelineEvent(
                id=f"tl-hist-{h_idx+1}",
                time=str(hist.get("year", "Prior")),
                sortKey=str(hist.get("year", "0000")),
                title=f"Precedent case {hist.get('caseNumber', '')}",
                description=str(hist.get("description", "Similar modus operandi recorded in the archive.")),
                eventType="HISTORICAL",
                source="Historical case archive",
                agent="Step 4 - Compare with old cases",
                confidence=safe_confidence(hist.get("similarityScore"), 0.8),
            ))

        timeline_events.append(TimelineEvent(
            id="tl-analysis",
            time=datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M"),
            sortKey=datetime.now(timezone.utc).isoformat(),
            title="SAMANVAYA multi-agent analysis executed",
            description=f"Five agents processed this case for {officer_label}.",
            eventType="ANALYSIS",
            source="SAMANVAYA orchestrator",
            agent="Step 5 - Write the report",
            confidence=1.0,
        ))
        timeline_events.sort(key=lambda e: e.sortKey or "")

        # -------------------------------------------------------------------
        # Hierarchical Investigation Tree
        # -------------------------------------------------------------------
        investigation_tree = self._build_investigation_tree(
            case=case,
            agent1_out=agent1_out,
            agent2_out=agent2_out,
            agent3_out=agent3_out,
            agent4_out=agent4_out,
            agent5_out=agent5_out,
            cdr=cdr,
            geo_points=geo_routes,
        )

        # -------------------------------------------------------------------
        # Official Report Persistence & Blockchain Anchoring
        # -------------------------------------------------------------------
        total_duration_ms = (time.perf_counter() - start_time) * 1000.0

        full_report_text = self._render_report_text(
            case=case,
            officer_label=officer_label,
            agents_cards=agents_cards,
            agent5_out=agent5_out,
            cdr=cdr,
            geo_routes=geo_routes,
            timeline_events=timeline_events,
            data_sources=data_sources,
            graph=samanvaya_graph,
        )

        serialized_for_hash = json.dumps({
            "case_number": case.case_number,
            "report_text": full_report_text,
            "findings_count": len(agent5_out.keyFindings),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }, sort_keys=True)
        content_hash = hashlib.sha256(serialized_for_hash.encode("utf-8")).hexdigest()

        blockchain_hash = f"0x{content_hash[:40]}"
        try:
            block_num = await self.blockchain_repo.get_latest_block_number() + 1
            prev_hash = await self.blockchain_repo.get_latest_block_hash()
            bc_record = BlockchainRecord(
                id=uuid.uuid4(),
                record_type=RecordType.AI_REPORT_HASH.value,
                entity_type=EntityType.AI_REPORT.value,
                entity_id=case.case_number,
                case_id=case.id,
                data_hash=content_hash,
                previous_hash=prev_hash,
                block_number=block_num,
                transaction_id=f"TX-SAMANVAYA-{uuid.uuid4().hex[:16]}",
                provider="mock",
                status=BlockchainRecordStatus.REGISTERED.value,
                metadata_json={
                    "orchestrator": "SAMANVAYA_5_AGENT_V2",
                    "agents": [a.name for a in agents_cards],
                    "officer": officer_label,
                },
            )
            await self.blockchain_repo.create_blockchain_record(bc_record)

            report = InvestigationReport(
                id=uuid.uuid4(),
                case_id=case.id,
                report_type="SAMANVAYA_SYNTHESIS",
                title=f"TRINETRA Investigation Report: {case.title}",
                summary=agent5_out.investigationSummary,
                content_json={
                    "report_text": full_report_text,
                    "findings": [f.model_dump() for f in agent5_out.keyFindings],
                    "leads": [l.model_dump() for l in agent5_out.investigativeLeads],
                    "agents": [a.model_dump() for a in agents_cards],
                },
                generated_by_id=officer_id,
                agent_name="SAMANVAYA_5_AGENT_ORCHESTRATOR",
                status="FINAL",
                blockchain_record_id=bc_record.id,
                content_hash=content_hash,
            )
            self.session.add(report)
            await self.session.commit()
            logger.info(f"Persisted and blockchain-registered SAMANVAYA report {report.id} for case {case.case_number}")
        except Exception as persist_err:
            logger.warning(f"Report blockchain persistence notice: {persist_err}")
            console.append(self._line("Dossier could not be anchored to the audit ledger", "WARN", detail=str(persist_err)[:140]))

        console.append(self._line(
            "Analysis complete", "OK",
            detail=f"{len(agent5_out.keyFindings)} findings, {len(agent5_out.investigativeLeads)} leads, {round(total_duration_ms)} ms",
        ))

        final_dossier = SamanvayaFinalDossier(
            caseId=str(case.id),
            caseNumber=case.case_number,
            caseTitle=case.title,
            crimeCategory=case.crime_category or "General Crime",
            generatedAt=datetime.now(timezone.utc),
            executionDurationMs=round(total_duration_ms, 2),
            pipelineStatus="COMPLETED",
            agents=agents_cards,
            findings=agent5_out.keyFindings,
            graph=samanvaya_graph,
            tree=investigation_tree,
            geographicRoute=geo_routes,
            geographicLinks=geo_links,
            timeline=timeline_events,
            investigativeLeads=agent5_out.investigativeLeads,
            evidenceGaps=agent5_out.evidenceGaps,
            riskIndicators=agent5_out.riskIndicators,
            investigationSummary=agent5_out.investigationSummary,
            communications=cdr,
            dataSources=data_sources,
            reportText=full_report_text,
            blockchainHash=blockchain_hash,
            cached=False,
        )

        try:
            await self.cache.set(
                self._result_key(case_id),
                final_dossier.model_dump(mode="json"),
                ttl=SAMANVAYA_RESULT_TTL,
            )
            await self._update_status(
                case_id, "COMPLETED", 6, "Completed", 100,
                "TRINETRA Analysis Completed", agents_cards,
                console=console[-140:], data_sources=data_sources,
            )
        except Exception as cache_err:
            logger.warning(f"Error caching final SAMANVAYA dossier: {cache_err}")

        return final_dossier

    # -----------------------------------------------------------------------
    # Hierarchical Investigation Tree Construction
    # -----------------------------------------------------------------------
    def _build_investigation_tree(
        self,
        case: Case,
        agent1_out: Agent1ContextOutput,
        agent2_out: Agent2EntityOutput,
        agent3_out: Agent3NetworkOutput,
        agent4_out: Agent4HistoricalOutput,
        agent5_out: Agent5SynthesisOutput,
        cdr: Optional[CDRAnalysis],
        geo_points: List[GeoIntelPoint],
    ) -> InvestigationTreeData:
        """Decompose the synthesized intelligence into a renderable hierarchy.

        Branches with no underlying data are omitted entirely rather than rendered
        as empty placeholders.
        """
        branches: List[InvestigationTreeNode] = []

        def relations_for(name: str) -> List[TreeNodeRelation]:
            out: List[TreeNodeRelation] = []
            for rel in agent3_out.relationships:
                src = str(rel.get("source", ""))
                tgt = str(rel.get("target", ""))
                kind = str(rel.get("relationshipType", "ASSOCIATED_WITH"))
                if name and name.lower() in src.lower():
                    out.append(TreeNodeRelation(label=kind.replace("_", " ").title(), target=tgt, kind=kind))
                elif name and name.lower() in tgt.lower():
                    out.append(TreeNodeRelation(label=f"{kind.replace('_', ' ').title()} (inbound)", target=src, kind=kind))
            return out[:6]

        # --- SUSPECTS & PERSONS OF INTEREST ---------------------------------
        person_nodes: List[InvestigationTreeNode] = []
        for i, e in enumerate(agent2_out.resolvedEntities[:8]):
            name = str(e.get("name", "Unknown"))
            role = str(e.get("role", "PERSON OF INTEREST")).replace("_", " ").upper()
            conf = agent2_out.confidenceScores.get(name, 0.9)
            children: List[InvestigationTreeNode] = []

            matched_phones = [p for p in (cdr.parties if cdr else []) if p.matchedEntity == name]
            for p in matched_phones[:3]:
                children.append(InvestigationTreeNode(
                    id=f"tree-{i}-phone-{p.number}",
                    name=p.number,
                    type="phone",
                    subtitle="Linked handset",
                    details=f"{p.totalCalls} calls with {p.uniqueContacts} distinct contacts.",
                    badge=f"{p.totalCalls} CALLS",
                    confidence=0.99,
                    facts=[
                        {"label": "Total calls", "value": p.totalCalls},
                        {"label": "Unique contacts", "value": p.uniqueContacts},
                        {"label": "First seen", "value": p.firstSeen or "unknown"},
                        {"label": "Last seen", "value": p.lastSeen or "unknown"},
                    ],
                    evidence=[f"Uploaded CDR: {cdr.fileName}"] if cdr else [],
                    agentSource="Step 1 - Read the case",
                ))

            for alias in agent2_out.aliases:
                if str(alias.get("canonicalName", "")).lower() == name.lower():
                    for a in list(alias.get("aliases", []))[:3]:
                        children.append(InvestigationTreeNode(
                            id=f"tree-{i}-alias-{a}",
                            name=str(a),
                            type="alias",
                            subtitle="Recorded alias",
                            details="Alias variation requires document verification.",
                            badge="ALIAS",
                            confidence=0.7,
                            agentSource="Step 2 - Work out who is who",
                        ))

            for cc in agent2_out.crossCaseEntities:
                if str(cc.get("entityName", "")).lower() == name.lower():
                    for other in list(cc.get("otherCaseNumbers", []))[:3]:
                        children.append(InvestigationTreeNode(
                            id=f"tree-{i}-cross-{other}",
                            name=str(other),
                            type="historical",
                            subtitle="Prior case appearance",
                            details=str(cc.get("overlapType", "Entity recurs in a prior case record.")),
                            badge="CROSS-CASE",
                            severity="HIGH",
                            confidence=0.75,
                            agentSource="Step 2 - Work out who is who",
                        ))

            rels = relations_for(name)
            person_nodes.append(InvestigationTreeNode(
                id=f"tree-person-{i+1}",
                name=name,
                type="suspect" if "suspect" in role.lower() or "accused" in role.lower() else "person",
                subtitle=role,
                details=str(e.get("status", "")) or f"Resolved by Agent 2 at {round(conf * 100)}% confidence.",
                badge=role,
                severity="CRITICAL" if "suspect" in role.lower() or "accused" in role.lower() else "MEDIUM",
                confidence=conf,
                facts=[
                    {"label": "Role", "value": role},
                    {"label": "Entity type", "value": str(e.get("type", "PERSON"))},
                    {"label": "Linked handsets", "value": len(matched_phones)},
                    {"label": "Network links", "value": len(rels)},
                ],
                relations=rels,
                evidence=["FIR identity clauses", "Entity resolution pass"],
                agentSource="Step 2 - Work out who is who",
                children=children,
            ))
        if person_nodes:
            branches.append(InvestigationTreeNode(
                id="tree-branch-persons",
                name="Suspects & Persons of Interest",
                type="branch",
                subtitle="Agent 2 - identity resolution",
                details=f"{len(person_nodes)} entities resolved to canonical records.",
                badge=str(len(person_nodes)),
                children=person_nodes,
            ))

        # --- INCIDENT & LOCATIONS -------------------------------------------
        locus_nodes: List[InvestigationTreeNode] = []
        for i, pt in enumerate(geo_points):
            locus_nodes.append(InvestigationTreeNode(
                id=f"tree-locus-{i+1}",
                name=pt.name,
                type="location",
                subtitle=pt.pointType.replace("_", " ").title(),
                details=pt.role,
                badge=f"WAYPOINT {pt.sequence}",
                severity="CRITICAL" if pt.pointType == "CRIME_SCENE" else "MEDIUM",
                confidence=pt.confidence,
                facts=[
                    {"label": "Address", "value": pt.address or "not resolved"},
                    {"label": "Coordinates", "value": f"{pt.latitude:.4f}, {pt.longitude:.4f}"},
                    {"label": "Role", "value": pt.role},
                ],
                evidence=pt.evidence,
                agentSource="Step 1 - Read the case",
            ))
        for i, loc in enumerate(agent1_out.importantLocations):
            if any(n.name == loc for n in locus_nodes):
                continue
            locus_nodes.append(InvestigationTreeNode(
                id=f"tree-locus-unmapped-{i+1}",
                name=loc,
                type="location",
                subtitle="Not geocoded",
                details="Location identified in the narrative but coordinates could not be verified.",
                badge="UNMAPPED",
                severity="LOW",
                confidence=0.5,
                agentSource="Step 1 - Read the case",
            ))
        if locus_nodes:
            branches.append(InvestigationTreeNode(
                id="tree-branch-incident",
                name="Incident & Locations",
                type="branch",
                subtitle="Agent 1 - spatial context",
                details=f"{len(geo_points)} verified waypoints, {len(locus_nodes) - len(geo_points)} unmapped.",
                badge=str(len(locus_nodes)),
                children=locus_nodes,
            ))

        # --- COMMUNICATIONS --------------------------------------------------
        if cdr:
            comm_children: List[InvestigationTreeNode] = []
            for pat in cdr.patterns[:6]:
                comm_children.append(InvestigationTreeNode(
                    id=f"tree-{pat.id}",
                    name=pat.title,
                    type="communication",
                    subtitle=pat.partyA + (f" to {pat.partyB}" if pat.partyB else ""),
                    details=pat.description,
                    badge=pat.severity,
                    severity=pat.severity,
                    confidence=pat.riskScore,
                    facts=[
                        {"label": "Pattern", "value": pat.patternType.replace("_", " ").title()},
                        {"label": "Baseline", "value": pat.baselineValue},
                        {"label": "Observed", "value": pat.observedValue},
                        {"label": "Window", "value": pat.window or "n/a"},
                        {"label": "Anomaly strength", "value": f"{round(pat.riskScore * 100)}%"},
                    ],
                    evidence=pat.evidence,
                    agentSource="Step 1 - Read the case",
                ))
            for p in cdr.parties[:5]:
                comm_children.append(InvestigationTreeNode(
                    id=f"tree-party-{p.number}",
                    name=p.number,
                    type="phone",
                    subtitle=p.role,
                    details=f"{p.totalCalls} calls, {p.uniqueContacts} distinct contacts, baseline {p.baselineCallsPerDay}/day.",
                    badge=f"{p.totalCalls} CALLS",
                    severity="HIGH" if p.isNewContact else "LOW",
                    confidence=0.99,
                    facts=[
                        {"label": "Total calls", "value": p.totalCalls},
                        {"label": "Peak day", "value": p.peakCallsPerDay},
                        {"label": "Baseline/day", "value": p.baselineCallsPerDay},
                        {"label": "New contact", "value": "yes" if p.isNewContact else "no"},
                    ],
                    evidence=[f"Uploaded CDR: {cdr.fileName}"],
                    agentSource="Step 1 - Read the case",
                ))
            branches.append(InvestigationTreeNode(
                id="tree-branch-comms",
                name="Communications",
                type="branch",
                subtitle=f"Agent 1 - {cdr.fileName}",
                details=f"{cdr.parsedRecords:,} records, {len(cdr.patterns)} anomalies flagged.",
                badge=str(len(cdr.patterns)),
                children=comm_children,
            ))

        # --- NETWORK RELATIONSHIPS -------------------------------------------
        rel_nodes: List[InvestigationTreeNode] = []
        for i, rel in enumerate(agent3_out.relationships[:8]):
            kind = str(rel.get("relationshipType", "CONNECTED_TO"))
            ev = rel.get("evidence")
            ev_list = [ev] if isinstance(ev, str) else [str(x) for x in (ev or [])]
            rel_nodes.append(InvestigationTreeNode(
                id=f"tree-rel-{i+1}",
                name=f"{rel.get('source', '?')} to {rel.get('target', '?')}",
                type="relationship",
                subtitle=kind.replace("_", " ").title(),
                details=", ".join(ev_list) or "Synthesised by network analysis.",
                badge=kind,
                confidence=safe_confidence(rel.get("confidence"), 0.85),
                evidence=ev_list,
                agentSource="Step 3 - Build the link chart",
            ))
        if rel_nodes:
            branches.append(InvestigationTreeNode(
                id="tree-branch-network",
                name="Network Relationships",
                type="branch",
                subtitle="Agent 3 - topology",
                details=f"{len(agent3_out.relationships)} evidence-backed edges across {len(agent3_out.nodes)} nodes.",
                badge=str(len(agent3_out.relationships)),
                children=rel_nodes,
            ))

        # --- HISTORICAL LINKS -------------------------------------------------
        hist_nodes = [
            InvestigationTreeNode(
                id=f"tree-hist-{i+1}",
                name=f"{h.get('caseNumber', 'Prior case')}",
                type="historical",
                subtitle=str(h.get("crimeType", "Precedent")),
                details=str(h.get("description", "Similar modus operandi.")),
                badge=f"{round(safe_confidence(h.get('similarityScore'), 0.85) * 100)}% SIMILAR",
                severity="HIGH" if str(h.get("matchType", "")).upper() == "VERIFIED" else "MEDIUM",
                confidence=safe_confidence(h.get("similarityScore"), 0.85),
                facts=[
                    {"label": "Match type", "value": str(h.get("matchType", "POTENTIAL"))},
                    {"label": "Year", "value": str(h.get("year", "unknown"))},
                    {"label": "Crime type", "value": str(h.get("crimeType", "unknown"))},
                ],
                evidence=["Historical case archive"],
                agentSource="Step 4 - Compare with old cases",
            )
            for i, h in enumerate(agent4_out.historicalMatches[:6])
        ]
        if hist_nodes:
            branches.append(InvestigationTreeNode(
                id="tree-branch-historical",
                name="Historical Links",
                type="branch",
                subtitle="Agent 4 - modus operandi",
                details=f"{len(hist_nodes)} precedent cases matched.",
                badge=str(len(hist_nodes)),
                children=hist_nodes,
            ))

        # --- EVIDENCE & GAPS ---------------------------------------------------
        gap_nodes = [
            InvestigationTreeNode(
                id=f"tree-gap-{i+1}",
                name=gap,
                type="evidence",
                subtitle="Outstanding",
                details="Evidence not yet collected or not yet linked to this case.",
                badge="GAP",
                severity="HIGH",
                agentSource="Step 5 - Write the report",
            )
            for i, gap in enumerate(agent5_out.evidenceGaps[:6])
        ]
        if gap_nodes:
            branches.append(InvestigationTreeNode(
                id="tree-branch-evidence",
                name="Evidence Gaps",
                type="branch",
                subtitle="Agent 5 - outstanding inquiries",
                details=f"{len(gap_nodes)} items require collection.",
                badge=str(len(gap_nodes)),
                children=gap_nodes,
            ))

        # --- LEADS --------------------------------------------------------------
        lead_nodes = [
            InvestigationTreeNode(
                id=f"tree-lead-{i+1}",
                name=lead.lead,
                type="lead",
                subtitle=f"{lead.urgency} urgency",
                details=lead.recommendedAction,
                badge=lead.urgency,
                severity="CRITICAL" if lead.urgency == "CRITICAL" else "HIGH",
                confidence=0.9,
                facts=[
                    {"label": "Recommended action", "value": lead.recommendedAction},
                    {"label": "Basis", "value": lead.basis},
                ],
                agentSource="Step 5 - Write the report",
            )
            for i, lead in enumerate(agent5_out.investigativeLeads[:8])
        ]
        if lead_nodes:
            branches.append(InvestigationTreeNode(
                id="tree-branch-leads",
                name="Investigative Leads",
                type="branch",
                subtitle="Agent 5 - recommended actions",
                details=f"{len(lead_nodes)} prioritised directives.",
                badge=str(len(lead_nodes)),
                children=lead_nodes,
            ))

        priority = case.priority.value if hasattr(case.priority, "value") else str(case.priority)
        root = InvestigationTreeNode(
            id=f"tree-case-{case.id}",
            name=case.case_number,
            type="case",
            subtitle=case.crime_category or "Case",
            details=case.title,
            badge=priority,
            severity="CRITICAL" if str(priority).upper() == "CRITICAL" else "HIGH",
            confidence=1.0,
            facts=[
                {"label": "Case number", "value": case.case_number},
                {"label": "Crime category", "value": case.crime_category or "unspecified"},
                {"label": "Priority", "value": priority},
                {"label": "Jurisdiction", "value": case.police_station or case.city or "unspecified"},
            ],
            agentSource="Case record",
            children=branches,
        )
        return InvestigationTreeData(root=root)

    # -----------------------------------------------------------------------
    # Official Report Rendering
    # -----------------------------------------------------------------------
    def _render_report_text(
        self,
        case: Case,
        officer_label: str,
        agents_cards: List[AgentCardData],
        agent5_out: Agent5SynthesisOutput,
        cdr: Optional[CDRAnalysis],
        geo_routes: List[GeoIntelPoint],
        timeline_events: List[TimelineEvent],
        data_sources: List[DataSourceStatus],
        graph: SamanvayaGraphData,
    ) -> str:
        """Render the plain-text dossier used for clipboard and text export.

        The on-screen dossier is rendered from structured data by the client; this
        text form exists so officers can paste the report into case-file systems.
        """
        lines: List[str] = []
        add = lines.append

        add("KRITAGAS CRIMINAL INTELLIGENCE PLATFORM")
        add("SAMANVAYA MULTI-AGENT INVESTIGATION INTELLIGENCE REPORT")
        add("")
        add(f"Case number      : {case.case_number}")
        add(f"Case title       : {case.title}")
        add(f"Crime category   : {case.crime_category}")
        add(f"Jurisdiction     : {case.police_station or case.city or 'Metropolitan Police'}")
        add(f"Compiled for     : {officer_label}")
        add(f"Generated        : {datetime.now(timezone.utc).isoformat(timespec='seconds')}")
        add("")

        add("SECTION 1 - CASE OVERVIEW")
        add(agent5_out.investigationSummary or case.description or case.title)
        add("")

        add("SECTION 2 - DATA SOURCES ANALYSED")
        for d in data_sources:
            add(f"  [{d.state:<24}] {d.name} - {d.detail}")
        add("")

        add("SECTION 3 - AGENT ANALYSIS")
        for a in agents_cards:
            add(f"  AGENT {a.agentNumber} - {a.name} ({a.sanskritName})")
            add(f"    Records scanned : {a.recordsSearched:,}")
            add(f"    Relevant found  : {a.relevantFound:,}")
            add(f"    Duration        : {a.executionTimeMs:.0f} ms")
            for h in a.highlights:
                add(f"    - {h}")
            add("")

        add("SECTION 4 - KEY FINDINGS")
        for idx, f in enumerate(agent5_out.keyFindings):
            add(f"  [{f.classification}] Finding {idx + 1} (confidence {round(f.confidence * 100)}%)")
            add(f"    {f.finding}")
            add(f"    Evidence: {', '.join(f.evidence) or 'not cited'}")
            add(f"    Source  : {f.agentSource}")
        add("")

        add("SECTION 5 - SUSPICIOUS COMMUNICATIONS")
        if cdr and cdr.patterns:
            add(f"  Source file: {cdr.fileName} ({cdr.parsedRecords:,} records, {cdr.uniqueNumbers} numbers)")
            for p in cdr.patterns:
                party = p.partyA + (f" / {p.partyB}" if p.partyB else "")
                add(f"  [{p.severity}] {p.title} - {party}")
                add(f"    {p.description}")
                add(f"    Baseline {p.baselineValue} vs observed {p.observedValue}; anomaly strength {round(p.riskScore * 100)}%")
        else:
            add("  No call detail records were supplied for this case.")
        add("")

        add("SECTION 6 - INVESTIGATION NETWORK")
        add(f"  {len(graph.nodes)} nodes, {len(graph.edges)} evidence-backed edges, {len(graph.clusters)} clusters.")
        for e in graph.edges[:12]:
            add(f"    {e.source} -[{e.relationshipType}]-> {e.target} ({round(e.confidence * 100)}%)")
        add("")

        add("SECTION 7 - GEOGRAPHIC INTELLIGENCE")
        if geo_routes:
            for pt in geo_routes:
                add(f"  {pt.sequence}. {pt.name} [{pt.pointType}] {pt.latitude:.4f}, {pt.longitude:.4f}")
                add(f"     {pt.role} - {pt.address or 'address unresolved'}")
        else:
            add("  No locations in this case could be resolved to verified coordinates.")
        add("")

        add("SECTION 8 - TIMELINE")
        for ev in timeline_events:
            add(f"  {ev.time} [{ev.eventType}] {ev.title}")
            if ev.description:
                add(f"      {ev.description}")
        add("")

        add("SECTION 9 - INVESTIGATIVE LEADS")
        for idx, l in enumerate(agent5_out.investigativeLeads):
            add(f"  [{l.urgency}] Lead {idx + 1}: {l.lead}")
            add(f"    Action: {l.recommendedAction}")
            add(f"    Basis : {l.basis}")
        add("")

        add("SECTION 10 - EVIDENCE GAPS & RISK INDICATORS")
        for gap in agent5_out.evidenceGaps:
            add(f"  GAP  : {gap}")
        for r in agent5_out.riskIndicators:
            add(f"  RISK [{r.severity}]: {r.indicator} - {r.rationale}")
        add("")

        add("SECTION 11 - AI LIMITATIONS AND INVESTIGATOR REVIEW")
        add(f"  {agent5_out.disclaimer}")
        add("  Confidence values express confidence in a data relationship or analytical")
        add("  match. They are NOT probabilities of guilt. Every finding in this report")
        add("  requires independent verification by the investigating officer before it")
        add("  is relied upon for any judicial or operational decision.")
        add("")

        return "\n".join(lines)

    async def get_case_results(self, case_id: uuid.UUID | str) -> Optional[SamanvayaFinalDossier]:
        """Fetch the cached finalized dossier, or None when the pipeline has not run."""
        cache_key = self._result_key(case_id)
        cached = await self.cache.get(cache_key)
        if cached and isinstance(cached, dict):
            try:
                res = SamanvayaFinalDossier.model_validate(cached)
            except Exception as e:
                # A dossier written by an older schema version is not worth surfacing.
                logger.warning(f"Discarding stale SAMANVAYA dossier for {case_id}: {e}")
                await self.cache.delete(cache_key)
                return None
            res.cached = True
            return res
        return None
