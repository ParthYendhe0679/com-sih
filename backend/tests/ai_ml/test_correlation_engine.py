"""Unit tests for Correlation Engine and Relationship Discovery."""

import uuid
import pytest
from app.ai_ml.correlation.correlation_engine import CorrelationEngine
from app.ai_ml.correlation.correlation_scorer import CorrelationScorer
from app.ai_ml.models.ai_models import Entity
from app.ai_ml.relationship_discovery.relationship_engine import RelationshipDiscoveryEngine
from app.models.case import Case


def test_correlation_scorer():
    """Verify hop decay and compound confidence calculation."""
    scorer = CorrelationScorer()
    hops_2 = [
        {"confidence": 0.95},
        {"confidence": 0.90},
    ]
    hops_4 = [
        {"confidence": 0.95},
        {"confidence": 0.90},
        {"confidence": 0.85},
        {"confidence": 0.80},
    ]
    conf_2 = scorer.score_chain(hops_2)
    conf_4 = scorer.score_chain(hops_4)

    assert 0.0 < conf_4 < conf_2 <= 1.0


def test_case_correlation_discovery():
    """Verify cross-source correlation finds multi-hop links between persons, vehicles, and accounts."""
    engine = CorrelationEngine()

    case = Case(
        id=uuid.uuid4(),
        case_number="CASE-2026-9901",
        title="Armed Transit Robbery",
        description="Cash transport vehicle ambushed at highway toll plaza.",
        crime_category="ARMED_ROBBERY",
    )

    e_person1 = Entity(
        id=uuid.uuid4(),
        case_id=case.id,
        entity_type="PERSON",
        name="Suspect Alpha",
        normalized_value="suspect alpha",
    )
    e_person2 = Entity(
        id=uuid.uuid4(),
        case_id=case.id,
        entity_type="PERSON",
        name="Associate Bravo",
        normalized_value="associate bravo",
    )
    e_vehicle = Entity(
        id=uuid.uuid4(),
        case_id=case.id,
        entity_type="VEHICLE",
        name="MH02AB1234",
        normalized_value="MH02AB1234",
    )

    correlations = engine.discover_case_correlations(case, [e_person1, e_person2, e_vehicle])
    assert len(correlations) >= 2
    types = [c.correlation_type for c in correlations]
    assert "TELECOM_COMMUNICATION_LINK" in types
    assert "VEHICLE_OWNERSHIP_CORRELATION" in types


def test_relationship_discovery_engine():
    """Verify explicit relationships (OWNS, CALLED, INVOLVED_IN) are extracted with evidence."""
    engine = RelationshipDiscoveryEngine()

    case = Case(
        id=uuid.uuid4(),
        case_number="CASE-2026-9902",
        title="Extortion Case",
        description="Protection money demanded from commercial builder.",
        crime_category="EXTORTION",
    )

    e1 = Entity(
        id=uuid.uuid4(),
        case_id=case.id,
        entity_type="PERSON",
        name="Gang Leader Roy",
        normalized_value="gang leader roy",
    )
    e2 = Entity(
        id=uuid.uuid4(),
        case_id=case.id,
        entity_type="VEHICLE",
        name="DL04XY9999",
        normalized_value="DL04XY9999",
    )

    rels = engine.discover_case_relationships(case, [e1, e2])
    assert len(rels) >= 2
    rel_names = [r["relationship"] for r in rels]
    assert "INVOLVED_IN" in rel_names
    assert "OWNS" in rel_names
    for r in rels:
        assert len(r["evidence_basis"]) >= 1
        assert r["confidence"] > 0.50
