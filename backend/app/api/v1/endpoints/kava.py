"""KAVA AI — Case-Grounded Investigative Chat Endpoints."""

import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_async_session, require_roles
from app.core.constants import UserRole
from app.core.logging import get_logger
from app.models.user import User
from app.services.kava_service import KavaService
from app.utils.response import success_response

logger = get_logger("kritagas.kava.api")

router = APIRouter()


# ── Request / Response schemas ────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message content")


class KavaChatRequest(BaseModel):
    caseId: Optional[str] = Field(default=None, description="UUID of the active investigation case")
    case_id: Optional[str] = Field(default=None, description="UUID of the active investigation case (alias)")
    message: str = Field(..., min_length=1, max_length=4000, description="Investigator's question")
    history: Optional[List[ChatMessage]] = Field(default=None, description="Prior conversation turns")


class KavaChatResponse(BaseModel):
    answer: str
    sources: List[str]
    groundingLevel: str  # FULL | PARTIAL | LIMITED | ERROR | NONE
    contextStats: Dict[str, Any]
    intents: Optional[List[str]] = None


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post(
    "/chat",
    summary="KAVA AI — Case-Grounded Investigative Query",
    description=(
        "Submit an investigative question grounded in the selected case. "
        "KAVA retrieves real case data (FIR, entities, CDR, SAMANVAYA outputs) "
        "before generating an evidence-anchored answer."
    ),
    response_model=None,
    status_code=status.HTTP_200_OK,
)
async def kava_chat(
    body: KavaChatRequest,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    """KAVA AI chat endpoint — grounded in real case intelligence."""
    raw_case_id = body.caseId or body.case_id
    if not raw_case_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Either 'caseId' or 'case_id' must be provided.",
        )

    # Validate UUID
    try:
        case_uuid = uuid.UUID(raw_case_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid case ID format: '{raw_case_id}'. Expected a UUID.",
        )

    history = (
        [{"role": m.role, "content": m.content} for m in body.history]
        if body.history
        else []
    )

    svc = KavaService(session)
    result = await svc.ask(case_id=case_uuid, message=body.message, history=history)

    logger.info(
        "KAVA response for case=%s grounding=%s sources=%s",
        raw_case_id,
        result.get("groundingLevel"),
        result.get("sources"),
    )

    return success_response(
        data=result,
        message="KAVA AI analysis generated.",
    )


@router.get(
    "/{case_id}/context",
    summary="Get Case Intelligence Context for KAVA",
    description="Retrieve consolidated case intelligence (FIR, entities, evidence, SAMANVAYA dossier, timeline, stats).",
    response_model=None,
    status_code=status.HTTP_200_OK,
)
async def get_kava_case_context(
    case_id: str,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        case_uuid = uuid.UUID(case_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid case ID format: '{case_id}'. Expected a UUID.",
        )
    svc = KavaService(session)
    intel = await svc.get_case_intelligence_context(case_uuid)
    if "error" in intel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=intel["error"])
    return success_response(data=intel, message="Case intelligence retrieved successfully.")
