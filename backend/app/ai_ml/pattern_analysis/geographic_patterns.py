"""Geographic hotspot and spatial clustering pattern analyzer."""

from collections import Counter
from typing import Any, Dict, List, Optional
from app.ai_ml.utils.metrics import haversine_distance_km


class GeographicPatternAnalyzer:
    """Detects spatial co-location, high-density incident corridors, and hotspot clusters."""

    def analyze_locations(
        self,
        locations: List[str],
    ) -> Optional[Dict[str, Any]]:
        """Identify repeated geographical locations or station corridors."""
        if not locations:
            return None

        # Clean locations
        cleaned = [loc.strip() for loc in locations if loc and loc.strip()]
        if len(cleaned) < 2:
            return None

        counts = Counter(cleaned)
        most_common, freq = counts.most_common(1)[0]

        if freq >= 2:
            ratio = freq / len(cleaned)
            return {
                "pattern_type": "GEOGRAPHIC_HOTSPOT",
                "hotspot_location": most_common,
                "incident_count": freq,
                "confidence": round(min(0.95, 0.50 + 0.15 * freq), 2),
                "description": f"Repeated incident clustering localized at '{most_common}' ({freq} linked cases/reports).",
            }
        return None


geographic_pattern_analyzer = GeographicPatternAnalyzer()
