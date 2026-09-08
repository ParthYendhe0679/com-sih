"""Graph Intelligence & Criminal Network Endpoints for KRITAGAS.

Provides graph retrieval, PostgreSQL ↔ Neo4j synchronization, hidden connection discovery,
shared resource detection, shortest path analysis, cross-case entity resolution,
and network analytics metrics.
"""

from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_async_session,
    get_case_service,
    get_current_user,
    get_fir_service,
    get_graph_intelligence_service,
    get_graph_service,
    require_roles,
)
from app.core.constants import UserRole
from app.core.exceptions import PermissionDeniedException
from app.models.user import User
from app.schemas.common import APIResponse
from app.schemas.graph import (
    CaseGraphResponse,
    CaseNetworkResponse,
    CrossCaseEntityItem,
    GraphAnalyticsResponse,
    GraphStatistics,
    GraphSyncResponse,
    HiddenConnectionItem,
    SharedResourceItem,
    ShortestPathResponse,
)
from app.services.case_service import CaseService
from app.services.fir_service import FIRService
from app.services.graph_intelligence_service import GraphIntelligenceService
from app.services.graph_service import Neo4jGraphService
from app.utils.response import success_response

router = APIRouter()


# -------------------------------------------------------------
# 1. Case Graph Retrieval & Synchronization
# -------------------------------------------------------------

@router.get(
    "/cases/{case_id}/graph",
    response_model=APIResponse[CaseGraphResponse],
    summary="Get Case Graph",
    description="Retrieve comprehensive graph representation (nodes, relationships, and metrics) for an investigation case.",
)
async def get_case_graph(
    case_id: str,
    current_user: User = Depends(get_current_user),
    case_service: CaseService = Depends(get_case_service),
    graph_service: Neo4jGraphService = Depends(get_graph_service),
    session: AsyncSession = Depends(get_async_session),
):
    # Enforce case access permissions and resolve canonical UUID
    case = await case_service.get_case_by_id(case_id, current_user=current_user)

    data = await graph_service.get_case_graph(case.id, session=session)
    return success_response(data=data, message=f"Case graph retrieved ({data.engine}).")


@router.get(
    "/cases/{case_id}/graph/network",
    response_model=APIResponse[CaseNetworkResponse],
    summary="Get Case Network Visualization",
    description="Retrieve Cytoscape-formatted network graph specifically mapped for the Next.js frontend.",
)
async def get_case_network(
    case_id: str,
    current_user: User = Depends(get_current_user),
    case_service: CaseService = Depends(get_case_service),
    graph_service: Neo4jGraphService = Depends(get_graph_service),
    session: AsyncSession = Depends(get_async_session),
):
    case = await case_service.get_case_by_id(case_id, current_user=current_user)

    data = await graph_service.get_case_network(case.id, session=session)
    return success_response(data=data, message=f"Case network intelligence retrieved ({data.engine}).")


@router.get(
    "/cases/{case_id}/graph/statistics",
    response_model=APIResponse[GraphStatistics],
    summary="Get Case Graph Statistics",
    description="Retrieve graph density, node count, edge count, and entity type distributions.",
)
async def get_case_graph_statistics(
    case_id: str,
    current_user: User = Depends(get_current_user),
    case_service: CaseService = Depends(get_case_service),
    graph_service: Neo4jGraphService = Depends(get_graph_service),
    session: AsyncSession = Depends(get_async_session),
):
    case = await case_service.get_case_by_id(case_id, current_user=current_user)

    graph = await graph_service.get_case_graph(case.id, session=session)
    return success_response(data=graph.statistics, message="Graph statistics retrieved.")


@router.post(
    "/cases/{case_id}/graph/sync",
    response_model=APIResponse[GraphSyncResponse],
    summary="Synchronize Case Intelligence into Neo4j",
    description="Trigger bidirectional synchronization: reads validated entities, relationships, evidence, and FIR data from PostgreSQL and merges them into Neo4j Aura.",
)
async def sync_case_graph_to_neo4j(
    case_id: str,
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    case_service: CaseService = Depends(get_case_service),
    graph_service: Neo4jGraphService = Depends(get_graph_service),
    session: AsyncSession = Depends(get_async_session),
):
    case = await case_service.get_case_by_id(case_id, current_user=current_user)
    result = await graph_service.sync_case_graph(case.id, session=session)
    return success_response(data=result, message=result.message)


# -------------------------------------------------------------
# 2. Hidden Connections & Latent Links
# -------------------------------------------------------------

