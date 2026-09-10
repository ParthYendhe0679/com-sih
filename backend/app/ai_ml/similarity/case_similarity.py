"""Multi-factor Case Similarity Engine combining semantic vectors, MO, spatial, and entity overlaps."""

import math
import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple
from app.ai_ml.config import aiml_settings
from app.ai_ml.models.ai_models import CaseSimilarity
from app.ai_ml.similarity.semantic_similarity import semantic_similarity_engine
from app.ai_ml.utils.metrics import haversine_distance_km
from app.models.case import Case


class CaseSimilarityEngine:
    """Computes multi-dimensional similarity between an investigation Case and historical cases."""

    def __init__(self):
        self.semantic_engine = semantic_similarity_engine
        self.weights = aiml_settings

    def compare_cases(
        self,
        source: Case,
        target: Case,
    ) -> CaseSimilarity:
        """Evaluate multi-attribute similarity between source case and a candidate target case."""
        reasons: List[str] = []
        matched_features: Dict[str, Any] = {}

        # 1. Semantic description similarity
        sem_score = self.semantic_engine.compute_text_similarity(
            source.description or source.title,
            target.description or target.title,
        )
        if sem_score >= 0.70:
            reasons.append(f"High narrative similarity ({int(sem_score * 100)}%)")

        # 2. Modus Operandi & Crime Category overlap
        mo_score = 0.0
        if source.crime_category.lower() == target.crime_category.lower():
            mo_score += 0.60
            reasons.append(f"Identical crime category: {source.crime_category}")
            matched_features["crime_category"] = source.crime_category

        # Extract keyword overlap (weapons, vehicles, entry methods)
        src_tokens = set((source.description or "").lower().split())
        tgt_tokens = set((target.description or "").lower().split())
        common_words = src_tokens.intersection(tgt_tokens)
        mo_keywords = {"robbery", "weapon", "knife", "pistol", "atm", "gas cutter", "mask", "vehicle", "cyber", "ransomware", "phishing", "extortion"}
        matched_mo = mo_keywords.intersection(common_words)
        if matched_mo:
            mo_score = min(1.0, mo_score + 0.10 * len(matched_mo))
            reasons.append(f"Common modus operandi signature keywords: {', '.join(matched_mo)}")
            matched_features["mo_keywords"] = list(matched_mo)

        # 3. Entity overlap (suspects, vehicles, phones attached)
        entity_score = 0.0
        src_entities = {e.normalized_value for e in (source.entities or [])}
        tgt_entities = {e.normalized_value for e in (target.entities or [])}
        shared_ents = src_entities.intersection(tgt_entities)
        if shared_ents:
            entity_score = min(1.0, 0.40 + 0.20 * len(shared_ents))
            reasons.append(f"Shared investigation entity identifiers: {', '.join(list(shared_ents)[:3])}")
            matched_features["shared_entities"] = list(shared_ents)

        # 4. Location proximity
        loc_score = 0.0
        src_loc = getattr(source, "incident_location", None) or (source.fir.incident_location if source.fir else None)
        tgt_loc = getattr(target, "incident_location", None) or (target.fir.incident_location if target.fir else None)
        if src_loc and tgt_loc:
            if src_loc.strip().lower() == tgt_loc.strip().lower():
                loc_score = 1.0
                reasons.append(f"Co-located in identical jurisdiction: {src_loc}")
            elif any(word in tgt_loc.lower() for word in src_loc.lower().split() if len(word) > 3):
                loc_score = 0.70
                reasons.append(f"Geographic vicinity: {src_loc} ~ {tgt_loc}")

        # 5. Temporal interval proximity
        temporal_score = 0.50
        try:
            d1 = source.created_at
            d2 = target.created_at
            if d1 and d2:
                days_diff = abs((d1 - d2).days)
                if days_diff <= 30:
                    temporal_score = 1.0
                    reasons.append(f"Temporal clustering within {days_diff} days")
                elif days_diff <= 180:
                    temporal_score = 0.75
                elif days_diff <= 365:
                    temporal_score = 0.50
                else:
                    temporal_score = 0.25
        except Exception:
            pass

        # Weighted calculation
        overall = (
            self.weights.WEIGHT_SEMANTIC * sem_score
            + self.weights.WEIGHT_MODUS_OPERANDI * mo_score
            + self.weights.WEIGHT_ENTITY_OVERLAP * entity_score
            + self.weights.WEIGHT_LOCATION * loc_score
            + self.weights.WEIGHT_TEMPORAL * temporal_score
        )
        overall = round(float(min(1.0, max(0.0, overall))), 4)

        summary_text = (
            f"Similarity Score {int(overall * 100)}%. "
            + ("; ".join(reasons) if reasons else "General investigative pattern match.")
        )

        return CaseSimilarity(
            id=uuid.uuid4(),
            source_case_id=source.id,
            target_case_id=target.id,
            similarity_score=overall,
            semantic_score=round(sem_score, 4),
            modus_operandi_score=round(mo_score, 4),
            entity_overlap_score=round(entity_score, 4),
            location_score=round(loc_score, 4),
            temporal_score=round(temporal_score, 4),
            common_features=matched_features,
            explanation_summary=summary_text,
            supporting_records=[source.case_number, target.case_number],
        )

    def find_top_similar(
        self,
        source: Case,
        candidates: List[Case],
        top_k: int = 5,
    ) -> List[CaseSimilarity]:
        """Rank candidate historical cases and return top-k matches."""
        results: List[CaseSimilarity] = []
        for cand in candidates:
            if cand.id == source.id:
                continue
            sim = self.compare_cases(source, cand)
            if sim.similarity_score >= 0.28:
                results.append(sim)

        results.sort(key=lambda x: x.similarity_score, reverse=True)
        return results[:top_k]


case_similarity_engine = CaseSimilarityEngine()
