"""Centralized AI Service Orchestrator for KRITAGAS."""

import asyncio
from typing import Any, Dict, List, Optional, Tuple, Type, TypeVar
from pydantic import BaseModel

from app.ai.exceptions import (
    AIError,
    AIInvalidResponse,
    AIProviderNotConfigured,
    AIProviderUnavailable,
    AIRequestTimeout,
    AIStructuredOutputError,
)
from app.ai.providers.huggingface_provider import HuggingFaceProvider
from app.ai.schemas.ai import (
    AIRequest,
    AIResponseEnvelope,
    AnomalyExplanationOutput,
    InvestigativeLeadExtraction,
    OverallAIHealthResponse,
    TaskType,
)
from app.ai.services.provider_health import AIHealthService
from app.ai.services.provider_router import AIProviderRouter
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("kritagas.ai.service")

T = TypeVar("T", bound=BaseModel)


class AIService:
    """Unified entry point for AI inference, structured extraction, embeddings, and provider health."""

    def __init__(self, router: Optional[AIProviderRouter] = None):
        self.router = router or AIProviderRouter()
        self.health_service = AIHealthService(self.router)

    async def generate_text(self, request: AIRequest) -> AIResponseEnvelope:
        """Execute text completion with intelligent fallback across configured providers."""
        candidates = self.router.resolve_provider_candidates(
            task_type=request.task_type,
            preferred_provider=request.preferred_provider,
        )

        last_error: Optional[Exception] = None

        for provider in candidates:
            # Attempt with max retries on transient errors
            max_attempts = 1 + settings.AI_MAX_RETRIES
            for attempt in range(1, max_attempts + 1):
                try:
                    logger.debug(
                        "Attempting generation with provider '%s' (attempt %d/%d)",
                        provider.provider_name,
                        attempt,
                        max_attempts,
                    )
                    envelope = await provider.generate_text(
                        prompt=request.prompt,
                        system_instruction=request.system_instruction,
                        temperature=request.temperature,
                        max_tokens=request.max_tokens,
                        json_mode=request.json_mode,
                    )
                    return envelope
                except (AIRequestTimeout, AIProviderUnavailable) as transient_err:
                    last_error = transient_err
                    logger.warning(
                        "Provider '%s' transient failure on attempt %d: %s",
                        provider.provider_name,
                        attempt,
                        transient_err,
                    )
                    if attempt < max_attempts:
                        await asyncio.sleep(0.5 * attempt)
                    else:
                        break
                except AIProviderNotConfigured:
                    # Non-retriable, move immediately to next fallback
                    break
                except Exception as unexpected_err:
                    last_error = unexpected_err
                    logger.error("Unexpected error with provider '%s': %s", provider.provider_name, unexpected_err)
                    break

        # If all candidates failed (including local fallback), raise error
        raise AIProviderUnavailable(
            f"All AI providers failed. Last error: {last_error}",
            provider="orchestrator",
            details={"last_error": str(last_error)},
        )

    async def generate_structured(
        self,
        prompt: str,
        schema: Type[T],
        task_type: TaskType = TaskType.STRUCTURED_EXTRACTION,
        preferred_provider: Optional[str] = None,
        system_instruction: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 1024,
    ) -> Tuple[T, AIResponseEnvelope]:
        """Execute structured JSON extraction strictly validated against a Pydantic schema."""
        candidates = self.router.resolve_provider_candidates(
            task_type=task_type,
            preferred_provider=preferred_provider,
        )

        last_error: Optional[Exception] = None

        for provider in candidates:
            try:
                validated_data, envelope = await provider.generate_structured(
                    prompt=prompt,
                    schema=schema,
                    system_instruction=system_instruction,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                return validated_data, envelope
            except (AIStructuredOutputError, AIInvalidResponse, AIProviderUnavailable, AIRequestTimeout) as err:
                last_error = err
                logger.warning(
                    "Structured generation failed with provider '%s': %s. Trying fallback.",
                    provider.provider_name,
                    err,
                )
                continue
            except AIProviderNotConfigured:
                continue

        # If all failed, provide a valid default empty instance of schema to maintain stability
        logger.error("All providers failed structured extraction. Producing fallback instance. Error: %s", last_error)
        try:
            fallback_instance = schema.model_validate({})
        except Exception:
            # If schema requires fields, construct using mock local provider text
            local = self.router.get_provider("local_fallback")
            fallback_instance, envelope = await local.generate_structured(
                prompt=prompt,
                schema=schema,
                system_instruction=system_instruction,
            )
            return fallback_instance, envelope

        fallback_envelope = AIResponseEnvelope(
            success=False,
            provider="fallback",
            model="default-schema",
            text="{}",
            structured_data=fallback_instance.model_dump(),
            latency_ms=0.0,
            error=str(last_error),
        )
        return fallback_instance, fallback_envelope

    async def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate vector embeddings for input strings."""
        hf_provider = self.router.get_provider("huggingface")
        if isinstance(hf_provider, HuggingFaceProvider):
            return await hf_provider.generate_embeddings(texts)
        raise AIProviderUnavailable("Hugging Face provider not registered.", provider="huggingface")

    async def compute_similarity(self, text_a: str, text_b: str) -> float:
        """Compute cosine similarity score between two texts."""
        hf_provider = self.router.get_provider("huggingface")
        if isinstance(hf_provider, HuggingFaceProvider):
            return await hf_provider.compute_similarity(text_a, text_b)
        raise AIProviderUnavailable("Hugging Face provider not registered.", provider="huggingface")

    async def extract_investigative_leads(
        self, narrative: str
    ) -> Tuple[InvestigativeLeadExtraction, AIResponseEnvelope]:
        """Extract structured entities (persons, aliases, gangs, locations, MO) from crime narrative."""
        system_instruction = (
            "You are a specialized Criminal Intelligence Analyst for law enforcement. "
            "Extract all entities, aliases, syndicate names, crime scenes, vehicles, and modus operandi."
        )
        prompt = f"Extract all investigative entities from this FIR or crime record narrative:\n\n{narrative}"

        return await self.generate_structured(
            prompt=prompt,
            schema=InvestigativeLeadExtraction,
            task_type=TaskType.STRUCTURED_EXTRACTION,
            system_instruction=system_instruction,
        )

    async def explain_anomaly(
        self, anomaly_data: Dict[str, Any]
    ) -> Tuple[AnomalyExplanationOutput, AIResponseEnvelope]:
        """Produce investigator-friendly reasoning and actionable next steps for a detected anomaly."""
        system_instruction = (
            "You are an AI Forensic Crime Analyst. Analyze the provided anomalous indicators "
            "and generate a clear, professional summary with concrete investigative actions."
        )
        prompt = (
            f"Explain the following detected crime network anomaly:\n"
            f"Indicator Data: {anomaly_data}\n"
            f"Provide title, severity, confidence, detailed explanation, and recommended investigative actions."
        )

        return await self.generate_structured(
            prompt=prompt,
            schema=AnomalyExplanationOutput,
            task_type=TaskType.ANOMALY_EXPLANATION,
            system_instruction=system_instruction,
        )

    def get_health(self) -> OverallAIHealthResponse:
        """Inspect provider readiness passively without paid calls."""
        return self.health_service.check_health()


# Global Singleton Instance
ai_service = AIService()
