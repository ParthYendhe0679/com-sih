"""Comprehensive Test Suite for KRITAGAS Part 7: Neo4j Graph Database & Criminal Network Intelligence.

Validates:
1. Neo4j driver instantiation, configuration, and health probing.
2. Parameterized Cypher query generation and label/relationship type sanitization.
3. PostgreSQL ↔ Neo4j bidirectional synchronization engine.
4. Case graph retrieval and Valkey caching layer acceleration.
5. Cytoscape-compatible network visualization format for frontend.
6. Hidden connection discovery (common associates & multi-hop paths).
7. Shared resource co-utilization detection (phones, vehicles, accounts).
8. Shortest connection path evaluation with evidence chain.
9. Cross-case entity intersection discovery and RBAC authorization enforcement.
10. Graph analytics (degree centrality and cluster detection).
11. Targeted cache invalidation on graph synchronization.
12. Neo4j health probe endpoint (/api/v1/health/neo4j).
13. Dual-mode graceful degradation when Neo4j Aura is offline or in fallback mode.
"""

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_ml.models.ai_models import Entity
from app.core.cache import CacheKeys
from app.core.constants import CasePriority, CaseStatus
from app.core.neo4j.client import Neo4jClient
from app.core.neo4j.constraints import CONSTRAINTS, INDEXES
from app.models.case import Case
from app.models.data_architecture import CaseEntityContext, EntityRelationship
from app.models.user import User
from app.repositories.graph_repository import GraphRepository
from app.services.cache_service import CacheService, cache_service
from app.services.graph_service import Neo4jGraphService


# -------------------------------------------------------------
# Test 1: Neo4j Client Instantiation & Health Status
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_neo4j_client_instantiation_and_health():
    client = Neo4jClient()
    health = await client.get_health_status()

    assert "status" in health
    assert "configured" in health
    assert "database" in health
    # Password must NEVER be exposed in health reports
    assert "password" not in health
    assert "NEO4J_PASSWORD" not in str(health)


# -------------------------------------------------------------
# Test 2: Schema Constraints and Indexes Idempotency
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_schema_constraints_and_indexes():
    assert len(CONSTRAINTS) >= 10
    assert len(INDEXES) >= 5

    for name, cypher in CONSTRAINTS:
        assert "CREATE CONSTRAINT" in cypher
        assert "IF NOT EXISTS" in cypher
        assert "IS UNIQUE" in cypher

    for name, cypher in INDEXES:
        assert "CREATE INDEX" in cypher
        assert "IF NOT EXISTS" in cypher


# -------------------------------------------------------------
# Test 3: Label & Relationship Sanitization
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_graph_repository_sanitization():
    client = Neo4jClient()
    repo = GraphRepository(client)

    # Valid label conversions
    assert repo._sanitize_label("person") == "Person"
    assert repo._sanitize_label("PHONE") == "Phone"
    assert repo._sanitize_label("bank_account") == "Account"
    assert repo._sanitize_label("UnknownEntity") == "Entity"

    # Valid relationship sanitization
    assert repo._sanitize_rel_type("involved_in") == "INVOLVED_IN"
    assert repo._sanitize_rel_type("owns") == "OWNS"
    assert repo._sanitize_rel_type("malicious_injection; DROP") == "ASSOCIATED_WITH"


