"""FastAPI endpoints for KRITAGAS AI/ML Intelligence Engine."""

import asyncio
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.ai_ml.entity_resolution.resolver import entity_resolver
from app.ai_ml.intelligence.explanation_engine import explanation_engine
from app.ai_ml.models.ai_models import (
    AnalysisJob,
    Anomaly,
    CaseSimilarity,
    Correlation,
    Entity,
    EntityMatch,
    IntelligenceInsight,
)
from app.ai_ml.schemas.anomaly import AnomalyItem, AnomalyListResponse
from app.ai_ml.schemas.correlation import CorrelationItem
from app.ai_ml.schemas.entity_resolution import (
    EntityItem,
    EntityMatchCandidate,
    EntityResolveRequest,
    EntityResolveResponse,
)
from app.ai_ml.schemas.intelligence import (
    AnalysisJobResponse,
    CaseIntelligenceDossier,
    InsightResponse,
    PersonIntelligenceProfile,
)
from app.ai_ml.schemas.similarity import CaseSimilarityResponse
from app.ai_ml.services.case_intelligence_service import CaseIntelligenceService
from app.ai_ml.services.historical_search_service import HistoricalCaseSearchService
from app.ai_ml.services.person_intelligence_service import PersonIntelligenceService
from app.api.deps import (
    get_async_session,
    get_case_intelligence_service,
    get_current_user,
    get_historical_search_service,
    get_person_intelligence_service,
    require_roles,
)
from app.core.constants import UserRole
from app.core.exceptions import NotFoundException
from app.models.user import User
from app.utils.response import success_response

router = APIRouter()


# -------------------------------------------------------------
# 1. Asynchronous Case Analysis Job Execution & Polling
# -------------------------------------------------------------

@router.post(
    "/cases/{case_id}/analyze",
    summary="Trigger Asynchronous Case AI Analysis",
    description="Enqueue a comprehensive background intelligence analysis job across entities, correlations, similarities, and anomalies.",
    status_code=status.HTTP_202_ACCEPTED,
)
async def analyze_case(
    case_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    intelligence_service: CaseIntelligenceService = Depends(get_case_intelligence_service),
    session: AsyncSession = Depends(get_async_session),
):
    job = await intelligence_service.create_analysis_job(case_id=case_id, triggered_by=current_user)

    # Launch in background with dedicated session scope
    async def run_in_background(j_id: uuid.UUID):
        # Allow short tick for transaction commit
        await asyncio.sleep(0.1)
        async with session.begin():
            svc = CaseIntelligenceService(session)
            await svc.execute_case_analysis(j_id)

    background_tasks.add_task(intelligence_service.execute_case_analysis, job.id)

    return success_response(
        data={
            "job_id": str(job.id),
            "case_id": str(job.case_id),
            "status": job.status,
            "progress": job.progress,
            "current_stage": job.current_stage,
            "message": "AI/ML investigation analysis queued for asynchronous processing.",
        },
        message="Case analysis job queued.",
        status_code=status.HTTP_202_ACCEPTED,
    )


@router.get(
    "/analysis/jobs/{job_id}",
    summary="Get Analysis Job Status",
    description="Poll progress and status of a running or completed analysis job.",
)
async def get_job_status(
    job_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    intelligence_service: CaseIntelligenceService = Depends(get_case_intelligence_service),
):
    job = await intelligence_service.get_job_status(job_id)
    return success_response(
        data=AnalysisJobResponse.model_validate(job).model_dump(mode="json"),
        message="Job status retrieved.",
    )


# -------------------------------------------------------------
# 2. Case Intelligence Dossier
# -------------------------------------------------------------

@router.get(
    "/cases/{case_id}/intelligence",
    summary="Get Case Intelligence Dossier",
    description="Retrieve consolidated intelligence findings, priority scoring, correlations, anomalies, and insights.",
)
async def get_case_intelligence(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    intelligence_service: CaseIntelligenceService = Depends(get_case_intelligence_service),
):
    dossier = await intelligence_service.get_case_intelligence_dossier(case_id)
    return success_response(
        data=dossier.model_dump(mode="json"),
        message="Case intelligence dossier retrieved.",
    )


# -------------------------------------------------------------
# 3. Similar Historical Cases
# -------------------------------------------------------------

