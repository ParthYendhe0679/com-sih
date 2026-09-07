"""Structured logging configuration for KRITAGAS backend."""

import logging
import sys
from typing import Any, Dict

SENSITIVE_KEYS = {"password", "secret", "token", "access_token", "refresh_token", "authorization"}


class SensitiveDataFilter(logging.Filter):
    """Filter that masks sensitive fields from log record parameters."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.args, dict):
            record.args = self._sanitize_dict(record.args)
        elif isinstance(record.args, tuple):
            record.args = tuple(
                self._sanitize_dict(item) if isinstance(item, dict) else item
                for item in record.args
            )
        return True

    def _sanitize_dict(self, d: Dict[str, Any]) -> Dict[str, Any]:
        sanitized = {}
        for k, v in d.items():
            if any(sens in k.lower() for sens in SENSITIVE_KEYS):
                sanitized[k] = "******"
            elif isinstance(v, dict):
                sanitized[k] = self._sanitize_dict(v)
            else:
                sanitized[k] = v
        return sanitized


def setup_logging(debug: bool = False) -> None:
    """Initialize system-wide logging with structured output."""
    log_level = logging.DEBUG if debug else logging.INFO

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-7s | [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.addFilter(SensitiveDataFilter())

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers.clear()
    root_logger.addHandler(console_handler)

    # Silence overly verbose external libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a configured logger with the given namespace."""
    return logging.getLogger(name)
