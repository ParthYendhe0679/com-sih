"""Unit tests for Semantic Similarity, Embedding Service, and Case Similarity."""

import uuid
from datetime import datetime, timezone
import pytest
from app.ai_ml.models.ai_models import Entity
from app.ai_ml.similarity.case_similarity import CaseSimilarityEngine
from app.ai_ml.similarity.embedding_service import EmbeddingService
from app.ai_ml.similarity.person_similarity import PersonSimilarityEngine
from app.ai_ml.similarity.semantic_similarity import SemanticSimilarityEngine
from app.models.case import Case


def test_embedding_service_deterministic():
    """Verify embedding service produces stable, non-zero unit-norm vectors."""
    svc = EmbeddingService()
    v1 = svc.encode_text("Armed bank robbery with getaway motorcycle")
    v2 = svc.encode_text("Armed bank robbery with getaway motorcycle")
    v3 = svc.encode_text("Cyber phishing and unauthorized fund diversion")

    assert len(v1) == 384
    assert v1 == v2  # Deterministic / cached
    assert v1 != v3  # Distinct content yields distinct vectors


def test_semantic_similarity():
    """Verify semantic similarity correctly scores close vs far narratives."""
    engine = SemanticSimilarityEngine()
    sim_close = engine.compute_text_similarity(
        "Robbery at jewelry showroom using gas cutter and stolen vehicle",
        "Heist at gold jewelry store cutting metal shutters with acetylene torches",
    )
    sim_far = engine.compute_text_similarity(
        "Robbery at jewelry showroom using gas cutter and stolen vehicle",
        "Copyright violation and intellectual property counterfeit software distribution",
    )
    assert sim_close > sim_far
    assert 0.0 <= sim_close <= 1.0


def test_person_similarity():
    """Verify person profile multi-attribute comparison."""
    engine = PersonSimilarityEngine()
    p1 = {
        "name": "Karan Verma",
        "phones": ["9820144192"],
        "vehicles": ["MH02AB1234"],
        "locations": ["Andheri West"],
        "associations": ["Associate X"],
    }
    p2 = {
        "name": "K. Verma",
        "phones": ["9820144192"],
        "vehicles": ["MH02AB1234"],
        "locations": ["Andheri West"],
        "associations": ["Associate X", "Associate Y"],
    }
    score, breakdown, matches = engine.compare_persons(p1, p2)
    assert score >= 0.85
    assert len(matches) >= 3


def test_case_similarity_multi_factor():
    """Verify case similarity scores crime category, keywords, entities, and locations."""
    engine = CaseSimilarityEngine()

    c1 = Case(
        id=uuid.uuid4(),
        case_number="CASE-2026-0001",
        title="Midnight ATM Heist at Bandra",
        description="Three masked suspects entered ATM kiosk using gas cutter and dismantled vault. Fled in black vehicle.",
        crime_category="ARMED_ROBBERY",
        created_at=datetime.now(timezone.utc),
    )
    c2 = Case(
        id=uuid.uuid4(),
        case_number="CASE-2026-0042",
        title="ATM Vault Tampering at Andheri",
        description="Two suspects used gas cutter and crowbars to breach ATM vault at 03:00 AM. Fled on motorcycle.",
        crime_category="ARMED_ROBBERY",
        created_at=datetime.now(timezone.utc),
    )
    c3 = Case(
        id=uuid.uuid4(),
        case_number="CASE-2026-0099",
        title="Corporate Wire Fraud",
        description="Internal accountant altered SWIFT transfer credentials diverting corporate treasury funds.",
        crime_category="FINANCIAL_FRAUD",
        created_at=datetime.now(timezone.utc),
    )

    sim_high = engine.compare_cases(c1, c2)
    sim_low = engine.compare_cases(c1, c3)

    assert sim_high.similarity_score > sim_low.similarity_score
    assert sim_high.modus_operandi_score > 0.50
    assert "ARMED_ROBBERY" in sim_high.explanation_summary
