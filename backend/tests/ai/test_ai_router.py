"""Tests for AI provider router and task-based fallback resolution."""

import pytest
from app.ai.schemas.ai import TaskType
from app.ai.services.provider_router import AIProviderRouter


def test_router_initialization():
    """Verify router instantiates all standard providers."""
    router = AIProviderRouter()
    assert "groq" in router.providers
    assert "gemini" in router.providers
    assert "huggingface" in router.providers
    assert "local_fallback" in router.providers


def test_router_resolves_task_candidates_with_local_fallback():
    """Verify candidates always end with the reliable local fallback safety net."""
    router = AIProviderRouter()
    candidates = router.resolve_provider_candidates(TaskType.TEXT_COMPLETION)
    assert len(candidates) >= 1
    # Last candidate should be local fallback provider
    assert candidates[-1].provider_name == "local_fallback"


def test_router_task_specific_ordering():
    """Verify task chains are ordered appropriately."""
    router = AIProviderRouter()
    assert TaskType.SUMMARIZATION in router.task_routing
    assert router.task_routing[TaskType.SUMMARIZATION][0] == "gemini"
    assert router.task_routing[TaskType.TEXT_COMPLETION][0] == "groq"
    assert router.task_routing[TaskType.EMBEDDING][0] == "huggingface"


def test_router_preferred_provider():
    """Verify preferred_provider is respected when available."""
    router = AIProviderRouter()
    # local_fallback is always available
    candidates = router.resolve_provider_candidates(
        task_type=TaskType.TEXT_COMPLETION,
        preferred_provider="local_fallback",
    )
    assert candidates[0].provider_name == "local_fallback"
