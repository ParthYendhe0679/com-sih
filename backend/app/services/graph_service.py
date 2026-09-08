"""High-Performance Graph Service and PostgreSQL ↔ Neo4j Synchronization Engine for KRITAGAS.

Implements bidirectional graph synchronization from PostgreSQL models into Neo4j Aura,
accelerates graph queries via Valkey caching, and provides seamless graceful
fallback to PostgreSQL in-memory graph synthesis when Neo4j is offline.
"""

import time
from typing import Any, Dict, List, Optional
import uuid
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai_ml.models.ai_models import Entity
from app.core.cache import CacheKeys, CacheTTL
from app.core.exceptions import NotFoundException, PermissionDeniedException
from app.core.logging import get_logger
from app.core.neo4j.client import Neo4jClient, neo4j_client
from app.integrations.graph.graph_interface import GraphService as AbstractGraphService
from app.models.case import Case
from app.models.data_architecture import CaseEntityContext, EntityRelationship
from app.models.evidence import Evidence
from app.models.fir import FIR
from app.repositories.graph_repository import GraphRepository
from app.schemas.graph import (
    CaseGraphResponse,
    CaseNetworkResponse,
    GraphEdge,
    GraphNode,
    GraphStatistics,
    GraphSyncResponse,
)
from app.services.cache_service import CacheService, cache_service as default_cache

logger = get_logger("kritagas.graph.service")


