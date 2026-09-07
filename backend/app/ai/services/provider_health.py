"""Provider health check and probe aggregation service."""

from typing import Dict, List
from app.ai.schemas.ai import OverallAIHealthResponse, ProviderHealthStatus
from app.ai.services.provider_router import AIProviderRouter
from app.core.config import settings


class AIHealthService:
    """Aggregates and formats operational readiness of all AI providers without paid API calls."""

    def __init__(self, router: AIProviderRouter):
        self.router = router

    def check_health(self) -> OverallAIHealthResponse:
        """Inspect provider credentials and operational status passively."""
        statuses: Dict[str, ProviderHealthStatus] = {}
        configured_list: List[str] = []

        for name, provider in self.router.providers.items():
            status = provider.get_health_status()
            statuses[name] = status
            if status.configured and status.enabled and name != "local_fallback":
                configured_list.append(name)

        # Evaluate system status
        has_primary_llm = any(
            statuses.get(p) and statuses[p].configured and statuses[p].enabled
            for p in ("groq", "gemini")
        )

        if has_primary_llm:
            overall_status = "healthy"
        elif configured_list:
            overall_status = "degraded"
        else:
            overall_status = "unconfigured"

        return OverallAIHealthResponse(
            status=overall_status,
            default_provider=settings.AI_DEFAULT_PROVIDER,
            configured_providers=configured_list,
            providers=statuses,
        )
