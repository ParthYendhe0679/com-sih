"""Person similarity and association comparison engine."""

from typing import Any, Dict, List, Set, Tuple
from app.ai_ml.entity_resolution.similarity import (
    compute_address_similarity,
    compute_name_similarity,
    compute_phone_similarity,
)


class PersonSimilarityEngine:
    """Evaluates multi-dimensional similarity between two person dossiers."""

    def compare_persons(
        self,
        person1: Dict[str, Any],
        person2: Dict[str, Any],
    ) -> Tuple[float, Dict[str, float], List[str]]:
        """Compare two person profiles across identity, contact, vehicle, and historical associations."""
        scores: Dict[str, float] = {}
        matches: List[str] = []

        # 1. Name match
        name1 = person1.get("name", "")
        name2 = person2.get("name", "")
        name_sim = compute_name_similarity(name1, name2)
        scores["name_similarity"] = name_sim
        if name_sim >= 0.85:
            matches.append(f"Name identity match: '{name1}' ~ '{name2}'")

        # 2. Phone overlap
        phones1 = set(person1.get("phones", []))
        phones2 = set(person2.get("phones", []))
        phone_overlap = phones1.intersection(phones2)
        phone_score = 1.0 if phone_overlap else 0.0
        scores["phone_overlap"] = phone_score
        if phone_overlap:
            matches.append(f"Shared telephone number(s): {', '.join(phone_overlap)}")

        # 3. Vehicle overlap
        vehicles1 = set(person1.get("vehicles", []))
        vehicles2 = set(person2.get("vehicles", []))
        veh_overlap = vehicles1.intersection(vehicles2)
        veh_score = 1.0 if veh_overlap else 0.0
        scores["vehicle_overlap"] = veh_score
        if veh_overlap:
            matches.append(f"Shared vehicle registration(s): {', '.join(veh_overlap)}")

        # 4. Location overlap
        locs1 = set(person1.get("locations", []))
        locs2 = set(person2.get("locations", []))
        loc_overlap = locs1.intersection(locs2)
        loc_score = 1.0 if loc_overlap else 0.0
        scores["location_overlap"] = loc_score
        if loc_overlap:
            matches.append(f"Shared known hangout/residence area(s): {', '.join(loc_overlap)}")

        # 5. Co-accused / Co-associated overlap
        assoc1 = set(person1.get("associations", []))
        assoc2 = set(person2.get("associations", []))
        assoc_overlap = assoc1.intersection(assoc2)
        assoc_score = len(assoc_overlap) / max(1, len(assoc1.union(assoc2))) if (assoc1 or assoc2) else 0.0
        scores["association_overlap"] = round(assoc_score, 4)
        if assoc_overlap:
            matches.append(f"Shared associate network: {', '.join(list(assoc_overlap)[:3])}")

        # Weighted calculation
        total_score = (
            0.35 * name_sim
            + 0.25 * phone_score
            + 0.15 * veh_score
            + 0.10 * loc_score
            + 0.15 * assoc_score
        )
        return round(total_score, 4), scores, matches


person_similarity_engine = PersonSimilarityEngine()
