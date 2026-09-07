"""KRITAGAS AI Pipeline Exceptions."""


class AIError(Exception):
    """Base exception for all AI/ML pipeline errors."""

    def __init__(self, message: str, provider: str = "unknown", details: dict = None):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.details = details or {}


class AIProviderNotConfigured(AIError):
    """Raised when an AI provider is invoked but has no valid credentials configured."""
    pass


class AIProviderUnavailable(AIError):
    """Raised when an external AI provider fails, returns HTTP 5xx, or encounters network failure."""
    pass


class AIRequestTimeout(AIError):
    """Raised when an external inference request exceeds the configured timeout."""
    pass


class AIInvalidResponse(AIError):
    """Raised when the AI provider returns an empty, corrupted, or unparsable response."""
    pass


class AIStructuredOutputError(AIError):
    """Raised when an AI response fails schema validation against expected Pydantic model."""
    pass
