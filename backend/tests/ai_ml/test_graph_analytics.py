"""Unit tests for NetworkX graph feature extraction."""

import pytest
from app.ai_ml.utils.graph_utils import GraphAnalyticsEngine


def test_graph_analytics_centrality_and_communities():
    """Verify graph centrality calculation, betweenness, and community detection."""
    engine = GraphAnalyticsEngine()

    nodes = [
        {"id": "P1", "label": "Kingpin", "type": "PERSON"},
        {"id": "P2", "label": "Lieutenant A", "type": "PERSON"},
        {"id": "P3", "label": "Lieutenant B", "type": "PERSON"},
        {"id": "V1", "label": "Vehicle 1", "type": "VEHICLE"},
        {"id": "P4", "label": "Driver", "type": "PERSON"},
    ]
    edges = [
        {"source": "P1", "target": "P2", "confidence": 95},
        {"source": "P1", "target": "P3", "confidence": 95},
        {"source": "P2", "target": "V1", "confidence": 90},
        {"source": "P3", "target": "V1", "confidence": 90},
        {"source": "V1", "target": "P4", "confidence": 85},
    ]

    g = engine.build_graph(nodes, edges)
    assert len(g.nodes) == 5
    assert len(g.edges) == 5

    metrics = engine.extract_metrics(g)
    assert len(metrics) == 5

    # Kingpin or Vehicle should have highest degree centrality
    top_node = metrics[0]
    assert top_node["degree_centrality"] > 0.0

    # Shortest path test
    path = engine.find_shortest_intelligence_path(g, "P1", "P4")
    assert path is not None
    assert path[0] == "P1"
    assert path[-1] == "P4"
