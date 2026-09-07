"""Google Gemini AI Provider Implementation."""

import asyncio
import time
from typing import Optional

from app.ai.exceptions import (
    AIProviderNotConfigured,
    AIProviderUnavailable,
    AIRequestTimeout,
)
from app.ai.providers.base import BaseAIProvider
from app.ai.schemas.ai import AIResponseEnvelope, ProviderHealthStatus
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("kritagas.ai.gemini")


class GeminiProvider(BaseAIProvider):
    """Google Gemini AI inference provider supporting multimodal reasoning and synthesis."""

    provider_name: str = "gemini"

    def __init__(self):
        self._model = None
        self._cached_key = None

    @property
    def model_name(self) -> str:
        return settings.GEMINI_MODEL

    def is_configured(self) -> bool:
        return bool(settings.get_active_gemini_key())

    def is_enabled(self) -> bool:
        return bool(settings.AI_ENABLE_GEMINI)

    def _get_model(self):
        """Lazy load and initialize the Gemini GenerativeModel."""
        active_key = settings.get_active_gemini_key()
        if not active_key:
            return None

        if self._model is None or self._cached_key != active_key:
            try:
                import google.generativeai as genai

                genai.configure(api_key=active_key)
                self._model = genai.GenerativeModel(self.model_name)
                self._cached_key = active_key
            except ImportError as err:
                logger.error("google-generativeai package is not installed: %s", err)
                return None
            except Exception as err:
                logger.error("Failed to configure Google Gemini: %s", err)
                return None

        return self._model

    async def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 1024,
        json_mode: bool = False,
    ) -> AIResponseEnvelope:
        if not self.is_configured():
            raise AIProviderNotConfigured("Gemini API key is not configured.", provider=self.provider_name)
        if not self.is_enabled():
            raise AIProviderNotConfigured("Gemini provider is disabled in settings.", provider=self.provider_name)

        model = self._get_model()
        if model is None:
            raise AIProviderUnavailable("Gemini model could not be initialized.", provider=self.provider_name)

        # Build prompt
        full_prompt = f"{system_instruction}\n\n{prompt}" if system_instruction else prompt

        generation_config = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
        }
        if json_mode:
            generation_config["response_mime_type"] = "application/json"

        start = time.perf_counter()
        try:
            # Check if generate_content_async is available, otherwise use asyncio.to_thread
            if hasattr(model, "generate_content_async"):
                call_coro = model.generate_content_async(
                    full_prompt,
                    generation_config=generation_config,
                )
            else:
                call_coro = asyncio.to_thread(
                    model.generate_content,
                    full_prompt,
                    generation_config=generation_config,
                )

            resp = await asyncio.wait_for(call_coro, timeout=float(settings.AI_REQUEST_TIMEOUT))
            latency = (time.perf_counter() - start) * 1000.0

            text = ""
            if hasattr(resp, "text"):
                text = resp.text
            elif hasattr(resp, "candidates") and resp.candidates:
                parts = resp.candidates[0].content.parts
                text = "".join(part.text for part in parts if hasattr(part, "text"))

            tokens_used = None
            if hasattr(resp, "usage_metadata") and resp.usage_metadata:
                tokens_used = getattr(resp.usage_metadata, "total_token_count", None)

            return AIResponseEnvelope(
                success=True,
                provider=self.provider_name,
                model=self.model_name,
                text=text,
                latency_ms=round(latency, 2),
                tokens_used=tokens_used,
            )
        except asyncio.TimeoutError as err:
            raise AIRequestTimeout(
                f"Gemini request timed out after {settings.AI_REQUEST_TIMEOUT}s",
                provider=self.provider_name,
            ) from err
        except Exception as err:
            logger.error("Gemini API error during generation: %s", err)
            raise AIProviderUnavailable(
                f"Gemini API error: {err}",
                provider=self.provider_name,
            ) from err

    def get_health_status(self) -> ProviderHealthStatus:
        active_key = settings.get_active_gemini_key()
        configured = bool(active_key)
        enabled = self.is_enabled()
        status = "ready" if (configured and enabled) else ("disabled" if not enabled else "unconfigured")

        return ProviderHealthStatus(
            provider=self.provider_name,
            configured=configured,
            enabled=enabled,
            model=self.model_name,
            active_key_index=settings.GEMINI_PRIMARY_KEY_INDEX,
            key_masked=self.mask_key(active_key),
            status=status,
            details=f"Primary key index {settings.GEMINI_PRIMARY_KEY_INDEX} ({'set' if configured else 'missing'})",
        )
