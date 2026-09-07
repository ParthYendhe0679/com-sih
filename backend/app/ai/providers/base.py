"""Abstract Base Class for AI Providers."""

from abc import ABC, abstractmethod
import json
import re
from typing import Any, Dict, Optional, Tuple, Type, TypeVar
from pydantic import BaseModel, ValidationError

from app.ai.exceptions import AIInvalidResponse, AIStructuredOutputError
from app.ai.schemas.ai import AIResponseEnvelope, ProviderHealthStatus

T = TypeVar("T", bound=BaseModel)


class BaseAIProvider(ABC):
    """Abstract interface defining required methods for any KRITAGAS AI provider."""

    provider_name: str = "base"

    @property
    @abstractmethod
    def model_name(self) -> str:
        """The default or configured model name for this provider."""
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """Return True if required API credentials/keys are present."""
        pass

    @abstractmethod
    def is_enabled(self) -> bool:
        """Return True if this provider is enabled via settings."""
        pass

    @abstractmethod
    async def generate_text(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 1024,
        json_mode: bool = False,
    ) -> AIResponseEnvelope:
        """Generate unstructured or raw text/JSON from the provider."""
        pass

    async def generate_structured(
        self,
        prompt: str,
        schema: Type[T],
        system_instruction: Optional[str] = None,
        temperature: float = 0.1,
        max_tokens: int = 1024,
    ) -> Tuple[T, AIResponseEnvelope]:
        """Generate structured data strictly validated against a Pydantic schema."""
        # Enforce JSON output instructions
        schema_json = json.dumps(schema.model_json_schema(), indent=2)
        structured_instruction = (
            f"{system_instruction or ''}\n\n"
            "CRITICAL REQUIREMENT: Return ONLY a valid JSON object matching this JSON Schema:\n"
            f"{schema_json}\n"
            "Do NOT include markdown fences, code blocks, or explanatory comments. Return ONLY raw JSON."
        ).strip()

        envelope = await self.generate_text(
            prompt=prompt,
            system_instruction=structured_instruction,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=True,
        )

        raw_text = envelope.text.strip()
        parsed_dict = self._extract_json_from_text(raw_text)

        try:
            validated_obj = schema.model_validate(parsed_dict)
            envelope.structured_data = validated_obj.model_dump()
            return validated_obj, envelope
        except ValidationError as val_err:
            raise AIStructuredOutputError(
                f"Failed to validate response against {schema.__name__}: {val_err}",
                provider=self.provider_name,
                details={"raw_text": raw_text, "validation_errors": val_err.errors()},
            ) from val_err

    @abstractmethod
    def get_health_status(self) -> ProviderHealthStatus:
        """Return provider configuration and readiness status without making paid API calls."""
        pass

    @staticmethod
    def _extract_json_from_text(text: str) -> Dict[str, Any]:
        """Extract and parse a JSON object from raw response text, handling markdown fences."""
        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Strip markdown fences if present (```json ... ```)
        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.DOTALL)
        if fence_match:
            try:
                return json.loads(fence_match.group(1))
            except json.JSONDecodeError:
                pass

        # Look for first { and last }
        brace_start = text.find("{")
        brace_end = text.rfind("}")
        if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
            candidate = text[brace_start : brace_end + 1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass

        raise AIInvalidResponse(
            f"Unable to parse valid JSON from AI output: {text[:200]}...",
            provider="base",
            details={"raw_output": text},
        )

    @staticmethod
    def mask_key(key: Optional[str]) -> Optional[str]:
        """Return masked key for safe debugging/health monitoring without leaking secrets."""
        if not key or not key.strip():
            return None
        stripped = key.strip()
        if len(stripped) <= 8:
            return "****"
        return f"{stripped[:4]}...{stripped[-4:]}"
