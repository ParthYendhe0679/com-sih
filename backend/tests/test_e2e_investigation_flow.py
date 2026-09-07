"""Complete 14-step End-to-End Investigation Lifecycle Integration Test.

Verifies the connected flow:
1. Register Citizen
2. Citizen logs in & receives JWT
3. Citizen creates draft FIR
4. Citizen submits FIR
5. Police logs in & receives JWT
6. Police views FIR in review queue
7. Police transitions FIR to UNDER_REVIEW
8. Police accepts FIR
9. Police creates Case from FIR
10. Assign Lead Investigator
11. Update Case status to UNDER_INVESTIGATION
12. Add chain-of-custody Evidence metadata
13. Verify persistent Notifications for Citizen
14. Verify persistent Audit Trail logs for Admin
"""

import pytest
from httpx import AsyncClient
from app.models.user import User


@pytest.mark.asyncio
async def test_complete_investigation_lifecycle_e2e(
    client: AsyncClient,
    admin_client: AsyncClient,
    police_user: User,
):
    # -------------------------------------------------------------
    # Step 1: Register Citizen
    # -------------------------------------------------------------
    citizen_reg_payload = {
        "email": "e2e_citizen@example.com",
        "username": "e2e_citizen",
        "full_name": "Siddharth Malhotra",
        "phone_number": "+91-9876599999",
        "password": "CitizenSecret@123",
    }
    reg_resp = await client.post("/api/v1/auth/register", json=citizen_reg_payload)
    assert reg_resp.status_code == 201, reg_resp.text
    reg_data = reg_resp.json()["data"]
    citizen_id = reg_data["user_id"]
    assert reg_data["email"] == "e2e_citizen@example.com"

    # -------------------------------------------------------------
    # Step 2: Citizen logs in & receives JWT
    # -------------------------------------------------------------
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "e2e_citizen", "password": "CitizenSecret@123"},
    )
    assert login_resp.status_code == 200, login_resp.text
    citizen_token = login_resp.json()["data"]["access_token"]
    citizen_headers = {"Authorization": f"Bearer {citizen_token}"}

    # -------------------------------------------------------------
    # Step 3: Citizen creates draft FIR
    # -------------------------------------------------------------
    fir_create_payload = {
        "title": "Organized Financial Identity Theft and Wire Scam",
        "description": "Criminal actors impersonating tax authority requested confidential credentials and unauthorized debit of funds.",
        "crime_category": "Cybercrime",
        "incident_date": "2026-03-01",
        "incident_time": "11:45:00",
        "incident_location": "Bandra Kurla Complex, Mumbai",
        "priority": "HIGH",
    }
    fir_create_resp = await client.post(
        "/api/v1/firs",
        json=fir_create_payload,
        headers=citizen_headers,
    )
    assert fir_create_resp.status_code == 201, fir_create_resp.text
    fir_data = fir_create_resp.json()["data"]
    fir_id = fir_data["id"]
    fir_number = fir_data["fir_number"]
    assert fir_data["status"] == "DRAFT"

    # -------------------------------------------------------------
    # Step 4: Citizen submits FIR for police review
    # -------------------------------------------------------------
    submit_resp = await client.post(
        f"/api/v1/firs/{fir_id}/submit",
        headers=citizen_headers,
    )
    assert submit_resp.status_code == 200, submit_resp.text
    assert submit_resp.json()["data"]["status"] == "SUBMITTED"

    # -------------------------------------------------------------
    # Step 5: Police logs in & receives JWT
    # -------------------------------------------------------------
    police_login_resp = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": police_user.username, "password": "Police@123456"},
    )
    assert police_login_resp.status_code == 200, police_login_resp.text
    police_token = police_login_resp.json()["data"]["access_token"]
    police_headers = {"Authorization": f"Bearer {police_token}"}


    # -------------------------------------------------------------
    # Step 6: Police views FIR in review queue
    # -------------------------------------------------------------
    queue_resp = await client.get("/api/v1/police/fir-queue", headers=police_headers)
    assert queue_resp.status_code == 200, queue_resp.text
    queue_firs = queue_resp.json()["data"]["items"]
    assert any(f["id"] == fir_id for f in queue_firs)


    # -------------------------------------------------------------
    # Step 7: Police transitions FIR to UNDER_REVIEW
    # -------------------------------------------------------------
    review_start_resp = await client.post(
        f"/api/v1/firs/{fir_id}/review",
        json={"status": "UNDER_REVIEW", "remarks": "Forensic verification initiated."},
        headers=police_headers,
    )
    assert review_start_resp.status_code == 200, review_start_resp.text
    assert review_start_resp.json()["data"]["status"] == "UNDER_REVIEW"

    # -------------------------------------------------------------
    # Step 8: Police accepts FIR
    # -------------------------------------------------------------
    accept_resp = await client.post(
        f"/api/v1/firs/{fir_id}/review",
        json={"status": "ACCEPTED", "remarks": "Prima facie cyber extortion established."},
        headers=police_headers,
    )
    assert accept_resp.status_code == 200, accept_resp.text
    assert accept_resp.json()["data"]["status"] == "ACCEPTED"

    # -------------------------------------------------------------
    # Step 9: Police creates Case from FIR
    # -------------------------------------------------------------
    case_payload = {
        "title": "Operation PhishTrace: Identity Theft Investigation",
        "description": "Criminal inquiry initiated into syndicated identity theft and wire fraud operations.",
        "crime_category": "Cybercrime",
        "priority": "HIGH",
        "fir_id": str(fir_id),
    }
    case_resp = await client.post(
        "/api/v1/cases",
        json=case_payload,
        headers=police_headers,
    )
    assert case_resp.status_code == 201, case_resp.text
    case_data = case_resp.json()["data"]
    case_id = case_data["id"]
    case_number = case_data["case_number"]
    assert case_data["fir_id"] == str(fir_id)
    assert case_data["status"] == "OPEN"

    # -------------------------------------------------------------
    # Step 10: Assign Lead Investigator
    # -------------------------------------------------------------
    assign_resp = await client.post(
        f"/api/v1/cases/{case_id}/assign",
        json={"lead_investigator_id": str(police_user.id)},
        headers=police_headers,
    )
    assert assign_resp.status_code == 200, assign_resp.text
    assert assign_resp.json()["data"]["lead_investigator_id"] == str(police_user.id)

    # -------------------------------------------------------------
    # Step 11: Update Case status to UNDER_INVESTIGATION
    # -------------------------------------------------------------
    status_resp = await client.post(
        f"/api/v1/cases/{case_id}/status",
        json={"status": "UNDER_INVESTIGATION", "note": "Warrants and telecom IP logs requested."},
        headers=police_headers,
    )
    assert status_resp.status_code == 200, status_resp.text
    assert status_resp.json()["data"]["status"] == "UNDER_INVESTIGATION"


    # -------------------------------------------------------------
    # Step 12: Add chain-of-custody Evidence metadata
    # -------------------------------------------------------------
    evidence_payload = {
        "case_id": case_id,
        "fir_id": fir_id,
        "title": "Target Phishing Email Headers & SPF/DKIM Records",
        "description": "Original raw MIME email headers containing originating source IP.",
        "evidence_type": "DOCUMENT",
        "file_name": "headers_dump.txt",
        "file_url": "/uploads/headers_dump.txt",
        "file_hash": "a1b2c3d4e5f60718293041526374859607182930415263748596071829304152",
        "file_size": 4096,
        "mime_type": "text/plain",
    }
    ev_resp = await client.post(
        "/api/v1/evidence",
        json=evidence_payload,
        headers=police_headers,
    )
    assert ev_resp.status_code == 201, ev_resp.text
    assert ev_resp.json()["data"]["case_id"] == case_id

    # -------------------------------------------------------------
    # Step 13: Verify persistent Notifications for Citizen
    # -------------------------------------------------------------
    notif_resp = await client.get("/api/v1/notifications", headers=citizen_headers)
    assert notif_resp.status_code == 200, notif_resp.text
    citizen_notifs = notif_resp.json()["data"]
    assert len(citizen_notifs) >= 1
    # Check that complaint submission notification exists
    notif_messages = [n["message"] for n in citizen_notifs]
    assert any(fir_number in m for m in notif_messages)

    # -------------------------------------------------------------
    # Step 14: Verify persistent Audit Trail logs for Admin
    # -------------------------------------------------------------
    audit_resp = await admin_client.get("/api/v1/admin/audit-logs")
    assert audit_resp.status_code == 200, audit_resp.text
    audit_logs = audit_resp.json()["data"]
    assert len(audit_logs) >= 3

    # Verify key operational actions were audited in PostgreSQL
    actions = [log["action"] for log in audit_logs]
    assert "USER_REGISTER" in actions
    assert "FIR_CREATED" in actions
    assert "FIR_SUBMITTED" in actions
    assert "CASE_CREATED" in actions


