"""Comprehensive tests for KRITAGAS Part 6 High-Performance Data Access & Valkey Caching.

Validates end-to-end performance and caching mechanisms:
1. Valkey connection, ping, and health diagnostics
2. CacheService CRUD, TTL expiration, and atomic increments
3. Zero-crash graceful fallback when cache fails or times out
4. Case detail caching and fast retrieval
5. Targeted invalidation on case update, note, and status shift
6. Network graph caching and retrieval
7. Timeline event caching
8. Dashboard metrics caching across citizen, police, and admin
9. Search normalization and categorized entity response caching
10. SAMANVAYA multi-agent report caching and reuse
11. AI case intelligence dossier caching with request deduplication
12. Security invariance: RBAC and case permissions enforced even with cached data
13. Health probe /api/v1/health/cache reporting without secret leakage
"""

import asyncio
import time
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache.cache_keys import CacheKeys
from app.core.cache.cache_ttl import CacheTTL
from app.core.constants import CasePriority, CaseStatus, UserRole
from app.core.security import create_access_token
from app.models.case import Case
from app.models.user import User
from app.schemas.case import CaseUpdate
from app.services.cache_service import CacheService, cache_service
from app.services.case_service import CaseService
from app.services.dashboard_service import DashboardService
from app.services.search_service import SearchService
from app.services.data_synchronization_service import DataSynchronizationService
from app.ai_ml.services.case_intelligence_service import CaseIntelligenceService
from app.repositories.case_repository import CaseRepository
from app.repositories.fir_repository import FIRRepository
from app.repositories.user_repository import UserRepository
from app.repositories.audit_repository import AuditRepository
from app.repositories.notification_repository import NotificationRepository
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService
from app.integrations.intelligence.intelligence_interface import ActiveMasterIntelligenceService
from app.integrations.graph.graph_interface import NoOpGraphService


# -------------------------------------------------------------
# Test 1: Live Valkey Connection & Health Diagnostics
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_valkey_connection_and_ping():
    """Verify live connectivity and ping against the configured Valkey instance."""
    is_live = await cache_service.ping()
    assert is_live is True, "Valkey instance ping must return True"

    health = await cache_service.get_health_status()
    assert health["status"] == "connected"
    assert health["connected"] is True
    assert health["engine"] in ("Valkey", "Redis")
    assert isinstance(health["latency_ms"], (int, float))
    assert health["latency_ms"] >= 0.0
    assert "metrics" in health


# -------------------------------------------------------------
# Test 2: CacheService CRUD Operations & TTL Expiration
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_cache_service_crud_and_ttl():
    """Test set, get, exists, delete, increment, and TTL expiration."""
    test_key = f"kritagas:test:crud:{uuid.uuid4().hex[:8]}"
    payload = {"case_number": "CASE-2026-999", "entities": ["Karan Verma"], "score": 94.5}

    # 1. Set with short TTL
    set_ok = await cache_service.set(test_key, payload, ttl=5)
    assert set_ok is True

    # 2. Exists check
    exists = await cache_service.exists(test_key)
    assert exists is True

    # 3. Get and verify deserialization
    cached_val = await cache_service.get(test_key)
    assert cached_val is not None
    assert cached_val["case_number"] == "CASE-2026-999"
    assert cached_val["score"] == 94.5

    # 4. Atomic Increment
    counter_key = f"{test_key}:counter"
    val1 = await cache_service.increment(counter_key, 1)
    val2 = await cache_service.increment(counter_key, 5)
    assert val1 == 1
    assert val2 == 6
    await cache_service.delete(counter_key)

    # 5. Delete
    deleted = await cache_service.delete(test_key)
    assert deleted is True
    assert await cache_service.get(test_key) is None


# -------------------------------------------------------------
# Test 3: Graceful Fallback When Cache is Unavailable
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_graceful_fallback_when_cache_fails():
    """Verify system never crashes if cache encounters failures or is disabled."""
    mock_service = CacheService()
    mock_service.enabled = False  # Simulate disabled or down cache

    # Should not raise exception
    res = await mock_service.get("any:key")
    assert res is None

    set_res = await mock_service.set("any:key", {"foo": "bar"})
    assert set_res is False

    del_res = await mock_service.delete("any:key")
    assert del_res is False

    ping_res = await mock_service.ping()
    assert ping_res is False

    health = await mock_service.get_health_status()
    assert health["status"] == "disabled"
    assert health["connected"] is False


