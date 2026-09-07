"""Multi-attribute confidence calculation and evidence aggregation for Entity Resolution."""

from typing import Any, Dict, List, Tuple
from app.ai_ml.config import aiml_settings
from app.ai_ml.entity_resolution.similarity import (
    compute_address_similarity,
    compute_name_similarity,
    compute_phone_similarity,
    compute_vehicle_similarity,
)
from app.ai_ml.models.ai_models import Entity


class EntityMatchConfidenceScorer:
    """Calculates granular confidence and evidence points for candidate entity matches."""

    def score_pair(
        self,
        e1: Entity,
        e2: Entity,
    ) -> Tuple[float, Dict[str, float], List[str], List[str]]:
        """Score candidate match between e1 and e2.

        Returns:
            (overall_confidence, similarity_breakdown, supporting_evidence, conflicting_evidence)
        """
        breakdown: Dict[str, float] = {}
        supporting: List[str] = []
        conflicting: List[str] = []

        etype = e1.entity_type.upper()

        if etype in ("PERSON", "SUSPECT", "VICTIM"):
            # 1. Name similarity
            name_sim = compute_name_similarity(e1.name, e2.name)
            breakdown["name_similarity"] = name_sim
            if name_sim >= 0.80:
                supporting.append(f"High name phonetic & token similarity ({int(name_sim * 100)}%)")
            elif name_sim < 0.50:
                conflicting.append(f"Substantial name divergence ('{e1.name}' vs '{e2.name}')")

            # 2. Phone attribute comparison
            attrs1 = e1.attributes_json or {}
            attrs2 = e2.attributes_json or {}
            p1 = attrs1.get("phone")
            p2 = attrs2.get("phone")
            phone_sim = 0.0
            if p1 and p2:
                phone_sim = compute_phone_similarity(str(p1), str(p2))
                breakdown["phone_match"] = phone_sim
                if phone_sim >= 0.90:
                    supporting.append(f"Exact telephone match ({p1})")
                elif phone_sim == 0.0:
                    conflicting.append(f"Divergent phone numbers ({p1} vs {p2})")

            # 3. Address comparison
            a1 = attrs1.get("address")
            a2 = attrs2.get("address")
            addr_sim = 0.0
            if a1 and a2:
                addr_sim = compute_address_similarity(str(a1), str(a2))
                breakdown["address_similarity"] = addr_sim
                if addr_sim >= 0.60:
                    supporting.append(f"Significant residential/work address overlap ({int(addr_sim * 100)}%)")

            # 4. Contextual co-occurrence
            context_sim = 0.0
            if e1.case_id and e2.case_id and e1.case_id == e2.case_id:
                context_sim = 0.85
                breakdown["context_similarity"] = context_sim
                supporting.append("Co-occurred in the same investigation case docket")

            # Weighted aggregation
            weights = aiml_settings
            # Dynamic reweighting if phone or address not present
            w_name = weights.WEIGHT_NAME_SIMILARITY
            w_phone = weights.WEIGHT_PHONE_MATCH if p1 and p2 else 0.0
            w_addr = weights.WEIGHT_ADDRESS_SIMILARITY if a1 and a2 else 0.0
            w_ctx = weights.WEIGHT_CONTEXT_SIMILARITY if context_sim > 0.0 else 0.0

            total_w = w_name + w_phone + w_addr + w_ctx
            if total_w > 0.0:
                score = (
                    w_name * name_sim
                    + w_phone * phone_sim
                    + w_addr * addr_sim
                    + w_ctx * context_sim
                ) / total_w
            else:
                score = name_sim

        elif etype in ("PHONE", "MOBILE", "TELECOM"):
            score = compute_phone_similarity(e1.name, e2.name)
            breakdown["phone_similarity"] = score
            if score >= 0.90:
                supporting.append("Matching 10-digit subscriber identifier")
            else:
                conflicting.append("Subscriber number mismatch")

        elif etype in ("VEHICLE", "CAR", "BIKE"):
            score = compute_vehicle_similarity(e1.name, e2.name)
            breakdown["vehicle_similarity"] = score
            if score >= 0.90:
                supporting.append(f"Vehicle registration plate match: {e1.name}")
            else:
                conflicting.append(f"Differing registration numbers: {e1.name} vs {e2.name}")

        else:
            # Default token match
            name_sim = compute_name_similarity(e1.name, e2.name)
            breakdown["name_similarity"] = name_sim
            score = name_sim
            if name_sim >= 0.75:
                supporting.append(f"High identifier string match ({int(name_sim * 100)}%)")

        return round(float(score), 4), breakdown, supporting, conflicting
