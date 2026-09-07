"""Authentication and token request/response schemas."""

import uuid
from pydantic import BaseModel, EmailStr, Field
from app.core.constants import UserRole


class RegisterRequest(BaseModel):
    """Citizen self-registration payload."""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    full_name: str = Field(..., min_length=2, max_length=150)
    password: str = Field(..., min_length=8, description="Minimum 8 characters with upper, lower, and digit")
    phone_number: str = Field(..., min_length=7, max_length=20)


class LoginRequest(BaseModel):
    """User credential login payload."""
    username_or_email: str = Field(..., description="Username or registered email address")
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    """JWT token pair response with user context."""
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int
    user_id: uuid.UUID
    email: str
    username: str
    role: UserRole


class RefreshTokenRequest(BaseModel):
    """Token refresh request."""
    refresh_token: str
