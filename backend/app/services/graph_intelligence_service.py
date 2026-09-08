"""Graph Intelligence Service for KRITAGAS.

Discovers hidden connections, multi-hop paths, shared resources, cross-case intersections,
and calculates graph-theoretic centrality and clustering metrics.
"""

from typing import Any, Dict, List, Optional
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai_ml.models.ai_models import Entity
from app.ai_ml.utils.graph_utils import GraphAnalyticsEngine
from app.core.cache import CacheKeys, CacheTTL
from app.core.exceptions import NotFoundException, PermissionDeniedException
from app.core.logging import get_logger
from app.core.neo4j.client import Neo4jClient, neo4j_client
from app.models.case import Case
from app.models.data_architecture import CaseEntityContext, EntityRelationship
from app.models.user import User, UserRole
from app.repositories.graph_repository import GraphRepository
from app.schemas.graph import (
    CrossCaseEntityItem,
    GraphAnalyticsResponse,
    GraphEdge,
    GraphNode,
    HiddenConnectionItem,
    SharedResourceItem,
    ShortestPathResponse,
)
from app.services.cache_service import CacheService, cache_service as default_cache

logger = get_logger("kritagas.graph.intelligence")


class GraphIntelligenceService:
    """Service providing advanced criminal network analysis and hidden pattern discovery."""

    def __init__(
        self,
        client: Optional[Neo4jClient] = None,
        repository: Optional[GraphRepository] = None,
        cache: Optional[CacheService] = None,
    ):
        self.client = client or neo4j_client
        self.repo = repository or GraphRepository(self.client)
        self.cache = cache or default_cache
        self.networkx_engine = GraphAnalyticsEngine()

    async def find_hidden_connections(
        self,
        case_id: uuid.UUID,
        session: AsyncSession,
        entity_id: Optional[uuid.UUID] = None,
        max_depth: int = 2,
    ) -> List[HiddenConnectionItem]:
        """Discover hidden connections between entities in an investigation case.
        
        Searches for:
        1. Common associates (Person A -> Shared Entity <- Person B)
        2. Multi-hop chains up to max_depth
        """
        cache_key = f"{CacheKeys.PREFIX}:graph:hidden:{case_id}:{entity_id or 'all'}:{max_depth}"
        cached = await self.cache.get(cache_key)
        if cached and isinstance(cached, list):
            try:
                return [HiddenConnectionItem.model_validate(item) for item in cached]
            except Exception:
                pass

        results: List[HiddenConnectionItem] = []

        if self.client.is_connected:
            try:
                shared = await self.repo.find_shared_resources(str(case_id))
                for item in shared:
                    persons = item.get("connected_persons") or []
                    if len(persons) >= 2:
                        p1 = persons[0]
                        p2 = persons[1]
                        results.append(
                            HiddenConnectionItem(
                                connection_type="SHARED_RESOURCE",
                                source_entity={"id": p1.get("id"), "name": p1.get("name"), "type": "Person"},
                                target_entity={"id": p2.get("id"), "name": p2.get("name"), "type": "Person"},
                                intermediaries=[{
                                    "id": item.get("resource_id"),
                                    "value": item.get("resource_value"),
                                    "type": item.get("resource_type"),
                                }],
                                hop_distance=2,
                                confidence=0.88,
                                evidence_basis=[f"Shared {item.get('resource_type')} co-utilization"],
                                description=f"{p1.get('name')} and {p2.get('name')} both share {item.get('resource_type')} '{item.get('resource_value')}'.",
                            )
                        )
            except Exception as e:
                logger.warning(f"Neo4j hidden connection query failed: {e}")

        # Fallback / augment with PostgreSQL relationship analysis
        if not results:
            results = await self._find_hidden_connections_postgres(case_id, session, entity_id)

        await self.cache.set(
            cache_key,
            [r.model_dump(mode="json") for r in results],
            ttl=CacheTTL.NETWORK,
        )
        return results

    async def find_shared_resources(
        self,
        case_id: Optional[uuid.UUID],
        session: AsyncSession,
    ) -> List[SharedResourceItem]:
        """Identify Phones, Vehicles, Bank Accounts, or Locations linked to multiple persons."""
        cache_key = f"{CacheKeys.PREFIX}:graph:shared:{case_id or 'global'}"
        cached = await self.cache.get(cache_key)
        if cached and isinstance(cached, list):
            try:
                return [SharedResourceItem.model_validate(i) for i in cached]
            except Exception:
                pass

        items: List[SharedResourceItem] = []

        if self.client.is_connected:
            try:
                raw_resources = await self.repo.find_shared_resources(str(case_id) if case_id else None)
                for res in raw_resources:
                    items.append(
                        SharedResourceItem(
                            resource_id=str(res.get("resource_id")),
                            resource_type=str(res.get("resource_type")),
                            resource_value=str(res.get("resource_value")),
                            connected_persons=res.get("connected_persons") or [],
                            case_ids=res.get("case_ids") or [],
                        )
                    )
            except Exception as e:
                logger.warning(f"Neo4j shared resources query failed: {e}")

        if not items:
            items = await self._find_shared_resources_postgres(case_id, session)

        await self.cache.set(
            cache_key,
            [i.model_dump(mode="json") for i in items],
            ttl=CacheTTL.NETWORK,
        )
        return items

    async def find_shortest_path(
        self,
        source_id: uuid.UUID,
        target_id: uuid.UUID,
        session: AsyncSession,
        max_depth: int = 4,
    ) -> ShortestPathResponse:
        """Find the shortest connection path between two entities."""
        cache_key = f"{CacheKeys.PREFIX}:graph:path:{source_id}:{target_id}:{max_depth}"
        cached = await self.cache.get(cache_key)
        if cached and isinstance(cached, dict):
            try:
                return ShortestPathResponse.model_validate(cached)
            except Exception:
                pass

        if self.client.is_connected:
            try:
                paths = await self.repo.find_shortest_path(str(source_id), str(target_id), max_depth=max_depth)
                if paths:
                    path_data = paths[0]
                    nodes = [GraphNode.model_validate(n) for n in path_data.get("path_nodes", [])]
                    edges = [
                        GraphEdge(
                            id=f"edge-{e['source']}-{e['target']}",
                            source=e["source"],
                            target=e["target"],
                            relationship=e["type"],
                            confidence=e.get("confidence", 1.0),
                            evidence_basis=e.get("evidence_basis", ["Path traversal"]),
                        )
                        for e in path_data.get("path_edges", [])
                    ]
                    resp = ShortestPathResponse(
                        source_id=str(source_id),
                        target_id=str(target_id),
                        path_length=path_data.get("length", len(edges)),
                        nodes=nodes,
                        edges=edges,
                        evidence_chain=[f"{e.relationship} ({e.confidence * 100:.0f}%)" for e in edges],
                    )
                    await self.cache.set(cache_key, resp.model_dump(mode="json"), ttl=CacheTTL.CASE)
                    return resp
            except Exception as e:
                logger.warning(f"Neo4j shortest path query failed: {e}")

        # Fallback via NetworkX
        resp = await self._find_shortest_path_networkx(source_id, target_id, session, max_depth)
        await self.cache.set(cache_key, resp.model_dump(mode="json"), ttl=CacheTTL.CASE)
        return resp

    async def find_cross_case_connections(
        self,
        user: User,
        session: AsyncSession,
    ) -> List[CrossCaseEntityItem]:
        """Discover entities appearing in multiple investigation cases.
        
        Enforces RBAC:
        - CITIZEN: Not authorized (cannot view cross-case intelligence).
        - POLICE / ADMIN: Authorized.
        """
        if user.role == UserRole.CITIZEN:
            raise PermissionDeniedException("Cross-case intelligence is restricted to authorized officers.")

        cache_key = f"{CacheKeys.PREFIX}:graph:cross_case"
        cached = await self.cache.get(cache_key)
        if cached and isinstance(cached, list):
            try:
                return [CrossCaseEntityItem.model_validate(item) for item in cached]
            except Exception:
                pass

        items: List[CrossCaseEntityItem] = []

        if self.client.is_connected:
            try:
                raw_items = await self.repo.find_cross_case_entities()
                for item in raw_items:
                    items.append(
                        CrossCaseEntityItem(
                            entity_id=str(item.get("entity_id")),
                            name=str(item.get("name")),
                            entity_type=str(item.get("entity_type")),
                            cases=item.get("cases") or [],
                            total_cases=item.get("total_cases", 0),
                        )
                    )
            except Exception as e:
                logger.warning(f"Neo4j cross-case query failed: {e}")

        if not items:
            items = await self._find_cross_case_postgres(session)

        await self.cache.set(
            cache_key,
            [i.model_dump(mode="json") for i in items],
            ttl=CacheTTL.DASHBOARD,
        )
        return items

    async def get_graph_analytics(
        self,
        case_id: uuid.UUID,
        session: AsyncSession,
    ) -> GraphAnalyticsResponse:
        """Calculate network metrics (degree centrality, clusters, key intermediaries)."""
        cache_key = f"{CacheKeys.PREFIX}:graph:analytics:{case_id}"
        cached = await self.cache.get(cache_key)
        if cached and isinstance(cached, dict):
            try:
                return GraphAnalyticsResponse.model_validate(cached)
            except Exception:
                pass

        # Load case relationships and entities from PostgreSQL
        rel_stmt = select(EntityRelationship).where(EntityRelationship.case_id == case_id)
        rel_res = await session.execute(rel_stmt)
        relationships = list(rel_res.scalars().all())

        ent_ids = set()
        for r in relationships:
            ent_ids.add(r.source_entity_id)
            ent_ids.add(r.target_entity_id)

        ent_stmt = select(Entity).where(Entity.id.in_(list(ent_ids)))
        ent_res = await session.execute(ent_stmt)
        entities = list(ent_res.scalars().all())
        ent_map = {e.id: e for e in entities}

        # Build NetworkX graph
        nodes_payload = [{"id": str(e.id), "label": e.name, "type": e.entity_type} for e in entities]
        edges_payload = [
            {
                "source": str(r.source_entity_id),
                "target": str(r.target_entity_id),
                "relationship": r.relationship_type,
                "confidence": r.confidence * 100.0,
            }
            for r in relationships
        ]

        nx_graph = self.networkx_engine.build_graph(nodes_payload, edges_payload)
        metrics = self.networkx_engine.extract_metrics(nx_graph)

        centrality_dict: Dict[str, float] = {}
        high_connectivity: List[Dict[str, Any]] = []

        for m in metrics:
            e_id = str(m.get("node_id") or m.get("entity_id") or "")
            e_obj = None
            try:
                e_obj = ent_map.get(uuid.UUID(e_id))
            except Exception:
                pass

            name = e_obj.name if e_obj else m.get("label", e_id)
            ent_type = e_obj.entity_type if e_obj else m.get("entity_type", "Entity")
            deg = float(m.get("degree_centrality", 0.0))
            btw = float(m.get("betweenness_centrality", 0.0))
            conn_count = int(nx_graph.degree(e_id)) if nx_graph.has_node(e_id) else 0

            centrality_dict[e_id] = deg

            if conn_count >= 2 or deg > 0.3:
                high_connectivity.append({
                    "entity_id": e_id,
                    "entity_name": name,
                    "entity_type": ent_type,
                    "connection_count": conn_count,
                    "degree_centrality": deg,
                    "betweenness_centrality": btw,
                    "investigative_note": "High connectivity entity requiring priority review.",
                })

        # Intermediaries (betweenness > 0)
        intermediaries = [
            {
                "entity_id": str(m.get("node_id") or m.get("entity_id")),
                "betweenness": float(m.get("betweenness_centrality", 0.0)),
                "note": "Potential communication bridge between distinct clusters.",
            }
            for m in metrics
            if float(m.get("betweenness_centrality", 0.0)) > 0.05
        ]

        # Communities / Clusters
        communities = self.networkx_engine.detect_communities(nx_graph)
        cluster_list = [
            {"cluster_id": idx, "entity_count": len(c), "entities": list(c)}
            for idx, c in enumerate(communities)
        ]

        response = GraphAnalyticsResponse(
            case_id=str(case_id),
            high_connectivity_entities=sorted(high_connectivity, key=lambda x: x["degree_centrality"], reverse=True),
            central_intermediaries=intermediaries,
            clusters=cluster_list,
            degree_centrality=centrality_dict,
        )

        await self.cache.set(cache_key, response.model_dump(mode="json"), ttl=CacheTTL.NETWORK)
        return response

    # -------------------------------------------------------------
    # Fallback Algorithms using PostgreSQL + NetworkX
    # -------------------------------------------------------------

    async def _find_hidden_connections_postgres(
        self,
        case_id: uuid.UUID,
        session: AsyncSession,
        target_entity_id: Optional[uuid.UUID],
    ) -> List[HiddenConnectionItem]:
        """Synthesize hidden connections via PostgreSQL two-hop entity matching."""
        rel_stmt = select(EntityRelationship).where(EntityRelationship.case_id == case_id)
        rel_res = await session.execute(rel_stmt)
        relationships = list(rel_res.scalars().all())

        if not relationships:
            return []

        # Find entities that share a neighbor
        adj: Dict[uuid.UUID, List[uuid.UUID]] = {}
        for r in relationships:
            adj.setdefault(r.source_entity_id, []).append(r.target_entity_id)
            adj.setdefault(r.target_entity_id, []).append(r.source_entity_id)

        # Load entity names
        ent_stmt = select(Entity).where(Entity.id.in_(list(adj.keys())))
        ent_res = await session.execute(ent_stmt)
        ent_map = {e.id: e for e in ent_res.scalars().all()}

        results: List[HiddenConnectionItem] = []
        seen_pairs = set()

        for a, neighbors_a in adj.items():
            for b, neighbors_b in adj.items():
                if a >= b:
                    continue
                common = set(neighbors_a).intersection(set(neighbors_b))
                if common and (a, b) not in seen_pairs:
                    seen_pairs.add((a, b))
                    e_a = ent_map.get(a)
                    e_b = ent_map.get(b)
                    if e_a and e_b:
                        inter_list = [{"id": str(mid), "name": ent_map.get(mid).name if mid in ent_map else str(mid)} for mid in common]
                        results.append(
                            HiddenConnectionItem(
                                connection_type="COMMON_ASSOCIATE",
                                source_entity={"id": str(a), "name": e_a.name, "type": e_a.entity_type},
                                target_entity={"id": str(b), "name": e_b.name, "type": e_b.entity_type},
                                intermediaries=inter_list,
                                hop_distance=2,
                                confidence=0.85,
                                evidence_basis=["Co-occurrence in case relationship network"],
                                description=f"{e_a.name} and {e_b.name} are indirectly connected via common associate(s).",
                            )
                        )
        return results[:10]

    async def _find_shared_resources_postgres(
        self,
        case_id: Optional[uuid.UUID],
        session: AsyncSession,
    ) -> List[SharedResourceItem]:
        """Find resources connected to >= 2 persons in PostgreSQL."""
        query = select(EntityRelationship)
        if case_id:
            query = query.where(EntityRelationship.case_id == case_id)
        res = await session.execute(query)
        rels = list(res.scalars().all())

        resource_links: Dict[uuid.UUID, List[uuid.UUID]] = {}
        for r in rels:
            resource_links.setdefault(r.target_entity_id, []).append(r.source_entity_id)

        items = []
        for res_id, person_ids in resource_links.items():
            distinct_persons = list(set(person_ids))
            if len(distinct_persons) >= 2:
                r_stmt = select(Entity).where(Entity.id == res_id)
                r_res = await session.execute(r_stmt)
                r_obj = r_res.scalar_one_or_none()
                if r_obj and r_obj.entity_type in ["PHONE", "VEHICLE", "BANK_ACCOUNT", "LOCATION"]:
                    p_stmt = select(Entity).where(Entity.id.in_(distinct_persons))
                    p_res = await session.execute(p_stmt)
                    persons = list(p_res.scalars().all())

                    items.append(
                        SharedResourceItem(
                            resource_id=str(r_obj.id),
                            resource_type=r_obj.entity_type,
                            resource_value=r_obj.name,
                            connected_persons=[{"id": str(p.id), "name": p.name} for p in persons],
                            case_ids=[str(case_id)] if case_id else [],
                        )
                    )
        return items

    async def _find_shortest_path_networkx(
        self,
        source_id: uuid.UUID,
        target_id: uuid.UUID,
        session: AsyncSession,
        max_depth: int,
    ) -> ShortestPathResponse:
        """Find shortest path using in-memory NetworkX traversal."""
        rel_stmt = select(EntityRelationship)
        rel_res = await session.execute(rel_stmt)
        relationships = list(rel_res.scalars().all())

        nodes_set = set()
        edges_list = []
        for r in relationships:
            nodes_set.add(r.source_entity_id)
            nodes_set.add(r.target_entity_id)
            edges_list.append({
                "source": str(r.source_entity_id),
                "target": str(r.target_entity_id),
                "relationship": r.relationship_type,
                "confidence": r.confidence * 100.0,
            })

        ent_stmt = select(Entity).where(Entity.id.in_(list(nodes_set)))
        ent_res = await session.execute(ent_stmt)
        ent_map = {str(e.id): e for e in ent_res.scalars().all()}

        nodes_payload = [{"id": k, "label": v.name, "type": v.entity_type} for k, v in ent_map.items()]
        nx_graph = self.networkx_engine.build_graph(nodes_payload, edges_list)

        path_nodes_ids = self.networkx_engine.find_shortest_path(nx_graph, str(source_id), str(target_id))

        if not path_nodes_ids or len(path_nodes_ids) > (max_depth + 1):
            return ShortestPathResponse(
                source_id=str(source_id),
                target_id=str(target_id),
                path_length=0,
                nodes=[],
                edges=[],
                evidence_chain=["No connection path found within depth limit."],
            )

        graph_nodes = []
        for nid in path_nodes_ids:
            e = ent_map.get(nid)
            graph_nodes.append(
                GraphNode(
                    id=nid,
                    label=e.name if e else nid,
                    type=e.entity_type.capitalize() if e else "Entity",
                    data={"name": e.name if e else nid},
                    confidence=1.0,
                )
            )

        graph_edges = []
        for i in range(len(path_nodes_ids) - 1):
            s = path_nodes_ids[i]
            t = path_nodes_ids[i + 1]
            graph_edges.append(
                GraphEdge(
                    id=f"edge-{s}-{t}",
                    source=s,
                    target=t,
                    relationship="CONNECTED_TO",
                    confidence=0.90,
                    evidence_basis=["Network traversal path"],
                )
            )

        return ShortestPathResponse(
            source_id=str(source_id),
            target_id=str(target_id),
            path_length=len(graph_edges),
            nodes=graph_nodes,
            edges=graph_edges,
            evidence_chain=[f"{e.relationship} ({e.confidence * 100:.0f}%)" for e in graph_edges],
        )

    async def _find_cross_case_postgres(self, session: AsyncSession) -> List[CrossCaseEntityItem]:
        """Find entities associated with multiple cases in PostgreSQL."""
        from collections import defaultdict
        ctx_stmt = (
            select(CaseEntityContext)
            .options(selectinload(CaseEntityContext.entity), selectinload(CaseEntityContext.case))
        )
        ctx_res = await session.execute(ctx_stmt)
        contexts = list(ctx_res.scalars().all())

        entity_cases = defaultdict(list)
        entity_lookup = {}

        for ctx in contexts:
            if ctx.entity and ctx.case:
                entity_lookup[ctx.entity_id] = ctx.entity
                entity_cases[ctx.entity_id].append({
                    "case_id": str(ctx.case_id),
                    "case_number": ctx.case.case_number,
                    "title": ctx.case.title,
                    "role": ctx.role,
                })

        items = []
        for ent_id, cases in entity_cases.items():
            if len(cases) > 1:
                e = entity_lookup[ent_id]
                items.append(
                    CrossCaseEntityItem(
                        entity_id=str(e.id),
                        name=e.name,
                        entity_type=e.entity_type,
                        cases=cases,
                        total_cases=len(cases),
                    )
                )

        return sorted(items, key=lambda x: x.total_cases, reverse=True)


# Singleton instance
graph_intelligence_service = GraphIntelligenceService()
