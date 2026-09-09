"""FastAPI endpoints for the SAMANVAYA Multi-Agent Criminal Investigation System.

Read endpoints never trigger analysis. Selecting a case in the UI must not silently
start an expensive five-agent run, so a case that has not been analysed returns an
explicit empty state and the officer starts the pipeline deliberately.
"""

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_async_session, require_roles
from app.core.constants import UserRole
from app.core.logging import get_logger
from app.models.case import Case
from app.models.user import User
from app.services.samanvaya_service import SamanvayaService
from app.utils.response import success_response

logger = get_logger("kritagas.samanvaya.api")

router = APIRouter()

MAX_CDR_BYTES = 25 * 1024 * 1024


# ---------------------------------------------------------------------------
# 1. Start SAMANVAYA Investigation Pipeline
# ---------------------------------------------------------------------------

@router.post(
    "/cases/{case_id}/start",
    summary="Start SAMANVAYA 5-Agent Multi-Agent Pipeline",
    description="Initializes and runs the sequential 5-agent investigation pipeline.",
    status_code=status.HTTP_200_OK,
)
@router.post(
    "/cases/{case_id}/run",
    include_in_schema=False,
)
async def start_samanvaya_pipeline(
    case_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    sync: bool = Query(False, description="If True, wait for full completion synchronously"),
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Execute autonomous SAMANVAYA 5-agent investigation on a selected case."""
    service = SamanvayaService(session)

    # Capture identity as primitives: the background task runs on a different
    # session, where an ORM User instance would be detached.
    officer_id = current_user.id
    officer_name = current_user.username

    if sync:
        dossier = await service.run_investigation_pipeline(
            case_id, officer_id=officer_id, officer_name=officer_name
        )
        return success_response(
            data=dossier,
            message="SAMANVAYA Multi-Agent Analysis Completed Successfully.",
        )

    await service.invalidate_case_cache(case_id)

    data_sources = await service.get_data_sources(case_id)
    await service._update_status(
        case_id=case_id,
        status="INITIALIZING",
        agent_idx=0,
        agent_name="Master Orchestrator",
        progress=5,
        stage_text="Initializing SAMANVAYA Multi-Agent Pipeline...",
        agents=[],
        console=[SamanvayaService._line("Orchestrator queued - awaiting worker", "INFO")],
        data_sources=data_sources,
    )

    async def _execute_bg():
        from app.db.session import AsyncSessionLocal
        async with AsyncSessionLocal() as bg_session:
            bg_service = SamanvayaService(bg_session)
            try:
                await bg_service.run_investigation_pipeline(
                    case_id, officer_id=officer_id, officer_name=officer_name
                )
            except Exception as err:
                logger.exception(f"SAMANVAYA pipeline failed for case {case_id}")
                await bg_service._update_status(
                    case_id=case_id,
                    status="FAILED",
                    agent_idx=0,
                    agent_name="Orchestrator",
                    progress=0,
                    stage_text=f"Analysis failed: {err}",
                    agents=[],
                    error=str(err),
                    console=[SamanvayaService._line(str(err)[:300], "ERROR")],
                )

    background_tasks.add_task(_execute_bg)

    return success_response(
        data={
            "caseId": str(case_id),
            "status": "INITIALIZING",
            "progress": 5,
            "message": "SAMANVAYA Multi-Agent Pipeline started in background.",
        },
        message="SAMANVAYA analysis initiated.",
    )


# ---------------------------------------------------------------------------
# 2. Get Live Pipeline Execution Status
# ---------------------------------------------------------------------------

@router.get(
    "/cases/{case_id}/status",
    summary="Get SAMANVAYA Pipeline Execution Status",
    response_model=None,
)
async def get_samanvaya_status(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Returns current real progress, active agent, and completed cards for polling."""
    service = SamanvayaService(session)
    status_obj = await service.get_pipeline_status(case_id)
    return success_response(data=status_obj, message="Pipeline status retrieved.")


# ---------------------------------------------------------------------------
# 3. Get Final Synthesized Results
# ---------------------------------------------------------------------------

@router.get(
    "/cases/{case_id}/results",
    summary="Get Complete SAMANVAYA Investigation Results",
    response_model=None,
)
async def get_samanvaya_results(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Return the finalized dossier, or null when the pipeline has not been run."""
    service = SamanvayaService(session)
    results = await service.get_case_results(case_id)
    if not results:
        return success_response(
            data=None,
            message="No SAMANVAYA analysis has been run for this case yet.",
        )
    return success_response(data=results, message="SAMANVAYA intelligence results retrieved.")


# ---------------------------------------------------------------------------
# 4. Get Agent Cards & Inspection Telemetry
# ---------------------------------------------------------------------------

@router.get(
    "/cases/{case_id}/agents",
    summary="Get Individual Agent Telemetry and Inspectable Cards",
    response_model=None,
)
async def get_samanvaya_agents(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Returns the 5 agent cards with inputs, processing, data sources, and limitations."""
    service = SamanvayaService(session)
    results = await service.get_case_results(case_id)
    return success_response(
        data=results.agents if results else [],
        message="Agent telemetry retrieved." if results else "No agent telemetry recorded for this case yet.",
    )


# ---------------------------------------------------------------------------
# 5. Get Advanced Investigation Graph
# ---------------------------------------------------------------------------

@router.get(
    "/cases/{case_id}/graph",
    summary="Get Advanced SAMANVAYA Intelligence Graph",
    response_model=None,
)
async def get_samanvaya_graph(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Returns multi-tier criminal network graph distinct from the simple FIR graph."""
    service = SamanvayaService(session)
    results = await service.get_case_results(case_id)
    return success_response(
        data=results.graph if results else None,
        message="Advanced intelligence graph retrieved." if results else "No graph synthesized for this case yet.",
    )


# ---------------------------------------------------------------------------
# 6. Get Investigation Tree
# ---------------------------------------------------------------------------

@router.get(
    "/cases/{case_id}/tree",
    summary="Get Hierarchical Investigation Tree",
    response_model=None,
)
async def get_samanvaya_tree(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Returns hierarchical tree structure decomposing suspects, incident loci, and leads."""
    service = SamanvayaService(session)
    results = await service.get_case_results(case_id)
    return success_response(
        data=results.tree if results else None,
        message="Investigation tree retrieved." if results else "No investigation tree built for this case yet.",
    )


# ---------------------------------------------------------------------------
# 7. Get Official Final Dossier Report
# ---------------------------------------------------------------------------

@router.get(
    "/cases/{case_id}/report",
    summary="Get Official SAMANVAYA Investigation Report",
    response_model=None,
)
async def get_samanvaya_report(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Returns the comprehensive report text with its audit-ledger verification hash."""
    service = SamanvayaService(session)
    results = await service.get_case_results(case_id)
    if not results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No SAMANVAYA report exists for this case. Run the analysis first.",
        )
    return success_response(
        data={
            "caseId": results.caseId,
            "caseNumber": results.caseNumber,
            "caseTitle": results.caseTitle,
            "reportText": results.reportText,
            "blockchainHash": results.blockchainHash,
            "generatedAt": results.generatedAt,
            "findingsCount": len(results.findings),
            "leadsCount": len(results.investigativeLeads),
        },
        message="Official investigation report retrieved.",
    )


# ---------------------------------------------------------------------------
# 8. Data Source Availability (Step 2 of the investigation flow)
# ---------------------------------------------------------------------------

@router.get(
    "/cases/{case_id}/data-sources",
    summary="Get Real Investigation Data Source Availability",
    response_model=None,
)
async def get_samanvaya_data_sources(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Reports which investigation data sources are genuinely available for this case."""
    service = SamanvayaService(session)
    sources = await service.get_data_sources(case_id)
    return success_response(data=sources, message="Data source availability retrieved.")


# ---------------------------------------------------------------------------
# 9. Call Detail Record Ingestion
# ---------------------------------------------------------------------------

@router.post(
    "/cases/{case_id}/data-sources/cdr",
    summary="Upload Call Detail Records for a Case",
    status_code=status.HTTP_201_CREATED,
    response_model=None,
)
async def upload_case_cdr(
    case_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Parse and analyse an officer-supplied CSV or JSON call detail record export."""
    service = SamanvayaService(session)

    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Case {case_id} not found.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded file is empty.")
    if len(content) > MAX_CDR_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds the {MAX_CDR_BYTES // (1024 * 1024)} MB call-record upload limit.",
        )

    file_name = file.filename or "call_records.csv"
    if not file_name.lower().endswith((".csv", ".json", ".txt", ".tsv")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Call detail records must be supplied as .csv, .tsv, .txt or .json.",
        )

    incident_at: Optional[datetime] = None
    if case.incident_date:
        incident_at = datetime.combine(case.incident_date, case.incident_time or datetime.min.time())

    try:
        analysis = await service.ingest_cdr(
            case_id=case_id,
            content=content,
            file_name=file_name,
            incident_at=incident_at,
        )
    except ValueError as err:
        # Parsing problems are the officer's to fix, so return the reason verbatim.
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(err))
    except Exception as err:
        logger.exception(f"CDR ingestion failed for case {case_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Call record ingestion failed: {err}",
        )

    return success_response(
        data=analysis,
        message=f"{analysis.parsedRecords:,} call records indexed, {len(analysis.patterns)} anomalies flagged.",
    )


@router.get(
    "/cases/{case_id}/data-sources/cdr",
    summary="Get Stored Communication Analysis",
    response_model=None,
)
async def get_case_cdr(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Return the communication analysis derived from the uploaded call records."""
    service = SamanvayaService(session)
    analysis = await service.get_cdr(case_id)
    return success_response(
        data=analysis,
        message="Communication analysis retrieved." if analysis else "No call records attached to this case.",
    )


@router.delete(
    "/cases/{case_id}/data-sources/cdr",
    summary="Detach Uploaded Call Detail Records",
    response_model=None,
)
async def delete_case_cdr(
    case_id: uuid.UUID,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """Remove the uploaded call records and invalidate the derived dossier."""
    service = SamanvayaService(session)
    await service.clear_cdr(case_id)
    return success_response(data={"caseId": str(case_id)}, message="Call detail records detached from this case.")
