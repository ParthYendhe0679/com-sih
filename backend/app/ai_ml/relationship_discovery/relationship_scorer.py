"""Confidence scorer for discovered relationships based on evidentiary proof."""

from typing import List


def compute_relationship_confidence(
    evidence_types: List[str],
    is_direct_observation: bool = True,
) -> float:
    """Calculate relationship confidence score bounded in [0.40, 0.98]."""
    score = 0.50
    if is_direct_observation:
        score += 0.20

    weights = {
        "OFFICIAL_DOCUMENT": 0.20,
        "BIOMETRIC_CCTV": 0.20,
        "BANKING_TRANSACTION": 0.20,
        "TELECOM_CDR": 0.15,
        "WITNESS_STATEMENT": 0.10,
        "HEURISTIC_CO_OCCURRENCE": 0.05,
    }
    for ev in evidence_types:
        score += weights.get(ev.upper(), 0.05)

    return round(float(min(0.98, max(0.40, score))), 4)
