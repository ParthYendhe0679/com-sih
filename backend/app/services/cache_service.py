"""Centralized Valkey / Redis-compatible Caching Service for KRITAGAS.

Provides resilient high-performance data access, automatic JSON serialization/deserialization,
targeted invalidation, metrics tracking, and zero-crash graceful fallback.
"""

import asyncio
from datetime import date, datetime
from enum import Enum
import json
import time
from typing import Any, Dict, List, Optional, Union
import uuid

from app.core.cache.cache_keys import CacheKeys
from app.core.cache.cache_ttl import CacheTTL
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("kritagas.cache")

# Dynamic import: try valkey.asyncio first, fall back to redis.asyncio
try:
    import valkey.asyncio as cache_engine
    ENGINE_NAME = "Valkey"
except ImportError:
    try:
        import redis.asyncio as cache_engine
        ENGINE_NAME = "Redis"
    except ImportError:
        cache_engine = None
        ENGINE_NAME = "None"


class CacheJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder handling UUIDs, datetimes, Pydantic models, and SQLAlchemy entities."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Enum):
            return obj.value
        if hasattr(obj, "model_dump"):
            return obj.model_dump(mode="json")
        if hasattr(obj, "__dict__"):
            # Clean SQLAlchemy or class dict
            d = dict(obj.__dict__)
            d.pop("_sa_instance_state", None)
            return d
        return super().default(obj)


class CacheMetrics:
    """Thread-safe observational metrics for cache hits, misses, and errors."""

    def __init__(self):
        self.hits: int = 0
        self.misses: int = 0
        self.errors: int = 0
        self.sets: int = 0
        self.deletes: int = 0

    def record_hit(self):
        self.hits += 1

    def record_miss(self):
        self.misses += 1

    def record_error(self):
        self.errors += 1

    def record_set(self):
        self.sets += 1

    def record_delete(self):
        self.deletes += 1

    def to_dict(self) -> Dict[str, Any]:
        total_requests = self.hits + self.misses
        hit_rate = round((self.hits / total_requests * 100), 2) if total_requests > 0 else 0.0
        return {
            "hits": self.hits,
            "misses": self.misses,
            "total_requests": total_requests,
            "hit_rate_pct": hit_rate,
            "errors": self.errors,
            "sets": self.sets,
            "deletes": self.deletes,
        }


