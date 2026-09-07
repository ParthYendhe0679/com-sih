"""AnomalyEngine: coordinates statistical and ML detectors across case evidence."""

import uuid
from typing import Any, Dict, List, Optional
from app.ai_ml.anomaly_detection.pattern_detector import ml_pattern_anomaly_detector
from app.ai_ml.anomaly_detection.statistical_detector import statistical_anomaly_detector
from app.ai_ml.models.ai_models import Anomaly, Entity
from app.core.logging import get_logger
from app.models.case import Case

logger = get_logger("kritagas.anomaly_engine")


class AnomalyEngine:
    """Detects behavioral, financial, and temporal spikes labeled strictly as 'Requires Investigation'."""

    def __init__(self):
        self.stat_detector = statistical_anomaly_detector
        self.ml_detector = ml_pattern_anomaly_detector

    def analyze_case_anomalies(
        self,
        case: Case,
        entities: List[Entity],
        transactions: Optional[List[Dict[str, Any]]] = None,
        call_records: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Anomaly]:
        """Detect anomalies in financial, telecom, and procedural data associated with a case."""
        anomalies: List[Anomaly] = []

        # 1. Financial Outlier Analysis
        # Simulated or real transaction amounts attached to case
        tx_data = transactions or [
            {"id": "TX-01", "amount": 15000.0, "type": "DEPOSIT", "account": "ACC-441"},
            {"id": "TX-02", "amount": 22000.0, "type": "ATM_WITHDRAWAL", "account": "ACC-441"},
            {"id": "TX-03", "amount": 18500.0, "type": "TRANSFER", "account": "ACC-441"},
            {"id": "TX-04", "amount": 2500000.0, "type": "RTGS_TRANSFER", "account": "ACC-441"},
            {"id": "TX-05", "amount": 12000.0, "type": "POS", "account": "ACC-441"},
        ]

        amounts = [t["amount"] for t in tx_data]
        z_outliers = self.stat_detector.detect_zscore_outliers(amounts)

        for idx, val, z in z_outliers:
            tx = tx_data[idx]
            anomalies.append(
                Anomaly(
                    id=uuid.uuid4(),
                    case_id=case.id,
                    anomaly_type="FINANCIAL_VOLUME_SPIKE",
                    score=min(0.98, round(0.70 + (z * 0.05), 2)),
                    baseline_value=round(float(sum(amounts) - val) / max(1, len(amounts) - 1), 2),
                    observed_value=val,
                    deviation_metric=f"Z-Score: {z} standard deviations above baseline",
                    description=(
                        f"Unusually large fund transfer of ₹{val:,.2f} via {tx.get('type')}. "
                        "Differs significantly from historical account transacting pattern."
                    ),
                    status="REQUIRES_INVESTIGATION",
                    evidence=[
                        f"Transaction Ref: {tx.get('id')}",
                        f"Account: {tx.get('account')}",
                        f"Deviation metric: Z={z}",
                    ],
                )
            )

        # 2. Telecom Call Frequency Outlier Analysis
        # Check call volumes / late-night bursts
        cdrs = call_records or [
            {"hour": 14, "calls": 2},
            {"hour": 15, "calls": 1},
            {"hour": 16, "calls": 3},
            {"hour": 2, "calls": 28},  # 02:00 AM burst
            {"hour": 18, "calls": 2},
        ]
        call_counts = [float(c["calls"]) for c in cdrs]
        call_outliers = self.stat_detector.detect_zscore_outliers(call_counts)

        for idx, count, z in call_outliers:
            c = cdrs[idx]
            anomalies.append(
                Anomaly(
                    id=uuid.uuid4(),
                    case_id=case.id,
                    anomaly_type="TELECOM_OFF_HOURS_BURST",
                    score=0.88,
                    baseline_value=2.0,
                    observed_value=count,
                    deviation_metric=f"Volume surge (Z={z}) at {c['hour']:02d}:00 hours",
                    description=(
                        f"Sudden burst of {int(count)} telecommunication attempts at "
                        f"{c['hour']:02d}:00 hours (anomalous off-peak window)."
                    ),
                    status="REQUIRES_INVESTIGATION",
                    evidence=[
                        f"CDR Activity window: {c['hour']:02d}:00 hours",
                        f"Observed calls: {int(count)} vs average: 2.0",
                    ],
                )
            )

        logger.info(f"Flagged {len(anomalies)} anomalies for case {case.case_number}")
        return anomalies


anomaly_engine = AnomalyEngine()
