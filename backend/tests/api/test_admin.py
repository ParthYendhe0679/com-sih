"""Admin endpoints, user lifecycle, and audit log exploration test suite."""

import pytest
from httpx import AsyncClient
from app.models.user import User


@pytest.mark.asyncio
async def test_admin_create_police_account(admin_client: AsyncClient):
    payload = {
        "email": "subinspector.anil@police.gov.in",
        "username": "si_anil",
        "full_name": "SI Anil Kapoor",
        "password": "Police@123456",
        "phone_number": "+91-9877001122",
        "badge_number": "DL-POL-9912",
        "department": "Crime Branch Special Cell",
        "rank": "Sub-Inspector",
    }
    resp = await admin_client.post("/api/v1/admin/police-account", json=payload)
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["role"] == "POLICE"
    assert data["badge_number"] == "DL-POL-9912"


@pytest.mark.asyncio
async def test_admin_toggle_user_status(admin_client: AsyncClient, citizen_user: User):
    # Deactivate citizen
    deact_resp = await admin_client.patch(
        f"/api/v1/admin/users/{citizen_user.id}/status",
        json={"is_active": False},
    )
    assert deact_resp.status_code == 200
    assert deact_resp.json()["data"]["is_active"] is False

    # Reactivate citizen
    react_resp = await admin_client.patch(
        f"/api/v1/admin/users/{citizen_user.id}/status",
        json={"is_active": True},
    )
    assert react_resp.status_code == 200
    assert react_resp.json()["data"]["is_active"] is True


@pytest.mark.asyncio
async def test_admin_inspect_audit_logs(admin_client: AsyncClient):
    resp = await admin_client.get("/api/v1/admin/audit-logs?limit=10")
    assert resp.status_code == 200
    logs = resp.json()["data"]
    assert isinstance(logs, list)


@pytest.mark.asyncio
async def test_police_forbidden_from_admin(police_client: AsyncClient):
    resp = await police_client.get("/api/v1/admin/audit-logs")
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "PERMISSION_DENIED"
