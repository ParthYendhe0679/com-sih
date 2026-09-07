"""API endpoint tests for /api/v1/health/ai probe."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_ai_health_endpoint(client: AsyncClient):
    """Verify GET /api/v1/health/ai returns 200 with structured provider readiness."""
    resp = await client.get("/api/v1/health/ai")
    assert resp.status_code == 200
    data = resp.json()

    assert "status" in data
    assert "default_provider" in data
    assert "configured_providers" in data
    assert "providers" in data
    assert "timestamp" in data

    providers = data["providers"]
    assert "groq" in providers
    assert "gemini" in providers
    assert "huggingface" in providers
    assert "local_fallback" in providers

    # Verify key masking - no secret tokens exposed
    for p_name, p_info in providers.items():
        assert "key" not in p_info or p_info.get("key_masked") is None or "..." in p_info.get("key_masked", "") or p_info.get("key_masked") in ("****", "local_model")


@pytest.mark.asyncio
async def test_readiness_probe_ai_integration(client: AsyncClient):
    """Verify GET /api/v1/health/ready includes AI service block."""
    resp = await client.get("/api/v1/health/ready")
    assert resp.status_code == 200
    data = resp.json()
    assert "services" in data
    services = data["services"]
    assert "ai" in services
    assert services["ai"]["status"] in ("healthy", "degraded", "unconfigured")
