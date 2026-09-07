"""KRITAGAS AI/ML Intelligence Engine master module.

Uses PEP 562 lazy attribute loading to eliminate circular imports between
database models, intelligence engines, and similarity providers.
"""

from app.ai_ml.config import aiml_settings

__all__ = [
    "aiml_settings",
    "MasterIntelligenceEngine",
    "master_intelligence_engine",
    "AIProviderOrchestrator",
    "ai_orchestrator",
]


def __getattr__(name: str):
    if name in ("MasterIntelligenceEngine", "master_intelligence_engine"):
        from app.ai_ml.intelligence_engine import (
            MasterIntelligenceEngine,
            master_intelligence_engine,
        )
        return locals()[name]
    if name in ("AIProviderOrchestrator", "ai_orchestrator"):
        from app.ai_ml.orchestrator import AIProviderOrchestrator, ai_orchestrator
        return locals()[name]
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")
