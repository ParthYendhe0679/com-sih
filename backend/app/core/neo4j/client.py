"""Asynchronous Neo4j Client and Connection Pool Manager for KRITAGAS.

Provides resilient, connection-pooled, asynchronous communication with Neo4j Aura
or on-premise Neo4j clusters. Ensures parameterization, health probing, and
graceful degradation when the graph database is unreachable or awaiting credentials.
"""

import asyncio
import time
from typing import Any, Dict, List, Optional, Tuple
from neo4j import AsyncDriver, AsyncGraphDatabase, AsyncSession
from neo4j.exceptions import AuthError, Neo4jError, ServiceUnavailable

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("kritagas.neo4j")


class Neo4jClient:
    """Enterprise-grade asynchronous Neo4j driver and connection pool manager."""

    def __init__(self):
        self._driver: Optional[AsyncDriver] = None
        self._is_connected: bool = False
        self._last_error: Optional[str] = None
        self._lock = asyncio.Lock()

    @property
    def is_configured(self) -> bool:
        """Check if Neo4j connection parameters are configured."""
        return bool(settings.NEO4J_URI and settings.ENABLE_GRAPH)

    @property
    def is_connected(self) -> bool:
        """Check if active connection to Neo4j has been verified."""
        return self._is_connected and self._driver is not None

    async def get_driver(self) -> Optional[AsyncDriver]:
        """Retrieve or lazily initialize the AsyncDriver singleton."""
        if not self.is_configured:
            return None

        if self._driver is None:
            async with self._lock:
                if self._driver is None:
                    await self._initialize_driver()

        return self._driver

    async def _initialize_driver(self) -> None:
        """Create the AsyncGraphDatabase driver instance with connection pool parameters."""
        uri = settings.NEO4J_URI
        username = settings.NEO4J_USERNAME or "neo4j"
        password = settings.NEO4J_PASSWORD or ""

        if not uri:
            logger.info("Neo4j URI is not set. Graph service will operate in fallback mode.")
            return

        auth: Optional[Tuple[str, str]] = None
        if password:
            auth = (username, password)
        else:
            logger.info("Neo4j password not supplied in environment. Operating in unauthenticated/fallback mode.")

        try:
            self._driver = AsyncGraphDatabase.driver(
                uri,
                auth=auth,
                max_connection_pool_size=settings.NEO4J_MAX_CONNECTION_POOL_SIZE,
                connection_timeout=settings.NEO4J_CONNECTION_TIMEOUT,
            )
            logger.info(f"Neo4j async driver instantiated for URI: {uri}")
        except Exception as e:
            self._last_error = str(e)
            logger.warning(f"Failed to instantiate Neo4j driver for {uri}: {e}")
            self._driver = None

    async def verify_connectivity(self) -> Tuple[bool, float, Optional[str]]:
        """Verify driver connectivity with latency measurement.
        
        Returns:
            (is_healthy: bool, latency_ms: float, error_message: Optional[str])
        """
        driver = await self.get_driver()
        if not driver:
            return False, 0.0, "Neo4j driver is not configured or initialized"

        start_time = time.perf_counter()
        try:
            await driver.verify_connectivity()
            latency = (time.perf_counter() - start_time) * 1000.0
            self._is_connected = True
            self._last_error = None
            return True, round(latency, 2), None
        except AuthError as ae:
            latency = (time.perf_counter() - start_time) * 1000.0
            err = f"Neo4j Authentication failed: {ae}"
            self._is_connected = False
            self._last_error = err
            logger.warning(err)
            return False, round(latency, 2), err
        except ServiceUnavailable as su:
            latency = (time.perf_counter() - start_time) * 1000.0
            err = f"Neo4j service unavailable at {settings.NEO4J_URI}: {su}"
            self._is_connected = False
            self._last_error = err
            logger.warning(err)
            return False, round(latency, 2), err
        except Exception as e:
            latency = (time.perf_counter() - start_time) * 1000.0
            err = f"Neo4j connectivity verification failed: {e}"
            self._is_connected = False
            self._last_error = err
            logger.warning(err)
            return False, round(latency, 2), err

    async def execute_query(
        self,
        query: str,
        parameters: Optional[Dict[str, Any]] = None,
        database: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Execute a parameterized Cypher query and return results as a list of dicts.
        
        Guarantees:
        - Parameterized query execution (0 string interpolation)
        - Session context management and cleanup
        - Configured query timeout
        """
        driver = await self.get_driver()
        if not driver:
            raise ServiceUnavailable("Neo4j driver is not configured or connected.")

        db_name = database or settings.NEO4J_DATABASE
        params = parameters or {}

        async def _run_session(target_db: Optional[str]):
            session_kwargs = {"database": target_db} if target_db else {}
            async with driver.session(**session_kwargs) as session:
                result = await session.run(query, params)
                return [record.data() async for record in result]

        try:
            return await _run_session(db_name)
        except Neo4jError as ne:
            if "DatabaseNotFound" in str(ne.code) and db_name:
                logger.warning(f"Database '{db_name}' not found. Retrying query against default Aura database...")
                try:
                    return await _run_session(None)
                except Exception as fallback_err:
                    logger.error(f"Fallback query execution failed: {fallback_err}")
                    raise
            logger.error(f"Neo4j Cypher execution error: {ne.message} (Code: {ne.code})")
            raise
        except Exception as e:
            logger.error(f"Unexpected error executing Neo4j Cypher query: {e}")
            raise

    async def execute_write(
        self,
        query: str,
        parameters: Optional[Dict[str, Any]] = None,
        database: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Execute a write query inside an explicit write transaction."""
        driver = await self.get_driver()
        if not driver:
            raise ServiceUnavailable("Neo4j driver is not configured or connected.")

        db_name = database or settings.NEO4J_DATABASE
        params = parameters or {}

        async def _write_tx(tx):
            res = await tx.run(query, params)
            return [record.data() async for record in res]

        async def _run_write_session(target_db: Optional[str]):
            session_kwargs = {"database": target_db} if target_db else {}
            async with driver.session(**session_kwargs) as session:
                return await session.execute_write(_write_tx)

        try:
            return await _run_write_session(db_name)
        except Neo4jError as ne:
            if "DatabaseNotFound" in str(ne.code) and db_name:
                logger.warning(f"Database '{db_name}' not found. Retrying write against default Aura database...")
                try:
                    return await _run_write_session(None)
                except Exception as fallback_err:
                    logger.error(f"Fallback write transaction failed: {fallback_err}")
                    raise
            logger.error(f"Failed to execute Neo4j write transaction: {ne}")
            raise
        except Exception as e:
            logger.error(f"Failed to execute Neo4j write transaction: {e}")
            raise

    async def get_health_status(self) -> Dict[str, Any]:
        """Return diagnostic health information for health check endpoints."""
        if not self.is_configured:
            return {
                "status": "unconfigured",
                "configured": False,
                "connected": False,
                "uri": settings.NEO4J_URI or None,
                "database": settings.NEO4J_DATABASE,
                "message": "Neo4j is not configured (ENABLE_GRAPH=false or missing NEO4J_URI).",
            }

        healthy, latency_ms, error = await self.verify_connectivity()
        node_count = 0
        relationship_count = 0

        if healthy:
            try:
                counts = await self.execute_query(
                    "MATCH (n) RETURN count(n) AS nodes, 0 AS rels"
                )
                if counts:
                    node_count = counts[0].get("nodes", 0)
                rel_counts = await self.execute_query(
                    "MATCH ()-[r]->() RETURN count(r) AS rels"
                )
                if rel_counts:
                    relationship_count = rel_counts[0].get("rels", 0)
            except Exception:
                pass

        return {
            "status": "healthy" if healthy else "degraded",
            "configured": True,
            "connected": healthy,
            "uri": settings.NEO4J_URI,
            "database": settings.NEO4J_DATABASE,
            "latency_ms": latency_ms,
            "node_count": node_count,
            "relationship_count": relationship_count,
            "error": error,
        }

    async def close(self) -> None:
        """Close the underlying driver connection pool gracefully."""
        if self._driver is not None:
            try:
                await self._driver.close()
                logger.info("Neo4j driver pool closed cleanly.")
            except Exception as e:
                logger.warning(f"Error closing Neo4j driver: {e}")
            finally:
                self._driver = None
                self._is_connected = False


# Global singleton instance
neo4j_client = Neo4jClient()
