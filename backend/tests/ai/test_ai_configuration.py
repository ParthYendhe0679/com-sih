"""Tests for AI environment settings and multi-key resolution."""

import pytest
from app.ai.providers.base import BaseAIProvider
from app.core.config import Settings


def test_ai_settings_defaults():
    """Verify default AI settings are initialized with sensible values."""
    s = Settings()
    assert s.AI_DEFAULT_PROVIDER == "groq"
    assert s.AI_ENABLE_GROQ is True
    assert s.AI_ENABLE_GEMINI is True
    assert s.AI_ENABLE_HUGGINGFACE is True
    assert s.GROQ_PRIMARY_KEY_INDEX == 1
    assert s.GEMINI_PRIMARY_KEY_INDEX == 1
    assert s.AI_REQUEST_TIMEOUT == 30
    assert s.AI_MAX_RETRIES == 2


def test_groq_primary_key_resolution():
    """Verify GROQ_PRIMARY_KEY_INDEX explicitly selects corresponding key."""
    s = Settings(
        GROQ_API_KEY_1="gsk_key_one_test_123456789",
        GROQ_API_KEY_2="gsk_key_two_test_987654321",
        GROQ_PRIMARY_KEY_INDEX=2,
    )
    assert s.get_active_groq_key() == "gsk_key_two_test_987654321"

    # Switch to index 1
    s.GROQ_PRIMARY_KEY_INDEX = 1
    assert s.get_active_groq_key() == "gsk_key_one_test_123456789"


def test_groq_primary_key_fallback_when_unspecified_index_is_empty():
    """When specified primary key index is empty, fall back to any populated key."""
    s = Settings(
        GROQ_API_KEY_1="gsk_key_one_only_here",
        GROQ_API_KEY_2=None,
        GROQ_PRIMARY_KEY_INDEX=2,  # index 2 is None
    )
    assert s.get_active_groq_key() == "gsk_key_one_only_here"


def test_gemini_primary_key_resolution():
    """Verify GEMINI_PRIMARY_KEY_INDEX selects corresponding key."""
    s = Settings(
        GEMINI_API_KEY_1="AIza_gemini_key_primary",
        GEMINI_API_KEY_2="AIza_gemini_key_secondary",
        GEMINI_PRIMARY_KEY_INDEX=2,
    )
    assert s.get_active_gemini_key() == "AIza_gemini_key_secondary"


def test_key_masking_utility():
    """Verify mask_key safely masks secrets without revealing them."""
    assert BaseAIProvider.mask_key(None) is None
    assert BaseAIProvider.mask_key("") is None
    assert BaseAIProvider.mask_key("short") == "****"
    masked = BaseAIProvider.mask_key("gsk_sample_secret_key_12345678")
    assert masked == "gsk_...5678"
    assert "sample_secret_key" not in masked


def test_is_provider_configured():
    """Verify is_provider_configured respects flags and key existence."""
    s = Settings(
        _env_file=None,
        GROQ_API_KEY_1="gsk_valid_key",
        AI_ENABLE_GROQ=True,
        GEMINI_API_KEY_1=None,
        GEMINI_API_KEY_2=None,
        GEMINI_API_KEY=None,
        AI_ENABLE_GEMINI=True,
    )
    assert s.is_provider_configured("groq") is True
    assert s.is_provider_configured("gemini") is False
    assert s.is_provider_configured("local") is True
    assert s.is_provider_configured("huggingface") is True

