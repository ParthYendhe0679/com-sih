"""InsightGenerator: formats explainable intelligence leads with strict Fact vs Inference separation."""

import uuid
from typing import Any, Dict, List
from app.ai_ml.models.ai_models import IntelligenceInsight
from app.models.case import Case


class InsightGenerator:
    """Generates structured investigation leads clearly separating observed facts from AI inferences."""

    def build_case_lead_insight(
        self,
        case: Case,
        title: str,
        summary: str,
        confidence: float,
        facts: List[str],
        inferences: List[str],
        supporting_records: List[str],
        limitations: str,
        priority: str = "MEDIUM",
        insight_type: str = "INVESTIGATION_LEAD",
    ) -> IntelligenceInsight:
        """Construct an IntelligenceInsight with validated boundaries."""
        return IntelligenceInsight(
            id=uuid.uuid4(),
            case_id=case.id,
            insight_type=insight_type,
            title=title,
            summary=summary,
            confidence=round(confidence, 4),
            facts=facts,
            inferences=inferences,
            supporting_records=supporting_records,
            limitations=limitations,
            priority=priority,
        )


insight_generator = InsightGenerator()
