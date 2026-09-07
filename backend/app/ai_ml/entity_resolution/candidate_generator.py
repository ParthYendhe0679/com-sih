"""Candidate pair generator implementing blocking strategies to avoid O(N^2) pairwise comparisons."""

from collections import defaultdict
from typing import Any, Dict, List, Set, Tuple
from app.ai_ml.models.ai_models import Entity
from app.ai_ml.utils.metrics import (
    normalize_phone_number,
    normalize_text_token,
    normalize_vehicle_plate,
)


class CandidateGenerator:
    """Generates candidate entity pairs for resolution using standard blocking keys."""

    def generate_candidate_pairs(
        self,
        entities: List[Entity],
    ) -> List[Tuple[Entity, Entity]]:
        """Group entities by blocking keys and emit unique pairwise comparisons."""
        # 1. Group strictly by entity_type
        by_type: Dict[str, List[Entity]] = defaultdict(list)
        for e in entities:
            by_type[e.entity_type.upper()].append(e)

        candidate_pairs: Set[Tuple[str, str]] = set()
        entity_map: Dict[str, Entity] = {str(e.id): e for e in entities}

        # 2. Apply type-specific blocking
        for etype, group in by_type.items():
            if len(group) < 2:
                continue

            blocks: Dict[str, List[Entity]] = defaultdict(list)

            for ent in group:
                keys = self._get_blocking_keys(ent)
                for k in keys:
                    blocks[k].append(ent)

            for key, block_members in blocks.items():
                n = len(block_members)
                if n > 50:
                    # Guard against mega-blocks that degrade performance
                    block_members = block_members[:50]
                for i in range(len(block_members)):
                    for j in range(i + 1, len(block_members)):
                        e1 = block_members[i]
                        e2 = block_members[j]
                        if e1.id != e2.id:
                            pair_key = (
                                (str(e1.id), str(e2.id))
                                if str(e1.id) < str(e2.id)
                                else (str(e2.id), str(e1.id))
                            )
                            candidate_pairs.add(pair_key)

        return [(entity_map[id1], entity_map[id2]) for id1, id2 in candidate_pairs]

    def _get_blocking_keys(self, entity: Entity) -> List[str]:
        """Extract indexing blocking keys based on entity type."""
        keys = []
        etype = entity.entity_type.upper()
        norm_name = normalize_text_token(entity.name)

        if etype in ("PERSON", "SUSPECT", "VICTIM"):
            # Surname / Last word prefix
            words = norm_name.split()
            if words:
                keys.append(f"name_prefix_{words[0][:3]}")
                if len(words) > 1:
                    keys.append(f"surname_{words[-1][:3]}")
            # Phone attribute if present
            attrs = entity.attributes_json or {}
            if "phone" in attrs:
                phone = normalize_phone_number(str(attrs["phone"]))
                if phone:
                    keys.append(f"phone_{phone[-6:]}")

        elif etype in ("PHONE", "MOBILE", "TELECOM"):
            phone = normalize_phone_number(entity.name)
            if phone:
                keys.append(f"phone_suffix_{phone[-6:]}")
                keys.append(f"phone_prefix_{phone[:5]}")

        elif etype in ("VEHICLE", "CAR", "BIKE"):
            plate = normalize_vehicle_plate(entity.name)
            if len(plate) >= 4:
                keys.append(f"plate_rto_{plate[:4]}")
                keys.append(f"plate_num_{plate[-4:]}")

        elif etype in ("ORGANIZATION", "COMPANY", "BANK_ACCOUNT"):
            if len(norm_name) >= 3:
                keys.append(f"org_{norm_name[:4]}")

        if not keys and norm_name:
            keys.append(f"general_{norm_name[:3]}")

        return keys
