"""Authentication domain service handling user registration, authentication, and token lifecycle."""

from datetime import datetime, timezone
from typing import Optional
import uuid
from app.core.config import settings
from app.core.constants import AuditAction, UserRole
from app.core.exceptions import AuthenticationException, ConflictException
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_jwt_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services.audit_service import AuditService
from app.utils.validators import validate_password_strength


class AuthService:
    """Service encapsulating authentication logic and token issuance."""

    def __init__(self, user_repo: UserRepository, audit_service: AuditService):
        self.user_repo = user_repo
        self.audit_service = audit_service

    async def register(self, req: RegisterRequest, client_ip: Optional[str] = None) -> TokenResponse:
        """Register a new Citizen user, record audit event, and issue authentication tokens."""
        # Check uniqueness
        if await self.user_repo.get_by_email(req.email):
            raise ConflictException(f"An account with email '{req.email}' already exists.")
        if await self.user_repo.get_by_username(req.username):
            raise ConflictException(f"Username '{req.username}' is already taken.")

        validate_password_strength(req.password)
        pw_hash = hash_password(req.password)

        new_user = User(
            email=req.email.lower().strip(),
            username=req.username.strip(),
            full_name=req.full_name.strip(),
            phone_number=req.phone_number.strip(),
            password_hash=pw_hash,
            role=UserRole.CITIZEN,
            is_active=True,
            is_verified=True,
            last_login=datetime.now(timezone.utc),
        )

        user = await self.user_repo.create(new_user)

        # Audit registration
        await self.audit_service.log_action(
            action=AuditAction.USER_REGISTER.value,
            resource_type="user",
            resource_id=str(user.id),
            description=f"Citizen account registered with email '{user.email}'",
            user_id=user.id,
            ip_address=client_ip,
        )

        return self._generate_token_response(user)

    async def login(self, req: LoginRequest, client_ip: Optional[str] = None) -> TokenResponse:
        """Authenticate user credentials, update last login, log audit trail, and issue tokens."""
        user = await self.user_repo.get_by_username_or_email(req.username_or_email)
        if not user:
            raise AuthenticationException("Invalid username or password.")

        if not user.is_active:
            raise AuthenticationException("Your account has been deactivated. Please contact support.")

        if not verify_password(req.password, user.password_hash):
            raise AuthenticationException("Invalid username or password.")

        # Update last login timestamp
        user.last_login = datetime.now(timezone.utc)
        await self.user_repo.update(user)

        # Audit login
        await self.audit_service.log_action(
            action=AuditAction.USER_LOGIN.value,
            resource_type="user",
            resource_id=str(user.id),
            description=f"User '{user.username}' successfully logged in",
            user_id=user.id,
            ip_address=client_ip,
        )

        return self._generate_token_response(user)

    async def refresh_tokens(self, refresh_token: str) -> TokenResponse:
        """Validate a refresh token and issue a fresh access/refresh token pair."""
        payload = decode_jwt_token(refresh_token)
        if payload.get("type") != "refresh":
            raise AuthenticationException("Invalid token type. Refresh token required.")

        user_id_str = payload.get("sub")
        if not user_id_str:
            raise AuthenticationException("Token missing subject identifier.")

        try:
            user_id = uuid.UUID(user_id_str)
        except ValueError:
            raise AuthenticationException("Invalid subject identifier in token.")

        user = await self.user_repo.get_by_id(user_id)
        if not user or not user.is_active:
            raise AuthenticationException("User not found or inactive.")

        return self._generate_token_response(user)

    def _generate_token_response(self, user: User) -> TokenResponse:
        """Helper to generate JWT tokens and serialize TokenResponse."""
        access_token = create_access_token(
            subject=user.id,
            role=user.role.value,
            email=user.email,
        )
        refresh_token = create_refresh_token(subject=user.id)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="Bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user_id=user.id,
            email=user.email,
            username=user.username,
            role=user.role,
        )
