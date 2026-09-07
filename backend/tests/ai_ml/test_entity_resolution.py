"""Unit tests for Entity Resolution: candidate generation, similarity, and confidence scoring."""

import uuid
import pytest
from app.ai_ml.entity_resolution.candidate_generator import CandidateGenerator
from app.ai_ml.entity_resolution.confidence import EntityMatchConfidenceScorer
from app.ai_ml.entity_resolution.resolver import EntityResolver
from app.ai_ml.entity_resolution.similarity import (
    compute_address_similarity,
    compute_name_similarity,
    compute_phone_similarity,
    compute_token_sort_ratio,
    compute_vehicle_similarity,
)
from app.ai_ml.models.ai_models import Entity


def test_name_similarity_metrics():
    """Verify composite name similarity behaves correctly on exact, typo, and abbreviation."""
    # Exact
    assert compute_name_similarity("Karan Verma", "Karan Verma") == 1.0
    # Abbreviation
    abbr_sim = compute_name_similarity("K. Verma", "Karan Verma")
    assert abbr_sim >= 0.80
    # Token permutation
    perm_sim = compute_name_similarity("Verma Karan", "Karan Verma")
    assert perm_sim >= 0.90
    # Dissimilar
    diff_sim = compute_name_similarity("Suresh Raina", "Karan Verma")
    assert diff_sim < 0.40


def test_phone_similarity():
    """Verify phone normalization and match scoring."""
    assert compute_phone_similarity("+91 98201 44192", "09820144192") == 1.0
    assert compute_phone_similarity("9820144192", "9820144192") == 1.0
    assert compute_phone_similarity("9820144192", "9111111111") == 0.0


def test_vehicle_similarity():
    """Verify vehicle registration string similarity."""
    assert compute_vehicle_similarity("MH 02 AB 1234", "MH02AB1234") == 1.0
    assert compute_vehicle_similarity("DL 01 CD 5678", "MH02AB1234") == 0.0


def test_address_similarity():
    """Verify address token Jaccard overlap."""
    a1 = "Flat 402, Sea View Apartments, Andheri West, Mumbai"
    a2 = "Sea View Apartments, Andheri West, Mumbai"
    sim = compute_address_similarity(a1, a2)
    assert sim >= 0.60


def test_candidate_generator_and_confidence():
    """Verify blocking and candidate pair emission."""
    gen = CandidateGenerator()
    scorer = EntityMatchConfidenceScorer()

    e1 = Entity(
        id=uuid.uuid4(),
        entity_type="PERSON",
        name="Karan Verma",
        normalized_value="karan verma",
        attributes_json={"phone": "9820144192", "address": "Andheri West, Mumbai"},
    )
    e2 = Entity(
        id=uuid.uuid4(),
        entity_type="PERSON",
        name="K. Verma",
        normalized_value="k verma",
        attributes_json={"phone": "9820144192", "address": "Andheri West"},
    )
    e3 = Entity(
        id=uuid.uuid4(),
        entity_type="PERSON",
        name="Rajesh Khanna",
        normalized_value="rajesh khanna",
        attributes_json={"phone": "9112233445"},
    )

    pairs = gen.generate_candidate_pairs([e1, e2, e3])
    # e1 and e2 should be clustered together by surname or phone
    pair_ids = [(p[0].name, p[1].name) for p in pairs]
    assert any(("Karan Verma" in p and "K. Verma" in p) for p in pair_ids)

    score, breakdown, supporting, conflicting = scorer.score_pair(e1, e2)
    assert score >= 0.85
    assert len(supporting) >= 2
    assert any("Exact telephone match" in s for s in supporting)


def test_entity_resolver_workflow():
    """Test full EntityResolver candidate evaluation and human confirmation."""
    resolver = EntityResolver()

    e1 = Entity(
        id=uuid.uuid4(),
        entity_type="PERSON",
        name="Vikram Singh",
        normalized_value="vikram singh",
        attributes_json={"phone": "9876500001"},
    )
    e2 = Entity(
        id=uuid.uuid4(),
        entity_type="PERSON",
        name="V. Singh",
        normalized_value="v singh",
        attributes_json={"phone": "9876500001"},
    )

    match = resolver.evaluate_pair(e1, e2)
    assert match is not None
    assert match.confidence_score >= 0.80

    # Test confirmation
    canonical = resolver.confirm_match(match, e1, e2, notes="Investigator verified PAN and photo.")
    assert match.status == "CONFIRMED_SAME"
    assert e2.is_canonical is False
    assert e2.canonical_entity_id == e1.id
