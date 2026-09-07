"""Machine-learning based anomaly detection using Isolation Forest."""

from typing import Any, Dict, List, Optional
import numpy as np
from app.ai_ml.config import aiml_settings
from app.core.logging import get_logger

logger = get_logger("kritagas.anomaly_ml")


class MLPatternAnomalyDetector:
    """Multi-dimensional outlier detector using Scikit-Learn's Isolation Forest."""

    def detect_multidimensional_anomalies(
        self,
        features: List[List[float]],
        contamination: float = aiml_settings.ISOLATION_FOREST_CONTAMINATION,
    ) -> List[int]:
        """Fit Isolation Forest on feature matrix and return indices of flagged anomalies.

        Features could include: [transaction_amount, hour_of_day, frequency, counterparty_count].
        Returns:
            List of outlier indices.
        """
        if len(features) < 6:
            # Insufficient samples for robust multivariate density estimation
            return []

        try:
            from sklearn.ensemble import IsolationForest

            X = np.array(features, dtype=float)
            clf = IsolationForest(
                contamination=contamination,
                random_state=42,
                n_estimators=50,
            )
            preds = clf.fit_predict(X)
            # -1 indicates an anomaly
            anomalies = [i for i, p in enumerate(preds) if p == -1]
            return anomalies
        except Exception as e:
            logger.warning(f"Isolation Forest inference error: {e}")
            return []


ml_pattern_anomaly_detector = MLPatternAnomalyDetector()
