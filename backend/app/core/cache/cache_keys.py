"""Standardized Cache Key Strategy for KRITAGAS.

Ensures consistent naming, case isolation, user isolation, and targeted invalidation.
Prefix: kritagas:
"""

import hashlib
import re
from typing import Optional, Union
import uuid


class CacheKeys:
    """Predictable and namespace-isolated cache key generator."""

    PREFIX = "kritagas"

    @classmethod
    def case(cls, case_id: Union[str, uuid.UUID]) -> str:
        return f"{cls.PREFIX}:case:{case_id}"

    @classmethod
    def case_summary(cls, case_id: Union[str, uuid.UUID]) -> str:
        return f"{cls.PREFIX}:case:{case_id}:summary"

    @classmethod
    def case_entities(cls, case_id: Union[str, uuid.UUID]) -> str:
        return f"{cls.PREFIX}:case:{case_id}:entities"

    @classmethod
    def case_relationships(cls, case_id: Union[str, uuid.UUID]) -> str:
        return f"{cls.PREFIX}:case:{case_id}:relationships"

    @classmethod
    def case_network(cls, case_id: Union[str, uuid.UUID]) -> str:
        return f"{cls.PREFIX}:case:{case_id}:network"

    @classmethod
    def case_timeline(cls, case_id: Union[str, uuid.UUID]) -> str:
        return f"{cls.PREFIX}:case:{case_id}:timeline"

    @classmethod
    def case_intelligence(cls, case_id: Union[str, uuid.UUID]) -> str:
        return f"{cls.PREFIX}:case:{case_id}:intelligence"

    @classmethod
    def case_pattern(cls, case_id: Union[str, uuid.UUID]) -> str:
        """Pattern to match all cached keys related to a specific case for targeted eviction."""
        return f"{cls.PREFIX}:case:{case_id}*"

    @classmethod
    def entity(cls, entity_id: Union[str, uuid.UUID]) -> str:
        return f"{cls.PREFIX}:entity:{entity_id}"

    @classmethod
    def entity_profile(cls, entity_id: Union[str, uuid.UUID]) -> str:
        return f"{cls.PREFIX}:entity:{entity_id}:profile"

    @classmethod
    def entity_relationships(cls, entity_id: Union[str, uuid.UUID]) -> str:
        return f"{cls.PREFIX}:entity:{entity_id}:relationships"

    @classmethod
    def entity_pattern(cls, entity_id: Union[str, uuid.UUID]) -> str:
        return f"{cls.PREFIX}:entity:{entity_id}*"

    @classmethod
    def normalize_search_query(cls, query: str) -> str:
        """Normalize query string: lowercase, collapse whitespace, trim."""
        if not query:
            return ""
        return re.sub(r"\s+", " ", query.strip().lower())

    @classmethod
    def search(cls, query: str, role: str = "all", limit: int = 20) -> str:
        """Normalized search query hash key ensuring case/spacing variations hit identical cache."""
        normalized = cls.normalize_search_query(query)
        q_hash = hashlib.sha256(f"{normalized}:{limit}".encode("utf-8")).hexdigest()[:16]
        return f"{cls.PREFIX}:search:{role}:{q_hash}"

    @classmethod
    def dashboard(cls, role: str, user_id: Optional[Union[str, uuid.UUID]] = None) -> str:
        """Role and user isolated dashboard cache key."""
        uid = str(user_id) if user_id else "global"
        return f"{cls.PREFIX}:dashboard:{role.lower()}:{uid}"

    @classmethod
    def dashboard_pattern(cls) -> str:
        """Pattern matching all dashboard caches to evict on case/FIR status shifts."""
        return f"{cls.PREFIX}:dashboard:*"

    @classmethod
    def agent_samanvaya(cls, case_id: Union[str, uuid.UUID]) -> str:
        return f"{cls.PREFIX}:agent:samanvaya:{case_id}"

    @classmethod
    def ai_summary(cls, content_hash: str) -> str:
        return f"{cls.PREFIX}:ai:summary:{content_hash}"
