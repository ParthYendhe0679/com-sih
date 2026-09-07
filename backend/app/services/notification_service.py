"""Notification domain service."""

from typing import Any, Dict, Optional, Sequence
import uuid
from app.core.constants import NotificationType
from app.models.notification import Notification
from app.repositories.notification_repository import NotificationRepository


class NotificationService:
    """Domain service managing user notifications and read confirmations."""

    def __init__(self, notification_repo: NotificationRepository):
        self.notification_repo = notification_repo

    async def send_notification(
        self,
        user_id: uuid.UUID,
        title: str,
        message: str,
        notification_type: NotificationType = NotificationType.INFO,
        data: Optional[Dict[str, Any]] = None,
    ) -> Notification:
        """Create and queue an in-app notification for a user."""
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=notification_type,
            data_json=data,
        )
        return await self.notification_repo.create(notification)

    async def get_user_notifications(
        self,
        user_id: uuid.UUID,
        page: int = 1,
        size: int = 20,
    ) -> Sequence[Notification]:
        """Fetch notifications for a user."""
        offset = (page - 1) * size
        return await self.notification_repo.get_by_user(user_id=user_id, offset=offset, limit=size)

    async def get_unread_count(self, user_id: uuid.UUID) -> int:
        """Count unread notifications for a user."""
        return await self.notification_repo.count_unread(user_id=user_id)

    async def mark_read(self, notification_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        """Mark a single notification as read."""
        return await self.notification_repo.mark_as_read(notification_id=notification_id, user_id=user_id)

    async def mark_all_read(self, user_id: uuid.UUID) -> int:
        """Mark all notifications for a user as read."""
        return await self.notification_repo.mark_all_as_read(user_id=user_id)
