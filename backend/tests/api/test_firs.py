"""FIR lifecycle and RBAC test suite."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_citizen_create_and_submit_fir(citizen_client: AsyncClient):
    # 1. Create FIR in DRAFT
    create_payload = {
        "title": "Commercial Extortion and Threats Received via Phone",
        "description": "Received threatening calls demanding ransom of INR 10 Lakhs with threats against family.",
        "crime_category": "Extortion",
        "incident_date": "2026-03-01",
        "incident_time": "18:30:00",
        "incident_location": "Vasant Kunj, New Delhi",
        "priority": "HIGH",
    }
    create_resp = await citizen_client.post("/api/v1/firs", json=create_payload)
    assert create_resp.status_code == 201
    fir_data = create_resp.json()["data"]
    fir_id = fir_data["id"]
    assert fir_data["status"] == "DRAFT"
    assert fir_data["fir_number"].startswith("FIR-")

    # 2. Submit FIR
    submit_resp = await citizen_client.post(f"/api/v1/firs/{fir_id}/submit")
    assert submit_resp.status_code == 200
    submitted_data = submit_resp.json()["data"]
    assert submitted_data["status"] == "SUBMITTED"

    # 3. Retrieve own FIRs
    my_firs_resp = await citizen_client.get("/api/v1/firs/my-firs")
    assert my_firs_resp.status_code == 200
    items = my_firs_resp.json()["data"]["items"]
    assert any(f["id"] == fir_id for f in items)


@pytest.mark.asyncio
async def test_police_review_accept_fir(citizen_client: AsyncClient, police_client: AsyncClient):
    # Citizen lodges and submits FIR
    create_payload = {
        "title": "Stolen Two-Wheeler Vehicle Theft from Metro Parking",
        "description": "Motorcycle stolen from public metro station parking bay between 09:00 and 17:00.",
        "crime_category": "Vehicle Theft",
        "incident_date": "2026-03-02",
        "incident_time": "10:00:00",
        "incident_location": "Rajiv Chowk Metro Station",
        "priority": "MEDIUM",
    }
    res = await citizen_client.post("/api/v1/firs?submit_now=true", json=create_payload)
    fir_id = res.json()["data"]["id"]

    # Police reviews and accepts FIR
    review_payload = {
        "status": "ACCEPTED",
        "priority": "HIGH",
    }
    review_resp = await police_client.post(f"/api/v1/firs/{fir_id}/review", json=review_payload)
    assert review_resp.status_code == 200
    assert review_resp.json()["data"]["status"] == "ACCEPTED"


@pytest.mark.asyncio
async def test_police_review_reject_requires_reason(citizen_client: AsyncClient, police_client: AsyncClient):
    create_payload = {
        "title": "Civil Contract Breach Inquiry Request",
        "description": "Landlord refused to return security deposit of 20000 rupees upon moving out.",
        "crime_category": "Fraud",
        "incident_date": "2026-03-03",
        "incident_location": "Noida",
    }
    res = await citizen_client.post("/api/v1/firs?submit_now=true", json=create_payload)
    fir_id = res.json()["data"]["id"]

    # Attempt to reject without reason
    bad_payload = {"status": "REJECTED"}
    bad_resp = await police_client.post(f"/api/v1/firs/{fir_id}/review", json=bad_payload)
    assert bad_resp.status_code == 400

    # Reject with proper reason
    good_payload = {
        "status": "REJECTED",
        "rejection_reason": "Matter is of purely civil nature (tenancy dispute). Directed to civil court.",
    }
    good_resp = await police_client.post(f"/api/v1/firs/{fir_id}/review", json=good_payload)
    assert good_resp.status_code == 200
    assert good_resp.json()["data"]["status"] == "REJECTED"


@pytest.mark.asyncio
async def test_police_request_and_citizen_provide_info(citizen_client: AsyncClient, police_client: AsyncClient):
    create_payload = {
        "title": "Online Cryptocurrency Investment Fraud",
        "description": "Invested in fraudulent portal and lost funds after withdrawal was blocked.",
        "crime_category": "Cybercrime",
        "incident_date": "2026-03-04",
        "incident_location": "Dwarka",
    }
    res = await citizen_client.post("/api/v1/firs?submit_now=true", json=create_payload)
    fir_id = res.json()["data"]["id"]

    # Police requests more information
    req_payload = {"instructions": "Please provide transaction hashes and destination wallet addresses."}
    req_resp = await police_client.post(f"/api/v1/firs/{fir_id}/request-information", json=req_payload)
    assert req_resp.status_code == 200
    assert req_resp.json()["data"]["status"] == "MORE_INFORMATION_REQUIRED"

    # Citizen provides information
    provide_payload = {"additional_information": "Wallet: 0x71C... and TxHash: 0x9a3f..."}
    provide_resp = await citizen_client.post(f"/api/v1/firs/{fir_id}/provide-information", json=provide_payload)
    assert provide_resp.status_code == 200
    assert provide_resp.json()["data"]["status"] == "UNDER_REVIEW"


@pytest.mark.asyncio
async def test_citizen_forbidden_from_police_actions(citizen_client: AsyncClient):
    # Citizen attempts to review an FIR
    resp = await citizen_client.post(
        "/api/v1/firs/00000000-0000-0000-0000-000000000000/review",
        json={"status": "ACCEPTED"},
    )
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "PERMISSION_DENIED"
