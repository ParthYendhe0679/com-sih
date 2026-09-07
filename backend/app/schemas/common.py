"""Common reusable Pydantic schemas for API responses and requests."""

from typing import Any, Dict, Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class ErrorDetail(BaseModel):
    """Structured error information."""
    code: str = Field(..., description="Machine-readable error classification code")
    details: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Contextual error metadata")


class APIResponse(BaseModel, Generic[T]):
    """Standardized top-level API response envelope."""
    success: bool = Field(..., description="Boolean status flag indicating overall success")
    message: str = Field(..., description="Human-readable status summary")
    data: Optional[T] = Field(default=None, description="Response payload data")
    error: Optional[ErrorDetail] = Field(default=None, description="Error information if success is false")


class PaginationParams(BaseModel):
    """Query parameters for pagination."""
    page: int = Field(default=1, ge=1, description="Page index (1-based)")
    size: int = Field(default=20, ge=1, le=100, description="Items per page (max 100)")


class PaginatedResponse(BaseModel, Generic[T]):
    """Standardized paginated list payload."""
    items: List[T]
    page: int
    size: int
    total: int
    total_pages: int