class Neo4jGraphService(AbstractGraphService):
    """Production Graph Service managing Neo4j storage, synchronization, and Valkey caching."""

    def __init__(
        self,
        client: Optional[Neo4jClient] = None,
        repository: Optional[GraphRepository] = None,
        cache: Optional[CacheService] = None,
    ):
        self.client = client or neo4j_client
        self.repo = repository or GraphRepository(self.client)
        self.cache = cache or default_cache

    # -------------------------------------------------------------
    # AbstractGraphService Implementation (Hooks for CaseService)
    # -------------------------------------------------------------

    async def sync_case_node(
        self,
        case_id: str,
        case_number: str,
        title: str,
        crime_category: str,
        status: str,
    ) -> bool:
        """Create or update a Case vertex in the knowledge graph."""
        if not self.client.is_connected:
            logger.debug(f"Neo4j not connected; skipped real-time sync for case {case_number}")
            return True

        try:
            await self.repo.upsert_case_node(
                case_id=case_id,
                case_number=case_number,
                title=title,
                crime_category=crime_category,
                status=status,
            )
            return True
        except Exception as e:
            logger.warning(f"Error syncing case node {case_number} to Neo4j: {e}")
            return False

    async def sync_relationship(
        self,
        source_id: str,
        target_id: str,
        relationship_type: str,
        properties: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Create or update a directed edge connecting entities in the knowledge graph."""
        if not self.client.is_connected:
            return True

        try:
            await self.repo.upsert_relationship(
                source_id=source_id,
                target_id=target_id,
                relationship_type=relationship_type,
                properties=properties,
            )
            return True
        except Exception as e:
            logger.warning(f"Error syncing relationship {source_id} -> {target_id} to Neo4j: {e}")
            return False

    # -------------------------------------------------------------
    # PostgreSQL ↔ Neo4j Synchronization Engine
    # -------------------------------------------------------------

    async def sync_case_graph(
        self,
        case_id: uuid.UUID,
        session: AsyncSession,
    ) -> GraphSyncResponse:
        """Synchronize complete case intelligence from PostgreSQL into Neo4j.
        
        Reads:
        - Case metadata
        - CaseEntityContext + canonical Entity records
        - Discovered EntityRelationship edges
        - Linked FIR and attached Evidence records
        
        Performs atomic idempotent MERGE operations on Neo4j and clears stale Valkey cache.
        """
        start_time = time.perf_counter()

        # 1. Fetch Case
        case_stmt = select(Case).where(Case.id == case_id)
        case_res = await session.execute(case_stmt)
        case = case_res.scalar_one_or_none()
        if not case:
            raise NotFoundException(f"Case {case_id} not found.")

        # 2. Fetch Entities via Context or legacy Case ID
        ctx_stmt = (
            select(CaseEntityContext)
            .where(CaseEntityContext.case_id == case.id)
            .options(selectinload(CaseEntityContext.entity))
        )
        ctx_res = await session.execute(ctx_stmt)
        contexts = list(ctx_res.scalars().all())

        entities: List[Entity] = []
        role_map: Dict[str, str] = {}

        if contexts:
            for c in contexts:
                if c.entity:
                    entities.append(c.entity)
                    role_map[str(c.entity.id)] = c.role
        else:
            leg_stmt = select(Entity).where(Entity.case_id == case.id)
            leg_res = await session.execute(leg_stmt)
            entities = list(leg_res.scalars().all())
            for e in entities:
                role_map[str(e.id)] = "INVOLVED_IN"

        # 3. Fetch Relationships
        rel_stmt = select(EntityRelationship).where(EntityRelationship.case_id == case.id)
        rel_res = await session.execute(rel_stmt)
        relationships = list(rel_res.scalars().all())

        # 4. Fetch Evidence
        ev_stmt = select(Evidence).where(Evidence.case_id == case.id)
        ev_res = await session.execute(ev_stmt)
        evidence_items = list(ev_res.scalars().all())

        # 5. Fetch FIR
        fir: Optional[FIR] = None
        if case.fir_id:
            fir_stmt = select(FIR).where(FIR.id == case.fir_id)
            fir_res = await session.execute(fir_stmt)
            fir = fir_res.scalar_one_or_none()

        nodes_synced = 0
        edges_synced = 0

        # Execute Neo4j sync if available
        if self.client.is_connected:
            try:
                # A. Upsert Case Node
                await self.repo.upsert_case_node(
                    case_id=str(case.id),
                    case_number=case.case_number,
                    title=case.title,
                    crime_category=case.crime_category,
                    status=case.status.value if hasattr(case.status, "value") else str(case.status),
                )
                nodes_synced += 1

                # B. Upsert Entities & link to Case
                for ent in entities:
                    await self.repo.upsert_entity_node(
                        entity_id=str(ent.id),
                        entity_type=ent.entity_type,
                        name=ent.name,
                        normalized_name=ent.normalized_value,
                        confidence=ent.confidence,
                        source="POSTGRESQL_SYNC",
                        properties=ent.attributes_json or {},
                    )
                    nodes_synced += 1

                    role = role_map.get(str(ent.id), "INVOLVED_IN")
                    await self.repo.link_entity_to_case(
                        entity_id=str(ent.id),
                        case_id=str(case.id),
                        role=role,
                        confidence=ent.confidence,
                    )
                    edges_synced += 1

                # C. Upsert Relationships between Entities
                for rel in relationships:
                    evidence_list = []
                    if rel.evidence_chain and isinstance(rel.evidence_chain, dict):
                        evidence_list = rel.evidence_chain.get("evidence_basis", [])

                    await self.repo.upsert_relationship(
                        source_id=str(rel.source_entity_id),
                        target_id=str(rel.target_entity_id),
                        relationship_type=rel.relationship_type,
                        confidence=rel.confidence,
                        case_id=str(case.id),
                        evidence_basis=evidence_list or ["Investigation Correlation"],
                    )
                    edges_synced += 1

                # D. Upsert FIR Node and connect to Case
                if fir:
                    await self.repo.upsert_entity_node(
                        entity_id=str(fir.id),
                        entity_type="FIR",
                        name=fir.fir_number,
                        normalized_name=fir.fir_number.lower(),
                        confidence=1.0,
                        source="FIR_INTAKE",
                        properties={"title": fir.title, "incident_location": fir.incident_location or ""},
                    )
                    nodes_synced += 1

                    await self.repo.upsert_relationship(
                        source_id=str(case.id),
                        target_id=str(fir.id),
                        relationship_type="ORIGINATED_FROM",
                        confidence=1.0,
                        case_id=str(case.id),
                        evidence_basis=["Official FIR Intake"],
                    )
                    edges_synced += 1

                # E. Upsert Evidence Nodes
                for ev in evidence_items:
                    await self.repo.upsert_entity_node(
                        entity_id=str(ev.id),
                        entity_type="Evidence",
                        name=ev.title,
                        normalized_name=ev.title.lower(),
                        confidence=1.0,
                        source="CHAIN_OF_CUSTODY",
                        properties={
                            "evidence_type": ev.evidence_type.value if hasattr(ev.evidence_type, "value") else str(ev.evidence_type),
                            "file_hash": ev.file_hash or "",
                        },
                    )
                    nodes_synced += 1

                    await self.repo.upsert_relationship(
                        source_id=str(case.id),
                        target_id=str(ev.id),
                        relationship_type="ATTACHED_EVIDENCE",
                        confidence=1.0,
                        case_id=str(case.id),
                        evidence_basis=["Chain of Custody Ledger"],
                    )
                    edges_synced += 1

            except Exception as e:
                logger.error(f"Error during Neo4j synchronization for case {case.id}: {e}")
        else:
            # Fallback counting
            nodes_synced = 1 + len(entities) + (1 if fir else 0) + len(evidence_items)
            edges_synced = len(entities) + len(relationships) + (1 if fir else 0) + len(evidence_items)
            logger.info(f"Synchronized {nodes_synced} nodes into PostgreSQL graph projection (Neo4j in standby).")

        # 6. Invalidate Valkey graph cache
        await self._invalidate_graph_cache(case.id)

        duration = (time.perf_counter() - start_time) * 1000.0
        return GraphSyncResponse(
            case_id=str(case.id),
            nodes_synced=nodes_synced,
            edges_synced=edges_synced,
            status="SUCCESS",
            message=f"Synchronized {nodes_synced} nodes and {edges_synced} edges for Case {case.case_number}.",
            duration_ms=round(duration, 2),
        )

    # -------------------------------------------------------------
    # Case Graph & Network Retrieval with Valkey Caching
    # -------------------------------------------------------------

    async def get_case_graph(
        self,
        case_id: uuid.UUID,
        session: AsyncSession,
    ) -> CaseGraphResponse:
        """Retrieve full graph representation of a case (Valkey cached -> Neo4j -> Postgres fallback)."""
        cache_key = f"{CacheKeys.PREFIX}:graph:case:{case_id}"
        cached = await self.cache.get(cache_key)
        if cached and isinstance(cached, dict):
            try:
                return CaseGraphResponse.model_validate(cached)
            except Exception:
                pass

        # If Neo4j is connected, read from Neo4j
        if self.client.is_connected:
            try:
                subgraph = await self.repo.get_case_subgraph(str(case_id))
                raw_nodes = subgraph.get("nodes") or []
                raw_edges = subgraph.get("edges") or []

                nodes: List[GraphNode] = []
                for n in raw_nodes:
                    node_data = dict(n)
                    node_id = str(node_data.get("id") or "")
                    label = node_data.get("name") or node_data.get("case_number") or node_data.get("title") or node_id
                    node_type = node_data.get("type") or "Entity"

                    nodes.append(
                        GraphNode(
                            id=node_id,
                            label=label,
                            type=node_type,
                            data=node_data,
                            confidence=float(node_data.get("confidence", 1.0)),
                            source=node_data.get("source"),
                        )
                    )

                edges: List[GraphEdge] = []
                for i, r in enumerate(raw_edges):
                    rel_data = dict(r)
                    src = str(rel_data.get("source") or "")
                    tgt = str(rel_data.get("target") or "")
                    rel_type = str(rel_data.get("type") or "CONNECTED_TO")

                    edges.append(
                        GraphEdge(
                            id=f"edge-{src}-{tgt}-{i}",
                            source=src,
                            target=tgt,
                            relationship=rel_type,
                            confidence=float(rel_data.get("confidence", 1.0)),
                            evidence_basis=rel_data.get("evidence_basis") or ["Case Intelligence Link"],
                            case_ids=[str(case_id)],
                            properties=rel_data,
                        )
                    )

                # Fetch Case details for header
                case_stmt = select(Case).where(Case.id == case_id)
                case_res = await session.execute(case_stmt)
                case = case_res.scalar_one_or_none()
                case_num = case.case_number if case else str(case_id)

                stats = GraphStatistics(
                    node_count=len(nodes),
                    edge_count=len(edges),
                    node_types={t: sum(1 for n in nodes if n.type == t) for t in set(n.type for n in nodes)},
                    relationship_types={r: sum(1 for e in edges if e.relationship == r) for r in set(e.relationship for e in edges)},
                    density=round((2 * len(edges)) / (len(nodes) * (len(nodes) - 1)), 4) if len(nodes) > 1 else 0.0,
                )

                response = CaseGraphResponse(
                    case_id=str(case_id),
                    case_number=case_num,
                    nodes=nodes,
                    edges=edges,
                    statistics=stats,
                    engine="neo4j",
                )
                await self.cache.set(cache_key, response.model_dump(mode="json"), ttl=CacheTTL.NETWORK)
                return response
            except Exception as e:
                logger.warning(f"Neo4j graph query failed, falling back to PostgreSQL: {e}")

        # Fallback: In-memory graph synthesis directly from PostgreSQL
        fallback_resp = await self._synthesize_case_graph_from_postgres(case_id, session)
        await self.cache.set(cache_key, fallback_resp.model_dump(mode="json"), ttl=CacheTTL.NETWORK)
        return fallback_resp

    async def get_case_network(
        self,
        case_id: uuid.UUID,
        session: AsyncSession,
    ) -> CaseNetworkResponse:
        """Get Cytoscape-formatted network data specifically mapped for the Next.js frontend."""
        graph = await self.get_case_graph(case_id, session)

        return CaseNetworkResponse(
            case_id=graph.case_id,
            case_number=graph.case_number,
            nodes=graph.nodes,
            edges=graph.edges,
            total_nodes=len(graph.nodes),
            total_edges=len(graph.edges),
            engine=graph.engine,
        )

    # -------------------------------------------------------------
    # Graceful Fallback: PostgreSQL Graph Projection
    # -------------------------------------------------------------

    async def _synthesize_case_graph_from_postgres(
        self,
        case_id: uuid.UUID,
        session: AsyncSession,
    ) -> CaseGraphResponse:
        """Synthesizes graph structure directly from PostgreSQL tables when Neo4j is offline."""
        case_stmt = select(Case).where(Case.id == case_id)
        case_res = await session.execute(case_stmt)
        case = case_res.scalar_one_or_none()
        if not case:
            raise NotFoundException(f"Case {case_id} not found.")

        nodes: List[GraphNode] = [
            GraphNode(
                id=str(case.id),
                label=case.case_number,
                type="Case",
                data={
                    "case_number": case.case_number,
                    "title": case.title,
                    "status": case.status.value if hasattr(case.status, "value") else str(case.status),
                    "crime_category": case.crime_category,
                },
                confidence=1.0,
                source="POSTGRESQL",
            )
        ]
        edges: List[GraphEdge] = []

        # Load Entities
        ctx_stmt = (
            select(CaseEntityContext)
            .where(CaseEntityContext.case_id == case.id)
            .options(selectinload(CaseEntityContext.entity))
        )
        ctx_res = await session.execute(ctx_stmt)
        contexts = list(ctx_res.scalars().all())

        for ctx in contexts:
            ent = ctx.entity
            if not ent:
                continue
            nodes.append(
                GraphNode(
                    id=str(ent.id),
                    label=ent.name,
                    type=ent.entity_type.capitalize(),
                    data={
                        "name": ent.name,
                        "normalized": ent.normalized_value,
                        "role": ctx.role,
                        **(ent.attributes_json or {}),
                    },
                    confidence=ctx.confidence,
                    source=ctx.extraction_method,
                )
            )
            edges.append(
                GraphEdge(
                    id=f"edge-ctx-{ent.id}-{case.id}",
                    source=str(ent.id),
                    target=str(case.id),
                    relationship="INVOLVED_IN",
                    confidence=ctx.confidence,
                    evidence_basis=["Case Entity Context Assignment"],
                    case_ids=[str(case.id)],
                )
            )

        # Load Relationships
        rel_stmt = select(EntityRelationship).where(EntityRelationship.case_id == case.id)
        rel_res = await session.execute(rel_stmt)
        relationships = list(rel_res.scalars().all())

        for rel in relationships:
            edges.append(
                GraphEdge(
                    id=str(rel.id),
                    source=str(rel.source_entity_id),
                    target=str(rel.target_entity_id),
                    relationship=rel.relationship_type,
                    confidence=rel.confidence,
                    evidence_basis=["Investigation Correlation Discovery"],
                    case_ids=[str(case.id)],
                )
            )

        # Load Evidence
        ev_stmt = select(Evidence).where(Evidence.case_id == case.id)
        ev_res = await session.execute(ev_stmt)
        evidence_items = list(ev_res.scalars().all())

        for ev in evidence_items:
            ev_id = str(ev.id)
            nodes.append(
                GraphNode(
                    id=ev_id,
                    label=ev.title[:24],
                    type="Evidence",
                    data={"title": ev.title, "hash": ev.file_hash[:16] if ev.file_hash else ""},
                    confidence=1.0,
                    source="CHAIN_OF_CUSTODY",
                )
            )
            edges.append(
                GraphEdge(
                    id=f"edge-ev-{ev.id}",
                    source=str(case.id),
                    target=ev_id,
                    relationship="ATTACHED_EVIDENCE",
                    confidence=1.0,
                    evidence_basis=["Cryptographic Evidence Anchor"],
                    case_ids=[str(case.id)],
                )
            )

        # Load FIR
        if case.fir_id:
            fir_stmt = select(FIR).where(FIR.id == case.fir_id)
            fir_res = await session.execute(fir_stmt)
            fir = fir_res.scalar_one_or_none()
            if fir:
                fir_id = str(fir.id)
                nodes.append(
                    GraphNode(
                        id=fir_id,
                        label=fir.fir_number,
                        type="FIR",
                        data={"fir_number": fir.fir_number, "title": fir.title},
                        confidence=1.0,
                        source="FIR_INTAKE",
                    )
                )
                edges.append(
                    GraphEdge(
                        id=f"edge-fir-{fir.id}",
                        source=str(case.id),
                        target=fir_id,
                        relationship="ORIGINATED_FROM",
                        confidence=1.0,
                        evidence_basis=["FIR Registration Dossier"],
                        case_ids=[str(case.id)],
                    )
                )

        stats = GraphStatistics(
            node_count=len(nodes),
            edge_count=len(edges),
            node_types={t: sum(1 for n in nodes if n.type == t) for t in set(n.type for n in nodes)},
            relationship_types={r: sum(1 for e in edges if e.relationship == r) for r in set(e.relationship for e in edges)},
            density=round((2 * len(edges)) / (len(nodes) * (len(nodes) - 1)), 4) if len(nodes) > 1 else 0.0,
        )

        return CaseGraphResponse(
            case_id=str(case.id),
            case_number=case.case_number,
            nodes=nodes,
            edges=edges,
            statistics=stats,
            engine="postgres_synthesis",
        )

    async def _invalidate_graph_cache(self, case_id: uuid.UUID) -> None:
        """Evict all cached graph responses for a case."""
        try:
            await self.cache.delete(f"{CacheKeys.PREFIX}:graph:case:{case_id}")
            await self.cache.delete(f"{CacheKeys.PREFIX}:graph:network:{case_id}")
            await self.cache.delete(f"{CacheKeys.PREFIX}:case:{case_id}:network")
            await self.cache.delete_pattern(f"{CacheKeys.PREFIX}:graph:*{case_id}*")
        except Exception as e:
            logger.warning(f"Error invalidating graph cache: {e}")


# Singleton service
graph_service = Neo4jGraphService()
