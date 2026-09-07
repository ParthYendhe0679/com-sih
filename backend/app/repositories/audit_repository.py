"""Audit log repository implementation."""

from typing import Any, Dict, Optional, Sequence
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.repositories.base_repository import BaseRepository


class AuditRepository(BaseRepository[AuditLog]):
    """Data access repository for immutable system and security audit logs."""

    def __init__(self, session: AsyncSession):
        super().__init__(AuditLog, session)

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
        """Create and persist an audit log entry."""
        log_entry = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            description=description,
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
        )
        self.session.add(log_entry)
        await self.session.flush()
        return log_entry

    async def list_recent(self, limit: int = 50) -> Sequence[AuditLog]:
        """Fetch the most recent audit records system-wide."""
        stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def list_by_resource(
        self,
        resource_type: str,
        resource_id: str,
    ) -> Sequence[AuditLog]:
        """Fetch all chronological audit logs for a specific resource (e.g. for generating Case timeline)."""
        stmt = (
            select(AuditLog)
            .where(AuditLog.resource_type == resource_type, AuditLog.resource_id == str(resource_id))
            .order_by(AuditLog.created_at.asc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def list_by_user(
        self,
        user_id: uuid.UUID,
        offset: int = 0,
        limit: int = 50,
    ) -> Sequence[AuditLog]:
        """Fetch audit records initiated by a specific user."""
        stmt = (
            select(AuditLog)
            .where(AuditLog.user_id == user_id)
            .order_by(AuditLog.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()
