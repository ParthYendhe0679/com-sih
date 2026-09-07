"""Pagination helpers and calculations."""

import math
from typing import Any, Generic, List, Sequence, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    """Pagination query parameter defaults and bounds."""
    page: int = Field(default=1, ge=1, description="Page number starting from 1")
    size: int = Field(default=20, ge=1, le=100, description="Items per page (max 100)")

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size


class PaginatedResult(BaseModel, Generic[T]):
    """Generic paginated envelope model."""
    items: List[T]
    page: int
    size: int
    total: int
    total_pages: int

    @classmethod
    def create(cls, items: Sequence[T], total: int, page: int, size: int) -> "PaginatedResult[T]":
        total_pages = math.ceil(total / size) if size > 0 else 1
        return cls(
            items=list(items),
            page=page,
            size=size,
            total=total,
            total_pages=total_pages,
        )
