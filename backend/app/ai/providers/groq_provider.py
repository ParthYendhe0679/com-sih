"""Groq Cloud AI Provider Implementation."""

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

logger = get_logger("kritagas.ai.groq")


class GroqProvider(BaseAIProvider):
    """Groq Cloud provider leveraging ultra-fast LPU inference (Llama-3)."""

    provider_name: str = "groq"

    def __init__(self):
        self._client = None
        self._cached_key = None

    @property
    def model_name(self) -> str:
        return settings.GROQ_MODEL

    def is_configured(self) -> bool:
        return bool(settings.get_active_groq_key())

    def is_enabled(self) -> bool:
        return bool(settings.AI_ENABLE_GROQ)

    def _get_client(self):
        """Lazy load and cache the AsyncGroq client."""
        active_key = settings.get_active_groq_key()
        if not active_key:
            return None

        if self._client is None or self._cached_key != active_key:
            try:
                from groq import AsyncGroq
                self._client = AsyncGroq(api_key=active_key, timeout=float(settings.AI_REQUEST_TIMEOUT))
                self._cached_key = active_key
            except ImportError as err:
                logger.error("groq package is not installed: %s", err)
                return None
            except Exception as err:
                logger.error("Failed to initialize AsyncGroq: %s", err)
                return None

        return self._client

    async def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 1024,
        json_mode: bool = False,
    ) -> AIResponseEnvelope:
        if not self.is_configured():
            raise AIProviderNotConfigured("Groq API key is not configured.", provider=self.provider_name)
        if not self.is_enabled():
            raise AIProviderNotConfigured("Groq provider is disabled in settings.", provider=self.provider_name)

        client = self._get_client()
        if client is None:
            raise AIProviderUnavailable("Groq client could not be initialized.", provider=self.provider_name)

        messages = []
        sys_content = system_instruction or ""
        if json_mode and "json" not in sys_content.lower() and "json" not in prompt.lower():
            sys_content = (sys_content + "\nProvide output in valid JSON format.").strip()

        if sys_content:
            messages.append({"role": "system", "content": sys_content})
        messages.append({"role": "user", "content": prompt})

        kwargs = {
            "model": self.model_name,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}

        start = time.perf_counter()
        try:
            call_coro = client.chat.completions.create(**kwargs)
            resp = await asyncio.wait_for(call_coro, timeout=float(settings.AI_REQUEST_TIMEOUT))
            latency = (time.perf_counter() - start) * 1000.0

            content = resp.choices[0].message.content or ""
            tokens_used = resp.usage.total_tokens if hasattr(resp, "usage") and resp.usage else None

            return AIResponseEnvelope(
                success=True,
                provider=self.provider_name,
                model=self.model_name,
                text=content,
                latency_ms=round(latency, 2),
                tokens_used=tokens_used,
            )
        except asyncio.TimeoutError as err:
            raise AIRequestTimeout(
                f"Groq request timed out after {settings.AI_REQUEST_TIMEOUT}s",
                provider=self.provider_name,
            ) from err
        except Exception as err:
            logger.error("Groq API error during generation: %s", err)
            raise AIProviderUnavailable(
                f"Groq API error: {err}",
                provider=self.provider_name,
            ) from err

    def get_health_status(self) -> ProviderHealthStatus:
        active_key = settings.get_active_groq_key()
        configured = bool(active_key)
        enabled = self.is_enabled()
        status = "ready" if (configured and enabled) else ("disabled" if not enabled else "unconfigured")

        return ProviderHealthStatus(
            provider=self.provider_name,
            configured=configured,
            enabled=enabled,
            model=self.model_name,
            active_key_index=settings.GROQ_PRIMARY_KEY_INDEX,
            key_masked=self.mask_key(active_key),
            status=status,
            details=f"Primary key index {settings.GROQ_PRIMARY_KEY_INDEX} ({'set' if configured else 'missing'})",
        )
