"""Neo4j Parameterized Cypher Repository for KRITAGAS.

Provides safe, parameterized, zero-injection graph access primitives for criminal
network queries, multi-hop traversals, shortest paths, and shared resource detection.
"""

from typing import Any, Dict, List, Optional, Set
from app.core.logging import get_logger
from app.core.neo4j.client import Neo4jClient

logger = get_logger("kritagas.neo4j.repo")

# Whitelist allowed node labels to prevent label injection
ALLOWED_LABELS: Set[str] = {
    "Person",
    "Phone",
    "Vehicle",
    "Location",
    "Organization",
    "Account",
    "Transaction",
    "Case",
    "FIR",
    "Evidence",
    "Entity",
}

# Whitelist allowed relationship types to prevent syntax manipulation
ALLOWED_REL_TYPES: Set[str] = {
    "INVOLVED_IN",
    "MENTIONED_IN",
    "ASSOCIATED_WITH",
    "CONNECTED_TO",
    "OWNS",
    "USES",
    "CALLED",
    "COMMUNICATED_WITH",
    "TRANSFERRED_TO",
    "TRANSFERRED_MONEY_TO",
    "LOCATED_AT",
    "LIVES_AT",
    "WORKS_FOR",
    "EMPLOYED_BY",
    "FAMILY_OF",
    "OBSERVED_AT",
    "ORIGINATED_FROM",
    "ATTACHED_EVIDENCE",
    "LINKED_TO",
    "SUPPORTED_BY",
}