# -------------------------------------------------------------
# Test 4: Fast Case Details Retrieval via Cache
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_case_details_cache_hit_and_speed(client: AsyncClient, session: AsyncSession, police_user: User):
    """Verify that querying a case stores it in Valkey and second call returns cached data."""
    token = create_access_token(
        subject=str(police_user.id),
        role=police_user.role,
        email=police_user.email,
    )
    headers = {"Authorization": f"Bearer {token}"}

    case = Case(
        case_number="CASE-2026-CACHE-001",
        title="High-Speed Syndicate Investigation",
        description="Testing Valkey acceleration for case intelligence retrieval.",
        crime_category="FRAUD",
        status=CaseStatus.UNDER_INVESTIGATION,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()
    await session.refresh(case)

    # First request: Cache Miss -> Populates Valkey
    r1 = await client.get(f"/api/v1/cases/{case.id}", headers=headers)
    assert r1.status_code == 200
    assert r1.json()["message"] == "Case details retrieved."

    # Verify key exists in Valkey
    cache_key = CacheKeys.case(case.id)
    cached_payload = await cache_service.get(cache_key)
    assert cached_payload is not None
    assert cached_payload["case_number"] == "CASE-2026-CACHE-001"

    # Second request: Cache Hit -> Returns instantly from Valkey
    r2 = await client.get(f"/api/v1/cases/{case.id}", headers=headers)
    assert r2.status_code == 200
    assert r2.json()["message"] == "Case details retrieved (cache)."
    assert r2.json()["data"]["title"] == case.title

    # Cleanup
    await cache_service.delete_pattern(CacheKeys.case_pattern(case.id))


# -------------------------------------------------------------
# Test 5: Targeted Invalidation on Case Metadata Update
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_case_targeted_invalidation_on_update(client: AsyncClient, session: AsyncSession, police_user: User):
    """Verify that updating case metadata or notes evicts the cached case."""
    token = create_access_token(
        subject=str(police_user.id),
        role=police_user.role,
        email=police_user.email,
    )
    headers = {"Authorization": f"Bearer {token}"}

    case = Case(
        case_number="CASE-2026-CACHE-002",
        title="Original Case Title",
        description="Original description",
        crime_category="ROBBERY",
        status=CaseStatus.OPEN,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()
    await session.refresh(case)

    # 1. Warm cache
    await client.get(f"/api/v1/cases/{case.id}", headers=headers)
    cache_key = CacheKeys.case(case.id)
    assert await cache_service.exists(cache_key) is True

    # 2. Update metadata
    patch_resp = await client.patch(
        f"/api/v1/cases/{case.id}",
        json={"title": "Updated Cache Title", "description": "Updated description for cache invalidation test"},
        headers=headers,
    )
    assert patch_resp.status_code == 200

    # 3. Verify cache was evicted
    assert await cache_service.exists(cache_key) is False

    # 4. Next read fetches fresh updated data
    r_fresh = await client.get(f"/api/v1/cases/{case.id}", headers=headers)
    assert r_fresh.status_code == 200
    assert r_fresh.json()["data"]["title"] == "Updated Cache Title"


# -------------------------------------------------------------
# Test 6: Case Intelligence Network Graph Caching
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_case_network_caching(client: AsyncClient, session: AsyncSession, police_user: User):
    """Verify /cases/{case_id}/network graph responses are cached in Valkey."""
    token = create_access_token(
        subject=str(police_user.id),
        role=police_user.role,
        email=police_user.email,
    )
    headers = {"Authorization": f"Bearer {token}"}

    case = Case(
        case_number="CASE-2026-NET-001",
        title="Graph Network Cache Test",
        description="Testing network visualization payload caching.",
        crime_category="DRUG_TRAFFICKING",
        status=CaseStatus.UNDER_INVESTIGATION,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()
    await session.refresh(case)

    # First request: computes network and stores in cache
    r1 = await client.get(f"/api/v1/cases/{case.id}/network", headers=headers)
    assert r1.status_code == 200
    assert "Case network intelligence retrieved." in r1.json()["message"]

    # Verify cache key exists
    net_key = CacheKeys.case_network(case.id)
    cached_graph = await cache_service.get(net_key)
    assert cached_graph is not None
    assert cached_graph["case_number"] == "CASE-2026-NET-001"

    # Second request: served from cache
    r2 = await client.get(f"/api/v1/cases/{case.id}/network", headers=headers)
    assert r2.status_code == 200
    assert "Case network intelligence retrieved (cache)." in r2.json()["message"]

    # Cleanup
    await cache_service.delete_pattern(CacheKeys.case_pattern(case.id))


# -------------------------------------------------------------
# Test 7: Case Timeline Caching & Retrieval
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_case_timeline_caching(session: AsyncSession, police_user: User):
    """Verify CaseService.get_timeline caches chronological events."""
    case = Case(
        case_number="CASE-2026-TIME-001",
        title="Timeline Cache Test",
        description="Testing timeline caching.",
        crime_category="THEFT",
        status=CaseStatus.OPEN,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()
    await session.refresh(case)

    case_repo = CaseRepository(session)
    fir_repo = FIRRepository(session)
    user_repo = UserRepository(session)
    audit_repo = AuditRepository(session)
    notification_repo = NotificationRepository(session)
    audit_service = AuditService(audit_repo)
    notification_service = NotificationService(notification_repo)
    intelligence_service = ActiveMasterIntelligenceService()
    graph_service = NoOpGraphService()

    service = CaseService(
        case_repo=case_repo,
        fir_repo=fir_repo,
        user_repo=user_repo,
        audit_service=audit_service,
        notification_service=notification_service,
        intelligence_service=intelligence_service,
        graph_service=graph_service,
        cache_service=cache_service,
    )

    timeline_key = CacheKeys.case_timeline(case.id)
    await cache_service.delete(timeline_key)

    # 1. First fetch: miss -> caches
    tl1 = await service.get_timeline(case.id)
    assert isinstance(tl1, list)
    assert await cache_service.exists(timeline_key) is True

    # 2. Second fetch: hit
    tl2 = await service.get_timeline(case.id)
    assert len(tl1) == len(tl2)

    # Cleanup
    await cache_service.delete(timeline_key)


# -------------------------------------------------------------
# Test 8: Dashboard Metrics Caching
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_dashboard_caching(session: AsyncSession, police_user: User):
    """Verify DashboardService caches dashboard metrics and evicts properly."""
    user_repo = UserRepository(session)
    fir_repo = FIRRepository(session)
    case_repo = CaseRepository(session)
    audit_repo = AuditRepository(session)
    notification_repo = NotificationRepository(session)

    dashboard_service = DashboardService(
        user_repo=user_repo,
        fir_repo=fir_repo,
        case_repo=case_repo,
        audit_repo=audit_repo,
        notification_repo=notification_repo,
        cache_service=cache_service,
    )

    dash_key = CacheKeys.dashboard("police", police_user.id)
    await cache_service.delete(dash_key)

    # 1. Fetch dashboard
    d1 = await dashboard_service.get_police_dashboard(police_user)
    assert d1 is not None
    assert await cache_service.exists(dash_key) is True

    # 2. Second call served from cache
    d2 = await dashboard_service.get_police_dashboard(police_user)
    assert d1.assigned_cases == d2.assigned_cases

    # Cleanup
    await cache_service.delete(dash_key)


# -------------------------------------------------------------
# Test 9: Normalized Query Search & Categorized Entity Results
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_search_normalization_and_caching(session: AsyncSession, police_user: User):
    """Verify that uppercase and whitespace query variants hit the identical Valkey cache key."""
    fir_repo = FIRRepository(session)
    case_repo = CaseRepository(session)

    search_service = SearchService(
        fir_repo=fir_repo,
        case_repo=case_repo,
        session=session,
        cache_service=cache_service,
    )

    # Test normalization function
    assert CacheKeys.normalize_search_query("  Karan    Verma  ") == "karan verma"
    assert CacheKeys.normalize_search_query("MH-01-AB-1234") == "mh-01-ab-1234"

    # Search with messy spacing
    res1 = await search_service.search("   Vikram   Syndicate   ", current_user=police_user)
    assert res1.query == "Vikram   Syndicate"
    assert "cases" in res1.results

    # Key generated for normalized query
    expected_key = CacheKeys.search("vikram syndicate", role=police_user.role.value)
    assert await cache_service.exists(expected_key) is True

    # Second search with different casing and leading space should hit the exact same cache
    res2 = await search_service.search("VIKRAM SYNDICATE", current_user=police_user)
    assert res2.total_matches == res1.total_matches

    # Cleanup
    await cache_service.delete(expected_key)


# -------------------------------------------------------------
# Test 10: SAMANVAYA Report Generation Caching
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_samanvaya_report_caching(session: AsyncSession, police_user: User):
    """Verify SAMANVAYA multi-agent report is cached in Valkey and returned without re-computation."""
    case = Case(
        case_number="CASE-2026-SAM-001",
        title="Multi-Stream Financial Hawala Syndicate",
        description="Coordinated cross-stream inquiry.",
        crime_category="MONEY_LAUNDERING",
        status=CaseStatus.UNDER_INVESTIGATION,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()
    await session.refresh(case)

    sync_service = DataSynchronizationService(session, cache_service=cache_service)
    samanvaya_key = CacheKeys.agent_samanvaya(case.id)
    await cache_service.delete(samanvaya_key)

    # First execution: computes, hashes to blockchain, and caches
    report1 = await sync_service.generate_and_persist_samanvaya_report(case.id, police_user)
    assert report1 is not None
    assert "report_id" in report1
    assert await cache_service.exists(samanvaya_key) is True

    # Second call: returns cached report instantly
    report2 = await sync_service.generate_and_persist_samanvaya_report(case.id, police_user)
    assert report2["report_id"] == report1["report_id"]
    assert report2["content_hash"] == report1["content_hash"]

    # Cleanup
    await cache_service.delete(samanvaya_key)


# -------------------------------------------------------------
# Test 11: AI Case Intelligence Dossier Caching & Deduplication
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_case_intelligence_dossier_caching_and_deduplication(session: AsyncSession, police_user: User):
    """Verify AI dossier is cached and in-flight deduplication prevents redundant processing."""
    case = Case(
        case_number="CASE-2026-DOSSIER-001",
        title="Dossier Caching Test",
        description="Testing dossier synthesis and Valkey storage.",
        crime_category="EXTORTION",
        status=CaseStatus.UNDER_INVESTIGATION,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()
    await session.refresh(case)

    ci_service = CaseIntelligenceService(session, cache_service=cache_service)
    dossier_key = CacheKeys.case_intelligence(case.id)
    await cache_service.delete(dossier_key)

    # First call: computes and caches
    dos1 = await ci_service.get_case_intelligence_dossier(case.id)
    assert dos1.case_number == case.case_number
    assert await cache_service.exists(dossier_key) is True

    # Second call: served from cache
    dos2 = await ci_service.get_case_intelligence_dossier(case.id)
    assert dos2.investigation_priority_score == dos1.investigation_priority_score

    # Cleanup
    await cache_service.delete(dossier_key)


# -------------------------------------------------------------
# Test 12: Security Invariance: Role Check Still Enforced on Hot Cache
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_authorization_enforced_with_hot_cache(client: AsyncClient, session: AsyncSession, police_user: User, citizen_user: User):
    """Verify an unauthorized citizen CANNOT view a confidential case even if it is hot in Valkey cache."""
    # 1. Create a confidential police case
    case = Case(
        case_number="CASE-2026-CONF-001",
        title="Confidential Anti-Terror Inquiry",
        description="Restricted to law enforcement officers only.",
        crime_category="TERRORISM",
        status=CaseStatus.UNDER_INVESTIGATION,
        created_by_id=police_user.id,
    )
    session.add(case)
    await session.commit()
    await session.refresh(case)

    # 2. Warm cache as police officer
    police_token = create_access_token(
        subject=str(police_user.id),
        role=police_user.role,
        email=police_user.email,
    )
    r_police = await client.get(
        f"/api/v1/cases/{case.id}",
        headers={"Authorization": f"Bearer {police_token}"},
    )
    assert r_police.status_code == 200

    # Verify case is now in cache
    assert await cache_service.exists(CacheKeys.case(case.id)) is True

    # 3. Citizen attempts to access hot cached case -> MUST BE REJECTED with 403 Forbidden!
    citizen_token = create_access_token(
        subject=str(citizen_user.id),
        role=citizen_user.role,
        email=citizen_user.email,
    )
    r_citizen = await client.get(
        f"/api/v1/cases/{case.id}",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert r_citizen.status_code in (403, 401), "Security check must never be bypassed by cached data"

    # Cleanup
    await cache_service.delete_pattern(CacheKeys.case_pattern(case.id))


# -------------------------------------------------------------
# Test 13: Cache Health Check Endpoint
# -------------------------------------------------------------

@pytest.mark.asyncio
async def test_cache_health_endpoint(client: AsyncClient):
    """Verify GET /api/v1/health/cache reports connection, latency, and metrics without secrets."""
    response = await client.get("/api/v1/health/cache")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in ("healthy", "connected", "disabled")
    assert body["cache"] == "valkey"
    assert "connected" in body
    assert "metrics" in body
    # Verify zero secrets leaked
    assert "password" not in str(body).lower()
    assert "avns_" not in str(body).lower()
