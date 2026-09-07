"""Task-based AI Provider Router with graceful fallback."""

from typing import Dict, List, Optional
from app.ai.exceptions import AIProviderNotConfigured, AIProviderUnavailable
from app.ai.providers.base import BaseAIProvider
from app.ai.providers.gemini_provider import GeminiProvider
from app.ai.providers.groq_provider import GroqProvider
from app.ai.providers.huggingface_provider import HuggingFaceProvider
from app.ai.providers.local_provider import LocalFallbackProvider
from app.ai.schemas.ai import TaskType
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("kritagas.ai.router")


class AIProviderRouter:
    """Manages provider instances and routes requests based on task specialization and availability."""

    def __init__(self):
        self.providers: Dict[str, BaseAIProvider] = {
            "groq": GroqProvider(),
            "gemini": GeminiProvider(),
            "huggingface": HuggingFaceProvider(),
            "local_fallback": LocalFallbackProvider(),
        }

        # Priority chains per task type
        self.task_routing: Dict[TaskType, List[str]] = {
            TaskType.TEXT_COMPLETION: ["groq", "gemini", "local_fallback"],
            TaskType.STRUCTURED_EXTRACTION: ["groq", "gemini", "local_fallback"],
            TaskType.SUMMARIZATION: ["gemini", "groq", "local_fallback"],
            TaskType.INTELLIGENCE_REPORT: ["gemini", "groq", "local_fallback"],
            TaskType.EMBEDDING: ["huggingface"],
            TaskType.ANOMALY_EXPLANATION: ["groq", "gemini", "local_fallback"],
            TaskType.ENTITY_RESOLUTION: ["groq", "huggingface", "local_fallback"],
        }

    def get_provider(self, provider_name: str) -> Optional[BaseAIProvider]:
        """Retrieve a specific provider by name."""
        return self.providers.get(provider_name.lower().strip())

    def resolve_provider_candidates(
        self,
        task_type: TaskType = TaskType.TEXT_COMPLETION,
        preferred_provider: Optional[str] = None,
    ) -> List[BaseAIProvider]:
        """Resolve an ordered list of viable provider instances based on preferences and availability."""
        candidates: List[BaseAIProvider] = []

        # 1. If user or caller explicitly requested a preferred provider
        if preferred_provider:
            pref = self.get_provider(preferred_provider)
            if pref and pref.is_configured() and pref.is_enabled():
                candidates.append(pref)

        # 2. Add task-specific priority chain
        task_chain = self.task_routing.get(task_type, ["groq", "gemini", "local_fallback"])
        for p_name in task_chain:
            provider = self.providers.get(p_name)
            if provider and provider not in candidates:
                # Include if configured and enabled, or if it's the ultimate local fallback
                if (provider.is_configured() and provider.is_enabled()) or p_name == "local_fallback":
                    candidates.append(provider)

        # 3. Ensure local fallback is always present as the safety net
        local = self.providers.get("local_fallback")
        if local and local not in candidates:
            candidates.append(local)

        return candidates

    def get_default_provider_name(self) -> str:
        """Return the configured default provider from settings."""
        return settings.AI_DEFAULT_PROVIDER.lower().strip()
