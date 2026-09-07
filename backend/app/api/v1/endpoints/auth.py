"""Authentication endpoints for registration, login, token refresh, and identity inspection."""

from fastapi import APIRouter, Depends, Request, status
from app.api.deps import get_auth_service, get_client_ip, get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshTokenRequest, RegisterRequest, TokenResponse
from app.schemas.common import APIResponse
from app.schemas.user import UserResponse
from app.services.auth_service import AuthService
from app.utils.response import success_response

router = APIRouter()


@router.post(
    "/register",
    response_model=APIResponse[TokenResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Citizen Registration",
    description="Registers a new public Citizen account and generates initial JWT access & refresh tokens.",
)
async def register(
    request: Request,
    body: RegisterRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    client_ip = get_client_ip(request)
    tokens = await auth_service.register(body, client_ip=client_ip)
    return success_response(
        data=tokens,
        message="Registration successful. Welcome to KRITAGAS.",
        status_code=status.HTTP_201_CREATED,
    )


@router.post(
    "/login",
    response_model=APIResponse[TokenResponse],
    summary="User Login",
    description="Authenticates credentials for Citizens, Police Officers, and Administrators.",
)
async def login(
    request: Request,
    body: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    client_ip = get_client_ip(request)
    tokens = await auth_service.login(body, client_ip=client_ip)
    return success_response(
        data=tokens,
        message="Login successful.",
    )


@router.post(
    "/refresh",
    response_model=APIResponse[TokenResponse],
    summary="Refresh Access Token",
    description="Exchange a valid long-lived refresh token for a fresh access & refresh token pair.",
)
async def refresh_token(
    body: RefreshTokenRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    tokens = await auth_service.refresh_tokens(body.refresh_token)
    return success_response(
        data=tokens,
        message="Token refreshed successfully.",
    )


@router.post(
    "/logout",
    response_model=APIResponse[None],
    summary="User Logout",
    description="Logs out the current user session.",
)
async def logout(current_user: User = Depends(get_current_user)):
    return success_response(
        data=None,
        message="Logout successful.",
    )


@router.get(
    "/me",
    response_model=APIResponse[UserResponse],
    summary="Get Current User Profile",
    description="Inspect authenticated user identity and role attributes.",
)
async def get_me(current_user: User = Depends(get_current_user)):
    user_res = UserResponse.model_validate(current_user)
    return success_response(
        data=user_res,
        message="Profile retrieved successfully.",
    )
