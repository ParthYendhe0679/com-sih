"""Pydantic schemas for AI requests, responses, health checks, and structured outputs."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TaskType(str, Enum):
    """Investigation AI task categories used for intelligent provider routing."""
    TEXT_COMPLETION = "text_completion"
    STRUCTURED_EXTRACTION = "structured_extraction"
    SUMMARIZATION = "summarization"
    INTELLIGENCE_REPORT = "intelligence_report"
    EMBEDDING = "embedding"
    ANOMALY_EXPLANATION = "anomaly_explanation"
    ENTITY_RESOLUTION = "entity_resolution"


class AIRequest(BaseModel):
    """Standardized input parameters for AI generation tasks."""
    prompt: str = Field(..., min_length=1, description="Primary user or task prompt")
    system_instruction: Optional[str] = Field(None, description="System prompt guidance")
    task_type: TaskType = Field(default=TaskType.TEXT_COMPLETION, description="Routing task category")
    temperature: float = Field(default=0.2, ge=0.0, le=2.0, description="Sampling temperature")
    max_tokens: int = Field(default=1024, ge=1, le=8192, description="Max generated tokens")
    preferred_provider: Optional[str] = Field(None, description="Force a specific provider if available")
    json_mode: bool = Field(default=False, description="Enforce JSON object return")


class AIResponseEnvelope(BaseModel):
    """Standardized response format returned across all AI providers."""
    success: bool = Field(default=True, description="Whether inference completed successfully")
    provider: str = Field(..., description="Provider identifier (groq, gemini, huggingface, local_fallback)")
    model: str = Field(..., description="Exact model name used for generation")
    text: str = Field(..., description="Generated text output")
    structured_data: Optional[Dict[str, Any]] = Field(None, description="Parsed JSON or Pydantic data if applicable")
    latency_ms: float = Field(..., description="Round-trip latency in milliseconds")
    tokens_used: Optional[int] = Field(None, description="Total tokens consumed if reported by provider")
    cached: bool = Field(default=False, description="Whether response was served from cache")
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    error: Optional[str] = Field(None, description="Error message if inference failed")


class ProviderHealthStatus(BaseModel):
    """Individual provider operational and credential status."""
    provider: str
    configured: bool
    enabled: bool
    model: str
    active_key_index: Optional[int] = None
    key_masked: Optional[str] = None
    status: str  # "ready", "unconfigured", "disabled", "error"
    details: Optional[str] = None


class OverallAIHealthResponse(BaseModel):
    """Aggregated health probe response for all AI providers."""
    status: str  # "healthy", "degraded", "offline"
    default_provider: str
    configured_providers: List[str]
    providers: Dict[str, ProviderHealthStatus]
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# Pre-defined Structured Output Schemas for Investigation Intelligence
class InvestigativeLeadExtraction(BaseModel):
    """Structured extraction of criminal entities and patterns from unstructured narratives."""
    persons: List[str] = Field(default_factory=list, description="Suspects, victims, associates")
    aliases: List[str] = Field(default_factory=list, description="Known aliases or street names")
    organizations: List[str] = Field(default_factory=list, description="Gangs, syndicates, front companies")
    locations: List[str] = Field(default_factory=list, description="Crime scenes, addresses, cities")
    vehicles: List[str] = Field(default_factory=list, description="Vehicle numbers, make/model")
    modis_operandi: List[str] = Field(default_factory=list, description="Techniques or patterns observed")
    summary: str = Field("", description="Executive summary of the extraction")


class AnomalyExplanationOutput(BaseModel):
    """Structured anomaly analysis explanation for investigators."""
    title: str = Field(..., description="Concise anomaly title")
    severity: str = Field(..., description="Severity level: LOW, MEDIUM, HIGH, CRITICAL")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    explanation: str = Field(..., description="Detailed explanation of anomalous pattern")
    recommended_actions: List[str] = Field(default_factory=list, description="Suggested investigator next steps")
