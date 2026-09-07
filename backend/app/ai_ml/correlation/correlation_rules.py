"""Cross-source correlation heuristic rules and path discovery."""

from typing import Any, Dict, List, Optional, Set, Tuple


class CorrelationRule:
    """Represents a validated investigative relationship inference rule."""

    def __init__(
        self,
        rule_name: str,
        source_type: str,
        relation: str,
        target_type: str,
        base_confidence: float,
        description_template: str,
    ):
        self.rule_name = rule_name
        self.source_type = source_type
        self.relation = relation
        self.target_type = target_type
        self.base_confidence = base_confidence
        self.description_template = description_template


CORRELATION_RULES = [
    CorrelationRule(
        "FIR_NAMED_SUSPECT",
        "FIR",
        "NAMES_SUSPECT",
        "PERSON",
        0.95,
        "FIR document explicitly identifies {source} as prime suspect.",
    ),
    CorrelationRule(
        "TELECOM_CALL_RECORD",
        "PERSON",
        "CALLED",
        "PERSON",
        0.90,
        "CDR log establishes voice communication between {source} and {target}.",
    ),
    CorrelationRule(
        "FINANCIAL_TRANSFER",
        "PERSON",
        "TRANSFERRED_FUNDS_TO",
        "PERSON",
        0.92,
        "Banking transaction reveals fund transfer of ₹{amount} from {source} to {target}.",
    ),
    CorrelationRule(
        "VEHICLE_OWNERSHIP",
        "PERSON",
        "OWNS_VEHICLE",
        "VEHICLE",
        0.95,
        "RTO registry confirms {source} is registered owner of {target}.",
    ),
    CorrelationRule(
        "CO_PRESENCE_INCIDENT",
        "PERSON",
        "CO_LOCATED_AT",
        "LOCATION",
        0.80,
        "Cell tower / CCTV triangulates {source} and {target} at the same scene.",
    ),
]
