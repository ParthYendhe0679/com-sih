"""In-app user notification endpoints."""

from typing import List
import uuid
from fastapi import APIRouter, Depends, Query
from app.api.deps import get_current_user, get_notification_service
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.notification import NotificationResponse
from app.services.notification_service import NotificationService
from app.utils.response import success_response

router = APIRouter()


@router.get(
    "",
    response_model=APIResponse[List[NotificationResponse]],
    summary="List My Notifications",
)
async def list_notifications(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    notification_service: NotificationService = Depends(get_notification_service),
):
    notifications = await notification_service.get_user_notifications(
        user_id=current_user.id,
        page=page,
        size=size,
    )
    return success_response(
        data=[NotificationResponse.model_validate(n) for n in notifications],
        message="Notifications retrieved.",
    )


@router.patch(
    "/{id}/read",
    response_model=APIResponse[bool],
    summary="Mark Notification as Read",
)
async def mark_notification_read(
    id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    notification_service: NotificationService = Depends(get_notification_service),
):
    result = await notification_service.mark_read(notification_id=id, user_id=current_user.id)
    return success_response(
        data=result,
        message="Notification marked as read." if result else "Notification not found or already read.",
    )


@router.post(
    "/read-all",
    response_model=APIResponse[int],
    summary="Mark All Notifications as Read",
)
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    notification_service: NotificationService = Depends(get_notification_service),
):
    count = await notification_service.mark_all_read(user_id=current_user.id)
    return success_response(
        data=count,
        message=f"{count} notifications marked as read.",
    )
