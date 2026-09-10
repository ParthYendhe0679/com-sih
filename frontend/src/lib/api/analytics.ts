// ============================================================
// TRINETRA — Analytics Hub Telemetry & Predictive API Client
// ============================================================

import { apiClient } from './client';
import type { HotspotItem } from '@/components/analytics/AnalyticsHotspotMap';

export interface AnalyticsKPICard {
  id: string;
  title: string;
  count: string;
  change: string;
  direction: 'up' | 'down';
  subtext: string;
  dotColor: string;
  badgeColor: string;
  badgeText: string;
}

export interface MonthlyTrendItem {
  month: string;
  fraud: number;
  robbery: number;
  cybercrime: number;
  kidnapping: number;
}

export interface CrimeDistributionItem {
  name: string;
  value: number;
  count: number;
  color: string;
}

export interface PeakHourItem {
  hour: string;
  incidents: number;
  label: string;
}

export interface CityVolumeItem {
  city: string;
  count: number;
  growth: string;
}

export interface EmergingPatternItem {
  id: string;
  title: string;
  direction: 'increasing' | 'decreasing';
  confidence: number;
  status: string;
  basis: string[];
  details: string;
  suggestedAction: string;
  timeframe: string;
  severity: string;
}

export interface AnalyticsOverviewData {
  total_firs: number;
  kpis: AnalyticsKPICard[];
  monthly_trends: MonthlyTrendItem[];
  crime_distribution: CrimeDistributionItem[];
  peak_hours: PeakHourItem[];
  city_volumes: CityVolumeItem[];
  hotspots: HotspotItem[];
  emerging_patterns: EmergingPatternItem[];
  last_refreshed: string;
}

export const analyticsApi = {
  /**
   * Fetch aggregated analytics overview including KPIs, monthly trends,
   * category breakdown, diurnal peak hours, city volumes, geospatial hotspots,
   * and AI predictive patterns.
   */
  async getOverview(forceRefresh: boolean = false): Promise<AnalyticsOverviewData> {
    return await apiClient.get<AnalyticsOverviewData>('/analytics/overview', {
      params: forceRefresh ? { force_refresh: true } : undefined,
    });
  },
};
