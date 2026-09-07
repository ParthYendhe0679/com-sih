"""Standardized API response formatting helpers."""

from typing import Any, Dict, Optional
from fastapi.responses import JSONResponse


def success_response(
    data: Any = None,
    message: str = "Operation completed successfully.",
    status_code: int = 200,
) -> Dict[str, Any]:
    """Generate a standard success response dictionary matching APIResponse schema."""
    return {
        "success": True,
        "message": message,
        "data": data,
        "error": None,
    }


def error_response_dict(
    message: str,
    error_code: str = "BAD_REQUEST",
    details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Generate a standard error response dictionary."""
    return {
        "success": False,
        "message": message,
        "data": None,
        "error": {
            "code": error_code,
            "details": details or {},
        },
    }


def json_error_response(
    message: str,
    error_code: str = "BAD_REQUEST",
    details: Optional[Dict[str, Any]] = None,
    status_code: int = 400,
) -> JSONResponse:
    """Generate a FastAPI JSONResponse for an error."""
    return JSONResponse(
        status_code=status_code,
        content=error_response_dict(
            message=message,
            error_code=error_code,
            details=details,
        ),
    )
