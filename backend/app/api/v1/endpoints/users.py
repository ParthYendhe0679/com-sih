"""User profile and directory endpoints."""

import uuid
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user, get_user_service, require_roles
from app.core.constants import UserRole
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.user import UserResponse, UserUpdate
from app.services.user_service import UserService
from app.utils.response import success_response

router = APIRouter()


@router.get(
    "/me",
    response_model=APIResponse[UserResponse],
    summary="Get Authenticated User Profile",
)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    return success_response(
        data=UserResponse.model_validate(current_user),
        message="Profile retrieved successfully.",
    )


@router.patch(
    "/me",
    response_model=APIResponse[UserResponse],
    summary="Update Authenticated User Profile",
)
async def update_my_profile(
    body: UserUpdate,
    current_user: User = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
):
    updated = await user_service.update_profile(
        user_id=current_user.id,
        update_data=body,
        current_user=current_user,
    )
    return success_response(
        data=UserResponse.model_validate(updated),
        message="Profile updated successfully.",
    )


@router.get(
    "/{user_id}",
    response_model=APIResponse[UserResponse],
    summary="Get User By ID",
    description="Retrieve user profile by UUID (restricted to Police and Admin users).",
)
async def get_user_by_id(
    user_id: uuid.UUID,
    user_service: UserService = Depends(get_user_service),
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
):
    user = await user_service.get_user_by_id(user_id)
    return success_response(
        data=UserResponse.model_validate(user),
        message="User retrieved successfully.",
    )
