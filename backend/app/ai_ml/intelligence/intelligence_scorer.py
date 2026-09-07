"""Intelligence Scoring: calculates investigation priority and relevance without attributing guilt."""

from typing import Any, Dict


class IntelligenceScorer:
    """Calculates overall investigation priority based on evidentiary weight and network connectivity."""

    def calculate_investigation_priority(
        self,
        evidence_count: int,
        correlation_count: int,
        similar_case_count: int,
        anomaly_count: int,
        max_network_centrality: float = 0.0,
    ) -> Dict[str, Any]:
        """Compute investigation priority score [0.0, 1.0] and component metrics.

        Never represents 'guilt' or 'criminal score'. Measures strictly investigative priority and lead density.
        """
        # Evidence component (0.0 to 1.0)
        ev_score = min(1.0, 0.20 * evidence_count)
        # Correlation strength
        corr_score = min(1.0, 0.25 * correlation_count)
        # Network graph centrality
        net_score = min(1.0, max_network_centrality * 1.5)
        # Historical context
        hist_score = min(1.0, 0.30 * similar_case_count)
        # Anomaly urgency
        anom_score = min(1.0, 0.35 * anomaly_count)

        overall = (
            0.30 * ev_score
            + 0.25 * corr_score
            + 0.15 * net_score
            + 0.15 * hist_score
            + 0.15 * anom_score
        )
        overall = round(float(min(1.0, max(0.15, overall))), 4)

        if overall >= 0.80:
            classification = "HIGH_INVESTIGATION_PRIORITY"
        elif overall >= 0.50:
            classification = "MEDIUM_INVESTIGATION_PRIORITY"
        else:
            classification = "ROUTINE_INVESTIGATION_PRIORITY"

        return {
            "score": overall,
            "classification": classification,
            "components": {
                "evidence_density": round(ev_score, 2),
                "correlation_strength": round(corr_score, 2),
                "network_significance": round(net_score, 2),
                "historical_similarity": round(hist_score, 2),
                "anomaly_urgency": round(anom_score, 2),
            },
        }


intelligence_scorer = IntelligenceScorer()
