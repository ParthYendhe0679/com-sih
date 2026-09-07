"""Entity Resolution module export."""

from app.ai_ml.entity_resolution.candidate_generator import CandidateGenerator
from app.ai_ml.entity_resolution.confidence import EntityMatchConfidenceScorer
from app.ai_ml.entity_resolution.resolver import EntityResolver, entity_resolver
from app.ai_ml.entity_resolution.similarity import (
    compute_address_similarity,
    compute_name_similarity,
    compute_phone_similarity,
    compute_token_sort_ratio,
    compute_vehicle_similarity,
)

__all__ = [
    "EntityResolver",
    "entity_resolver",
    "CandidateGenerator",
    "EntityMatchConfidenceScorer",
    "compute_name_similarity",
    "compute_phone_similarity",
    "compute_address_similarity",
    "compute_vehicle_similarity",
    "compute_token_sort_ratio",
]
