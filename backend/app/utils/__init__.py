"""Utility modules for KRITAGAS backend."""

from app.utils.helpers import calculate_sha256, generate_case_number, generate_fir_number
from app.utils.pagination import PaginatedResult, PaginationParams
from app.utils.response import error_response_dict, json_error_response, success_response
from app.utils.validators import (
    CASE_STATE_TRANSITIONS,
    FIR_STATE_TRANSITIONS,
    validate_case_transition,
    validate_fir_transition,
    validate_password_strength,
)

__all__ = [
    "success_response",
    "error_response_dict",
    "json_error_response",
    "PaginationParams",
    "PaginatedResult",
    "generate_fir_number",
    "generate_case_number",
    "calculate_sha256",
    "FIR_STATE_TRANSITIONS",
    "CASE_STATE_TRANSITIONS",
    "validate_fir_transition",
    "validate_case_transition",
    "validate_password_strength",
]
