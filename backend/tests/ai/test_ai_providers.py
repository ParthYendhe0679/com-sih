"""Tests for AI provider implementations."""

import pytest
from app.ai.exceptions import AIProviderNotConfigured
from app.ai.providers.gemini_provider import GeminiProvider
from app.ai.providers.groq_provider import GroqProvider
from app.ai.providers.huggingface_provider import HuggingFaceProvider
from app.ai.providers.local_provider import LocalFallbackProvider
from app.ai.schemas.ai import AnomalyExplanationOutput, InvestigativeLeadExtraction


@pytest.mark.asyncio
async def test_local_fallback_provider_text_generation():
    """Verify local fallback provider generates high quality response without keys."""
    provider = LocalFallbackProvider()
    assert provider.is_configured() is True
    assert provider.is_enabled() is True

    envelope = await provider.generate_text("Analyze suspect call logs")
    assert envelope.success is True
    assert envelope.provider == "local_fallback"
    assert envelope.model == "kritagas-heuristic-v1"
    assert "Local Intelligence" in envelope.text or "KRITAGAS" in envelope.text
    assert envelope.latency_ms >= 0.0


@pytest.mark.asyncio
async def test_local_fallback_provider_structured_extraction():
    """Verify local fallback provider returns valid structured Pydantic models."""
    provider = LocalFallbackProvider()
    result, envelope = await provider.generate_structured(
        prompt="Analyze narrative",
        schema=AnomalyExplanationOutput,
    )
    assert isinstance(result, AnomalyExplanationOutput)
    assert result.severity in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
    assert result.confidence > 0.0
    assert envelope.structured_data is not None


def test_groq_provider_unconfigured_behavior():
    """Verify GroqProvider handles unconfigured state gracefully."""
    provider = GroqProvider()
    status = provider.get_health_status()
    assert status.provider == "groq"
    assert status.model is not None


def test_gemini_provider_unconfigured_behavior():
    """Verify GeminiProvider handles unconfigured state gracefully."""
    provider = GeminiProvider()
    status = provider.get_health_status()
    assert status.provider == "gemini"
    assert status.model is not None


@pytest.mark.asyncio
async def test_huggingface_provider_embeddings_and_similarity():
    """Verify HuggingFaceProvider generates embeddings and computes similarity."""
    provider = HuggingFaceProvider()
    assert provider.is_enabled() is True

    # Similarity
    sim = await provider.compute_similarity(
        "suspect armed with firearm robbing jewelry shop",
        "gunman robbing diamond store",
    )
    assert isinstance(sim, float)
    assert 0.0 <= sim <= 1.0
    assert sim > 0.1  # Verified positive similarity


    # Embeddings
    embeddings = await provider.generate_embeddings(["test investigation narrative"])
    assert isinstance(embeddings, list)
    assert len(embeddings) == 1
    assert len(embeddings[0]) > 10  # Dimension >= 64
