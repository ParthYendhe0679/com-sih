"""ExplainabilityEngine: delivers granular, evidentiary 'WHY' breakdowns for investigators."""

from typing import Any, Dict, List, Optional
from app.ai_ml.models.ai_models import CaseSimilarity, Correlation, IntelligenceInsight


class ExplanationEngine:
    """Provides human-readable, auditable justifications for all AI-assisted investigation leads."""

    def explain_case_similarity(self, similarity: CaseSimilarity) -> Dict[str, Any]:
        """Explain why two cases were matched by the similarity engine."""
        features = similarity.common_features or {}
        reasons = []

        if cc_match := features.get("crime_category"):
            reasons.append(f"Identical statutory crime category ({cc_match})")
        if mo_kws := features.get("mo_keywords"):
            reasons.append(f"Shared operational signature keywords: {', '.join(mo_kws)}")
        if shared_ents := features.get("shared_entities"):
            reasons.append(f"Co-occurring entity identifiers: {', '.join(shared_ents[:3])}")
        if similarity.semantic_score >= 0.70:
            reasons.append(f"High natural language narrative vector overlap ({int(similarity.semantic_score * 100)}%)")

        return {
            "query": "WHY ARE THESE CASES SIMILAR?",
            "similarity_score": similarity.similarity_score,
            "confidence_percentage": f"{int(similarity.similarity_score * 100)}%",
            "reasons": reasons if reasons else ["General cross-case textual and classification similarity."],
            "breakdown": {
                "semantic": similarity.semantic_score,
                "modus_operandi": similarity.modus_operandi_score,
                "entity_overlap": similarity.entity_overlap_score,
                "location": similarity.location_score,
                "temporal": similarity.temporal_score,
            },
            "supporting_records": similarity.supporting_records or [],
            "limitations": (
                "Similarity assessment reflects text narratives, classification codes, and registered entities. "
                "Human detective review required to confirm operational linkage."
            ),
        }

    def explain_correlation(self, correlation: Correlation) -> Dict[str, Any]:
        """Explain the rationale and evidence chain supporting a cross-source correlation."""
        return {
            "query": "WHY IS THIS CORRELATION SUGGESTED?",
            "correlation_type": correlation.correlation_type,
            "confidence": correlation.confidence,
            "summary": correlation.description,
            "evidence_hops": correlation.evidence_chain or [],
            "source_records": correlation.source_records or [],
            "limitations": (
                "Correlations represent investigative hypotheses derived from digital, telecommunication, "
                "and financial breadcrumbs. Does not constitute autonomous legal proof."
            ),
        }

    def explain_insight(self, insight: IntelligenceInsight) -> Dict[str, Any]:
        """Explain an intelligence insight with separation of factual premises and inferences."""
        return {
            "insight_id": str(insight.id),
            "title": insight.title,
            "summary": insight.summary,
            "confidence": insight.confidence,
            "priority": insight.priority,
            "verified_facts": insight.facts or [],
            "ai_inferences": insight.inferences or [],
            "supporting_records": insight.supporting_records or [],
            "limitations": insight.limitations or "Standard algorithmic analysis limitations apply.",
        }


explanation_engine = ExplanationEngine()
