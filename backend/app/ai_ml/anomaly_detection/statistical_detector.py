"""Statistical anomaly detectors: Z-Score, IQR, and deviation metrics."""

from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from app.ai_ml.config import aiml_settings


class StatisticalAnomalyDetector:
    """Detects numeric outliers in transaction amounts, call frequencies, or temporal intervals."""

    def detect_zscore_outliers(
        self,
        values: List[float],
        threshold: float = aiml_settings.ANOMALY_ZSCORE_THRESHOLD,
    ) -> List[Tuple[int, float, float]]:
        """Identify values with absolute Z-score > threshold.

        Returns:
            List of (index, value, z_score)
        """
        if len(values) < 4:
            return []

        arr = np.array(values, dtype=float)
        mean = np.mean(arr)
        std = np.std(arr)

        if std == 0.0:
            return []

        import math
        # Standard sample z-score is mathematically bounded by (N-1)/sqrt(N)
        max_z = (len(arr) - 1) / math.sqrt(len(arr))
        effective_threshold = min(threshold, max(1.4, max_z * 0.85))

        outliers = []
        for i, val in enumerate(arr):
            z = abs((val - mean) / std)
            if z >= effective_threshold:
                outliers.append((i, float(val), round(float(z), 2)))
        return outliers

    def detect_iqr_outliers(
        self,
        values: List[float],
        multiplier: float = aiml_settings.ANOMALY_IQR_MULTIPLIER,
    ) -> List[Tuple[int, float]]:
        """Detect outliers exceeding Q3 + multiplier * IQR or below Q1 - multiplier * IQR."""
        if len(values) < 4:
            return []

        arr = np.array(values, dtype=float)
        q25, q75 = np.percentile(arr, [25, 75])
        iqr = q75 - q25

        if iqr == 0.0:
            return []

        lower_bound = q25 - (multiplier * iqr)
        upper_bound = q75 + (multiplier * iqr)

        outliers = []
        for i, val in enumerate(arr):
            if val < lower_bound or val > upper_bound:
                outliers.append((i, float(val)))
        return outliers


statistical_anomaly_detector = StatisticalAnomalyDetector()
