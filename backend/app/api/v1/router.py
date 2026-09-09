"""Aggregated API version 1 router."""

from fastapi import APIRouter
from app.api.v1.endpoints import (
    admin,
    analytics,
    auth,
    blockchain,
    cases,
    dashboard,
    data_sync,
    evidence,
    firs,
    graph,
    health,
    intelligence,
    notifications,
    police,
    samanvaya,
    search,
    users,
)

api_v1_router = APIRouter()

api_v1_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_v1_router.include_router(users.router, prefix="/users", tags=["Users"])
api_v1_router.include_router(firs.router, prefix="/firs", tags=["FIRs"])
api_v1_router.include_router(cases.router, prefix="/cases", tags=["Cases"])
api_v1_router.include_router(evidence.router, prefix="/evidence", tags=["Evidence"])
api_v1_router.include_router(police.router, prefix="/police", tags=["Police Operations"])
api_v1_router.include_router(admin.router, prefix="/admin", tags=["Admin Operations"])
api_v1_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
api_v1_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_v1_router.include_router(search.router, prefix="/search", tags=["Search"])
api_v1_router.include_router(health.router, prefix="/health", tags=["System Health"])
api_v1_router.include_router(intelligence.router, tags=["AI/ML Intelligence"])
api_v1_router.include_router(intelligence.router, prefix="/intelligence", tags=["AI/ML Intelligence (Namespaced)"])
api_v1_router.include_router(samanvaya.router, prefix="/intelligence", tags=["SAMANVAYA Multi-Agent Intelligence"])
api_v1_router.include_router(samanvaya.router, prefix="/samanvaya", tags=["SAMANVAYA"])
api_v1_router.include_router(blockchain.router, tags=["Blockchain Evidence Integrity"])
api_v1_router.include_router(data_sync.router, prefix="/sync", tags=["Data Synchronization"])
api_v1_router.include_router(graph.router, prefix="/graph", tags=["Graph Intelligence"])
api_v1_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics Hub"])

