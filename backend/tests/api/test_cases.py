"""Case workflow, investigator assignment, and timeline test suite."""

import pytest
from httpx import AsyncClient
from app.models.user import User


@pytest.mark.asyncio
async def test_police_create_case_from_accepted_fir(
    citizen_client: AsyncClient,
    police_client: AsyncClient,
    police_user: User,
):
    # Citizen files complaint
    fir_res = await citizen_client.post(
        "/api/v1/firs?submit_now=true",
        json={
            "title": "Counterfeit Currency Distribution Ring",
            "description": "Counterfeit 500 rupee notes circulated in local wholesale vegetable market.",
            "crime_category": "Fraud",
            "incident_date": "2026-03-05",
            "incident_location": "Okhla Mandi",
        },
    )
    fir_id = fir_res.json()["data"]["id"]

    # Police accepts FIR
    await police_client.post(f"/api/v1/firs/{fir_id}/review", json={"status": "ACCEPTED"})

    # Police converts accepted FIR to Case
    case_payload = {
        "title": "Operation FakeNote: Okhla Mandi Distribution Network",
        "description": "Criminal inquiry targeting source printing press and courier network.",
        "crime_category": "Fraud",
        "priority": "HIGH",
        "fir_id": fir_id,
        "lead_investigator_id": str(police_user.id),
    }
    case_resp = await police_client.post("/api/v1/cases", json=case_payload)
    assert case_resp.status_code == 201
    case_data = case_resp.json()["data"]
    case_id = case_data["id"]
    assert case_data["case_number"].startswith("CASE-")
    assert case_data["status"] == "UNDER_INVESTIGATION"

    # Verify FIR status updated to CONVERTED_TO_CASE
    updated_fir_res = await police_client.get(f"/api/v1/firs/{fir_id}")
    assert updated_fir_res.json()["data"]["status"] == "CONVERTED_TO_CASE"


@pytest.mark.asyncio
async def test_case_state_transitions(police_client: AsyncClient):
    # Direct Case creation
    case_resp = await police_client.post(
        "/api/v1/cases",
        json={
            "title": "Direct Offline Narcotics Intelligence Lead",
            "description": "Direct actionable intelligence on cross-border shipment.",
            "crime_category": "Drug Trafficking",
            "priority": "CRITICAL",
        },
    )
    assert case_resp.status_code == 201
    case_id = case_resp.json()["data"]["id"]
    assert case_resp.json()["data"]["status"] == "OPEN"

    # Invalid jump: OPEN -> CLOSED directly (violates workflow)
    invalid_resp = await police_client.post(
        f"/api/v1/cases/{case_id}/status",
        json={"status": "CLOSED"},
    )
    assert invalid_resp.status_code == 400
    assert invalid_resp.json()["error"]["code"] == "INVALID_STATE_TRANSITION"

    # Valid step 1: OPEN -> UNDER_INVESTIGATION
    step1 = await police_client.post(
        f"/api/v1/cases/{case_id}/status",
        json={"status": "UNDER_INVESTIGATION"},
    )
    assert step1.status_code == 200
    assert step1.json()["data"]["status"] == "UNDER_INVESTIGATION"

    # Valid step 2: UNDER_INVESTIGATION -> ACTIVE
    step2 = await police_client.post(
        f"/api/v1/cases/{case_id}/status",
        json={"status": "ACTIVE"},
    )
    assert step2.status_code == 200
    assert step2.json()["data"]["status"] == "ACTIVE"

    # Valid step 3: ACTIVE -> CLOSED
    step3 = await police_client.post(
        f"/api/v1/cases/{case_id}/status",
        json={"status": "CLOSED", "note": "Charge sheet filed before special NDPS court."},
    )
    assert step3.status_code == 200
    assert step3.json()["data"]["status"] == "CLOSED"


@pytest.mark.asyncio
async def test_case_notes_and_timeline(police_client: AsyncClient):
    case_resp = await police_client.post(
        "/api/v1/cases",
        json={
            "title": "High Value Burglary at Electronics Warehouse",
            "description": "Break-in at central hub with loss of laptops and mobile components.",
            "crime_category": "Robbery",
        },
    )
    case_id = case_resp.json()["data"]["id"]

    # Add investigative note
    note_resp = await police_client.post(
        f"/api/v1/cases/{case_id}/notes",
        json={"note": "CCTV forensic analysis indicates getaway vehicle had tempered license plates."},
    )
    assert note_resp.status_code == 201
    assert note_resp.json()["data"]["note"].startswith("CCTV forensic")

    # Fetch Case timeline
    timeline_resp = await police_client.get(f"/api/v1/cases/{case_id}/timeline")
    assert timeline_resp.status_code == 200
    events = timeline_resp.json()["data"]
    assert len(events) >= 2  # CASE_CREATED + NOTE_ADDED


@pytest.mark.asyncio
async def test_citizen_forbidden_from_case_creation(citizen_client: AsyncClient):
    resp = await citizen_client.post(
        "/api/v1/cases",
        json={
            "title": "Citizen Trying to Create Case",
            "description": "This should be denied by RBAC dependency.",
            "crime_category": "Robbery",
        },
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "PERMISSION_DENIED"