@router.get(
    "/cases/{case_id}/similar-cases",
    summary="Find Similar Historical Cases",
    description="Search multi-decade historical cases using semantic vector embeddings, modus operandi signatures, and spatial-temporal overlap.",
)
async def get_similar_cases(
    case_id: uuid.UUID,
    top_k: int = Query(5, ge=1, le=20),
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    search_service: HistoricalCaseSearchService = Depends(get_historical_search_service),
):
    result = await search_service.search_similar_cases(case_id=case_id, top_k=top_k)
    return success_response(
        data=result.model_dump(mode="json"),
        message="Similar historical cases retrieved.",
    )


# -------------------------------------------------------------
# 4. Cross-Source Correlations
# -------------------------------------------------------------

@router.get(
    "/cases/{case_id}/correlations",
    summary="Get Case Correlations",
    description="Retrieve cross-source multi-hop correlation chains linking FIRs, telecommunications, financial transfers, and vehicles.",
)
async def get_case_correlations(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    stmt = select(Correlation).where(Correlation.case_id == case_id)
    res = await session.execute(stmt)
    corrs = list(res.scalars().all())

    items = [
        CorrelationItem(
            id=c.id,
            case_id=c.case_id,
            correlation_type=c.correlation_type,
            confidence=c.confidence,
            description=c.description,
            evidence_chain=c.evidence_chain or [],
            source_records=c.source_records or [],
            created_at=c.created_at,
        ).model_dump(mode="json")
        for c in corrs
    ]
    return success_response(
        data={"case_id": str(case_id), "total": len(items), "correlations": items},
        message="Correlations retrieved.",
    )


# -------------------------------------------------------------
# 5. Patterns & Insights
# -------------------------------------------------------------

@router.get(
    "/cases/{case_id}/patterns",
    summary="Get Case Modus Operandi & Temporal Patterns",
    description="Retrieve detected behavioral signatures, temporal recurrence clusters, and geographic hotspots.",
)
async def get_case_patterns(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    stmt = select(IntelligenceInsight).where(
        (IntelligenceInsight.case_id == case_id)
        & (IntelligenceInsight.insight_type.like("%PATTERN%"))
    )
    res = await session.execute(stmt)
    patterns = list(res.scalars().all())

    items = [InsightResponse.model_validate(p).model_dump(mode="json") for p in patterns]
    return success_response(
        data={"case_id": str(case_id), "total": len(items), "patterns": items},
        message="Patterns retrieved.",
    )


@router.get(
    "/cases/{case_id}/insights",
    summary="Get Structured Case Insights",
    description="Retrieve investigative leads with verified facts and AI inferences cleanly separated.",
)
async def get_case_insights(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    stmt = select(IntelligenceInsight).where(IntelligenceInsight.case_id == case_id)
    res = await session.execute(stmt)
    insights = list(res.scalars().all())

    items = [InsightResponse.model_validate(i).model_dump(mode="json") for i in insights]
    return success_response(
        data={"case_id": str(case_id), "total": len(items), "insights": items},
        message="Insights retrieved.",
    )


# -------------------------------------------------------------
# 6. Flagged Anomalies
# -------------------------------------------------------------

@router.get(
    "/cases/{case_id}/anomalies",
    summary="Get Flagged Anomalies",
    description="Retrieve statistical transaction spikes, off-hour call bursts, and behavioral outliers labeled strictly 'Requires Investigation'.",
)
async def get_case_anomalies(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    stmt = select(Anomaly).where(Anomaly.case_id == case_id)
    res = await session.execute(stmt)
    anomalies = list(res.scalars().all())

    items = [AnomalyItem.model_validate(a).model_dump(mode="json") for a in anomalies]
    return success_response(
        data=AnomalyListResponse(
            case_id=case_id,
            total_anomalies=len(items),
            items=[AnomalyItem.model_validate(a) for a in anomalies],
        ).model_dump(mode="json"),
        message="Anomalies retrieved.",
    )


# -------------------------------------------------------------
# 7. Entity Resolution & Review
# -------------------------------------------------------------

@router.get(
    "/entities/{entity_id}/possible-matches",
    summary="Find Possible Duplicate Entity Matches",
    description="Query candidate matching entities across all cases for de-duplication review.",
)
async def get_entity_possible_matches(
    entity_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    stmt = select(Entity).where(Entity.id == entity_id)
    res = await session.execute(stmt)
    target = res.scalar_one_or_none()
    if not target:
        raise NotFoundException(f"Entity {entity_id} not found.")

    corpus_stmt = select(Entity).where(Entity.entity_type == target.entity_type).limit(100)
    corpus_res = await session.execute(corpus_stmt)
    corpus = list(corpus_res.scalars().all())

    matches = entity_resolver.find_possible_matches(target, corpus)

    items = []
    for m in matches:
        other_id = m.target_entity_id if m.source_entity_id == target.id else m.source_entity_id
        other_ent = next((e for e in corpus if e.id == other_id), None)
        if other_ent:
            items.append(
                EntityMatchCandidate(
                    match_id=m.id,
                    source_entity=EntityItem.model_validate(target),
                    target_entity=EntityItem.model_validate(other_ent),
                    confidence_score=m.confidence_score,
                    status=m.status,
                    similarity_breakdown=m.similarity_breakdown or {},
                    supporting_evidence=m.supporting_evidence or [],
                    conflicting_evidence=m.conflicting_evidence or [],
                    created_at=m.created_at,
                ).model_dump(mode="json")
            )

    return success_response(
        data={"entity_id": str(entity_id), "total_candidates": len(items), "candidates": items},
        message="Candidate entity matches retrieved.",
    )


@router.post(
    "/entities/resolve",
    summary="Review and Resolve Entity Match",
    description="Human detective confirms or rejects that two records refer to the same real-world identity.",
)
async def resolve_entity_match(
    body: EntityResolveRequest,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    stmt = select(EntityMatch).where(EntityMatch.id == body.match_id)
    res = await session.execute(stmt)
    match = res.scalar_one_or_none()
    if not match:
        raise NotFoundException(f"Entity match {body.match_id} not found.")

    s_ent = await session.get(Entity, match.source_entity_id)
    t_ent = await session.get(Entity, match.target_entity_id)

    if body.decision.upper() == "CONFIRMED_SAME":
        if s_ent and t_ent:
            entity_resolver.confirm_match(
                match=match,
                source_entity=s_ent,
                target_entity=t_ent,
                reviewer_id=current_user.id,
                notes=body.notes,
            )
            msg = f"Confirmed match: '{t_ent.name}' resolved to canonical '{s_ent.name}'."
        else:
            msg = "Confirmed match recorded."
    elif body.decision.upper() == "REJECTED":
        entity_resolver.reject_match(match=match, reviewer_id=current_user.id, notes=body.notes)
        msg = "Match candidate rejected by investigator."
    else:
        match.status = "FLAGGED"
        match.review_notes = body.notes
        msg = "Match candidate flagged for further verification."

    await session.commit()

    return success_response(
        data=EntityResolveResponse(
            match_id=match.id,
            status=match.status,
            canonical_entity_id=s_ent.id if s_ent else None,
            message=msg,
        ).model_dump(mode="json"),
        message="Entity resolution decision processed successfully.",
    )


# -------------------------------------------------------------
# 8. Person Intelligence Dossier
# -------------------------------------------------------------

@router.get(
    "/persons/{person_id}/intelligence",
    summary="Get Person 360 Intelligence Profile",
    description="Synthesize cross-case appearance, associations, telephone contacts, and timeline for a person.",
)
async def get_person_intelligence(
    person_id: str,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    person_service: PersonIntelligenceService = Depends(get_person_intelligence_service),
):
    profile = await person_service.get_person_intelligence(person_id)
    return success_response(
        data=profile.model_dump(mode="json"),
        message="Person intelligence profile retrieved.",
    )


# -------------------------------------------------------------
# 9. Granular Explainability
# -------------------------------------------------------------

@router.get(
    "/insights/{insight_id}/explanation",
    summary="Get Granular Insight Explanation",
    description="Retrieve deep explainability breakdown answering 'WHY' this insight was derived, citing supporting evidence and model limitations.",
)
async def get_insight_explanation(
    insight_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    stmt = select(IntelligenceInsight).where(IntelligenceInsight.id == insight_id)
    res = await session.execute(stmt)
    insight = res.scalar_one_or_none()
    if not insight:
        raise NotFoundException(f"Insight {insight_id} not found.")

    explanation = explanation_engine.explain_insight(insight)
    return success_response(
        data=explanation,
        message="Insight explanation retrieved.",
    )
