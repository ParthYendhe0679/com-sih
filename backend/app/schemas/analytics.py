"""Pydantic schemas for the KRITAGAS Analytics Hub."""

from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class AnalyticsKPICard(BaseModel):
    """Standardized KPI card metric."""
    id: str
    title: str
    count: str
    change: str
    direction: Literal["up", "down"]
    subtext: str
    dotColor: str
    badgeColor: str
    badgeText: str


class MonthlyTrendItem(BaseModel):
    """Monthly crime breakdown item."""
    month: str
    fraud: int = 0
    robbery: int = 0
    cybercrime: int = 0
    kidnapping: int = 0


class CrimeDistributionItem(BaseModel):
    """Categorized FIR distribution item for donut chart."""
    name: str
    value: float
    count: int
    color: str


class PeakHourItem(BaseModel):
    """Hourly incident distribution item."""
    hour: str
    incidents: int
    label: str


class CityVolumeItem(BaseModel):
    """Metropolitan city volume caseload item."""
    city: str
    count: int
    growth: str


class HotspotClusterItem(BaseModel):
    """Geospatial hotspot cluster entity matching Leaflet map requirements."""
    id: str
    area: str
    city: str
    state: str = "Maharashtra"
    coordinates: List[float]  # [lat, lng]
    crimeCount: int
    primaryCrime: str
    severity: Literal["Critical", "High", "Medium", "Low"]
    trend: Literal["Increasing", "Stable", "Decreasing"]
    recentFIRs: int


class EmergingPatternItem(BaseModel):
    """AI predictive pattern intelligence entity."""
    id: str
    title: str
    direction: Literal["increasing", "decreasing"]
    confidence: int
    status: str
    basis: List[str]
    details: str
    suggestedAction: str
    timeframe: str
    severity: str


class AnalyticsOverviewResponse(BaseModel):
    """Aggregated analytics response model."""
    total_firs: int
    kpis: List[AnalyticsKPICard]
    monthly_trends: List[MonthlyTrendItem]
    crime_distribution: List[CrimeDistributionItem]
    peak_hours: List[PeakHourItem]
    city_volumes: List[CityVolumeItem]
    hotspots: List[HotspotClusterItem]
    emerging_patterns: List[EmergingPatternItem]
    last_refreshed: str
