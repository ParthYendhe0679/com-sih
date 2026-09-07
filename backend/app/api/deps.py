"""Reusable FastAPI dependencies for database sessions, authentication, and role authorization."""

from typing import Callable, Optional, Sequence
import uuid
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.core.exceptions import AuthenticationException, PermissionDeniedException
from app.core.security import decode_jwt_token
from app.db.session import get_async_session
from app.integrations.graph.graph_interface import GraphService, get_graph_service
from app.integrations.intelligence.intelligence_interface import (
    IntelligenceService,
    get_intelligence_service,
)
from app.integrations.storage.storage_interface import StorageService, get_storage_service
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.repositories.case_repository import CaseRepository
from app.repositories.evidence_repository import EvidenceRepository
from app.repositories.fir_repository import FIRRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.user_repository import UserRepository
from app.services.audit_service import AuditService
from app.services.auth_service import AuthService
from app.services.case_service import CaseService
from app.services.dashboard_service import DashboardService
from app.services.evidence_service import EvidenceService
from app.services.fir_service import FIRService
from app.services.notification_service import NotificationService
from app.services.search_service import SearchService
from app.services.user_service import UserService
from app.ai_ml.services.case_intelligence_service import CaseIntelligenceService
from app.ai_ml.services.historical_search_service import HistoricalCaseSearchService
from app.ai_ml.services.person_intelligence_service import PersonIntelligenceService

# Bearer token extractor (auto_error=False to allow custom exception handling)
security = HTTPBearer(auto_error=False)


def get_client_ip(request: Request) -> Optional[str]:
    """Extract client IP address from request headers or socket."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


# -------------------------------------------------------------
# Repositories
# -------------------------------------------------------------

def get_user_repo(session: AsyncSession = Depends(get_async_session)) -> UserRepository:
    return UserRepository(session)


def get_fir_repo(session: AsyncSession = Depends(get_async_session)) -> FIRRepository:
    return FIRRepository(session)


def get_case_repo(session: AsyncSession = Depends(get_async_session)) -> CaseRepository:
    return CaseRepository(session)


def get_evidence_repo(session: AsyncSession = Depends(get_async_session)) -> EvidenceRepository:
    return EvidenceRepository(session)


def get_notification_repo(session: AsyncSession = Depends(get_async_session)) -> NotificationRepository:
    return NotificationRepository(session)


def get_audit_repo(session: AsyncSession = Depends(get_async_session)) -> AuditRepository:
    return AuditRepository(session)


# -------------------------------------------------------------
# Services
# -------------------------------------------------------------

def get_audit_service(
    audit_repo: AuditRepository = Depends(get_audit_repo),
) -> AuditService:
    return AuditService(audit_repo)


def get_notification_service(
    notification_repo: NotificationRepository = Depends(get_notification_repo),
) -> NotificationService:
    return NotificationService(notification_repo)


def get_auth_service(
    user_repo: UserRepository = Depends(get_user_repo),
    audit_service: AuditService = Depends(get_audit_service),
) -> AuthService:
    return AuthService(user_repo, audit_service)


def get_user_service(
    user_repo: UserRepository = Depends(get_user_repo),
    audit_service: AuditService = Depends(get_audit_service),
) -> UserService:
    return UserService(user_repo, audit_service)


def get_fir_service(
    fir_repo: FIRRepository = Depends(get_fir_repo),
    audit_service: AuditService = Depends(get_audit_service),
    notification_service: NotificationService = Depends(get_notification_service),
    intelligence_service: IntelligenceService = Depends(get_intelligence_service),
) -> FIRService:
    return FIRService(fir_repo, audit_service, notification_service, intelligence_service)


def get_case_service(
    case_repo: CaseRepository = Depends(get_case_repo),
    fir_repo: FIRRepository = Depends(get_fir_repo),
    user_repo: UserRepository = Depends(get_user_repo),
    audit_service: AuditService = Depends(get_audit_service),
    notification_service: NotificationService = Depends(get_notification_service),
    intelligence_service: IntelligenceService = Depends(get_intelligence_service),
    graph_service: GraphService = Depends(get_graph_service),
) -> CaseService:
    return CaseService(
        case_repo,
        fir_repo,
        user_repo,
        audit_service,
        notification_service,
        intelligence_service,
        graph_service,
    )


def get_evidence_service(
    evidence_repo: EvidenceRepository = Depends(get_evidence_repo),
    fir_repo: FIRRepository = Depends(get_fir_repo),
    case_repo: CaseRepository = Depends(get_case_repo),
    audit_service: AuditService = Depends(get_audit_service),
    storage_service: StorageService = Depends(get_storage_service),
) -> EvidenceService:
    return EvidenceService(
        evidence_repo,
        fir_repo,
        case_repo,
        audit_service,
        storage_service,
    )


def get_dashboard_service(
    user_repo: UserRepository = Depends(get_user_repo),
    fir_repo: FIRRepository = Depends(get_fir_repo),
    case_repo: CaseRepository = Depends(get_case_repo),
    audit_repo: AuditRepository = Depends(get_audit_repo),
    notification_repo: NotificationRepository = Depends(get_notification_repo),
) -> DashboardService:
    return DashboardService(
        user_repo,
        fir_repo,
        case_repo,
        audit_repo,
        notification_repo,
    )


def get_search_service(
    fir_repo: FIRRepository = Depends(get_fir_repo),
    case_repo: CaseRepository = Depends(get_case_repo),
) -> SearchService:
    return SearchService(fir_repo, case_repo)


def get_case_intelligence_service(
    db: AsyncSession = Depends(get_async_session),
) -> CaseIntelligenceService:
    return CaseIntelligenceService(db)


def get_historical_search_service(
    db: AsyncSession = Depends(get_async_session),
) -> HistoricalCaseSearchService:
    return HistoricalCaseSearchService(db)


def get_person_intelligence_service(
    db: AsyncSession = Depends(get_async_session),
) -> PersonIntelligenceService:
    return PersonIntelligenceService(db)


# -------------------------------------------------------------
# Authentication & Role Authorization Dependencies
# -------------------------------------------------------------

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    user_repo: UserRepository = Depends(get_user_repo),
) -> User:
    """Dependency validating Bearer JWT and returning active authenticated User."""
    if not credentials or not credentials.credentials:
        raise AuthenticationException("Authorization header with Bearer token is missing.")

    payload = decode_jwt_token(credentials.credentials)
    if payload.get("type") != "access":
        raise AuthenticationException("Invalid token type: access token required.")

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise AuthenticationException("Token is missing user identifier.")

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise AuthenticationException("Invalid user identifier in token.")

    user = await user_repo.get_by_id(user_id)
    if not user:
        raise AuthenticationException("Authenticated user account not found.")

    if not user.is_active:
        raise PermissionDeniedException("Account has been deactivated. Please contact an administrator.")

    return user


def require_roles(*allowed_roles: UserRole) -> Callable:
    """Factory creating an authorization dependency restricting endpoints to specified roles."""

    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            role_names = ", ".join(r.value for r in allowed_roles)
            raise PermissionDeniedException(
                f"Access forbidden: endpoint restricted to [{role_names}] roles."
            )
        return current_user

    return role_checker
