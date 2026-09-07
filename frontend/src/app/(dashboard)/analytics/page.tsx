'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  BarChart3, MapPin, BrainCircuit, TrendingUp, TrendingDown,
  ChevronRight, Flame, AlertTriangle, Shield, Check, Filter,
  ArrowUpRight, ArrowDownRight, Eye, RefreshCw, Layers, ExternalLink,
  Sparkles, CheckCircle2, AlertOctagon, Info
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import type { HotspotItem } from '@/components/analytics/AnalyticsHotspotMap';

// Dynamically import Leaflet map to prevent SSR issues
const AnalyticsHotspotMap = dynamic(
  () => import('@/components/analytics/AnalyticsHotspotMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[500px] rounded-2xl border flex flex-col items-center justify-center gap-3 animate-pulse"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        <MapPin size={28} className="animate-bounce" style={{ color: 'var(--accent)' }} />
        <span className="text-[14px] font-semibold" style={{ color: 'var(--ink-secondary)' }}>
          Loading Spatial Hotspot Engine...
        </span>
      </div>
    ),
  }
);

type TabKey = 'trends' | 'hotspots' | 'patterns';

const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'trends', label: 'Crime Trends', icon: BarChart3 },
  { key: 'hotspots', label: 'Crime Hotspots', icon: Flame },
  { key: 'patterns', label: 'Emerging Patterns', icon: BrainCircuit },
];

// Top 5 Standardized KPI Cards
const kpiCards = [
  {
    id: 'kpi-robbery',
    title: 'Robbery',
    count: '1,248',
    change: '+18%',
    direction: 'up' as const,
    subtext: 'vs. last year',
    dotColor: '#EF4444',
    badgeColor: 'rgba(239, 68, 68, 0.12)',
    badgeText: '#DC2626',
  },
  {
    id: 'kpi-fraud',
    title: 'Fraud',
    count: '892',
    change: '+11%',
    direction: 'up' as const,
    subtext: 'vs. last year',
    dotColor: '#F59E0B',
    badgeColor: 'rgba(245, 158, 11, 0.12)',
    badgeText: '#D97706',
  },
  {
    id: 'kpi-cybercrime',
    title: 'Cybercrime',
    count: '1,562',
    change: '+26%',
    direction: 'up' as const,
    subtext: 'vs. last year',
    dotColor: '#8B5CF6',
    badgeColor: 'rgba(139, 92, 246, 0.12)',
    badgeText: '#7C3AED',
  },
  {
    id: 'kpi-vehicle',
    title: 'Vehicle Theft',
    count: '673',
    change: '-4%',
    direction: 'down' as const,
    subtext: 'vs. last year',
    dotColor: '#10B981',
    badgeColor: 'rgba(16, 185, 129, 0.12)',
    badgeText: '#16A34A',
  },
  {
    id: 'kpi-extortion',
    title: 'Extortion',
    count: '421',
    change: '+2%',
    direction: 'up' as const,
    subtext: 'vs. last year',
    dotColor: '#D97706',
    badgeColor: 'rgba(217, 119, 6, 0.12)',
    badgeText: '#B45309',
  },
];

// Monthly FIR Trends Data (Jan to Aug)
const monthlyTrendsData = [
  { month: 'Jan', fraud: 38, robbery: 42, cybercrime: 22, kidnapping: 8 },
  { month: 'Feb', fraud: 41, robbery: 38, cybercrime: 25, kidnapping: 6 },
  { month: 'Mar', fraud: 44, robbery: 45, cybercrime: 28, kidnapping: 9 },
  { month: 'Apr', fraud: 46, robbery: 40, cybercrime: 32, kidnapping: 7 },
  { month: 'May', fraud: 42, robbery: 48, cybercrime: 29, kidnapping: 10 },
  { month: 'Jun', fraud: 48, robbery: 52, cybercrime: 34, kidnapping: 8 },
  { month: 'Jul', fraud: 51, robbery: 50, cybercrime: 38, kidnapping: 11 },
  { month: 'Aug', fraud: 53, robbery: 55, cybercrime: 41, kidnapping: 9 },
];

