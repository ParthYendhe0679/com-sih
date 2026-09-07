"""Mathematical, statistical, and vector metrics for AI/ML evaluation."""

import math
import re
from typing import List, Sequence, Union
import numpy as np


def cosine_similarity(v1: Sequence[float], v2: Sequence[float]) -> float:
    """Compute cosine similarity between two numeric vectors in [-1, 1], clamped to [0, 1]."""
    a = np.array(v1, dtype=float)
    b = np.array(v2, dtype=float)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    dot = np.dot(a, b)
    cos = dot / (norm_a * norm_b)
    return float(max(0.0, min(1.0, cos)))


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two GPS coordinates in kilometers."""
    r = 6371.0  # Earth radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def normalize_confidence(score: float) -> str:
    """Classify a numeric confidence score [0, 1] into standardized investigative tier."""
    if score >= 0.86:
        return "VERY_HIGH"
    elif score >= 0.71:
        return "HIGH"
    elif score >= 0.41:
        return "MEDIUM"
    return "LOW"


def normalize_text_token(text: str) -> str:
    """Normalize string by lowercasing, stripping punctuation, and collapsing whitespace."""
    if not text:
        return ""
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    return " ".join(cleaned.split())


def normalize_phone_number(raw: str) -> str:
    """Normalize phone numbers to standard 10-digit format, stripping prefixes."""
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) > 10:
        return digits[-10:]
    return digits


def normalize_vehicle_plate(raw: str) -> str:
    """Normalize Indian vehicle registration number (e.g., 'MH 02 AB 1234' -> 'MH02AB1234')."""
    return re.sub(r"[^A-Z0-9]", "", (raw or "").upper())
