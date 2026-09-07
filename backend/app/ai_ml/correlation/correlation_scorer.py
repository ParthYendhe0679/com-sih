"""Confidence propagation and scoring for multi-hop correlation chains."""

from typing import Any, Dict, List


class CorrelationScorer:
    """Calculates overall chain confidence accounting for evidentiary decay across hops."""

    def score_chain(self, hops: List[Dict[str, Any]]) -> float:
        """Calculate compound confidence across a multi-hop evidence chain.

        Each hop incurs a slight decay penalty to avoid overconfidence on deep inferences.
        """
        if not hops:
            return 0.0

        confidence = 1.0
        hop_decay = 0.95

        for hop in hops:
            hop_conf = float(hop.get("confidence", 0.8))
            confidence *= hop_conf * hop_decay

        # Bound score in [0.1, 0.99]
        return round(float(max(0.10, min(0.99, confidence))), 4)


correlation_scorer = CorrelationScorer()
