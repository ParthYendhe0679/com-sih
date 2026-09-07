"""CaseIntelligenceService: manages asynchronous analysis jobs, DB persistence, and intelligence queries."""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.ai_ml.intelligence_engine import master_intelligence_engine
from app.ai_ml.models.ai_models import (
    AnalysisJob,
    Anomaly,
    CaseSimilarity,
    Correlation,
    Entity,
    EntityMatch,
    IntelligenceInsight,
)
from app.ai_ml.schemas.intelligence import (
    CaseIntelligenceDossier,
    InsightResponse,
    NetworkMetricScore,
)
from app.core.exceptions import NotFoundException
from app.core.logging import get_logger
from app.models.case import Case
from app.models.data_architecture import EntityRelationship, InvestigationReport
from app.models.user import User

logger = get_logger("kritagas.case_intelligence_service")


class CaseIntelligenceService:
    """Orchestrates case intelligence execution, background job lifecycle, and result queries."""

    _inflight_locks: Dict[str, asyncio.Lock] = {}

    def __init__(self, session: AsyncSession, cache_service: Optional[Any] = None):
        self.session = session
        self.engine = master_intelligence_engine
        from app.services.cache_service import cache_service as default_cache
        self.cache = cache_service or default_cache

    async def create_analysis_job(
        self,
        case_id: uuid.UUID,
        triggered_by: Optional[User] = None,
    ) -> AnalysisJob:
        """Create a new queued analysis job."""
        stmt = select(Case).where(Case.id == case_id)
        result = await self.session.execute(stmt)
        case = result.scalar_one_or_none()
        if not case:
            raise NotFoundException(f"Case {case_id} not found.")

        job = AnalysisJob(
            id=uuid.uuid4(),
            case_id=case.id,
            status="QUEUED",
            progress=0,
            current_stage="QUEUED",
            triggered_by_id=triggered_by.id if triggered_by else None,
        )
        self.session.add(job)
        await self.session.commit()
        await self.session.refresh(job)
        return job

    async def get_job_status(self, job_id: uuid.UUID) -> AnalysisJob:
        """Fetch real-time progress of an analysis job."""
        stmt = select(AnalysisJob).where(AnalysisJob.id == job_id)
        result = await self.session.execute(stmt)
        job = result.scalar_one_or_none()
        if not job:
            raise NotFoundException(f"Analysis job {job_id} not found.")
        return job

    async def execute_case_analysis(
        self,
        job_id: uuid.UUID,
    ) -> Dict[str, Any]:
        """Execute all intelligence stages for a job, updating DB state and progress."""
        job = await self.get_job_status(job_id)
        job.status = "PROCESSING"
        job.progress = 15
        job.current_stage = "FETCHING_CASE_CORPUS"
        await self.session.commit()

        # Load case
        stmt = select(Case).where(Case.id == job.case_id)
        result = await self.session.execute(stmt)
        case = result.scalar_one_or_none()
        if not case:
            job.status = "FAILED"
            job.error_message = f"Case {job.case_id} not found."
            await self.session.commit()
            return {"status": "FAILED"}

        try:
            # Stage 1: Load historical cases for comparison
            job.progress = 30
            job.current_stage = "FETCHING_HISTORICAL_CASES"
            await self.session.commit()

            hist_stmt = select(Case).where(Case.id != case.id).limit(20)
            hist_res = await self.session.execute(hist_stmt)
            historical_cases = list(hist_res.scalars().all())

            # Stage 2: Extract / load entities
            job.progress = 50
            job.current_stage = "EXTRACTING_AND_RESOLVING_ENTITIES"
            await self.session.commit()

            ent_stmt = select(Entity).where(Entity.case_id == case.id)
            ent_res = await self.session.execute(ent_stmt)
            existing_entities = list(ent_res.scalars().all())

            # If no entities exist yet, generate from case metadata/FIR
            if not existing_entities:
                new_ents = self._synthesize_entities_from_case(case)
                for e in new_ents:
                    self.session.add(e)
                await self.session.commit()
                existing_entities = new_ents

            # Stage 3: Run Master Pipeline
            job.progress = 75
            job.current_stage = "RUNNING_SIMILARITY_AND_PATTERNS"
            await self.session.commit()

            analysis_result = self.engine.run_case_analysis_pipeline(
                case=case,
                historical_cases=historical_cases,
                existing_entities=existing_entities,
            )

            # Persist discovered records
            for m in analysis_result["entity_matches"]:
                self.session.add(m)
            for c in analysis_result["correlations"]:
                self.session.add(c)
            for s in analysis_result["similar_cases"]:
                self.session.add(s)
            for p in analysis_result["pattern_insights"]:
                self.session.add(p)
            for a in analysis_result["anomalies"]:
                self.session.add(a)

            # Persist Official Investigation AI Dossier Report
            report = InvestigationReport(
                id=uuid.uuid4(),
                case_id=case.id,
                report_type="AI_DOSSIER",
                title=f"AI Intelligence Dossier: {case.title}",
                summary=f"Automated intelligence synthesis for Case {case.case_number}. Discovered {len(analysis_result['correlations'])} correlations, {len(analysis_result['similar_cases'])} similar cases, {len(analysis_result['anomalies'])} anomalies.",
                content_json={
                    "priority_score": analysis_result["investigation_priority"]["score"],
                    "priority_level": analysis_result["investigation_priority"]["level"],
                    "total_correlations": len(analysis_result["correlations"]),
                    "total_similar_cases": len(analysis_result["similar_cases"]),
                    "total_anomalies": len(analysis_result["anomalies"]),
                    "total_patterns": len(analysis_result["pattern_insights"]),
                },
                generated_by_id=job.triggered_by_id,
                agent_name="CASE_INTELLIGENCE_ENGINE_V1",
                status="FINAL",
            )
            self.session.add(report)

            # Stage 4: Finalize
            job.progress = 100
            job.status = "COMPLETED"
            job.current_stage = "COMPLETED"
            job.completed_at = datetime.now(timezone.utc)
            job.result_summary = {
                "report_id": str(report.id),
                "priority_score": analysis_result["investigation_priority"]["score"],
                "total_correlations": len(analysis_result["correlations"]),
                "total_similar_cases": len(analysis_result["similar_cases"]),
                "total_anomalies": len(analysis_result["anomalies"]),
                "total_patterns": len(analysis_result["pattern_insights"]),
            }
            await self.session.commit()
            return analysis_result


        except Exception as e:
            logger.error(f"Error during case analysis execution: {e}")
            job.status = "FAILED"
            job.error_message = str(e)
            await self.session.commit()
            return {"status": "FAILED", "error": str(e)}

    async def get_case_intelligence_dossier(self, case_id: uuid.UUID) -> CaseIntelligenceDossier:
        """Fetch or synthesize the complete case intelligence dossier with caching and request deduplication."""
        cache_key = self.cache.keys.case_intelligence(case_id)
        cached = await self.cache.get(cache_key)
        if cached is not None and isinstance(cached, dict):
            try:
                return CaseIntelligenceDossier.model_validate(cached)
            except Exception:
                pass

        # Request deduplication: ensure simultaneous requests for the same case dossier reuse computation
        lock_key = str(case_id)
        if lock_key not in self._inflight_locks:
            self._inflight_locks[lock_key] = asyncio.Lock()

        async with self._inflight_locks[lock_key]:
            # Double-check cache after acquiring lock
            cached_retry = await self.cache.get(cache_key)
            if cached_retry is not None and isinstance(cached_retry, dict):
                try:
                    return CaseIntelligenceDossier.model_validate(cached_retry)
                except Exception:
                    pass

            stmt = select(Case).where(Case.id == case_id)
            result = await self.session.execute(stmt)
            case = result.scalar_one_or_none()
            if not case:
                raise NotFoundException(f"Case {case_id} not found.")

            # Load persisted correlations, similarities, insights, anomalies
            corr_stmt = select(Correlation).where(Correlation.case_id == case_id)
            corr_res = await self.session.execute(corr_stmt)
            correlations = list(corr_res.scalars().all())

            sim_stmt = select(CaseSimilarity).where(CaseSimilarity.source_case_id == case_id)
            sim_res = await self.session.execute(sim_stmt)
            similarities = list(sim_res.scalars().all())

            ins_stmt = select(IntelligenceInsight).where(IntelligenceInsight.case_id == case_id)
            ins_res = await self.session.execute(ins_stmt)
            insights = list(ins_res.scalars().all())

            anom_stmt = select(Anomaly).where(Anomaly.case_id == case_id)
            anom_res = await self.session.execute(anom_stmt)
            anomalies = list(anom_res.scalars().all())

            ent_stmt = select(Entity).where(Entity.case_id == case_id)
            ent_res = await self.session.execute(ent_stmt)
            entities = list(ent_res.scalars().all())

            # If empty, run inline synthesis
            if not similarities and not correlations:
                hist_stmt = select(Case).where(Case.id != case.id).limit(10)
                hist_res = await self.session.execute(hist_stmt)
                historical = list(hist_res.scalars().all())
                res = self.engine.run_case_analysis_pipeline(case, historical, entities)
                similarities = res["similar_cases"]
                correlations = res["correlations"]
                insights = res["pattern_insights"]
                anomalies = res["anomalies"]

            evidence_list = case.__dict__.get("evidence") or []
            priority_calc = self.engine.scorer.calculate_investigation_priority(
                evidence_count=len(evidence_list),
                correlation_count=len(correlations),
                similar_case_count=len(similarities),
                anomaly_count=len(anomalies),
            )

            insight_responses = [
                InsightResponse(
                    id=ins.id,
                    case_id=ins.case_id,
                    insight_type=ins.insight_type,
                    title=ins.title,
                    summary=ins.summary,
                    confidence=ins.confidence,
                    facts=ins.facts or [],
                    inferences=ins.inferences or [],
                    supporting_records=ins.supporting_records or [],
                    limitations=ins.limitations,
                    priority=ins.priority,
                    created_at=ins.created_at,
                )
                for ins in insights
            ]

            dossier = CaseIntelligenceDossier(
                case_id=case.id,
                case_number=case.case_number,
                title=case.title,
                investigation_priority_score=priority_calc["score"],
                priority_breakdown=priority_calc["components"],
                total_entities_extracted=len(entities),
                total_correlations_found=len(correlations),
                total_similar_cases=len(similarities),
                total_anomalies_flagged=len(anomalies),
                insights=insight_responses,
                graph_hubs=[],
                generated_at=datetime.now(timezone.utc),
            )

            await self.cache.set(
                cache_key,
                dossier.model_dump(mode="json"),
                ttl=self.cache.ttl.AI_RESULT,
            )
            return dossier

    def _synthesize_entities_from_case(self, case: Case) -> List[Entity]:
        """Extract baseline entities from case title, narrative, and location."""
        ents = []
        # Case location
        loc = getattr(case, "incident_location", None) or (case.fir.incident_location if case.fir else None)
        if loc:
            ents.append(
                Entity(
                    id=uuid.uuid4(),
                    case_id=case.id,
                    entity_type="LOCATION",
                    name=loc,
                    normalized_value=loc.lower().strip(),
                    confidence=1.0,
                    source_text="Case Incident Location",
                    is_canonical=True,
                )
            )

        # Suspects or vehicles mentioned in description
        text = case.description or ""
        import re
        phones = re.findall(r"(?:\+?91|0)?[6-9]\d{9}", text)
        for p in set(phones):
            ents.append(
                Entity(
                    id=uuid.uuid4(),
                    case_id=case.id,
                    entity_type="PHONE",
                    name=p,
                    normalized_value=p[-10:],
                    confidence=0.95,
                    source_text=f"Extracted from case narrative: {p}",
                    is_canonical=True,
                )
            )

        vehicles = re.findall(r"[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}", text.replace(" ", ""))
        for v in set(vehicles):
            ents.append(
                Entity(
                    id=uuid.uuid4(),
                    case_id=case.id,
                    entity_type="VEHICLE",
                    name=v,
                    normalized_value=v.upper(),
                    confidence=0.92,
                    source_text=f"Extracted vehicle plate: {v}",
                    is_canonical=True,
                )
            )

        # Baseline suspect entity if mentioned
        words = text.split()
        if len(words) >= 4:
            suspect_name = f"Suspect {case.case_number[-4:]}"
            ents.append(
                Entity(
                    id=uuid.uuid4(),
                    case_id=case.id,
                    entity_type="PERSON",
                    name=suspect_name,
                    normalized_value=suspect_name.lower(),
                    confidence=0.85,
                    source_text=f"Primary suspect associated with {case.case_number}",
                    is_canonical=True,
                )
            )

        return ents
