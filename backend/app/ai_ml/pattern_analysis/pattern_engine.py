"""PatternEngine: coordinates cross-case modus operandi, spatial, and temporal pattern detection."""

import uuid
from typing import Any, Dict, List
from app.ai_ml.models.ai_models import IntelligenceInsight
from app.ai_ml.pattern_analysis.geographic_patterns import geographic_pattern_analyzer
from app.ai_ml.pattern_analysis.temporal_patterns import temporal_pattern_analyzer
from app.models.case import Case


class PatternEngine:
    """Discovers recurring crime signatures and operational patterns across investigation records."""

    def __init__(self):
        self.temporal_analyzer = temporal_pattern_analyzer
        self.geo_analyzer = geographic_pattern_analyzer

    def analyze_case_patterns(
        self,
        case: Case,
        similar_cases: List[Case],
    ) -> List[IntelligenceInsight]:
        """Synthesize patterns between the active case and historical similar cases."""
        insights: List[IntelligenceInsight] = []
        all_cases = [case] + similar_cases

        # 1. Modus Operandi Pattern
        if similar_cases:
            categories = [c.crime_category for c in all_cases]
            shared_cat = case.crime_category
            matching = [c.case_number for c in similar_cases if c.crime_category.lower() == shared_cat.lower()]
            if matching:
                conf = min(0.92, 0.65 + 0.08 * len(matching))
                insights.append(
                    IntelligenceInsight(
                        id=uuid.uuid4(),
                        case_id=case.id,
                        insight_type="MODUS_OPERANDI_PATTERN",
                        title=f"Recurring {shared_cat} Modus Operandi Pattern",
                        summary=(
                            f"Multiple historical cases demonstrate matching operational profile in {shared_cat} "
                            f"category across {len(matching) + 1} investigation dockets."
                        ),
                        confidence=conf,
                        facts=[
                            f"Current case: {case.case_number} registered under {shared_cat}",
                            f"Identical classification found in: {', '.join(matching[:3])}",
                        ],
                        inferences=[
                            "Potential organized syndicate or copycat methodology operating with shared tactics.",
                        ],
                        supporting_records=[case.case_number] + matching[:3],
                        limitations="Based on available FIR category and narrative metadata in authorized database.",
                        priority="HIGH" if conf >= 0.80 else "MEDIUM",
                    )
                )

        # 2. Geographic Hotspot Pattern
        locations = []
        for c in all_cases:
            loc = (c.fir.incident_location if c.fir else None) or getattr(c, "incident_location", None)
            if loc:
                locations.append(loc)

        geo_pattern = self.geo_analyzer.analyze_locations(locations)
        if geo_pattern:
            insights.append(
                IntelligenceInsight(
                    id=uuid.uuid4(),
                    case_id=case.id,
                    insight_type="GEOGRAPHIC_PATTERN",
                    title=f"Spatial Hotspot: {geo_pattern['hotspot_location']}",
                    summary=geo_pattern["description"],
                    confidence=geo_pattern["confidence"],
                    facts=[
                        f"{geo_pattern['incident_count']} incidents recorded in the immediate vicinity of '{geo_pattern['hotspot_location']}'"
                    ],
                    inferences=[
                        "Area may represent target zone, logistical transit corridor, or syndicate operational base."
                    ],
                    supporting_records=[c.case_number for c in all_cases[:3]],
                    limitations="Spatial coordinates derived from station FIR incident location strings.",
                    priority="HIGH",
                )
            )

        # 3. Temporal Pattern
        timestamps = [c.created_at for c in all_cases if c.created_at]
        temp_pattern = self.temporal_analyzer.analyze_timestamps(timestamps)
        if temp_pattern:
            insights.append(
                IntelligenceInsight(
                    id=uuid.uuid4(),
                    case_id=case.id,
                    insight_type="TEMPORAL_PATTERN",
                    title="Temporal Execution Window Cluster",
                    summary=temp_pattern["description"],
                    confidence=temp_pattern["confidence"],
                    facts=[temp_pattern["metric"]],
                    inferences=["Offenders demonstrate preference for specific time windows to minimize detection."],
                    supporting_records=[c.case_number for c in all_cases[:3]],
                    limitations="Temporal logs subject to reporting delay vs actual incident time.",
                    priority="MEDIUM",
                )
            )

        return insights


pattern_engine = PatternEngine()
