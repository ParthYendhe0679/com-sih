"""KRITAGAS Centralized AI Module.

Provides multi-provider reasoning (Groq, Google Gemini, Hugging Face),
intelligent fallback routing, structured Pydantic extraction, and health probes.
"""

from app.ai.exceptions import (
    AIError,
    AIInvalidResponse,
    AIProviderNotConfigured,
    AIProviderUnavailable,
    AIRequestTimeout,
    AIStructuredOutputError,
)
from app.ai.schemas.ai import (
    AIRequest,
    AIResponseEnvelope,
    AnomalyExplanationOutput,
    InvestigativeLeadExtraction,
    OverallAIHealthResponse,
    ProviderHealthStatus,
    TaskType,
)
from app.ai.services.ai_service import AIService, ai_service
from app.ai.services.provider_health import AIHealthService
from app.ai.services.provider_router import AIProviderRouter

__all__ = [
    # Main Service
    "AIService",
    "ai_service",
    # Router & Health
    "AIProviderRouter",
    "AIHealthService",
    # Schemas
    "AIRequest",
    "AIResponseEnvelope",
    "AnomalyExplanationOutput",
    "InvestigativeLeadExtraction",
    "OverallAIHealthResponse",
    "ProviderHealthStatus",
    "TaskType",
    # Exceptions
    "AIError",
    "AIProviderNotConfigured",
    "AIProviderUnavailable",
    "AIRequestTimeout",
    "AIInvalidResponse",
    "AIStructuredOutputError",
]
