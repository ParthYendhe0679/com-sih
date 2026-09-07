"""Request logging middleware for telemetry and audit timing."""

import time
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.logging import get_logger

logger = get_logger("kritagas.requests")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Logs incoming HTTP request metrics, processing duration, and response statuses."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.perf_counter()
        client_ip = request.client.host if request.client else "unknown"
        method = request.method
        path = request.url.path

        try:
            response = await call_next(request)
            process_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
            status_code = response.status_code

            log_msg = f"{client_ip} - \"{method} {path}\" {status_code} ({process_time_ms}ms)"
            if status_code >= 500:
                logger.error(log_msg)
            elif status_code >= 400:
                logger.warning(log_msg)
            else:
                logger.info(log_msg)

            response.headers["X-Process-Time"] = f"{process_time_ms}ms"
            return response
        except Exception as exc:
            process_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(f"{client_ip} - \"{method} {path}\" UNHANDLED EXCEPTION ({process_time_ms}ms): {exc}")
            raise
