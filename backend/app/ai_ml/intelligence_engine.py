"""Master Intelligence Engine: orchestrates the complete AI/ML investigation pipeline."""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.ai_ml.anomaly_detection.anomaly_engine import anomaly_engine
from app.ai_ml.blockchain.audit_events import BlockchainAuditEvent
from app.ai_ml.correlation.correlation_engine import correlation_engine
from app.ai_ml.entity_resolution.resolver import entity_resolver
from app.ai_ml.intelligence.intelligence_scorer import intelligence_scorer
from app.ai_ml.models.ai_models import (
    Anomaly,
    CaseSimilarity,
    Correlation,
    Entity,
    EntityMatch,
    IntelligenceInsight,
)
from app.ai_ml.pattern_analysis.pattern_engine import pattern_engine
from app.ai_ml.relationship_discovery.relationship_engine import relationship_discovery_engine
from app.ai_ml.similarity.case_similarity import case_similarity_engine
from app.ai_ml.utils.graph_utils import GraphAnalyticsEngine
from app.core.logging import get_logger
from app.models.case import Case

logger = get_logger("kritagas.master_intelligence")


class MasterIntelligenceEngine:
    """Coordinates end-to-end AI/ML analysis across entities, correlations, similarities, and patterns."""

    def __init__(self):
        self.resolver = entity_resolver
        self.correlation_eng = correlation_engine
        self.relationship_eng = relationship_discovery_engine
        self.similarity_eng = case_similarity_engine
        self.pattern_eng = pattern_engine
        self.anomaly_eng = anomaly_engine
        self.graph_analytics = GraphAnalyticsEngine()
        self.scorer = intelligence_scorer

    def run_case_analysis_pipeline(
        self,
        case: Case,
        historical_cases: List[Case],
        existing_entities: Optional[List[Entity]] = None,
    ) -> Dict[str, Any]:
        """Execute full synchronous analysis pipeline on a case."""
        logger.info(f"Initiating Master AI/ML Intelligence Pipeline for Case {case.case_number}")

        # Emit audit event: Started
        BlockchainAuditEvent(
            event_type="CASE_ANALYSIS_STARTED",
            case_id=str(case.id),
            payload={"case_number": case.case_number},
        ).emit()

        if existing_entities is not None:
            entities = existing_entities
        else:
            entities = case.__dict__.get("entities") or []

        # 1. Entity Resolution (find duplicates / possible matches)
        matches: List[EntityMatch] = []
        if entities and len(entities) >= 2:
            matches = self.resolver.resolve_dataset(entities)

        # 2. Cross-Source Correlation
        correlations = self.correlation_eng.discover_case_correlations(case, entities)

        # 3. Discovered Relationships
        relationships = self.relationship_eng.discover_case_relationships(case, entities)

        # 4. Similar Historical Cases
        similar_cases: List[CaseSimilarity] = []
        if historical_cases:
            similar_cases = self.similarity_eng.find_top_similar(case, historical_cases, top_k=5)

        # 5. Pattern Detection
        similar_case_objs = [
            c for c in historical_cases if any(s.target_case_id == c.id for s in similar_cases)
        ]
        pattern_insights = self.pattern_eng.analyze_case_patterns(case, similar_case_objs)

        # 6. Anomaly Detection
        anomalies = self.anomaly_eng.analyze_case_anomalies(case, entities)

        # 7. Graph Network Metrics
        graph_nodes = []
        for ent in entities:
            graph_nodes.append({
                "id": str(ent.id),
                "label": ent.name,
                "type": ent.entity_type,
            })
        graph_nodes.append({
            "id": str(case.id),
            "label": case.case_number,
            "type": "CASE",
        })

        graph_edges = []
        for rel in relationships:
            graph_edges.append({
                "source": rel["source"],
                "target": rel["target"],
                "relationship": rel["relationship"],
                "confidence": rel["confidence"] * 100.0,
            })

        nx_graph = self.graph_analytics.build_graph(graph_nodes, graph_edges)
        graph_metrics = self.graph_analytics.extract_metrics(nx_graph)
        max_deg = max((m["degree_centrality"] for m in graph_metrics), default=0.0)

        # 8. Investigation Priority Scoring
        evidence_list = case.__dict__.get("evidence") or []
        priority_info = self.scorer.calculate_investigation_priority(
            evidence_count=len(evidence_list),
            correlation_count=len(correlations),
            similar_case_count=len(similar_cases),
            anomaly_count=len(anomalies),
            max_network_centrality=max_deg,
        )

        # Emit audit event: Completed
        BlockchainAuditEvent(
            event_type="CASE_ANALYSIS_COMPLETED",
            case_id=str(case.id),
            payload={
                "priority_score": priority_info["score"],
                "correlations_found": len(correlations),
                "similar_cases_found": len(similar_cases),
                "anomalies_flagged": len(anomalies),
            },
        ).emit()

        return {
            "case_id": case.id,
            "case_number": case.case_number,
            "title": case.title,
            "investigation_priority": priority_info,
            "entities": entities,
            "entity_matches": matches,
            "correlations": correlations,
            "relationships": relationships,
            "similar_cases": similar_cases,
            "pattern_insights": pattern_insights,
            "anomalies": anomalies,
            "graph_metrics": graph_metrics,
            "generated_at": datetime.now(timezone.utc),
        }


master_intelligence_engine = MasterIntelligenceEngine()