class GraphRepository:
    """Repository handling all Cypher query execution on Neo4j."""

    def __init__(self, client: Neo4jClient):
        self.client = client

    def _sanitize_label(self, raw_label: str) -> str:
        """Sanitize and map entity type to validated Neo4j node label."""
        cleaned = raw_label.strip().capitalize()
        # Common aliases
        mapping = {
            "Bank_account": "Account",
            "Bankaccount": "Account",
            "Financial_record": "Transaction",
            "Cdr": "Phone",
            "Call_record": "Phone",
            "Telephone": "Phone",
        }
        normalized = mapping.get(cleaned, cleaned)
        return normalized if normalized in ALLOWED_LABELS else "Entity"

    def _sanitize_rel_type(self, raw_type: str) -> str:
        """Sanitize and uppercase relationship type."""
        cleaned = raw_type.strip().upper().replace(" ", "_").replace("-", "_")
        return cleaned if cleaned in ALLOWED_REL_TYPES else "ASSOCIATED_WITH"

    async def upsert_case_node(
        self,
        case_id: str,
        case_number: str,
        title: str,
        crime_category: str,
        status: str,
    ) -> Dict[str, Any]:
        """Merge a Case vertex into the graph."""
        cypher = """
        MERGE (c:Case {id: $case_id})
        ON CREATE SET
            c.case_number = $case_number,
            c.title = $title,
            c.crime_category = $crime_category,
            c.status = $status,
            c.created_at = datetime()
        ON MATCH SET
            c.case_number = $case_number,
            c.title = $title,
            c.crime_category = $crime_category,
            c.status = $status,
            c.updated_at = datetime()
        RETURN c.id AS id, c.case_number AS case_number, c.title AS title
        """
        records = await self.client.execute_query(
            cypher,
            {
                "case_id": str(case_id),
                "case_number": case_number,
                "title": title,
                "crime_category": crime_category,
                "status": status,
            },
        )
        return records[0] if records else {}

    async def upsert_entity_node(
        self,
        entity_id: str,
        entity_type: str,
        name: str,
        normalized_name: str,
        confidence: float = 1.0,
        source: Optional[str] = None,
        properties: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Merge an Entity node into the graph with appropriate label."""
        label = self._sanitize_label(entity_type)
        props = properties or {}

        cypher = f"""
        MERGE (n:{label} {{id: $entity_id}})
        ON CREATE SET
            n.name = $name,
            n.normalized_name = $normalized_name,
            n.confidence = $confidence,
            n.source = $source,
            n.type = $raw_type,
            n += $props,
            n.created_at = datetime()
        ON MATCH SET
            n.name = $name,
            n.normalized_name = $normalized_name,
            n.confidence = $confidence,
            n.source = $source,
            n.type = $raw_type,
            n += $props,
            n.updated_at = datetime()
        RETURN n.id AS id, n.name AS name, labels(n) AS labels
        """
        records = await self.client.execute_query(
            cypher,
            {
                "entity_id": str(entity_id),
                "name": name,
                "normalized_name": normalized_name,
                "confidence": float(confidence),
                "source": source or "KRITAGAS_EXTRACTION",
                "raw_type": entity_type,
                "props": props,
            },
        )
        return records[0] if records else {}

    async def upsert_relationship(
        self,
        source_id: str,
        target_id: str,
        relationship_type: str,
        confidence: float = 1.0,
        case_id: Optional[str] = None,
        evidence_basis: Optional[List[str]] = None,
        properties: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Merge a directed relationship between two entities."""
        rel_type = self._sanitize_rel_type(relationship_type)
        props = properties or {}

        cypher = f"""
        MATCH (src {{id: $source_id}}), (tgt {{id: $target_id}})
        MERGE (src)-[r:{rel_type}]->(tgt)
        ON CREATE SET
            r.confidence = $confidence,
            r.case_id = $case_id,
            r.evidence_basis = $evidence_basis,
            r += $props,
            r.created_at = datetime()
        ON MATCH SET
            r.confidence = $confidence,
            r.evidence_basis = $evidence_basis,
            r += $props,
            r.updated_at = datetime()
        RETURN type(r) AS type, src.id AS source, tgt.id AS target
        """
        records = await self.client.execute_query(
            cypher,
            {
                "source_id": str(source_id),
                "target_id": str(target_id),
                "confidence": float(confidence),
                "case_id": str(case_id) if case_id else "",
                "evidence_basis": evidence_basis or ["AI Analysis"],
                "props": props,
            },
        )
        return records[0] if records else {}

    async def link_entity_to_case(
        self,
        entity_id: str,
        case_id: str,
        role: str = "INVOLVED_IN",
        confidence: float = 1.0,
    ) -> Dict[str, Any]:
        """Establish direct investigative relationship from Entity to Case."""
        cypher = """
        MATCH (e {id: $entity_id}), (c:Case {id: $case_id})
        MERGE (e)-[r:INVOLVED_IN]->(c)
        ON CREATE SET r.role = $role, r.confidence = $confidence, r.created_at = datetime()
        ON MATCH SET r.role = $role, r.confidence = $confidence, r.updated_at = datetime()
        RETURN e.id AS entity_id, c.id AS case_id, r.role AS role
        """
        records = await self.client.execute_query(
            cypher,
            {
                "entity_id": str(entity_id),
                "case_id": str(case_id),
                "role": role,
                "confidence": float(confidence),
            },
        )
        return records[0] if records else {}

    async def get_case_subgraph(self, case_id: str) -> Dict[str, Any]:
        """Fetch all nodes and relationships connected to a specific investigation case."""
        cypher = """
        MATCH (c:Case {id: $case_id})
        OPTIONAL MATCH (c)<-[r1]-(n)
        OPTIONAL MATCH (n)-[r2]-(m)
        WHERE (m)-[]-(c) OR m.id = c.id
        WITH collect(DISTINCT c) + collect(DISTINCT n) + collect(DISTINCT m) AS all_nodes,
             collect(DISTINCT r1) + collect(DISTINCT r2) AS all_rels
        UNWIND all_nodes AS node
        WITH collect(DISTINCT node) AS distinct_nodes, all_rels
        UNWIND all_rels AS rel
        RETURN distinct_nodes AS nodes, collect(DISTINCT rel) AS edges
        """
        records = await self.client.execute_query(cypher, {"case_id": str(case_id)})
        if not records or not records[0].get("nodes"):
            # Fallback query: just the case node itself
            case_node = await self.client.execute_query(
                "MATCH (c:Case {id: $case_id}) RETURN [c] AS nodes, [] AS edges",
                {"case_id": str(case_id)},
            )
            return case_node[0] if case_node else {"nodes": [], "edges": []}

        return records[0]

    async def find_shortest_path(
        self,
        source_id: str,
        target_id: str,
        max_depth: int = 4,
    ) -> List[Dict[str, Any]]:
        """Find the shortest connection path between two entities up to max_depth."""
        depth = max(1, min(max_depth, 6))
        cypher = f"""
        MATCH (src {{id: $source_id}}), (tgt {{id: $target_id}}),
        p = shortestPath((src)-[*..{depth}]-(tgt))
        RETURN [n IN nodes(p) | {{
            id: n.id,
            name: coalesce(n.name, n.case_number, n.title, n.id),
            label: head(labels(n)),
            type: coalesce(n.type, head(labels(n)))
        }}] AS path_nodes,
        [r IN relationships(p) | {{
            source: startNode(r).id,
            target: endNode(r).id,
            type: type(r),
            confidence: coalesce(r.confidence, 1.0),
            evidence_basis: coalesce(r.evidence_basis, [])
        }}] AS path_edges,
        length(p) AS length
        """
        return await self.client.execute_query(
            cypher,
            {"source_id": str(source_id), "target_id": str(target_id)},
        )

    async def find_common_associates(
        self,
        entity_a_id: str,
        entity_b_id: str,
    ) -> List[Dict[str, Any]]:
        """Find intermediate entities that connect both Entity A and Entity B."""
        cypher = """
        MATCH (a {id: $entity_a_id})-[r1]-(c)-[r2]-(b {id: $entity_b_id})
        WHERE c.id <> $entity_a_id AND c.id <> $entity_b_id
        RETURN c.id AS intermediary_id,
               coalesce(c.name, c.case_number, c.id) AS intermediary_name,
               head(labels(c)) AS intermediary_type,
               type(r1) AS rel_to_a,
               type(r2) AS rel_to_b,
               coalesce(r1.confidence, 1.0) AS confidence_a,
               coalesce(r2.confidence, 1.0) AS confidence_b
        """
        return await self.client.execute_query(
            cypher,
            {"entity_a_id": str(entity_a_id), "entity_b_id": str(entity_b_id)},
        )

    async def find_shared_resources(self, case_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Discover Phones, Bank Accounts, Vehicles, or Locations shared between >= 2 Persons."""
        case_filter = "AND (p1)-[:INVOLVED_IN]->(:Case {id: $case_id}) AND (p2)-[:INVOLVED_IN]->(:Case {id: $case_id})" if case_id else ""
        cypher = f"""
        MATCH (p1:Person)-[r1]->(res)<-[r2]-(p2:Person)
        WHERE p1.id < p2.id {case_filter}
          AND any(l IN labels(res) WHERE l IN ['Phone', 'Account', 'Vehicle', 'Location'])
        RETURN res.id AS resource_id,
               coalesce(res.name, res.phone_number, res.registration_number, res.id) AS resource_value,
               head(labels(res)) AS resource_type,
               collect(DISTINCT {{
                   id: p1.id,
                   name: p1.name,
                   relationship: type(r1)
               }}) + collect(DISTINCT {{
                   id: p2.id,
                   name: p2.name,
                   relationship: type(r2)
               }}) AS connected_persons,
               collect(DISTINCT coalesce(r1.case_id, r2.case_id, '')) AS case_ids
        """
        params = {"case_id": str(case_id)} if case_id else {}
        return await self.client.execute_query(cypher, params)

    async def find_cross_case_entities(self) -> List[Dict[str, Any]]:
        """Discover entities that participate in more than one distinct investigation case."""
        cypher = """
        MATCH (e)-[r:INVOLVED_IN]->(c:Case)
        WHERE NOT e:Case
        WITH e, count(DISTINCT c) AS case_count, collect(DISTINCT {
            case_id: c.id,
            case_number: c.case_number,
            title: c.title,
            role: coalesce(r.role, 'INVOLVED_IN')
        }) AS cases
        WHERE case_count > 1
        RETURN e.id AS entity_id,
               coalesce(e.name, e.id) AS name,
               head(labels(e)) AS entity_type,
               cases,
               case_count AS total_cases
        ORDER BY case_count DESC
        """
        return await self.client.execute_query(cypher)

    async def calculate_degree_centrality(self, case_id: str) -> List[Dict[str, Any]]:
        """Calculate direct degree centrality (connection density) per entity in a case."""
        cypher = """
        MATCH (c:Case {id: $case_id})<-[:INVOLVED_IN]-(n)
        MATCH (n)-[r]-()
        WITH n, count(DISTINCT r) AS degree
        RETURN n.id AS entity_id,
               coalesce(n.name, n.id) AS entity_name,
               head(labels(n)) AS entity_type,
               degree
        ORDER BY degree DESC
        """
        return await self.client.execute_query(cypher, {"case_id": str(case_id)})

    async def get_graph_statistics(self, case_id: str) -> Dict[str, Any]:
        """Aggregate high-level node and edge metrics for a case."""
        cypher = """
        MATCH (c:Case {id: $case_id})
        OPTIONAL MATCH (c)<-[r1]-(n)
        OPTIONAL MATCH (n)-[r2]-(m)
        WHERE (m)-[]-(c) OR m.id = c.id
        WITH collect(DISTINCT c) + collect(DISTINCT n) + collect(DISTINCT m) AS nodes,
             collect(DISTINCT r1) + collect(DISTINCT r2) AS edges
        RETURN size(nodes) AS node_count, size(edges) AS edge_count
        """
        records = await self.client.execute_query(cypher, {"case_id": str(case_id)})
        if records:
            return records[0]
        return {"node_count": 0, "edge_count": 0}
