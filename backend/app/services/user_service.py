"""User management and profile domain service."""

from typing import Optional, Sequence
import uuid
from app.core.constants import AuditAction, UserRole
from app.core.exceptions import (
    ConflictException,
    PermissionDeniedException,
    ResourceNotFoundException,
)
from app.core.security import hash_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import PoliceAccountCreate, UserUpdate
from app.services.audit_service import AuditService
from app.utils.validators import validate_password_strength


class UserService:
    """Service handling profile updates and administrative user lifecycle management."""

    def __init__(self, user_repo: UserRepository, audit_service: AuditService):
        self.user_repo = user_repo
        self.audit_service = audit_service

    async def get_user_by_id(self, user_id: uuid.UUID) -> User:
        """Fetch user by ID or raise ResourceNotFoundException."""
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise ResourceNotFoundException("User", user_id)
        return user

    async def update_profile(
        self,
        user_id: uuid.UUID,
        update_data: UserUpdate,
        current_user: User,
    ) -> User:
        """Update user profile fields."""
        # Non-admins can only update their own profile
        if current_user.role != UserRole.ADMIN and current_user.id != user_id:
            raise PermissionDeniedException("You are not authorized to update this profile.")

        user = await self.get_user_by_id(user_id)

        if update_data.full_name is not None:
            user.full_name = update_data.full_name.strip()
        if update_data.phone_number is not None:
            user.phone_number = update_data.phone_number.strip()
        if update_data.department is not None and current_user.role in (UserRole.ADMIN, UserRole.POLICE):
            user.department = update_data.department.strip()
        if update_data.rank is not None and current_user.role == UserRole.ADMIN:
            user.rank = update_data.rank.strip()

        return await self.user_repo.update(user)

    async def create_police_account(
        self,
        req: PoliceAccountCreate,
        admin_user: User,
        client_ip: Optional[str] = None,
    ) -> User:
        """Admin endpoint to provision a police investigator account."""
        if await self.user_repo.get_by_email(req.email):
            raise ConflictException(f"An account with email '{req.email}' already exists.")
        if await self.user_repo.get_by_username(req.username):
            raise ConflictException(f"Username '{req.username}' is already taken.")
        if await self.user_repo.get_by_badge(req.badge_number):
            raise ConflictException(f"Badge number '{req.badge_number}' is already registered.")

        validate_password_strength(req.password)
        pw_hash = hash_password(req.password)

        new_police = User(
            email=req.email.lower().strip(),
            username=req.username.strip(),
            full_name=req.full_name.strip(),
            phone_number=req.phone_number.strip(),
            password_hash=pw_hash,
            role=UserRole.POLICE,
            is_active=True,
            is_verified=True,
            badge_number=req.badge_number.strip(),
            department=req.department.strip(),
            rank=req.rank.strip(),
        )

        user = await self.user_repo.create(new_police)

        await self.audit_service.log_action(
            action=AuditAction.POLICE_ACCOUNT_CREATED.value,
            resource_type="user",
            resource_id=str(user.id),
            description=f"Admin '{admin_user.username}' provisioned police officer '{user.username}' (Badge: {user.badge_number})",
            user_id=admin_user.id,
            ip_address=client_ip,
        )

        return user

    async def set_user_status(
        self,
        user_id: uuid.UUID,
        is_active: bool,
        admin_user: User,
        client_ip: Optional[str] = None,
    ) -> User:
        """Activate or deactivate a user account with mandatory audit logging."""
        user = await self.get_user_by_id(user_id)
        old_status = user.is_active
        user.is_active = is_active
        updated = await self.user_repo.update(user)

        action_desc = "activated" if is_active else "deactivated"
        await self.audit_service.log_action(
            action=AuditAction.USER_STATUS_UPDATED.value,
            resource_type="user",
            resource_id=str(user.id),
            description=f"Admin '{admin_user.username}' {action_desc} user '{user.username}'",
            user_id=admin_user.id,
            old_value={"is_active": old_status},
            new_value={"is_active": is_active},
            ip_address=client_ip,
        )

        return updated

    async def list_users(
        self,
        role: Optional[UserRole] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        size: int = 20,
    ) -> Sequence[User]:
        """Fetch paginated list of users."""
        offset = (page - 1) * size
        return await self.user_repo.list_users(
            role=role,
            is_active=is_active,
            offset=offset,
            limit=size,
        )

    async def count_users(
        self,
        role: Optional[UserRole] = None,
        is_active: Optional[bool] = None,
    ) -> int:
        """Count total users matching criteria."""
        return await self.user_repo.count_users(role=role, is_active=is_active)
