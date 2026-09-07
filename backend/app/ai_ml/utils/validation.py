"""Validation routines and guards for AI outputs."""

from typing import Any, Dict, List, Optional
from app.core.exceptions import ValidationException


def validate_confidence_score(score: float) -> float:
    """Ensure confidence score is strictly bounded in [0.0, 1.0]."""
    if score < 0.0 or score > 1.0:
        raise ValidationException(f"Confidence score {score} must be between 0.0 and 1.0")
    return round(score, 4)


def sanitize_entity_value(val: str, max_len: int = 255) -> str:
    """Trim and clean raw entity string."""
    cleaned = (val or "").strip()
    if len(cleaned) > max_len:
        return cleaned[:max_len]
    return cleaned