// Crime Type Distribution (Donut Chart)
const crimeTypeDistribution = [
  { name: 'Fraud / Financial Crime', value: 38, count: 892, color: '#4F46E5' },
  { name: 'Robbery', value: 24, count: 1248, color: '#EF4444' },
  { name: 'Cybercrime', value: 18, count: 1562, color: '#10B981' },
  { name: 'Vehicle Theft', value: 12, count: 673, color: '#F59E0B' },
  { name: 'Others', value: 8, count: 421, color: '#6B7280' },
];

// Peak Hours Data
const peakHoursData = [
  { hour: '00-04', incidents: 18, label: 'Night Window' },
  { hour: '04-08', incidents: 10, label: 'Early Dawn' },
  { hour: '08-12', incidents: 42, label: 'Morning Peak' },
  { hour: '12-16', incidents: 46, label: 'Afternoon' },
  { hour: '16-20', incidents: 74, label: 'Evening Surge' },
  { hour: '20-24', incidents: 58, label: 'Late Night' },
];

// City-wise FIR Volume Data
const cityFIRData = [
  { city: 'Delhi', count: 184, growth: '+14%' },
  { city: 'Mumbai', count: 156, growth: '+9%' },
  { city: 'Bengaluru', count: 98, growth: '+22%' },
  { city: 'Pune', count: 82, growth: '+6%' },
  { city: 'Hyderabad', count: 70, growth: '-2%' },
  { city: 'Kolkata', count: 64, growth: '+4%' },
];

// Synthetic Hotspots Dataset
const fullHotspotList: HotspotItem[] = [
  {
    id: 'HS-001',
    area: 'Andheri',
    city: 'Mumbai',
    state: 'Maharashtra',
    coordinates: [19.1197, 72.8464],
    crimeCount: 124,
    primaryCrime: 'Fraud',
    severity: 'High',
    trend: 'Increasing',
    recentFIRs: 18,
  },
  {
    id: 'HS-002',
    area: 'Kurla',
    city: 'Mumbai',
    state: 'Maharashtra',
    coordinates: [19.0726, 72.8845],
    crimeCount: 98,
    primaryCrime: 'Robbery',
    severity: 'High',
    trend: 'Increasing',
    recentFIRs: 14,
  },
  {
    id: 'HS-003',
    area: 'Dadar',
    city: 'Mumbai',
    state: 'Maharashtra',
    coordinates: [19.0178, 72.8478],
    crimeCount: 76,
    primaryCrime: 'Cybercrime',
    severity: 'Medium',
    trend: 'Stable',
    recentFIRs: 9,
  },
  {
    id: 'HS-004',
    area: 'Bandra',
    city: 'Mumbai',
    state: 'Maharashtra',
    coordinates: [19.0596, 72.8295],
    crimeCount: 68,
    primaryCrime: 'Financial Crime',
    severity: 'Medium',
    trend: 'Stable',
    recentFIRs: 8,
  },
  {
    id: 'HS-005',
    area: 'Chembur',
    city: 'Mumbai',
    state: 'Maharashtra',
    coordinates: [19.0622, 72.8976],
    crimeCount: 52,
    primaryCrime: 'Vehicle Theft',
    severity: 'Low',
    trend: 'Decreasing',
    recentFIRs: 5,
  },
  {
    id: 'HS-006',
    area: 'Goregaon',
    city: 'Mumbai',
    state: 'Maharashtra',
    coordinates: [19.1663, 72.8526],
    crimeCount: 44,
    primaryCrime: 'Extortion',
    severity: 'Low',
    trend: 'Stable',
    recentFIRs: 4,
  },
  {
    id: 'HS-007',
    area: 'Connaught Place',
    city: 'Delhi',
    state: 'Delhi NCR',
    coordinates: [28.6315, 77.2167],
    crimeCount: 142,
    primaryCrime: 'Robbery',
    severity: 'Critical',
    trend: 'Increasing',
    recentFIRs: 21,
  },
  {
    id: 'HS-008',
    area: 'Karol Bagh',
    city: 'Delhi',
    state: 'Delhi NCR',
    coordinates: [28.6519, 77.1909],
    crimeCount: 112,
    primaryCrime: 'Vehicle Theft',
    severity: 'High',
    trend: 'Increasing',
    recentFIRs: 16,
  },
  {
    id: 'HS-009',
    area: 'Whitefield',
    city: 'Bengaluru',
    state: 'Karnataka',
    coordinates: [12.9698, 77.7500],
    crimeCount: 88,
    primaryCrime: 'Cybercrime',
    severity: 'High',
    trend: 'Increasing',
    recentFIRs: 12,
  },
  {
    id: 'HS-010',
    area: 'Koregaon Park',
    city: 'Pune',
    state: 'Maharashtra',
    coordinates: [18.5362, 73.8932],
    crimeCount: 58,
    primaryCrime: 'Financial Crime',
    severity: 'Medium',
    trend: 'Stable',
    recentFIRs: 7,
  },
];

