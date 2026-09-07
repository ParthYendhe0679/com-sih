"""User repository implementation."""

from typing import Optional, Sequence
import uuid
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import UserRole
from app.models.user import User
from app.repositories.base_repository import BaseRepository


class UserRepository(BaseRepository[User]):
    """Data access repository for User entities."""

    def __init__(self, session: AsyncSession):
        super().__init__(User, session)

    async def get_by_email(self, email: str) -> Optional[User]:
        """Lookup user by unique email."""
        stmt = select(User).where(func.lower(User.email) == email.lower().strip())
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_username(self, username: str) -> Optional[User]:
        """Lookup user by unique username."""
        stmt = select(User).where(func.lower(User.username) == username.lower().strip())
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_username_or_email(self, identifier: str) -> Optional[User]:
        """Lookup user by either username or email."""
        clean = identifier.lower().strip()
        stmt = select(User).where(
            (func.lower(User.username) == clean) | (func.lower(User.email) == clean)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_badge(self, badge_number: str) -> Optional[User]:
        """Lookup police officer by unique badge number."""
        stmt = select(User).where(User.badge_number == badge_number.strip())
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def list_users(
        self,
        role: Optional[UserRole] = None,
        is_active: Optional[bool] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Sequence[User]:
        """List users with optional role and status filters."""
        stmt = select(User)
        if role is not None:
            stmt = stmt.where(User.role == role)
        if is_active is not None:
            stmt = stmt.where(User.is_active == is_active)

        stmt = stmt.order_by(User.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_users(
        self,
        role: Optional[UserRole] = None,
        is_active: Optional[bool] = None,
    ) -> int:
        """Count users matching optional role and status filters."""
        stmt = select(func.count()).select_from(User)
        if role is not None:
            stmt = stmt.where(User.role == role)
        if is_active is not None:
            stmt = stmt.where(User.is_active == is_active)
        result = await self.session.execute(stmt)
        return result.scalar() or 0
