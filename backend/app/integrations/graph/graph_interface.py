"""Knowledge Graph integration interface for future Neo4j synchronization."""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from app.core.logging import get_logger

logger = get_logger("kritagas.graph")


class GraphService(ABC):
    """Abstract interface defining synchronization hooks for graph databases (e.g., Neo4j).
    
    Future implementations will synchronize:
    - Case and FIR nodes
    - Person, Vehicle, Location, Phone, Organization entities
    - Extracted investigative relationships (INVOLVED_IN, CONNECTED_TO, OWNS, etc.)
    """

    @abstractmethod
    async def sync_case_node(
        self,
        case_id: str,
        case_number: str,
        title: str,
        crime_category: str,
        status: str,
    ) -> bool:
        """Create or update a Case vertex in the knowledge graph."""
        pass

    @abstractmethod
    async def sync_relationship(
        self,
        source_id: str,
        target_id: str,
        relationship_type: str,
        properties: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Create or update a directed edge connecting entities in the knowledge graph."""
        pass


class NoOpGraphService(GraphService):
    """Default non-blocking placeholder implementation awaiting future Neo4j driver integration."""

    async def sync_case_node(
        self,
        case_id: str,
        case_number: str,
        title: str,
        crime_category: str,
        status: str,
    ) -> bool:
        logger.info(
            f"[NEO4J_HOOK] Sync Case node ({case_number}, ID: {case_id}) to Knowledge Graph (NoOp active)"
        )
        return True

    async def sync_relationship(
        self,
        source_id: str,
        target_id: str,
        relationship_type: str,
        properties: Optional[Dict[str, Any]] = None,
    ) -> bool:
        logger.debug(
            f"[NEO4J_HOOK] Sync Relationship {source_id} -[{relationship_type}]-> {target_id} (NoOp active)"
        )
        return True


def get_graph_service() -> GraphService:
    """Dependency factory returning the active GraphService implementation."""
    return NoOpGraphService()
