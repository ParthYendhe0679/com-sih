"""Integration test suite for AI/ML Intelligence API endpoints."""

import pytest
from httpx import AsyncClient
from app.models.user import User


@pytest.mark.asyncio
async def test_case_intelligence_endpoints_flow(
    police_client: AsyncClient,
    police_user: User,
):
    # 1. Create a case
    case_resp = await police_client.post(
        "/api/v1/cases",
        json={
            "title": "Operation Nightfall: Gold Showroom Break-in",
            "description": "Armed suspects entered showroom with acetylene gas cutter. Suspect Karan Verma and vehicle MH02AB1234 identified at scene.",
            "crime_category": "ARMED_ROBBERY",
            "priority": "HIGH",
        },
    )
    assert case_resp.status_code == 201
    case_id = case_resp.json()["data"]["id"]

    # 2. Trigger asynchronous case analysis job
    analyze_resp = await police_client.post(f"/api/v1/cases/{case_id}/analyze")
    assert analyze_resp.status_code == 202
    job_data = analyze_resp.json()["data"]
    assert "job_id" in job_data
    assert job_data["status"] in ("QUEUED", "PROCESSING", "COMPLETED")
    job_id = job_data["job_id"]

    # 3. Poll job status
    status_resp = await police_client.get(f"/api/v1/analysis/jobs/{job_id}")
    assert status_resp.status_code == 200
    assert status_resp.json()["data"]["id"] == job_id

    # 4. Get Case Intelligence Dossier
    intel_resp = await police_client.get(f"/api/v1/cases/{case_id}/intelligence")
    assert intel_resp.status_code == 200
    intel_data = intel_resp.json()["data"]
    assert intel_data["case_id"] == case_id
    assert "investigation_priority_score" in intel_data
    assert "priority_breakdown" in intel_data

    # 5. Get Similar Cases
    similar_resp = await police_client.get(f"/api/v1/cases/{case_id}/similar-cases")
    assert similar_resp.status_code == 200
    assert "matches" in similar_resp.json()["data"]

    # 6. Get Correlations
    corr_resp = await police_client.get(f"/api/v1/cases/{case_id}/correlations")
    assert corr_resp.status_code == 200
    assert "correlations" in corr_resp.json()["data"]

    # 7. Get Patterns
    patterns_resp = await police_client.get(f"/api/v1/cases/{case_id}/patterns")
    assert patterns_resp.status_code == 200
    assert "patterns" in patterns_resp.json()["data"]

    # 8. Get Anomalies
    anom_resp = await police_client.get(f"/api/v1/cases/{case_id}/anomalies")
    assert anom_resp.status_code == 200
    assert "items" in anom_resp.json()["data"]

    # 9. Get Insights
    insights_resp = await police_client.get(f"/api/v1/cases/{case_id}/insights")
    assert insights_resp.status_code == 200
    assert "insights" in insights_resp.json()["data"]

    # 10. Get Person Intelligence Profile
    person_resp = await police_client.get("/api/v1/persons/Karan Verma/intelligence")
    assert person_resp.status_code == 200
    person_data = person_resp.json()["data"]
    assert person_data["canonical_name"] == "Karan Verma"
    assert len(person_data["facts"]) >= 1
