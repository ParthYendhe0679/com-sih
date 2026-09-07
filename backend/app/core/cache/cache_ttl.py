"""Centralized Cache TTL Configuration for KRITAGAS.

Defines optimal expiration times per data volatility and computation cost.
"""


class CacheTTL:
    """Time-to-live settings (in seconds)."""

    # Case Details & Metadata: 5 minutes
    CASE = 300

    # Entity Profiles & Attributes: 10 minutes
    ENTITY = 600

    # Multi-Entity Search Results: 2 minutes (shorter for dynamic exploration)
    SEARCH = 120

    # Dashboard Aggregations & Metrics: 1 minute (high freshness requirement)
    DASHBOARD = 60

    # Network Visualization Graphs: 10 minutes (computationally heavy)
    NETWORK = 600

    # Investigation Chronological Timelines: 5 minutes
    TIMELINE = 300

    # AI Model Inference & Summaries: 30 minutes (expensive token consumption)
    AI_RESULT = 1800

    # SAMANVAYA Multi-Agent Synthesized Findings: 30 minutes
    AGENT_RESULT = 1800

    # Short Grace/Deduplication Lock: 30 seconds
    DEDUPLICATION_LOCK = 30