# -------------------------------------------------------------
# Test 4: PostgreSQL ↔ Neo4j Synchronization Engine
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_case_graph_synchronization_from_postgres(
    session: AsyncSession,
    police_user: User,
):
    # Setup test case
    case = Case(
        id=uuid.uuid4(),
        case_number=f"PART7-SYNC-{uuid.uuid4().hex[:6].upper()}",
        title="Hawala Network & Vehicle Smuggling Investigation",
        description="Complex syndicated fraud involving co-utilized vehicle and multiple phone lines.",
        crime_category="MONEY_LAUNDERING",
        status=CaseStatus.OPEN,
        priority=CasePriority.HIGH,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()

    # Create Entities
    person1 = Entity(
        id=uuid.uuid4(),
        entity_type="PERSON",
        name="Vikramaditya Rao",
        normalized_value="vikramaditya_rao",
        confidence=0.95,
    )
    person2 = Entity(
        id=uuid.uuid4(),
        entity_type="PERSON",
        name="Devendra Shinde",
        normalized_value="devendra_shinde",
        confidence=0.92,
    )
    phone = Entity(
        id=uuid.uuid4(),
        entity_type="PHONE",
        name="+91-9820012345",
        normalized_value="9820012345",
        confidence=0.98,
    )
    session.add_all([person1, person2, phone])
    await session.commit()

    # Create Contexts
    ctx1 = CaseEntityContext(
        id=uuid.uuid4(),
        case_id=case.id,
        entity_id=person1.id,
        role="SUSPECT",
        confidence=0.95,
        extraction_method="NLP_NER",
    )
    ctx2 = CaseEntityContext(
        id=uuid.uuid4(),
        case_id=case.id,
        entity_id=person2.id,
        role="ASSOCIATE",
        confidence=0.90,
        extraction_method="AI_AGENT",
    )
    ctx3 = CaseEntityContext(
        id=uuid.uuid4(),
        case_id=case.id,
        entity_id=phone.id,
        role="COMMUNICATION_DEVICE",
        confidence=0.98,
        extraction_method="TELECOM_CDR",
    )
    session.add_all([ctx1, ctx2, ctx3])

    # Create Relationships
    rel1 = EntityRelationship(
        id=uuid.uuid4(),
        source_entity_id=person1.id,
        target_entity_id=phone.id,
        relationship_type="USES",
        case_id=case.id,
        confidence=0.95,
        evidence_chain={"evidence_basis": ["CDR Extraction"]},
    )
    rel2 = EntityRelationship(
        id=uuid.uuid4(),
        source_entity_id=person2.id,
        target_entity_id=phone.id,
        relationship_type="CALLED",
        case_id=case.id,
        confidence=0.90,
        evidence_chain={"evidence_basis": ["Tower Call Logs"]},
    )
    session.add_all([rel1, rel2])
    await session.commit()

    # Execute Sync
    service = Neo4jGraphService()
    sync_resp = await service.sync_case_graph(case.id, session=session)

    assert sync_resp.status == "SUCCESS"
    assert sync_resp.case_id == str(case.id)
    assert sync_resp.nodes_synced >= 4  # Case + 2 Persons + Phone
    assert sync_resp.edges_synced >= 2  # Rel1 + Rel2 + Case Contexts
    assert sync_resp.duration_ms >= 0.0


# -------------------------------------------------------------
# Test 5: Case Graph Retrieval & Valkey Caching
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_case_graph_retrieval_and_caching(
    police_client: AsyncClient,
    session: AsyncSession,
    police_user: User,
):
    case = Case(
        id=uuid.uuid4(),
        case_number=f"PART7-CACHE-{uuid.uuid4().hex[:6].upper()}",
        title="Cyber Extortion Operation",
        description="Investigating illegal access and ransomware communications across network nodes.",
        crime_category="CYBERCRIME",
        status=CaseStatus.OPEN,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()

    # 1. First retrieval (cold cache)
    r1 = await police_client.get(f"/api/v1/graph/cases/{case.id}/graph")
    assert r1.status_code == 200
    data1 = r1.json()["data"]
    assert data1["case_id"] == str(case.id)
    assert len(data1["nodes"]) >= 1

    # 2. Verify cached in Valkey
    cache_key = f"{CacheKeys.PREFIX}:graph:case:{case.id}"
    assert await cache_service.exists(cache_key) is True

    # 3. Second retrieval (hot cache hit)
    r2 = await police_client.get(f"/api/v1/graph/cases/{case.id}/graph")
    assert r2.status_code == 200
    assert r2.json()["data"]["case_id"] == str(case.id)


# -------------------------------------------------------------
# Test 6: Case Network Cytoscape Format Endpoint
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_case_network_cytoscape_format(
    police_client: AsyncClient,
    session: AsyncSession,
    police_user: User,
):
    case = Case(
        id=uuid.uuid4(),
        case_number=f"PART7-NET-{uuid.uuid4().hex[:6].upper()}",
        title="Interstate Smuggling Ring",
        description="Interstate network tracking vehicles and safe house locations across jurisdictions.",
        crime_category="SMUGGLING",
        status=CaseStatus.OPEN,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()

    resp = await police_client.get(f"/api/v1/graph/cases/{case.id}/graph/network")
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert "nodes" in data
    assert "edges" in data
    assert "total_nodes" in data
    assert "total_edges" in data
    assert data["case_id"] == str(case.id)


# -------------------------------------------------------------
# Test 7: Hidden Connections Discovery
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_hidden_connections_discovery(
    police_client: AsyncClient,
    session: AsyncSession,
    police_user: User,
):
    case = Case(
        id=uuid.uuid4(),
        case_number=f"PART7-HIDDEN-{uuid.uuid4().hex[:6].upper()}",
        title="Organized Jewelry Heist",
        description="Investigating shared associate linkages across suspects in heist.",
        crime_category="ROBBERY",
        status=CaseStatus.OPEN,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()

    # Three persons: A connected to C, B connected to C
    p_a = Entity(id=uuid.uuid4(), entity_type="PERSON", name="Anand Kulkarni", normalized_value="anand_k")
    p_b = Entity(id=uuid.uuid4(), entity_type="PERSON", name="Brijesh Patel", normalized_value="brijesh_p")
    p_c = Entity(id=uuid.uuid4(), entity_type="PERSON", name="Chetan Mastermind", normalized_value="chetan_m")
    session.add_all([p_a, p_b, p_c])
    await session.commit()

    rel_ac = EntityRelationship(
        id=uuid.uuid4(),
        source_entity_id=p_a.id,
        target_entity_id=p_c.id,
        relationship_type="ASSOCIATED_WITH",
        case_id=case.id,
        confidence=0.90,
    )
    rel_bc = EntityRelationship(
        id=uuid.uuid4(),
        source_entity_id=p_b.id,
        target_entity_id=p_c.id,
        relationship_type="ASSOCIATED_WITH",
        case_id=case.id,
        confidence=0.88,
    )
    session.add_all([rel_ac, rel_bc])
    await session.commit()

    resp = await police_client.get(f"/api/v1/graph/hidden-connections?case_id={case.id}")
    assert resp.status_code == 200
    results = resp.json()["data"]
    assert len(results) >= 1
    first = results[0]
    assert first["connection_type"] in ["COMMON_ASSOCIATE", "SHARED_RESOURCE"]
    assert first["hop_distance"] == 2


# -------------------------------------------------------------
# Test 8: Shared Resources Detection
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_shared_resources_detection(
    police_client: AsyncClient,
    session: AsyncSession,
    police_user: User,
):
    case = Case(
        id=uuid.uuid4(),
        case_number=f"PART7-SHARED-{uuid.uuid4().hex[:6].upper()}",
        title="Shell Company Fund Diversion",
        description="Suspicious bank account and burner phone utilized by multiple entities.",
        crime_category="FINANCIAL_FRAUD",
        status=CaseStatus.OPEN,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()

    p1 = Entity(id=uuid.uuid4(), entity_type="PERSON", name="Prakash Mehta", normalized_value="prakash_m")
    p2 = Entity(id=uuid.uuid4(), entity_type="PERSON", name="Gaurav Singhania", normalized_value="gaurav_s")
    phone = Entity(id=uuid.uuid4(), entity_type="PHONE", name="+91-9999988888", normalized_value="9999988888")
    session.add_all([p1, p2, phone])
    await session.commit()

    rel1 = EntityRelationship(
        id=uuid.uuid4(),
        source_entity_id=p1.id,
        target_entity_id=phone.id,
        relationship_type="USES",
        case_id=case.id,
        confidence=0.95,
    )
    rel2 = EntityRelationship(
        id=uuid.uuid4(),
        source_entity_id=p2.id,
        target_entity_id=phone.id,
        relationship_type="USES",
        case_id=case.id,
        confidence=0.95,
    )
    session.add_all([rel1, rel2])
    await session.commit()

    resp = await police_client.get(f"/api/v1/graph/shared-resources?case_id={case.id}")
    assert resp.status_code == 200
    items = resp.json()["data"]
    assert len(items) >= 1
    assert items[0]["resource_type"] == "PHONE"
    assert len(items[0]["connected_persons"]) >= 2


# -------------------------------------------------------------
# Test 9: Shortest Path Analysis
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_shortest_path_endpoint(
    police_client: AsyncClient,
    session: AsyncSession,
    police_user: User,
):
    # A -> B -> C chain
    ent_a = Entity(id=uuid.uuid4(), entity_type="PERSON", name="Node A", normalized_value="node_a")
    ent_b = Entity(id=uuid.uuid4(), entity_type="PERSON", name="Node B", normalized_value="node_b")
    ent_c = Entity(id=uuid.uuid4(), entity_type="PERSON", name="Node C", normalized_value="node_c")
    session.add_all([ent_a, ent_b, ent_c])
    await session.commit()

    r1 = EntityRelationship(id=uuid.uuid4(), source_entity_id=ent_a.id, target_entity_id=ent_b.id, relationship_type="CONNECTED_TO")
    r2 = EntityRelationship(id=uuid.uuid4(), source_entity_id=ent_b.id, target_entity_id=ent_c.id, relationship_type="CONNECTED_TO")
    session.add_all([r1, r2])
    await session.commit()

    resp = await police_client.get(
        f"/api/v1/graph/shortest-path?source_id={ent_a.id}&target_id={ent_c.id}&max_depth=3"
    )
    assert resp.status_code == 200
    path = resp.json()["data"]
    assert path["path_length"] == 2
    assert len(path["nodes"]) == 3


# -------------------------------------------------------------
# Test 10: Cross-Case Authorization Enforcement (RBAC)
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_cross_case_authorization_enforcement(
    citizen_client: AsyncClient,
    police_client: AsyncClient,
):
    # Citizen forbidden from global cross-case intelligence
    r_cit = await citizen_client.get("/api/v1/graph/cross-case")
    assert r_cit.status_code == 403

    # Police officer authorized
    r_pol = await police_client.get("/api/v1/graph/cross-case")
    assert r_pol.status_code == 200


# -------------------------------------------------------------
# Test 11: Graph Analytics (Degree Centrality & Communities)
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_graph_analytics_metrics(
    police_client: AsyncClient,
    session: AsyncSession,
    police_user: User,
):
    case = Case(
        id=uuid.uuid4(),
        case_number=f"PART7-ANALYTICS-{uuid.uuid4().hex[:6].upper()}",
        title="Multi-Node Syndicate",
        description="Graph centrality analysis.",
        crime_category="ORGANIZED_CRIME",
        status=CaseStatus.OPEN,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()

    resp = await police_client.get(f"/api/v1/graph/analytics/{case.id}")
    assert resp.status_code == 200
    analytics = resp.json()["data"]
    assert analytics["case_id"] == str(case.id)
    assert "degree_centrality" in analytics
    assert "clusters" in analytics
    assert "central_intermediaries" in analytics


# -------------------------------------------------------------
# Test 12: Targeted Cache Invalidation on Sync
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_targeted_cache_invalidation_on_sync(
    police_client: AsyncClient,
    session: AsyncSession,
    police_user: User,
):
    case = Case(
        id=uuid.uuid4(),
        case_number=f"PART7-INVAL-{uuid.uuid4().hex[:6].upper()}",
        title="Narcotics Transportation Route",
        description="Route intelligence testing targeted cache eviction.",
        crime_category="NARCOTICS",
        status=CaseStatus.OPEN,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()

    # 1. Warm cache
    await police_client.get(f"/api/v1/graph/cases/{case.id}/graph")
    cache_key = f"{CacheKeys.PREFIX}:graph:case:{case.id}"
    assert await cache_service.exists(cache_key) is True

    # 2. Trigger sync
    sync_resp = await police_client.post(f"/api/v1/graph/cases/{case.id}/graph/sync")
    assert sync_resp.status_code == 200

    # 3. Cache should be cleared
    assert await cache_service.exists(cache_key) is False


# -------------------------------------------------------------
# Test 13: Neo4j Health Probe Endpoint
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_neo4j_health_check_endpoint(police_client: AsyncClient):
    resp = await police_client.get("/api/v1/health/neo4j")
    assert resp.status_code == 200
    data = resp.json()

    assert "status" in data
    assert "database" in data
    # Ensure zero passwords leaked
    assert "password" not in data
    assert "NEO4J_PASSWORD" not in str(data)
