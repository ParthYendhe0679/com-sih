'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openInspector } from '@/store/slices/uiSlice';
import {
  FolderOpen, AlertTriangle, FileCheck, History, Activity,
  ArrowRight, ChevronRight, BrainCircuit, Users, Package, Brain
} from 'lucide-react';
import { dashboardApi, type PoliceDashboardStats } from '@/lib/api/dashboard';
import { casesApi, type BackendCase } from '@/lib/api/cases';
import { analyticsApi } from '@/lib/api/analytics';
import type { CrimeTrendData } from '@/types';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

interface LiveFeedItem {
  time: string;
  color: string;
  event: string;
  caseId: string;
}

const aiInsights: { id: string; title: string; body: string; confidence: number; caseId: string }[] = [];

// Crime trends start empty and are replaced by /analytics/overview once it
// responds. The chart renders its own empty state until then.
const fallbackCrimeTrends: CrimeTrendData[] = [];

/** Colour the activity feed dot by how urgent the case is. */
function priorityColor(priority?: string | null): string {
  switch ((priority || '').toUpperCase()) {
    case 'CRITICAL': return '#DC2626';
    case 'HIGH': return '#D97706';
    case 'MEDIUM': return '#12376E';
    default: return '#16A34A';
  }
}

/** "2 hours ago" style stamp for the activity feed. */
function relativeTime(iso?: string | null): string {
  if (!iso) return 'recently';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'recently';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** Turn the most recent cases into activity-feed rows. */
function buildLiveFeed(cases: BackendCase[]): LiveFeedItem[] {
  return cases.slice(0, 6).map((c) => ({
    time: relativeTime(c.updated_at || c.created_at),
    color: priorityColor(c.priority),
    event: `${c.crime_category || 'Case'} — ${c.title || 'Investigation'}`,
    caseId: c.case_number || '',
  }));
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const CustomChartTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 dark:bg-[#1A1B28]/95 backdrop-blur-xs border border-slate-200/90 dark:border-white/10 rounded-xl p-3 shadow-xl text-xs space-y-1.5 min-w-[140px]">
        <p className="font-semibold text-slate-800 dark:text-slate-100 text-[13px] mb-1">{label}</p>
        {payload.map((entry, index) => {
          const color = entry.name === 'Cybercrime' ? '#16A34A'
            : entry.name === 'Fraud' ? '#12376E'
            : entry.name === 'Kidnapping' ? '#DC2626'
            : '#D97706';
          return (
            <div key={index} className="flex items-center justify-between gap-3 text-[12px]">
              <span className="flex items-center gap-1.5 font-medium" style={{ color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                {entry.name} :
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-100 tabular-nums">{entry.value}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.ui.theme);
  const isDark = theme === 'dark';

  const [recentCases, setRecentCases] = useState<BackendCase[]>([]);
  const [trends, setTrends] = useState<CrimeTrendData[]>(fallbackCrimeTrends);
  const [liveFeedData, setLiveFeedData] = useState<LiveFeedItem[]>([]);
  const [stats, setStats] = useState<PoliceDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadDashboard() {
      try {
        const [dashRes, casesRes, analyticsRes] = await Promise.allSettled([
          dashboardApi.getPoliceDashboard(),
          casesApi.listCases({ size: 8 }),
          analyticsApi.getOverview(),
        ]);

        if (isMounted) {
          if (dashRes.status === 'fulfilled' && dashRes.value) {
            setStats(dashRes.value);
            if (dashRes.value.recent_cases && dashRes.value.recent_cases.length > 0) {
              setRecentCases(dashRes.value.recent_cases);
              setLiveFeedData(buildLiveFeed(dashRes.value.recent_cases));
            }
          }
          if (casesRes.status === 'fulfilled' && casesRes.value?.items?.length) {
            setRecentCases(casesRes.value.items);
            setLiveFeedData(buildLiveFeed(casesRes.value.items));
          }
          // Monthly caseload for the trends chart. The backend already returns
          // month/fraud/robbery/cybercrime/kidnapping, which is exactly what
          // the AreaChart plots.
          if (analyticsRes.status === 'fulfilled' && analyticsRes.value?.monthly_trends?.length) {
            setTrends(
              analyticsRes.value.monthly_trends.map((m) => ({
                month: m.month,
                fraud: m.fraud ?? 0,
                robbery: m.robbery ?? 0,
                cybercrime: m.cybercrime ?? 0,
                kidnapping: m.kidnapping ?? 0,
                murder: 0,
                vehicleTheft: 0,
              }))
            );
          }
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadDashboard();
    return () => { isMounted = false; };
  }, []);

  const topMetrics = [
    {
      label: 'Active Cases',
      value: stats ? String(stats.assigned_cases ?? stats.assigned_cases_count ?? stats.open_cases ?? 0) : '0',
      sub: 'Assigned investigations',
      icon: FolderOpen,
      href: '/cases',
      color: 'var(--pastel-mint-ink)',
      bg: 'var(--pastel-mint)'
    },
    {
      label: 'New FIRs',
      value: stats ? String(stats.pending_fir_reviews ?? stats.pending_fir_reviews_count ?? 0) : '0',
      sub: 'Pending review',
      icon: FileCheck,
      href: '/fir',
      color: 'var(--pastel-peach-ink)',
      bg: 'var(--pastel-peach)'
    },
    {
      label: 'TRINETRA Analysis',
      value: '10',
      sub: 'Agents online',
      icon: BrainCircuit,
      href: '/intelligence/samanvaya',
      color: 'var(--pastel-lilac-ink)',
      bg: 'var(--pastel-lilac)'
    },
    {
      label: 'High Priority',
      value: stats ? String(stats.high_priority_cases ?? stats.urgent_cases_count ?? 0) : '0',
      sub: 'Urgent attention',
      icon: Users,
      href: '/cases?priority=CRITICAL',
      color: 'var(--pastel-sky-ink)',
      bg: 'var(--pastel-sky)'
    },
    {
      label: 'Open Cases',
      value: stats ? String(stats.open_cases ?? stats.open_cases_count ?? 0) : '0',
      sub: 'Active queue',
      icon: History,
      href: '/cases?status=OPEN',
      color: 'var(--pastel-rose-ink)',
      bg: 'var(--pastel-rose)'
    },
    {
      label: 'Evidence Reviews',
      value: '12',
      sub: 'SHA-256 sealed',
      icon: Package,
      href: '/evidence',
      color: 'var(--pastel-teal-ink)',
      bg: 'var(--pastel-teal)'
    },
    {
      label: 'Cross-Case Patterns',
      value: '9',
      sub: 'MANTHAN identified',
      icon: Activity,
      href: '/intelligence/samanvaya',
      color: 'var(--pastel-sand-ink)',
      bg: 'var(--pastel-sand)'
    },
    {
      label: 'Case Leads',
      value: stats ? String(stats.pending_fir_reviews ?? 0) : '0',
      sub: 'Ready for review',
      icon: AlertTriangle,
      href: '/cases',
      color: 'var(--pastel-mint-ink)',
      bg: 'var(--pastel-mint)'
    },
  ];

  const topEntities: { id: string; name: string; role: string; connections: number; caseId: string }[] = [];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[32px] font-semibold leading-none tracking-[-0.03em]" style={{ color: 'var(--ink-primary)' }}>
            Investigation Intelligence Overview
          </h1>
          <p className="text-[13.5px] mt-1" style={{ color: 'var(--ink-secondary)' }}>
            Live case tracking, evidence signals and network activity
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/intelligence/samanvaya"
            className="px-4 py-2.5 rounded-full text-[12.5px] font-semibold transition-colors flex items-center gap-2 cursor-pointer hover:bg-[var(--surface-2)]"
            style={{ background: 'var(--surface-1)', color: 'var(--ink-secondary)' }}
          >
            TRINETRA Analysis
          </Link>
          <button
            onClick={() => router.push('/cases')}
            className="px-5 py-2.5 rounded-full text-[13px] font-semibold text-white flex items-center gap-2 transition-opacity cursor-pointer hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            View Cases
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* ── 8 Metric Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {topMetrics.map((m) => {
          const Icon = m.icon;
          return (
            // Reference layout: uppercase label on the left, tinted icon chip on
            // the right, then the figure underneath in ink. Colour lives in the
            // icon, not the number, so eight tiles in a row stay calm and the
            // eye can still compare the values.
            <button
              key={m.label}
              onClick={() => router.push(m.href)}
              className="card-dashed px-5 py-5 text-left transition-colors hover:border-[var(--ink-faint)] group cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2 mb-4">
                <span
                  className="text-[13px] font-semibold leading-snug"
                  style={{ color: 'var(--ink-primary)' }}
                >
                  {m.label}
                </span>
                <span className="icon-chip" style={{ background: m.bg, color: m.color }}>
                  <Icon size={16} strokeWidth={2} />
                </span>
              </div>
              <div
                className="metric-value text-[30px] mb-1.5"
                style={{ color: 'var(--ink-primary)' }}
              >
                {m.value}
              </div>
              <div className="text-[11.5px]" style={{ color: 'var(--ink-tertiary)' }}>
                {m.sub}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Main Grid: Trends + Live Feed ───────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Crime Trends Chart (8 cols) */}
        <div className="xl:col-span-8 card-solid p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-[17px] font-semibold" style={{ color: 'var(--ink-primary)' }}>
                Metropolitan Crime Trends
              </h3>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--ink-tertiary)' }}>
                Monthly caseload across jurisdictions
              </p>
            </div>
            <Link
              href="/analytics"
              className="text-[13px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline flex items-center gap-1"
            >
              Full Analytics <ChevronRight size={14} />
            </Link>
          </div>

          {trends.length === 0 ? (
            <div className="h-[270px] w-full flex flex-col items-center justify-center text-slate-400">
              <Activity className="mb-2 text-slate-300 dark:text-slate-600" size={32} />
              <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300">No crime trend data available</p>
              <p className="text-[11.5px] text-slate-400 dark:text-slate-400">Monthly crime metrics will populate as FIR records are ingested</p>
            </div>
          ) : (
            <>
              <div className="h-[270px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cFraud" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#17A2A2" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#17A2A2" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="cRobbery" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F97316" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#F97316" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="cCyber" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#A7E8DC" stopOpacity={0.20} />
                        <stop offset="95%" stopColor="#A7E8DC" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="cKidnap" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B7FE8" stopOpacity={0.20} />
                        <stop offset="95%" stopColor="#8B7FE8" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.08)' : '#E1E5EA'} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: '#9CA3AF' }}
                      axisLine={{ stroke: isDark ? 'rgba(255,255,255,0.08)' : '#E1E5EA' }}
                      tickLine={false}
                    />
                    {/* Scale to the data. A fixed 0-60 domain flattened every
                        series against the axis, because real monthly counts
                        here peak in single digits. */}
                    <YAxis
                      domain={[0, (max: number) => Math.max(4, Math.ceil(max * 1.25))]}
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="robbery"
                      stroke="var(--cat-orange)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#cRobbery)"
                      name="Robbery"
                    />
                    <Area
                      type="monotone"
                      dataKey="fraud"
                      stroke="var(--accent)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#cFraud)"
                      name="Fraud"
                    />
                    <Area
                      type="monotone"
                      dataKey="cybercrime"
                      stroke="var(--cat-mint)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#cCyber)"
                      name="Cybercrime"
                    />
                    <Area
                      type="monotone"
                      dataKey="kidnapping"
                      stroke="var(--cat-purple)"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#cKidnap)"
                      name="Kidnapping"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center gap-6 text-[12px] pt-3.5 border-t border-slate-100 dark:border-white/10 mt-2 font-medium">
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#17A2A2]" />
                  Fraud
                </span>
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F97316]" />
                  Robbery
                </span>
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#A7E8DC]" />
                  Cybercrime
                </span>
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8B7FE8]" />
                  Kidnapping
                </span>
              </div>
            </>
          )}
        </div>

        {/* Live Investigation Feed (4 cols) */}
        <div className="xl:col-span-4 card-solid p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-[17px] font-semibold" style={{ color: 'var(--ink-primary)' }}>
                Active Investigation Activity
              </h3>
            </div>
            <Link
              href="/cases"
              className="text-[12.5px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline flex items-center gap-0.5"
            >
              View all <ChevronRight size={13} />
            </Link>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[330px] pr-1.5 flex flex-col justify-center">
            {liveFeedData.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Activity className="mx-auto mb-2 text-slate-300 dark:text-slate-600" size={28} />
                <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300">No active activity logs</p>
                <p className="text-[11.5px] text-slate-400 dark:text-slate-400 mt-0.5">Real-time investigative telemetry will display here</p>
              </div>
            ) : (
              liveFeedData.map((ev, i) => (
                <div key={i} className="flex gap-3 text-[13px]">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ background: ev.color }}
                    />
                    {i < liveFeedData.length - 1 && (
                      <div className="w-0.5 flex-1 mt-1 bg-slate-200/80 dark:bg-white/10 min-h-[24px]" />
                    )}
                  </div>
                  <div className="pb-2.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[11px] font-semibold text-slate-400 dark:text-slate-400">
                        {ev.time}
                      </span>
                      <Link
                        href={`/cases/${ev.caseId}`}
                        className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                      >
                        {ev.caseId}
                      </Link>
                    </div>
                    <p className="text-[12.5px] leading-snug text-slate-800 dark:text-slate-200">
                      {ev.event}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Grid: Cases, Entities, AI Insights ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Active Investigations */}
        <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#13141E] shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">Active Investigations</h3>
            <Link
              href="/cases"
              className="text-[13px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-0.5"
            >
              All Cases <ChevronRight size={13} />
            </Link>
          </div>
          <div className="space-y-2.5 flex-1">
            {recentCases.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <FolderOpen className="mx-auto mb-2 text-slate-300 dark:text-slate-600" size={32} />
                <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300">No active cases</p>
                <p className="text-[11.5px] text-slate-400 dark:text-slate-400 mt-0.5 mb-3">Cases created from FIRs will appear here</p>
                <Link
                  href="/cases"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                >
                  Create or View Cases
                </Link>
              </div>
            ) : (
              recentCases.map((c) => (
                <div
                  key={c.id}
                  onClick={() => router.push(`/cases/${c.id}`)}
                  className="p-3.5 rounded-xl border border-slate-200/70 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                      {c.case_number || c.id.slice(0, 8)}
                    </span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded font-semibold"
                      style={{
                        background: c.priority === 'CRITICAL' || c.priority === 'HIGH' ? (isDark ? 'rgba(220,38,38,0.2)' : '#FDECEC') : (isDark ? 'rgba(217,119,6,0.2)' : '#FDF3E3'),
                        color: c.priority === 'CRITICAL' || c.priority === 'HIGH' ? (isDark ? '#DC2626' : '#DC2626') : (isDark ? '#D97706' : '#D97706'),
                      }}
                    >
                      {c.priority}
                    </span>
                  </div>
                  <div className="text-[13.5px] font-semibold text-slate-900 dark:text-white truncate mt-1">
                    {c.title}
                  </div>
                  <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {c.crime_category || 'Investigation'} • {c.status}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Network Entities */}
        <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#13141E] shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">Top Network Entities</h3>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">Highest graph centrality</p>
            </div>
            <Link
              href="/network"
              className="text-[13px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-0.5"
            >
              Graph <ChevronRight size={13} />
            </Link>
          </div>
          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {topEntities.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <Users className="mx-auto mb-2 text-slate-300 dark:text-slate-600" size={28} />
                <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300">No network entities tracked</p>
                <p className="text-[11.5px] text-slate-400 dark:text-slate-400 mt-0.5">Entities will be extracted upon case & FIR ingestion</p>
              </div>
            ) : (
              topEntities.map((ent) => (
                <div
                  key={ent.id}
                  onClick={() =>
                    dispatch(
                      openInspector({
                        id: ent.id,
                        type: ent.id.startsWith('PERSON') ? 'Person' : 'Organization',
                      })
                    )
                  }
                  className="p-3.5 rounded-xl border border-slate-200/70 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <div className="text-[13.5px] font-semibold text-slate-900 dark:text-white">
                      {ent.name}
                    </div>
                    <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {ent.role} • {ent.caseId}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[16px] font-semibold font-mono text-indigo-600 dark:text-indigo-400">
                      {ent.connections}
                    </div>
                    <div className="text-[10.5px] font-mono text-slate-400 dark:text-slate-400">links</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Insights */}
        <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#13141E] shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Brain size={15} />
              </div>
              <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">AI Insights</h3>
            </div>
            <Link
              href="/ai"
              className="text-[13px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-0.5"
            >
              Ask AI <ChevronRight size={13} />
            </Link>
          </div>
          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {aiInsights.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <Brain className="mx-auto mb-2 text-slate-300 dark:text-slate-600" size={28} />
                <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300">No active AI alerts</p>
                <p className="text-[11.5px] text-slate-400 dark:text-slate-400 mt-0.5">Neural insights will compute as case links grow</p>
              </div>
            ) : (
              aiInsights.map((insight) => (
                <div
                  key={insight.id}
                  className="p-4 rounded-xl border border-slate-200/70 dark:border-white/10 bg-slate-50/70 dark:bg-white/5"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h4 className="text-[13px] font-semibold leading-tight text-slate-900 dark:text-white">
                      {insight.title}
                    </h4>
                  </div>
                  <p className="text-[12px] leading-relaxed mb-2.5 text-slate-600 dark:text-slate-300">
                    {insight.body}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full overflow-hidden bg-slate-200 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-indigo-600 dark:bg-indigo-400"
                          style={{ width: `${insight.confidence}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold font-mono text-indigo-600 dark:text-indigo-400">
                        {insight.confidence}%
                      </span>
                    </div>
                    <span className="text-[10.5px] font-mono text-slate-400 dark:text-slate-400">
                      {insight.caseId}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
