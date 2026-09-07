"""Temporal recurrence and operational window pattern analyzer."""

from datetime import datetime
from typing import Any, Dict, List, Optional


class TemporalPatternAnalyzer:
    """Analyzes timestamp distributions to identify operational schedules or recurring crime windows."""

    def analyze_timestamps(
        self,
        datetimes: List[datetime],
    ) -> Optional[Dict[str, Any]]:
        """Identify if events cluster in specific hours (e.g. night-time window) or days."""
        if len(datetimes) < 2:
            return None

        hours = [dt.hour for dt in datetimes]
        # Night window: 22:00 to 05:00
        night_events = sum(1 for h in hours if h >= 22 or h <= 5)
        night_ratio = night_events / len(hours)

        weekdays = [dt.weekday() for dt in datetimes]
        weekend_events = sum(1 for w in weekdays if w >= 5)
        weekend_ratio = weekend_events / len(weekdays)

        if night_ratio >= 0.65:
            return {
                "pattern_type": "TEMPORAL_NIGHT_OPERATION",
                "description": f"Significant operational concentration during night hours (22:00-05:00) ({int(night_ratio * 100)}% of incidents).",
                "confidence": round(float(night_ratio), 2),
                "metric": f"{night_events}/{len(hours)} night incidents",
            }

        if weekend_ratio >= 0.60:
            return {
                "pattern_type": "TEMPORAL_WEEKEND_CLUSTER",
                "description": f"Recurrent activity concentrated on weekends ({int(weekend_ratio * 100)}% of events).",
                "confidence": round(float(weekend_ratio), 2),
                "metric": f"{weekend_events}/{len(weekdays)} weekend incidents",
            }

        return None


temporal_pattern_analyzer = TemporalPatternAnalyzer()
