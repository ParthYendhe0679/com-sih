"""Notification response schemas."""

import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict
from app.core.constants import NotificationType


class NotificationResponse(BaseModel):
    """Response representation of an in-app notification."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    message: str
    type: NotificationType
    is_read: bool
    data_json: Optional[Dict[str, Any]] = None
    created_at: datetime
