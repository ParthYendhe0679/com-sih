"""Semantic similarity evaluator for case narratives, modus operandi, and witness statements."""

from typing import List, Sequence
from app.ai_ml.similarity.embedding_service import embedding_service
from app.ai_ml.utils.metrics import cosine_similarity


class SemanticSimilarityEngine:
    """Computes semantic similarity across investigation narratives using dense embeddings."""

    def __init__(self):
        self.embedding_svc = embedding_service

    def compute_text_similarity(self, text1: str, text2: str) -> float:
        """Compute cosine similarity between two natural language descriptions."""
        if not text1 or not text2:
            return 0.0
        vec1 = self.embedding_svc.encode_text(text1)
        vec2 = self.embedding_svc.encode_text(text2)
        return round(cosine_similarity(vec1, vec2), 4)

    def rank_candidates(
        self,
        query_text: str,
        corpus_texts: List[str],
    ) -> List[float]:
        """Rank a list of corpus texts by similarity to query_text."""
        if not query_text or not corpus_texts:
            return [0.0] * len(corpus_texts)
        q_vec = self.embedding_svc.encode_text(query_text)
        corpus_vecs = self.embedding_svc.batch_encode(corpus_texts)
        return [round(cosine_similarity(q_vec, c_vec), 4) for c_vec in corpus_vecs]


semantic_similarity_engine = SemanticSimilarityEngine()
