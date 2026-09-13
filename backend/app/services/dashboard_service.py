import time
from typing import Optional, Any, Dict, Tuple
from app.core.constants import CasePriority, CaseStatus, FIRStatus, UserRole
from app.models.user import User
from app.repositories.audit_repository import AuditRepository
from app.repositories.case_repository import CaseRepository
from app.repositories.fir_repository import FIRRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.user_repository import UserRepository
from app.schemas.case import CaseResponse
from app.schemas.dashboard import (
    AdminDashboardResponse,
    AuditLogSummary,
    CitizenDashboardResponse,
    PoliceDashboardResponse,
)
from app.schemas.fir import FIRResponse

_L1_DASHBOARD_CACHE: Dict[str, Tuple[float, Any]] = {}
L1_DASHBOARD_TTL = 60  # 60 seconds memory cache


class DashboardService:
    """Service computing analytical summaries and operational intelligence metrics with caching."""

    def __init__(
        self,
        user_repo: UserRepository,
        fir_repo: FIRRepository,
        case_repo: CaseRepository,
        audit_repo: AuditRepository,
        notification_repo: NotificationRepository,
        cache_service: Optional[Any] = None,
    ):
        self.user_repo = user_repo
        self.fir_repo = fir_repo
        self.case_repo = case_repo
        self.audit_repo = audit_repo
        self.notification_repo = notification_repo
        from app.services.cache_service import cache_service as default_cache
        self.cache = cache_service or default_cache

    async def get_citizen_dashboard(self, citizen: User) -> CitizenDashboardResponse:
        """Calculate live statistics for Citizen portal view with caching."""
        global _L1_DASHBOARD_CACHE
        now = time.time()
        cache_key = self.cache.keys.dashboard("citizen", citizen.id)

        if cache_key in _L1_DASHBOARD_CACHE:
            entry_time, cached_res = _L1_DASHBOARD_CACHE[cache_key]
            if now - entry_time < L1_DASHBOARD_TTL:
                return cached_res

        cached = await self.cache.get(cache_key)
        if cached is not None and isinstance(cached, dict):
            try:
                res = CitizenDashboardResponse.model_validate(cached)
                _L1_DASHBOARD_CACHE[cache_key] = (now, res)
                return res
            except Exception:
                pass

        total = await self.fir_repo.count_for_citizen(citizen.id)
        drafts = await self.fir_repo.count_for_citizen(citizen.id, FIRStatus.DRAFT)
        submitted = await self.fir_repo.count_for_citizen(citizen.id, FIRStatus.SUBMITTED)
        under_review = await self.fir_repo.count_for_citizen(citizen.id, FIRStatus.UNDER_REVIEW)
        more_info = await self.fir_repo.count_for_citizen(citizen.id, FIRStatus.MORE_INFORMATION_REQUIRED)
        pending = drafts + submitted + under_review + more_info

        accepted = (
            await self.fir_repo.count_for_citizen(citizen.id, FIRStatus.ACCEPTED)
            + await self.fir_repo.count_for_citizen(citizen.id, FIRStatus.CONVERTED_TO_CASE)
        )
        rejected = await self.fir_repo.count_for_citizen(citizen.id, FIRStatus.REJECTED)

        recent_firs = await self.fir_repo.list_for_citizen(citizen.id, offset=0, limit=5)
        unread_notifications = await self.notification_repo.count_unread(citizen.id)

        response = CitizenDashboardResponse(
            total_firs=total,
            pending_firs=pending,
            accepted_firs=accepted,
            rejected_firs=rejected,
            recent_firs=[FIRResponse.model_validate(f) for f in recent_firs],
            unread_notifications_count=unread_notifications,
        )
        _L1_DASHBOARD_CACHE[cache_key] = (now, response)
        await self.cache.set(cache_key, response.model_dump(mode="json"), ttl=self.cache.ttl.DASHBOARD)
        return response

    async def get_police_dashboard(self, police: User) -> PoliceDashboardResponse:
        """Calculate operational metrics for Law Enforcement Officer view with caching."""
        global _L1_DASHBOARD_CACHE
        now = time.time()
        cache_key = self.cache.keys.dashboard("police", police.id)

        # 1. L1 in-memory cache check (<0.1ms)
        if cache_key in _L1_DASHBOARD_CACHE:
            entry_time, cached_res = _L1_DASHBOARD_CACHE[cache_key]
            if now - entry_time < L1_DASHBOARD_TTL:
                return cached_res

        # 2. Valkey L2 cache check
        cached = await self.cache.get(cache_key)
        if cached is not None and isinstance(cached, dict):
            try:
                res = PoliceDashboardResponse.model_validate(cached)
                _L1_DASHBOARD_CACHE[cache_key] = (now, res)
                return res
            except Exception:
                pass

        # 3. Consolidated single-query metrics aggregation across cases table
        open_cases, high_priority, assigned = await self.case_repo.get_police_summary_metrics(police.id)
        pending_firs = await self.fir_repo.count_for_police_queue()

        recent_cases = await self.case_repo.list_for_investigator(police.id, offset=0, limit=5)
        if not recent_cases:
            recent_cases = await self.case_repo.list_cases(offset=0, limit=5)
        recent_firs = await self.fir_repo.list_for_police_queue(offset=0, limit=5)

        response = PoliceDashboardResponse(
            assigned_cases=assigned,
            open_cases=open_cases,
            pending_fir_reviews=pending_firs,
            high_priority_cases=high_priority,
            recent_cases=[CaseResponse.model_validate(c) for c in recent_cases],
            recent_firs_to_review=[FIRResponse.model_validate(f) for f in recent_firs],
        )
        _L1_DASHBOARD_CACHE[cache_key] = (now, response)
        await self.cache.set(cache_key, response.model_dump(mode="json"), ttl=self.cache.ttl.DASHBOARD)
        return response

    async def get_admin_dashboard(self) -> AdminDashboardResponse:
        """Calculate system-wide metrics and audit history for Administrator view with caching."""
        global _L1_DASHBOARD_CACHE
        now = time.time()
        cache_key = self.cache.keys.dashboard("admin", "system")

        if cache_key in _L1_DASHBOARD_CACHE:
            entry_time, cached_res = _L1_DASHBOARD_CACHE[cache_key]
            if now - entry_time < L1_DASHBOARD_TTL:
                return cached_res

        cached = await self.cache.get(cache_key)
        if cached is not None and isinstance(cached, dict):
            try:
                res = AdminDashboardResponse.model_validate(cached)
                _L1_DASHBOARD_CACHE[cache_key] = (now, res)
                return res
            except Exception:
                pass

        total_users = await self.user_repo.count_users()
        total_police = await self.user_repo.count_users(role=UserRole.POLICE)
        total_citizens = await self.user_repo.count_users(role=UserRole.CITIZEN)
        total_firs = await self.fir_repo.count()
        total_cases = await self.case_repo.count()

        fir_distribution = await self.fir_repo.get_status_distribution()
        case_distribution = await self.case_repo.get_status_distribution()

        recent_logs = await self.audit_repo.list_recent(limit=10)

        response = AdminDashboardResponse(
            total_users=total_users,
            total_police_officers=total_police,
            total_citizens=total_citizens,
            total_firs=total_firs,
            total_cases=total_cases,
            fir_status_distribution=fir_distribution,
            case_status_distribution=case_distribution,
            recent_audit_logs=[
                AuditLogSummary(
                    id=log.id,
                    action=log.action,
                    resource_type=log.resource_type,
                    resource_id=log.resource_id,
                    description=log.description,
                    user_id=log.user_id,
                    created_at=log.created_at,
                )
                for log in recent_logs
            ],
        )
        await self.cache.set(cache_key, response.model_dump(mode="json"), ttl=self.cache.ttl.DASHBOARD)
        return response
