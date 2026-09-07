"""EntityResolver coordinator: executes candidate generation, attribute matching, and review workflows."""

import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from app.ai_ml.config import aiml_settings
from app.ai_ml.entity_resolution.candidate_generator import CandidateGenerator
from app.ai_ml.entity_resolution.confidence import EntityMatchConfidenceScorer
from app.ai_ml.models.ai_models import Entity, EntityMatch
from app.core.logging import get_logger

logger = get_logger("kritagas.entity_resolver")


class EntityResolver:
    """Coordinates entity duplicate discovery, multi-attribute scoring, and investigator review."""

    def __init__(self):
        self.candidate_gen = CandidateGenerator()
        self.scorer = EntityMatchConfidenceScorer()

    def evaluate_pair(self, e1: Entity, e2: Entity) -> Optional[EntityMatch]:
        """Evaluate two entities and return an EntityMatch if above candidate threshold."""
        if e1.id == e2.id or e1.entity_type != e2.entity_type:
            return None

        score, breakdown, supporting, conflicting = self.scorer.score_pair(e1, e2)

        if score >= aiml_settings.ENTITY_MATCH_CANDIDATE_THRESHOLD:
            match_status = (
                "FLAGGED"
                if score >= aiml_settings.ENTITY_MATCH_CONFIRM_THRESHOLD
                else "PENDING_REVIEW"
            )
            return EntityMatch(
                id=uuid.uuid4(),
                source_entity_id=e1.id,
                target_entity_id=e2.id,
                confidence_score=score,
                status=match_status,
                similarity_breakdown=breakdown,
                supporting_evidence=supporting,
                conflicting_evidence=conflicting,
            )
        return None

    def find_possible_matches(
        self,
        target_entity: Entity,
        corpus: List[Entity],
    ) -> List[EntityMatch]:
        """Find all candidate matches in corpus for a single target entity."""
        matches: List[EntityMatch] = []
        for other in corpus:
            if other.id == target_entity.id:
                continue
            match = self.evaluate_pair(target_entity, other)
            if match:
                matches.append(match)
        matches.sort(key=lambda m: m.confidence_score, reverse=True)
        return matches

    def resolve_dataset(
        self,
        entities: List[Entity],
    ) -> List[EntityMatch]:
        """Run candidate generation and scoring across a batch of entities."""
        candidate_pairs = self.candidate_gen.generate_candidate_pairs(entities)
        logger.info(f"Generated {len(candidate_pairs)} candidate pairs from {len(entities)} entities")

        matches: List[EntityMatch] = []
        for e1, e2 in candidate_pairs:
            m = self.evaluate_pair(e1, e2)
            if m:
                matches.append(m)

        matches.sort(key=lambda x: x.confidence_score, reverse=True)
        return matches

    def confirm_match(
        self,
        match: EntityMatch,
        source_entity: Entity,
        target_entity: Entity,
        reviewer_id: Optional[uuid.UUID] = None,
        notes: Optional[str] = None,
    ) -> Entity:
        """Human investigator confirms that two records refer to the same real-world entity.

        Links target_entity to source_entity as canonical without destroying historical data.
        """
        match.status = "CONFIRMED_SAME"
        match.reviewed_by_id = reviewer_id
        match.reviewed_at = datetime.now(timezone.utc)
        match.review_notes = notes

        # Set canonical pointer
        target_entity.is_canonical = False
        target_entity.canonical_entity_id = source_entity.id

        logger.info(
            f"Investigator confirmed entity match {match.id}: "
            f"'{target_entity.name}' resolved to canonical '{source_entity.name}'"
        )
        return source_entity

    def reject_match(
        self,
        match: EntityMatch,
        reviewer_id: Optional[uuid.UUID] = None,
        notes: Optional[str] = None,
    ) -> EntityMatch:
        """Human investigator rejects a suggested entity match."""
        match.status = "REJECTED"
        match.reviewed_by_id = reviewer_id
        match.reviewed_at = datetime.now(timezone.utc)
        match.review_notes = notes
        logger.info(f"Investigator rejected entity match {match.id}")
        return match


entity_resolver = EntityResolver()
