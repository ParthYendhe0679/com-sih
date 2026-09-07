"""AI/ML engine configuration constants, confidence bands, and algorithm hyperparameters."""

from typing import Dict
from pydantic import BaseModel, Field


class AIMLSettings(BaseModel):
    """Configuration parameters and scoring weights for the KRITAGAS AI/ML engine."""

    # Confidence Thresholds
    CONFIDENCE_LOW_MAX: float = 0.40
    CONFIDENCE_MEDIUM_MAX: float = 0.70
    CONFIDENCE_HIGH_MAX: float = 0.85
    ENTITY_MATCH_CONFIRM_THRESHOLD: float = 0.85
    ENTITY_MATCH_CANDIDATE_THRESHOLD: float = 0.65

    # Case Similarity Weights (must sum to 1.0)
    WEIGHT_SEMANTIC: float = 0.35
    WEIGHT_MODUS_OPERANDI: float = 0.25
    WEIGHT_ENTITY_OVERLAP: float = 0.15
    WEIGHT_LOCATION: float = 0.15
    WEIGHT_TEMPORAL: float = 0.10

    # Entity Resolution Weights (must sum to 1.0)
    WEIGHT_NAME_SIMILARITY: float = 0.40
    WEIGHT_PHONE_MATCH: float = 0.30
    WEIGHT_ADDRESS_SIMILARITY: float = 0.15
    WEIGHT_CONTEXT_SIMILARITY: float = 0.15

    # Anomaly Detection Settings
    ANOMALY_ZSCORE_THRESHOLD: float = 2.5
    ANOMALY_IQR_MULTIPLIER: float = 1.5
    ISOLATION_FOREST_CONTAMINATION: float = 0.05

    # Graph Intelligence
    GRAPH_MAX_COMMUNITIES: int = 10
    HIGH_CENTRALITY_PERCENTILE: float = 0.80

    # Model Defaults
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"
    LOCAL_FALLBACK_DIMENSION: int = 384


aiml_settings = AIMLSettings()
