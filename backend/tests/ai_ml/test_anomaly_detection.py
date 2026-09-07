"""Unit tests for Statistical and Behavioral Anomaly Detection."""

import uuid
import pytest
from app.ai_ml.anomaly_detection.anomaly_engine import AnomalyEngine
from app.ai_ml.anomaly_detection.statistical_detector import StatisticalAnomalyDetector
from app.models.case import Case


def test_statistical_zscore_and_iqr():
    """Verify statistical anomaly detector flags large spikes and ignores normal variance."""
    detector = StatisticalAnomalyDetector()
    normal_values = [10000.0, 12000.0, 11500.0, 10500.0, 11000.0, 13000.0, 10800.0]
    outliers_none = detector.detect_zscore_outliers(normal_values)
    assert len(outliers_none) == 0

    values_with_spike = normal_values + [2500000.0]  # ₹25 Lakhs spike
    outliers = detector.detect_zscore_outliers(values_with_spike)
    assert len(outliers) == 1
    idx, val, z = outliers[0]
    assert val == 2500000.0
    assert z >= 2.5

    iqr_outliers = detector.detect_iqr_outliers(values_with_spike)
    assert len(iqr_outliers) == 1


def test_anomaly_engine_case_detection():
    """Verify anomaly engine creates structured Anomaly entities labeled 'REQUIRES_INVESTIGATION'."""
    engine = AnomalyEngine()
    case = Case(
        id=uuid.uuid4(),
        case_number="CASE-2026-8801",
        title="Money Laundering Inquiry",
        description="Shell account transactions under scrutiny.",
        crime_category="FINANCIAL_CRIME",
    )

    anomalies = engine.analyze_case_anomalies(case, [])
    assert len(anomalies) >= 1
    for a in anomalies:
        assert a.status == "REQUIRES_INVESTIGATION"
        assert a.score >= 0.70
        assert a.anomaly_type in ("FINANCIAL_VOLUME_SPIKE", "TELECOM_OFF_HOURS_BURST")
        assert len(a.evidence) >= 1