@router.get(
    "/hidden-connections",
    response_model=APIResponse[List[HiddenConnectionItem]],
    summary="Discover Hidden Connections",
    description="Discover indirect connections, common associates, and multi-hop paths between entities in an investigation.",
)
async def get_hidden_connections(
    case_id: str = Query(..., description="Target investigation case ID or number"),
    entity_id: Optional[uuid.UUID] = Query(None, description="Optional entity of interest"),
    max_depth: int = Query(2, ge=1, le=4, description="Max traversal depth"),
    current_user: User = Depends(get_current_user),
    case_service: CaseService = Depends(get_case_service),
    graph_intel: GraphIntelligenceService = Depends(get_graph_intelligence_service),
    session: AsyncSession = Depends(get_async_session),
):
    case = await case_service.get_case_by_id(case_id, current_user=current_user)

    results = await graph_intel.find_hidden_connections(
        case_id=case.id,
        session=session,
        entity_id=entity_id,
        max_depth=max_depth,
    )
    return success_response(data=results, message=f"Discovered {len(results)} hidden connection pattern(s).")


@router.get(
    "/shared-resources",
    response_model=APIResponse[List[SharedResourceItem]],
    summary="Detect Shared Resources",
    description="Detect Phones, Bank Accounts, Vehicles, and Locations shared by multiple persons of interest.",
)
async def get_shared_resources(
    case_id: Optional[str] = Query(None, description="Optional case filter (UUID or case number)"),
    current_user: User = Depends(get_current_user),
    case_service: CaseService = Depends(get_case_service),
    graph_intel: GraphIntelligenceService = Depends(get_graph_intelligence_service),
    session: AsyncSession = Depends(get_async_session),
):
    target_case_id = None
    if case_id:
        case = await case_service.get_case_by_id(case_id, current_user=current_user)
        target_case_id = case.id
    elif current_user.role == UserRole.CITIZEN:
        raise PermissionDeniedException("Global resource analysis is restricted to authorized officers.")

    results = await graph_intel.find_shared_resources(case_id=target_case_id, session=session)
    return success_response(data=results, message=f"Found {len(results)} shared resource nexus point(s).")


@router.get(
    "/shortest-path",
    response_model=APIResponse[ShortestPathResponse],
    summary="Calculate Shortest Connection Path",
    description="Calculate shortest path between two target entities with evidence chain.",
)
async def get_shortest_path(
    source_id: uuid.UUID = Query(..., description="Source entity ID"),
    target_id: uuid.UUID = Query(..., description="Target entity ID"),
    max_depth: int = Query(4, ge=1, le=6, description="Max path length"),
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    graph_intel: GraphIntelligenceService = Depends(get_graph_intelligence_service),
    session: AsyncSession = Depends(get_async_session),
):
    path = await graph_intel.find_shortest_path(
        source_id=source_id,
        target_id=target_id,
        session=session,
        max_depth=max_depth,
    )
    return success_response(data=path, message="Shortest path evaluated.")


@router.get(
    "/cross-case",
    response_model=APIResponse[List[CrossCaseEntityItem]],
    summary="Discover Cross-Case Entity Intersections",
    description="Identify entities that participate across multiple active investigations (Restricted to Police and Admin).",
)
async def get_cross_case_entities(
    current_user: User = Depends(require_roles(UserRole.POLICE, UserRole.ADMIN)),
    graph_intel: GraphIntelligenceService = Depends(get_graph_intelligence_service),
    session: AsyncSession = Depends(get_async_session),
):
    items = await graph_intel.find_cross_case_connections(user=current_user, session=session)
    return success_response(data=items, message=f"Identified {len(items)} cross-case entity intersection(s).")


# -------------------------------------------------------------
# 3. Graph Analytics & Centrality Metrics
# -------------------------------------------------------------

@router.get(
    "/analytics/{case_id}",
    response_model=APIResponse[GraphAnalyticsResponse],
    summary="Compute Case Network Analytics",
    description="Compute degree centrality, betweenness intermediaries, and community clusters for a case network.",
)
async def get_graph_analytics(
    case_id: str,
    current_user: User = Depends(get_current_user),
    case_service: CaseService = Depends(get_case_service),
    graph_intel: GraphIntelligenceService = Depends(get_graph_intelligence_service),
    session: AsyncSession = Depends(get_async_session),
):
    case = await case_service.get_case_by_id(case_id, current_user=current_user)

    analytics = await graph_intel.get_graph_analytics(case_id=case.id, session=session)
    return success_response(data=analytics, message="Network graph analytics computed.")
