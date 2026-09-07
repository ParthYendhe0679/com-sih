"""Custom domain exceptions for centralized error handling in KRITAGAS."""

from typing import Any, Dict, Optional


class BaseAppException(Exception):
    """Base application exception."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_code: str = "INTERNAL_SERVER_ERROR",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}


class ResourceNotFoundException(BaseAppException):
    """Raised when an entity is not found in the system."""

    def __init__(
        self,
        resource: str,
        identifier: Optional[Any] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        msg = f"{resource} with identifier '{identifier}' was not found." if identifier else f"{resource} was not found."
        super().__init__(
            message=msg,
            status_code=404,
            error_code="RESOURCE_NOT_FOUND",
            details=details or {"resource": resource, "identifier": str(identifier) if identifier else None},
        )


class NotFoundException(ResourceNotFoundException):
    """Alias for ResourceNotFoundException supporting single-argument messages."""

    def __init__(self, message: str = "Requested resource not found.", details: Optional[Dict[str, Any]] = None):
        super().__init__(resource=message, identifier=None, details=details)


class PermissionDeniedException(BaseAppException):
    """Raised when a user attempts an action forbidden by their role or ownership."""

    def __init__(
        self,
        message: str = "You do not have permission to perform this action.",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=403,
            error_code="PERMISSION_DENIED",
            details=details,
        )


class AuthenticationException(BaseAppException):
    """Raised when authentication credentials or token validation fails."""

    def __init__(
        self,
        message: str = "Could not validate credentials.",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=401,
            error_code="AUTHENTICATION_FAILED",
            details=details,
        )


class InvalidStateTransitionException(BaseAppException):
    """Raised when an entity status transition violates business workflow rules."""

    def __init__(
        self,
        entity_name: str,
        current_state: str,
        target_state: str,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=f"Invalid {entity_name} state transition from '{current_state}' to '{target_state}'.",
            status_code=400,
            error_code="INVALID_STATE_TRANSITION",
            details=details or {
                "entity": entity_name,
                "current_state": current_state,
                "target_state": target_state,
            },
        )


class ConflictException(BaseAppException):
    """Raised when a unique constraint or conflicting duplicate data is encountered."""

    def __init__(
        self,
        message: str = "Resource already exists or conflicting state detected.",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=409,
            error_code="CONFLICT",
            details=details,
        )


class BadRequestException(BaseAppException):
    """Raised when a request is malformed or violates business validation rules."""

    def __init__(
        self,
        message: str = "Bad request.",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=400,
            error_code="BAD_REQUEST",
            details=details,
        )


class ValidationException(BaseAppException):
    """Raised when custom data validation fails."""

    def __init__(
        self,
        message: str = "Data validation error.",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=422,
            error_code="VALIDATION_ERROR",
            details=details,
        )


class DatabaseUnavailableException(BaseAppException):
    """Raised when database connection, pooling, or service is unreachable."""

    def __init__(
        self,
        message: str = "Database service is temporarily unavailable. Please retry shortly.",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=503,
            error_code="DATABASE_UNAVAILABLE",
            details=details,
        )


class DataIntegrityException(BaseAppException):
    """Raised when an operation violates database referential integrity or constraints."""

    def __init__(
        self,
        message: str = "A database integrity constraint violation occurred.",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(
            message=message,
            status_code=409,
            error_code="DATA_INTEGRITY_VIOLATION",
            details=details,
        )

