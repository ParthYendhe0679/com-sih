"""Role-based dashboard metrics test suite."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_citizen_dashboard(citizen_client: AsyncClient):
    resp = await citizen_client.get("/api/v1/dashboard/citizen")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "total_firs" in data
    assert "pending_firs" in data
    assert "accepted_firs" in data
    assert "rejected_firs" in data
    assert isinstance(data["recent_firs"], list)


@pytest.mark.asyncio
async def test_police_dashboard(police_client: AsyncClient):
    resp = await police_client.get("/api/v1/dashboard/police")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "assigned_cases" in data
    assert "open_cases" in data
    assert "pending_fir_reviews" in data
    assert isinstance(data["recent_cases"], list)


@pytest.mark.asyncio
async def test_admin_dashboard(admin_client: AsyncClient):
    resp = await admin_client.get("/api/v1/dashboard/admin")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "total_users" in data
    assert "total_firs" in data
    assert "total_cases" in data
    assert "fir_status_distribution" in data
    assert "case_status_distribution" in data
