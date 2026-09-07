"""Evidence metadata and chain of custody test suite."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_citizen_attach_evidence_to_fir(citizen_client: AsyncClient):
    # Lodge FIR
    fir_res = await citizen_client.post(
        "/api/v1/firs?submit_now=true",
        json={
            "title": "Stolen Credit Card Online Transactions",
            "description": "Unauthorized online orders executed on international merchant platforms.",
            "crime_category": "Cybercrime",
            "incident_date": "2026-03-05",
            "incident_location": "Delhi",
        },
    )
    fir_id = fir_res.json()["data"]["id"]

    # Attach evidence metadata
    ev_payload = {
        "title": "Bank Transaction SMS Screenshots",
        "description": "Screenshots of OTPs and alert SMS messages received on mobile phone.",
        "evidence_type": "IMAGE",
        "file_name": "otp_sms_proof.png",
        "file_url": "/uploads/otp_sms_proof.png",
        "fir_id": fir_id,
        "file_hash": "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
        "file_size": 512000,
        "mime_type": "image/png",
    }
    ev_res = await citizen_client.post("/api/v1/evidence", json=ev_payload)
    assert ev_res.status_code == 201
    ev_data = ev_res.json()["data"]
    assert ev_data["title"] == "Bank Transaction SMS Screenshots"
    assert ev_data["status"] == "COLLECTED"

    # List FIR evidence
    list_res = await citizen_client.get(f"/api/v1/evidence/fir/{fir_id}")
    assert list_res.status_code == 200
    assert list_res.json()["data"]["total"] == 1


@pytest.mark.asyncio
async def test_citizen_forbidden_from_case_evidence(citizen_client: AsyncClient):
    ev_payload = {
        "title": "Contraband Forensic Report",
        "evidence_type": "DOCUMENT",
        "file_name": "toxicology.pdf",
        "file_url": "/uploads/toxicology.pdf",
        "case_id": "00000000-0000-0000-0000-000000000001",
    }
    res = await citizen_client.post("/api/v1/evidence", json=ev_payload)
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "PERMISSION_DENIED"
