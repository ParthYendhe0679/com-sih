"""User and profile request/response schemas."""

import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from app.core.constants import UserRole


class UserResponse(BaseModel):
    """User account response representation."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    username: str
    full_name: str
    phone_number: Optional[str] = None
    role: UserRole
    is_active: bool
    is_verified: bool
    badge_number: Optional[str] = None
    department: Optional[str] = None
    rank: Optional[str] = None
    last_login: Optional[datetime] = None
    created_at: datetime


class UserUpdate(BaseModel):
    """Payload for updating user profile details."""
    full_name: Optional[str] = Field(None, min_length=2, max_length=150)
    phone_number: Optional[str] = Field(None, min_length=7, max_length=20)
    department: Optional[str] = None
    rank: Optional[str] = None


class UserStatusUpdate(BaseModel):
    """Payload for activating or deactivating a user."""
    is_active: bool


class PoliceAccountCreate(BaseModel):
    """Payload for Admin creation of a law enforcement police account."""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    full_name: str = Field(..., min_length=2, max_length=150)
    password: str = Field(..., min_length=8)
    phone_number: str = Field(..., min_length=7, max_length=20)
    badge_number: str = Field(..., min_length=3, max_length=50)
    department: str = Field(..., min_length=2, max_length=100)
    rank: str = Field(..., min_length=2, max_length=100)
