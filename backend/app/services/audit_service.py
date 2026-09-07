"""Audit logging domain service."""

from typing import Any, Dict, Optional, Sequence
import uuid
from app.models.audit_log import AuditLog
from app.repositories.audit_repository import AuditRepository


class AuditService:
    """Domain service managing the creation and inspection of system audit records."""

    def __init__(self, audit_repo: AuditRepository):
        self.audit_repo = audit_repo

    async def log_action(
        self,
        action: str,
        resource_type: str,
        resource_id: Optional[str],
        description: str,
        user_id: Optional[uuid.UUID] = None,
        old_value: Optional[Dict[str, Any]] = None,
        new_value: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        """Record an event in the audit trail."""
        return await self.audit_repo.log_action(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            description=description,
            user_id=user_id,
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
        )

    async def get_recent_logs(self, limit: int = 50) -> Sequence[AuditLog]:
        """Fetch latest audit log entries."""
        return await self.audit_repo.list_recent(limit=limit)

    async def get_resource_logs(self, resource_type: str, resource_id: str) -> Sequence[AuditLog]:
        """Fetch history for a specific resource."""
        return await self.audit_repo.list_by_resource(resource_type=resource_type, resource_id=resource_id)
