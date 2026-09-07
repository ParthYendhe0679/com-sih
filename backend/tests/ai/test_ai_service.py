"""Tests for centralized AIService orchestration."""

import pytest
from app.ai.schemas.ai import (
    AIRequest,
    AnomalyExplanationOutput,
    InvestigativeLeadExtraction,
    OverallAIHealthResponse,
    TaskType,
)
from app.ai.services.ai_service import AIService


@pytest.mark.asyncio
async def test_ai_service_text_generation():
    """Verify AIService generates text response smoothly using available provider."""
    service = AIService()
    req = AIRequest(
        prompt="Synthesize suspect interrogation records",
        task_type=TaskType.TEXT_COMPLETION,
    )
    envelope = await service.generate_text(req)
    assert envelope.success is True
    assert envelope.provider in ("groq", "gemini", "local_fallback")
    assert envelope.text is not None
    assert envelope.latency_ms >= 0.0


@pytest.mark.asyncio
async def test_ai_service_structured_extraction():
    """Verify AIService performs structured schema extraction."""
    service = AIService()
    narrative = (
        "FIR No 412: Suspect Karan Verma alias 'Bittu' was spotted near Sector 18 "
        "driving a black Honda City DL-04-AB-1234. Associated with the Verma Syndicate."
    )
    extracted, envelope = await service.extract_investigative_leads(narrative)
    assert isinstance(extracted, InvestigativeLeadExtraction)
    assert envelope.success is True
    assert envelope.structured_data is not None


@pytest.mark.asyncio
async def test_ai_service_anomaly_explanation():
    """Verify AIService generates structured anomaly explanations."""
    service = AIService()
    anomaly_data = {
        "anomaly_type": "HIGH_FREQUENCY_CROSS_CASE_BURST",
        "primary_entity": "Karan Verma",
        "matched_cases": ["FIR-2024-001", "FIR-2024-009"],
        "anomaly_score": 0.88,
    }
    result, envelope = await service.explain_anomaly(anomaly_data)
    assert isinstance(result, AnomalyExplanationOutput)
    assert result.severity in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
    assert len(result.explanation) > 0


@pytest.mark.asyncio
async def test_ai_service_embeddings_and_similarity():
    """Verify AIService semantic embeddings and similarity methods."""
    service = AIService()
    sim = await service.compute_similarity("cyber fraud phishing scheme", "online banking credential harvesting")
    assert isinstance(sim, float)
    assert 0.0 <= sim <= 1.0

    emb = await service.generate_embeddings(["burglary of electronics warehouse"])
    assert len(emb) == 1
    assert len(emb[0]) > 0


def test_ai_service_health_passive_probe():
    """Verify AIService health check returns OverallAIHealthResponse without paid calls."""
    service = AIService()
    health = service.get_health()
    assert isinstance(health, OverallAIHealthResponse)
    assert health.status in ("healthy", "degraded", "unconfigured")
    assert "groq" in health.providers
    assert "gemini" in health.providers
    assert "huggingface" in health.providers
    assert "local_fallback" in health.providers
