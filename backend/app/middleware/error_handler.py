"""Centralized exception handlers for FastAPI application."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.exceptions import BaseAppException
from app.core.logging import get_logger
from app.utils.response import json_error_response

logger = get_logger("kritagas.exceptions")


def register_exception_handlers(app: FastAPI) -> None:
    """Register custom and framework exception handlers onto the FastAPI application."""

    @app.exception_handler(BaseAppException)
    async def app_exception_handler(request: Request, exc: BaseAppException):
        logger.warning(
            f"AppException [{exc.error_code}] on {request.method} {request.url.path}: {exc.message}"
        )
        return json_error_response(
            message=exc.message,
            error_code=exc.error_code,
            details=exc.details,
            status_code=exc.status_code,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.info(
            f"ValidationError on {request.method} {request.url.path}: {exc.errors()}"
        )
        # Format errors into clean list
        formatted_errors = [
            {
                "field": " -> ".join(str(loc) for loc in err.get("loc", [])),
                "message": err.get("msg", ""),
                "type": err.get("type", ""),
            }
            for err in exc.errors()
        ]
        return json_error_response(
            message="Request validation failed. Please inspect input parameters.",
            error_code="VALIDATION_ERROR",
            details={"errors": formatted_errors},
            status_code=422,
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        logger.info(f"HTTPException {exc.status_code} on {request.method} {request.url.path}: {exc.detail}")
        error_code = "HTTP_ERROR"
        if exc.status_code == 404:
            error_code = "ROUTE_NOT_FOUND"
        elif exc.status_code == 401:
            error_code = "UNAUTHORIZED"
        elif exc.status_code == 403:
            error_code = "FORBIDDEN"
        elif exc.status_code == 405:
            error_code = "METHOD_NOT_ALLOWED"

        return json_error_response(
            message=str(exc.detail),
            error_code=error_code,
            status_code=exc.status_code,
        )

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
        logger.error(
            f"Database exception on {request.method} {request.url.path}: {type(exc).__name__} - {exc}",
            exc_info=True,
        )

        # Integrity violations (duplicate keys, unique constraints, foreign keys)
        if isinstance(exc, IntegrityError):
            orig_msg = str(getattr(exc, "orig", exc)).lower()
            if "unique" in orig_msg or "duplicate key" in orig_msg:
                return json_error_response(
                    message="A conflicting or duplicate record already exists in the system.",
                    error_code="CONFLICT",
                    status_code=409,
                )
            if "foreign key" in orig_msg or "violates foreign key" in orig_msg:
                return json_error_response(
                    message="Referenced parent or dependent record does not exist or cannot be modified.",
                    error_code="FOREIGN_KEY_VIOLATION",
                    status_code=400,
                )
            if "check constraint" in orig_msg or "violates check constraint" in orig_msg:
                return json_error_response(
                    message="Record failed database check constraints.",
                    error_code="CHECK_CONSTRAINT_VIOLATION",
                    status_code=400,
                )
            return json_error_response(
                message="Operation violated database integrity rules.",
                error_code="DATA_INTEGRITY_ERROR",
                status_code=409,
            )

        # Connectivity / operational failures
        if isinstance(exc, OperationalError):
            return json_error_response(
                message="Database service is temporarily unavailable. Please retry shortly.",
                error_code="DATABASE_UNAVAILABLE",
                status_code=503,
            )

        return json_error_response(
            message="A database persistence error occurred. Please try again later.",
            error_code="DATABASE_ERROR",
            status_code=500,
        )


    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
        return json_error_response(
            message="An unexpected internal server error occurred.",
            error_code="INTERNAL_SERVER_ERROR",
            status_code=500,
        )