// Responsible Emerging Patterns Dataset
const emergingPatterns = [
  {
    id: 'PAT-001',
    title: 'Increasing Cyber Fraud Activity',
    direction: 'up',
    confidence: 78,
    status: 'Pattern Detected',
    basis: [
      'FIR frequency increase (+26% over past 60 days)',
      'Similar case patterns (remote banking Trojan & fake KYC links)',
      'Geographic clustering (shared telecom routing in Western suburbs)',
    ],
    details: 'Multiple complaints describe impersonation of electricity board and telco verification officers requesting urgent APK installations.',
    suggestedAction: 'Initiate Correlation Query',
    timeframe: 'Identified past 45 days',
    severity: 'High Priority',
  },
  {
    id: 'PAT-002',
    title: 'Repeated Vehicle Theft Pattern',
    direction: 'neutral',
    confidence: 71,
    status: 'Analytical Signal',
    basis: [
      'Similar locations (unmonitored transit parking lots along Western corridor)',
      'Similar time patterns (Friday & Saturday windows between 01:00 – 04:00 AM)',
      'Repeated entity relationships (suspected common forged chassis broker)',
    ],
    details: 'Cluster of mid-sized commercial vans reported stolen within 2km of highway toll exits without glass breakage.',
    suggestedAction: 'View Hotspot Overlay',
    timeframe: 'Identified past 30 days',
    severity: 'Medium Priority',
  },
  {
    id: 'PAT-003',
    title: 'Hawala Shell Company Transactions Clustering',
    direction: 'up',
    confidence: 84,
    status: 'Pattern Detected',
    basis: [
      'Rapid transaction velocity (<48h transit between bank accounts)',
      'Cross-district director overlaps (Karan Verma syndicate network)',
      'Foreign remittance spikes aligned with calendar holidays',
    ],
    details: 'Recurring financial hops through inactive LLP registrations flagged across Mumbai and Pune commercial registries.',
    suggestedAction: 'Cross-Reference Case-102',
    timeframe: 'Identified past 90 days',
    severity: 'High Priority',
  },
  {
    id: 'PAT-004',
    title: 'Commercial Logistics Pilferage Corridor',
    direction: 'neutral',
    confidence: 65,
    status: 'Emerging Trend',
    basis: [
      'Concentrated waypoints along freight transport bypass routes',
      'Off-hours vehicle staging at unauthorized wayside dhabas',
      'Correlated seal tampering reports on inter-state shipments',
    ],
    details: 'Anomalous stopover durations exceeding 90 minutes recorded on GPS consignment trackers along NH-48.',
    suggestedAction: 'Generate Intelligence Brief',
    timeframe: 'Identified past 60 days',
    severity: 'Routine Observation',
  },
];

function AnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabKey | null;

  const [activeTab, setActiveTab] = useState<TabKey>(
    tabParam && ['trends', 'hotspots', 'patterns'].includes(tabParam) ? tabParam : 'trends'
  );

  const [selectedCountry, setSelectedCountry] = useState('India');
  const [selectedState, setSelectedState] = useState('Maharashtra');
  const [selectedCity, setSelectedCity] = useState('Mumbai');
  const [selectedHotspot, setSelectedHotspot] = useState<HotspotItem | null>(fullHotspotList[0]);

  // Sync tab with URL parameter smoothly
  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    router.replace(`/analytics?tab=${key}`, { scroll: false });
  };

  // Filter hotspots by state and city
  const filteredHotspots = useMemo(() => {
    return fullHotspotList.filter((hs) => {
      if (selectedState !== 'all' && hs.state !== selectedState) return false;
      if (selectedCity !== 'all' && hs.city !== selectedCity) return false;
      return true;
    });
  }, [selectedState, selectedCity]);

  // Available cities based on selected state
  const availableCities = useMemo(() => {
    if (selectedState === 'all') return ['all', 'Mumbai', 'Delhi', 'Bengaluru', 'Pune'];
    const citiesInState = Array.from(
      new Set(fullHotspotList.filter((h) => h.state === selectedState).map((h) => h.city))
    );
    return ['all', ...citiesInState];
  }, [selectedState]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-7 animate-fade-in pb-12">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
            Analytics Hub
          </h1>
          <p className="text-[14px] sm:text-[15px] mt-1 text-[var(--ink-secondary)]">
            Crime trends, geographic hotspots, and emerging pattern intelligence.
          </p>
        </div>

        {/* Demo Data Notice Badge */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-[12.5px] font-medium border self-start sm:self-auto shadow-sm"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}>
          <Shield size={14} className="text-amber-500 shrink-0" />
          <span>Synthetic / Demo Data — Research & Analytical Intelligence</span>
        </div>
      </div>

      {/* ── Internal Tab Navigation ──────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl border w-fit shadow-sm"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[14px] font-semibold transition-all cursor-pointer"
              style={{
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? '#FFFFFF' : 'var(--ink-secondary)',
                boxShadow: isActive ? '0 4px 12px rgba(79, 70, 229, 0.28)' : 'none',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Standardized Top 5 KPI Cards (Moderate Linear/Vercel Sizing) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.id}
            className="p-5 rounded-2xl border transition-all duration-200 hover:shadow-sm"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
          >
            {/* Title & Indicator */}
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: kpi.dotColor }} />
                <span className="text-[14px] sm:text-[14.5px] font-semibold truncate" style={{ color: 'var(--ink-secondary)' }}>
                  {kpi.title}
                </span>
              </div>
            </div>

            {/* Main KPI Number (26-28px font-mono-id, bold) */}
            <div className="text-[26px] sm:text-[28px] font-bold font-mono-id tracking-tight my-1" style={{ color: 'var(--ink-primary)' }}>
              {kpi.count}
            </div>

            {/* YoY Change & Supporting Text */}
            <div className="flex items-center gap-1.5 text-[13px] font-semibold mt-1">
              <span
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-md font-mono-id text-[12.5px]"
                style={{ background: kpi.badgeColor, color: kpi.badgeText }}
              >
                {kpi.direction === 'up' ? '↑' : '↓'} {kpi.change}
              </span>
              <span className="text-[12px] font-normal" style={{ color: 'var(--ink-tertiary)' }}>
                {kpi.subtext}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ========================================================= */}
      {/* ── TAB 1: CRIME TRENDS ────────────────────────────────── */}
      {/* ========================================================= */}
      {activeTab === 'trends' && (
        <div className="space-y-6 animate-fade-in">
          {/* Main 2-Column Responsive Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Monthly FIR Volume Trends (8 Cols) */}
            <div
              className="lg:col-span-8 p-6 rounded-2xl border shadow-sm"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                <div>
                  <h3 className="text-[18px] sm:text-[20px] font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
                    Monthly FIR Volume Trends
                  </h3>
                  <p className="text-[13px] mt-0.5" style={{ color: 'var(--ink-secondary)' }}>
                    Comparative category volume across Jan – Aug 2026
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[12px] font-medium px-3 py-1 rounded-lg border"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}>
                  <span>Aggregated Jurisdictions</span>
                </div>
              </div>

              <div className="h-[320px] sm:h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrendsData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.6} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 13, fill: 'var(--ink-tertiary)' }}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 13, fill: 'var(--ink-tertiary)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        fontSize: '13px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      }}
                      itemStyle={{ padding: '2px 0' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '13px' }} />
                    <Line
                      type="monotone"
                      dataKey="fraud"
                      name="Fraud"
                      stroke="#4F46E5"
                      strokeWidth={2.5}
                      dot={{ r: 3.5, fill: '#4F46E5' }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="robbery"
                      name="Robbery"
                      stroke="#EF4444"
                      strokeWidth={2.5}
                      dot={{ r: 3.5, fill: '#EF4444' }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cybercrime"
                      name="Cybercrime"
                      stroke="#10B981"
                      strokeWidth={2.5}
                      dot={{ r: 3.5, fill: '#10B981' }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="kidnapping"
                      name="Kidnapping"
                      stroke="#EC4899"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#EC4899' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right: Crime Type Distribution (Donut Chart - 4 Cols) */}
            <div
              className="lg:col-span-4 p-6 rounded-2xl border shadow-sm flex flex-col justify-between"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
            >
              <div>
                <h3 className="text-[18px] sm:text-[20px] font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
                  Crime Type Distribution
                </h3>
                <p className="text-[13px] mt-0.5 mb-3" style={{ color: 'var(--ink-secondary)' }}>
                  Overall categorized FIR percentage
                </p>

                <div className="h-[210px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={crimeTypeDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {crimeTypeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'var(--surface-1)',
                          border: '1px solid var(--border)',
                          borderRadius: '10px',
                          fontSize: '13px',
                        }}
                        formatter={(val: any, name: any) => [`${val}% of total FIRs`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Donut Center Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[20px] font-bold font-mono-id" style={{ color: 'var(--ink-primary)' }}>
                      4,796
                    </span>
                    <span className="text-[11px] font-medium" style={{ color: 'var(--ink-tertiary)' }}>
                      Total FIRs
                    </span>
                  </div>
                </div>
              </div>

              {/* Breakdown Ledger */}
              <div className="space-y-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                {crimeTypeDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-[13px]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                      <span style={{ color: 'var(--ink-secondary)' }}>{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-mono-id" style={{ color: 'var(--ink-primary)' }}>
                        {item.value}%
                      </span>
                      <span className="text-[11.5px]" style={{ color: 'var(--ink-tertiary)' }}>
                        ({item.count})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Secondary 2-Column Row: Peak Hours & City-wise FIRs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Peak Crime Hours */}
            <div className="p-6 rounded-2xl border shadow-sm" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-[17px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                    Peak Incident Hours
                  </h4>
                  <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--ink-secondary)' }}>
                    Diurnal timeline distribution of registered incidents
                  </p>
                </div>
                <span className="text-[12px] font-semibold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-lg">
                  Surge: 16:00 – 20:00
                </span>
              </div>
              <div className="h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={peakHoursData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.6} />
                    <XAxis dataKey="hour" tick={{ fontSize: 12, fill: 'var(--ink-tertiary)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--ink-tertiary)' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        fontSize: '13px',
                      }}
                    />
                    <Bar dataKey="incidents" name="Incidents" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* City-wise FIR Count */}
            <div className="p-6 rounded-2xl border shadow-sm" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-[17px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                    City-wise FIR Volumes
                  </h4>
                  <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--ink-secondary)' }}>
                    Metropolitan jurisdiction caseload ranking
                  </p>
                </div>
                <span className="text-[12px] font-semibold text-indigo-500 bg-indigo-500/10 px-2.5 py-1 rounded-lg">
                  6 Major Metros
                </span>
              </div>
              <div className="h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cityFIRData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--ink-tertiary)' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="city" tick={{ fontSize: 12, fill: 'var(--ink-tertiary)' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        fontSize: '13px',
                      }}
                    />
                    <Bar dataKey="count" name="FIR Count" fill="#F59E0B" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ── TAB 2: CRIME HOTSPOTS ──────────────────────────────── */}
      {/* ========================================================= */}
      {activeTab === 'hotspots' && (
        <div className="space-y-6 animate-fade-in">
          {/* Spatial Filter Bar */}
          <div
            className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border shadow-sm"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-[13.5px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                <Filter size={15} className="text-[var(--accent)]" />
                <span>Geographic Scope:</span>
              </div>

              {/* Country Dropdown */}
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[13px] font-semibold"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }}>
                <span>🇮🇳 India</span>
              </div>

              <ChevronRight size={15} style={{ color: 'var(--ink-tertiary)' }} />

              {/* State Dropdown */}
              <select
                value={selectedState}
                onChange={(e) => {
                  setSelectedState(e.target.value);
                  setSelectedCity('all');
                }}
                className="h-10 px-3.5 rounded-xl border text-[13px] font-medium outline-none cursor-pointer transition-all"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
              >
                <option value="all">All States</option>
                <option value="Maharashtra">Maharashtra</option>
                <option value="Delhi NCR">Delhi NCR</option>
                <option value="Karnataka">Karnataka</option>
              </select>

              <ChevronRight size={15} style={{ color: 'var(--ink-tertiary)' }} />

              {/* City Dropdown */}
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="h-10 px-3.5 rounded-xl border text-[13px] font-medium outline-none cursor-pointer transition-all"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
              >
                <option value="all">All Cities</option>
                {availableCities.filter((c) => c !== 'all').map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            {/* Quick Summary Pill */}
            <div className="text-[12.5px] font-semibold text-[var(--ink-secondary)]">
              Showing <span className="font-mono-id text-[var(--accent)] font-bold">{filteredHotspots.length}</span> verified hotspot clusters
            </div>
          </div>

          {/* Large Map Visualization */}
          <div className="relative">
            <AnalyticsHotspotMap
              hotspots={filteredHotspots}
              selectedHotspot={selectedHotspot}
              onSelectHotspot={(hs) => setSelectedHotspot(hs)}
              selectedState={selectedState}
              selectedCity={selectedCity}
            />
          </div>

          {/* Top Hotspot Areas Table & Selected Area Inspection Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Top Hotspot Areas Table (8 Cols) */}
            <div
              className="lg:col-span-8 p-6 rounded-2xl border shadow-sm"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-[18px] sm:text-[20px] font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
                    Top Hotspot Areas
                  </h3>
                  <p className="text-[13px] mt-0.5" style={{ color: 'var(--ink-secondary)' }}>
                    Verified synthetic geographic clusters ranked by cumulative FIR density
                  </p>
                </div>
                <span className="text-[11.5px] font-medium text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-lg">
                  Synthetic Model Data
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b text-[12.5px] font-semibold text-[var(--ink-tertiary)]" style={{ borderColor: 'var(--border)' }}>
                      <th className="py-3 px-3">Area</th>
                      <th className="py-3 px-3">Jurisdiction</th>
                      <th className="py-3 px-3">Crime Count</th>
                      <th className="py-3 px-3">Primary Crime</th>
                      <th className="py-3 px-3">Density Level</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {filteredHotspots.map((hs) => {
                      const isSelected = selectedHotspot?.id === hs.id;
                      const isHigh = hs.severity === 'High' || hs.severity === 'Critical';
                      const isMed = hs.severity === 'Medium';

                      return (
                        <tr
                          key={hs.id}
                          onClick={() => setSelectedHotspot(hs)}
                          className="text-[13.5px] transition-colors cursor-pointer hover:bg-[var(--surface-2)]"
                          style={{
                            background: isSelected ? 'var(--accent-muted)' : 'transparent',
                          }}
                        >
                          <td className="py-3 px-3 font-semibold" style={{ color: 'var(--ink-primary)' }}>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{
                                  background: isHigh ? '#EF4444' : isMed ? '#F59E0B' : '#10B981',
                                }}
                              />
                              <span>{hs.area}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
                            {hs.city}, {hs.state}
                          </td>
                          <td className="py-3 px-3 font-mono-id font-bold text-[14px]" style={{ color: 'var(--ink-primary)' }}>
                            {hs.crimeCount}
                          </td>
                          <td className="py-3 px-3 text-[13px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
                            {hs.primaryCrime}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className="text-[11.5px] font-bold px-2.5 py-1 rounded-md"
                              style={{
                                background: isHigh ? 'rgba(239, 68, 68, 0.12)' : isMed ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                color: isHigh ? '#DC2626' : isMed ? '#D97706' : '#16A34A',
                              }}
                            >
                              {hs.severity} Density
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedHotspot(hs);
                              }}
                              className="px-2.5 py-1 rounded-lg text-[12px] font-semibold border transition-all hover:bg-[var(--surface-3)]"
                              style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Selected Area Inspection Card (4 Cols) */}
            <div className="lg:col-span-4 space-y-4">
              {selectedHotspot ? (
                <div
                  className="p-6 rounded-2xl border shadow-sm h-full flex flex-col justify-between"
                  style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[11px] uppercase tracking-wider font-bold text-[var(--accent)]">
                          Selected Hotspot Sector
                        </span>
                        <h4 className="text-[22px] font-bold tracking-tight mt-0.5" style={{ color: 'var(--ink-primary)' }}>
                          {selectedHotspot.area}
                        </h4>
                        <p className="text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
                          {selectedHotspot.city}, {selectedHotspot.state}
                        </p>
                      </div>
                      <span
                        className="text-[12px] font-bold px-3 py-1.5 rounded-xl shrink-0"
                        style={{
                          background: selectedHotspot.severity === 'High' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: selectedHotspot.severity === 'High' ? '#DC2626' : '#D97706',
                        }}
                      >
                        {selectedHotspot.severity} Density
                      </span>
                    </div>

                    {/* Coordinates & Quick Stats */}
                    <div className="grid grid-cols-2 gap-3 my-4">
                      <div className="p-3.5 rounded-xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                        <span className="text-[11px] font-medium" style={{ color: 'var(--ink-tertiary)' }}>Total Registered</span>
                        <div className="text-[20px] font-bold font-mono-id mt-0.5" style={{ color: 'var(--ink-primary)' }}>
                          {selectedHotspot.crimeCount} FIRs
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                        <span className="text-[11px] font-medium" style={{ color: 'var(--ink-tertiary)' }}>Recent 30 Days</span>
                        <div className="text-[20px] font-bold font-mono-id mt-0.5" style={{ color: 'var(--accent)' }}>
                          +{selectedHotspot.recentFIRs} new
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex justify-between text-[13px]">
                        <span style={{ color: 'var(--ink-secondary)' }}>Coordinates:</span>
                        <span className="font-mono-id font-medium" style={{ color: 'var(--ink-primary)' }}>
                          {selectedHotspot.coordinates[0]}°N, {selectedHotspot.coordinates[1]}°E
                        </span>
                      </div>
                      <div className="flex justify-between text-[13px]">
                        <span style={{ color: 'var(--ink-secondary)' }}>Primary Crime:</span>
                        <span className="font-semibold" style={{ color: 'var(--ink-primary)' }}>
                          {selectedHotspot.primaryCrime}
                        </span>
                      </div>
                      <div className="flex justify-between text-[13px]">
                        <span style={{ color: 'var(--ink-secondary)' }}>Observed Trend:</span>
                        <span className="font-semibold text-red-500">
                          {selectedHotspot.trend === 'Increasing' ? '↑ Rising Volume' : '→ Stable Baseline'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Synthetic Data Disclaimer Footer */}
                  <div className="mt-5 p-3 rounded-xl border text-[12px] leading-relaxed"
                    style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)', color: '#B45309' }}>
                    <strong>Notice:</strong> Synthetic / Demo Data only. Does NOT imply real criminal activity or individual criminality.
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-2xl border text-center h-full flex flex-col items-center justify-center"
                  style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
                  <MapPin size={28} className="text-gray-400 mb-2" />
                  <p className="text-[14px] font-medium text-[var(--ink-secondary)]">
                    Select an area from the table or click a map marker to view sector dossier.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ── TAB 3: EMERGING PATTERNS ───────────────────────────── */}
      {/* ========================================================= */}
      {activeTab === 'patterns' && (
        <div className="space-y-6 animate-fade-in">
          {/* Ethical Intelligence & Responsible AI Disclaimer */}
          <div
            className="p-5 rounded-2xl border flex items-start gap-4 shadow-sm"
            style={{
              background: 'rgba(79, 70, 229, 0.05)',
              borderColor: 'rgba(79, 70, 229, 0.22)',
            }}
          >
            <Shield size={22} className="text-[var(--accent)] shrink-0 mt-0.5" />
            <div className="space-y-1 text-[13.5px] leading-relaxed">
              <div className="font-bold text-[14.5px]" style={{ color: 'var(--ink-primary)' }}>
                Responsible Intelligence Framework Notice
              </div>
              <p style={{ color: 'var(--ink-secondary)' }}>
                Emerging pattern detection highlights historical synthetic correlations, spatial clustering, and temporal spikes for analytical prioritization.
                These analytical signals <strong>do not predict crime with certainty</strong> and <strong>never ascribe criminality to individuals</strong>.
                All patterns represent hypothesis signals that strictly require formal human investigator review.
              </p>
            </div>
          </div>

          {/* Pattern Intelligence Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {emergingPatterns.map((pat) => (
              <div
                key={pat.id}
                className="p-6 rounded-2xl border shadow-sm flex flex-col justify-between transition-all duration-200 hover:shadow-md"
                style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
              >
                <div>
                  {/* Top Header with Status & Confidence */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                      <span className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--accent)]">
                        {pat.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-semibold text-[var(--ink-tertiary)]">
                        Analytical Confidence:
                      </span>
                      <span className="text-[14px] font-bold font-mono-id px-2 py-0.5 rounded-lg text-emerald-600 bg-emerald-500/10">
                        {pat.confidence}%
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-[18px] sm:text-[19px] font-bold tracking-tight mb-2" style={{ color: 'var(--ink-primary)' }}>
                    {pat.title}
                  </h3>

                  {/* Summary Details */}
                  <p className="text-[13.5px] leading-relaxed mb-4" style={{ color: 'var(--ink-secondary)' }}>
                    {pat.details}
                  </p>

                  {/* Basis Breakdown */}
                  <div className="p-3.5 rounded-xl border mb-4 space-y-1.5"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)] block mb-1">
                      Correlated Signals Basis:
                    </span>
                    {pat.basis.map((b, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[12.5px] text-[var(--ink-secondary)]">
                        <CheckCircle2 size={13} className="text-[var(--accent)] shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Requirement & Action */}
                <div className="pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-600">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>Requires Investigator Review</span>
                  </div>

                  <button
                    onClick={() => router.push('/cases')}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-[12.5px] font-semibold transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink-primary)' }}
                  >
                    <span>{pat.suggestedAction}</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-7xl mx-auto p-8 text-[14px] flex items-center justify-center gap-2" style={{ color: 'var(--ink-secondary)' }}>
          <RefreshCw size={16} className="animate-spin" />
          <span>Loading Analytics Hub...</span>
        </div>
      }
    >
      <AnalyticsContent />
    </Suspense>
  );
}