class CacheService:
    """Centralized high-performance cache service backed by Valkey (Redis-compatible)."""

    def __init__(self):
        self.enabled: bool = settings.ENABLE_VALKEY and (cache_engine is not None)
        self.connection_url: Optional[str] = settings.valkey_connection_url
        self._client: Optional[Any] = None
        self._client_loop: Optional[Any] = None
        self.metrics = CacheMetrics()
        self.engine_name: str = ENGINE_NAME
        self.keys = CacheKeys
        self.ttl = CacheTTL

    async def _get_client(self) -> Optional[Any]:
        """Lazy initialization of async Valkey connection pool."""
        if not self.enabled or not self.connection_url:
            return None

        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            current_loop = None

        if self._client is not None and self._client_loop != current_loop:
            # Rebind client if active asyncio event loop changed
            self._client = None
            self._client_loop = None

        if self._client is None:
            try:
                self._client = cache_engine.from_url(
                    self.connection_url,
                    decode_responses=True,
                    socket_timeout=settings.VALKEY_SOCKET_TIMEOUT,
                    socket_connect_timeout=settings.VALKEY_CONNECT_TIMEOUT,
                    retry_on_timeout=True,
                )
                self._client_loop = current_loop
            except Exception as e:
                self.metrics.record_error()
                logger.warning(
                    "Failed to initialize %s connection: %s. Running in graceful fallback mode.",
                    self.engine_name,
                    e,
                )
                self._client = None
                self._client_loop = None
        return self._client

    async def get(self, key: str) -> Optional[Any]:
        """Retrieve and deserialize value by key. Returns None on miss or cache failure."""
        client = await self._get_client()
        if client is None:
            self.metrics.record_miss()
            return None

        try:
            raw_val = await client.get(key)
            if raw_val is None:
                self.metrics.record_miss()
                return None

            self.metrics.record_hit()
            try:
                return json.loads(raw_val)
            except (json.JSONDecodeError, TypeError):
                return raw_val
        except Exception as err:
            self.metrics.record_error()
            logger.warning("Cache GET failed for key '%s': %s", key, err)
            return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Serialize and set key with optional TTL (seconds). Returns False on error."""
        client = await self._get_client()
        if client is None:
            return False

        try:
            serialized = json.dumps(value, cls=CacheJSONEncoder)
            if ttl is not None and ttl > 0:
                await client.set(key, serialized, ex=ttl)
            else:
                await client.set(key, serialized)
            self.metrics.record_set()
            return True
        except Exception as err:
            self.metrics.record_error()
            logger.warning("Cache SET failed for key '%s': %s", key, err)
            return False

    async def delete(self, key: str) -> bool:
        """Delete specific key from cache. Returns True if deleted."""
        client = await self._get_client()
        if client is None:
            return False

        try:
            res = await client.delete(key)
            self.metrics.record_delete()
            return bool(res > 0)
        except Exception as err:
            self.metrics.record_error()
            logger.warning("Cache DELETE failed for key '%s': %s", key, err)
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """Safely scan and delete all keys matching pattern without blocking server."""
        client = await self._get_client()
        if client is None:
            return 0

        deleted_count = 0
        try:
            keys_to_delete: List[str] = []
            async for k in client.scan_iter(match=pattern, count=100):
                keys_to_delete.append(k)
                if len(keys_to_delete) >= 100:
                    del_res = await client.delete(*keys_to_delete)
                    deleted_count += del_res
                    keys_to_delete.clear()

            if keys_to_delete:
                del_res = await client.delete(*keys_to_delete)
                deleted_count += del_res

            self.metrics.record_delete()
            return deleted_count
        except Exception as err:
            self.metrics.record_error()
            logger.warning("Cache DELETE_PATTERN failed for pattern '%s': %s", pattern, err)
            return 0

    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        client = await self._get_client()
        if client is None:
            return False

        try:
            res = await client.exists(key)
            return bool(res > 0)
        except Exception as err:
            self.metrics.record_error()
            logger.warning("Cache EXISTS check failed for key '%s': %s", key, err)
            return False

    async def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """Atomically increment counter key."""
        client = await self._get_client()
        if client is None:
            return None

        try:
            return await client.incrby(key, amount)
        except Exception as err:
            self.metrics.record_error()
            logger.warning("Cache INCR failed for key '%s': %s", key, err)
            return None

    async def ping(self) -> bool:
        """Check live connectivity to Valkey."""
        client = await self._get_client()
        if client is None:
            return False

        try:
            pong = await client.ping()
            return bool(pong)
        except Exception as err:
            self.metrics.record_error()
            logger.warning("Cache PING failed: %s", err)
            return False

    async def get_health_status(self) -> Dict[str, Any]:
        """Detailed non-leaking health diagnostic for monitoring."""
        if not self.enabled:
            return {
                "status": "disabled",
                "engine": self.engine_name,
                "connected": False,
                "latency_ms": None,
                "metrics": self.metrics.to_dict(),
            }

        client = await self._get_client()
        if client is None:
            return {
                "status": "disconnected",
                "engine": self.engine_name,
                "connected": False,
                "latency_ms": None,
                "metrics": self.metrics.to_dict(),
            }

        start = time.perf_counter()
        try:
            pong = await client.ping()
            latency = round((time.perf_counter() - start) * 1000, 2)
            return {
                "status": "connected" if pong else "degraded",
                "engine": self.engine_name,
                "connected": bool(pong),
                "latency_ms": latency,
                "metrics": self.metrics.to_dict(),
            }
        except Exception as err:
            self.metrics.record_error()
            return {
                "status": "error",
                "engine": self.engine_name,
                "connected": False,
                "error": str(err),
                "latency_ms": None,
                "metrics": self.metrics.to_dict(),
            }

    async def close(self):
        """Gracefully close connection pool."""
        if self._client is not None:
            try:
                await self._client.aclose()
            except Exception:
                pass
            self._client = None


# Global Singleton Instance
cache_service = CacheService()
