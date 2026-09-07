"""Similarity modules export."""

from app.ai_ml.similarity.case_similarity import CaseSimilarityEngine, case_similarity_engine
from app.ai_ml.similarity.embedding_service import EmbeddingService, embedding_service
from app.ai_ml.similarity.person_similarity import PersonSimilarityEngine, person_similarity_engine
from app.ai_ml.similarity.semantic_similarity import (
    SemanticSimilarityEngine,
    semantic_similarity_engine,
)

__all__ = [
    "EmbeddingService",
    "embedding_service",
    "SemanticSimilarityEngine",
    "semantic_similarity_engine",
    "PersonSimilarityEngine",
    "person_similarity_engine",
    "CaseSimilarityEngine",
    "case_similarity_engine",
]
