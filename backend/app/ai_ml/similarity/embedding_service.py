"""Vector embedding service with lazy-loading, caching, and deterministic offline fallback."""

import hashlib
import re
from typing import Dict, List, Optional
import numpy as np
from app.ai_ml.config import aiml_settings
from app.core.logging import get_logger

logger = get_logger("kritagas.embeddings")


class EmbeddingService:
    """Manages sentence embedding generation with local caching and offline fallback."""

    def __init__(self):
        self._model = None
        self._cache: Dict[str, List[float]] = {}
        self._dim = aiml_settings.LOCAL_FALLBACK_DIMENSION

    def _get_model(self):
        """Lazy load SentenceTransformer model if available."""
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                # Load only locally cached weights to prevent blocking network operations
                self._model = SentenceTransformer(
                    aiml_settings.EMBEDDING_MODEL_NAME,
                    trust_remote_code=False,
                    local_files_only=True,
                )
                logger.info(f"Loaded local embedding model '{aiml_settings.EMBEDDING_MODEL_NAME}'")
            except Exception as e:
                logger.info(
                    f"SentenceTransformer local model unavailable ({e}); using fast deterministic offline feature vectorizer."
                )
                self._model = False

        return self._model

    def encode_text(self, text: str) -> List[float]:
        """Convert a single text into a normalized embedding vector."""
        cleaned = (text or "").strip()
        if not cleaned:
            return [0.0] * self._dim

        cache_key = hashlib.md5(cleaned.encode("utf-8")).hexdigest()
        if cache_key in self._cache:
            return self._cache[cache_key]

        model = self._get_model()
        if model and model is not False:
            try:
                vec = model.encode(cleaned, convert_to_numpy=True, normalize_embeddings=True)
                res = [float(x) for x in vec.tolist()]
                self._cache[cache_key] = res
                return res
            except Exception as e:
                logger.warning(f"Embedding inference failed: {e}; falling back to deterministic vector.")

        # Offline deterministic vector based on term frequency and char n-grams
        vec = self._deterministic_vector(cleaned)
        self._cache[cache_key] = vec
        return vec

    def batch_encode(self, texts: List[str]) -> List[List[float]]:
        """Batch encode a list of texts."""
        return [self.encode_text(t) for t in texts]

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Alias for batch_encode."""
        return self.batch_encode(texts)

    def compute_similarity(self, text_a: str, text_b: str) -> float:
        """Compute cosine similarity between two text strings."""
        vec_a = np.array(self.encode_text(text_a), dtype=float)
        vec_b = np.array(self.encode_text(text_b), dtype=float)
        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        dot = np.dot(vec_a, vec_b) / (norm_a * norm_b)
        return float(np.clip(dot, 0.0, 1.0))


    def _deterministic_vector(self, text: str) -> List[float]:
        """Compute a normalized pseudo-semantic vector using word hashes and character n-grams."""
        tokens = re.findall(r"\w+", text.lower())
        vec = np.zeros(self._dim, dtype=float)

        for token in tokens:
            idx = int(hashlib.md5(token.encode("utf-8")).hexdigest()[:8], 16) % self._dim
            vec[idx] += 1.0

        # Character trigrams for morphological similarity
        for i in range(len(text) - 2):
            tri = text[i : i + 3].lower()
            idx = int(hashlib.sha256(tri.encode("utf-8")).hexdigest()[:8], 16) % self._dim
            vec[idx] += 0.5

        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return [float(x) for x in vec.tolist()]


embedding_service = EmbeddingService()
