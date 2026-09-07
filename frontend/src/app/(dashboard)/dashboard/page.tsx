'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { openInspector } from '@/store/slices/uiSlice';
import {
  FolderOpen, AlertTriangle, FileCheck, History, Activity,
  ArrowRight, ChevronRight, BrainCircuit, Users, Package, Brain
} from 'lucide-react';
import {
  mockCaseService, mockAlertService,
  mockAnalyticsService
} from '@/services/mockServices';
import type { Case, Alert, HotspotData, CrimeTrendData } from '@/types';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

// Active Investigation Activity telemetry feed
const liveFeedData = [
  { time: '10:45', color: '#6366F1', event: 'Investigation Agent completed multi-source synthesis', caseId: 'CASE-102' },
  { time: '10:42', color: '#D97706', event: 'Investigator reviewed wire transfer evidence (EVIDENCE-046)', caseId: 'CASE-102' },
  { time: '10:38', color: '#7C3AED', event: 'Historical case match detected: 87% similarity with CASE-087', caseId: 'CASE-102' },
  { time: '10:35', color: '#4F46E5', event: 'New entity correlation found: Karan Verma ↔ MH-01-AB-1234', caseId: 'CASE-102' },
  { time: '10:32', color: '#16A34A', event: 'CASE-102 dossier updated with Juhu PS FIR-2026-0102', caseId: 'CASE-102' },
  { time: '10:18', color: '#0EA5E9', event: 'Approved online citizen complaint converted to investigation queue', caseId: 'CASE-119' },
  { time: '10:05', color: '#4F46E5', event: 'Centrality analysis identified ORG-014 as primary financial hub', caseId: 'CASE-102' },
  { time: '09:50', color: '#0369A1', event: 'Evidence integrity sealed: SHA-256 cryptographic verification', caseId: 'CASE-108' },
];

const aiInsights = [
  {
    id: 'AI-001',
    title: '3 Hidden Connections Detected',
    body: 'PERSON-014 has indirect links to PERSON-033 through 2 intermediary organizations not previously flagged.',
    confidence: 91,
    caseId: 'CASE-102',
  },
  {
    id: 'AI-002',
    title: 'Entity P-104 has High Network Centrality',
    body: 'ORG-014 (Nexus Trading Corp) acts as a financial hub node with 14 connected entities and ₹4.7Cr traced flow.',
    confidence: 87,
    caseId: 'CASE-102',
  },
  {
    id: 'AI-003',
    title: 'Historical Match: 87% Similarity',
    body: 'Current case pattern closely matches CASE-2019-042 — same crime type, overlapping location cluster, similar MO.',
    confidence: 87,
    caseId: 'CASE-102',
  },
];

// Fallback crime trend data matching screenshot exactly
const fallbackCrimeTrends: CrimeTrendData[] = [
  { month: 'Jan', robbery: 42, fraud: 38, kidnapping: 8, murder: 5, vehicleTheft: 28, cybercrime: 22 },
  { month: 'Feb', robbery: 38, fraud: 41, kidnapping: 6, murder: 4, vehicleTheft: 25, cybercrime: 25 },
  { month: 'Mar', robbery: 45, fraud: 44, kidnapping: 9, murder: 6, vehicleTheft: 30, cybercrime: 28 },
  { month: 'Apr', robbery: 40, fraud: 46, kidnapping: 7, murder: 5, vehicleTheft: 27, cybercrime: 32 },
  { month: 'May', robbery: 48, fraud: 42, kidnapping: 10, murder: 7, vehicleTheft: 32, cybercrime: 29 },
  { month: 'Jun', robbery: 52, fraud: 48, kidnapping: 8, murder: 6, vehicleTheft: 35, cybercrime: 34 },
  { month: 'Jul', robbery: 50, fraud: 51, kidnapping: 11, murder: 8, vehicleTheft: 29, cybercrime: 38 },
  { month: 'Aug', robbery: 55, fraud: 53, kidnapping: 9, murder: 5, vehicleTheft: 33, cybercrime: 41 },
];

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
      <div className="bg-white/95 backdrop-blur-xs border border-slate-200/90 rounded-xl p-3 shadow-xl text-xs space-y-1.5 min-w-[140px]">
        <p className="font-semibold text-slate-800 text-[13px] mb-1">{label}</p>
        {payload.map((entry, index) => {
          const color = entry.name === 'Cybercrime' ? '#10B981' : entry.name === 'Fraud' ? '#6366F1' : '#F59E0B';
          return (
            <div key={index} className="flex items-center justify-between gap-3 text-[12px]">
              <span className="flex items-center gap-1.5 font-medium" style={{ color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                {entry.name} :
              </span>
              <span className="font-bold text-slate-800 tabular-nums">{entry.value}</span>
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

  const [recentCases, setRecentCases] = useState<Case[]>([]);
  const [trends, setTrends] = useState<CrimeTrendData[]>(fallbackCrimeTrends);

  useEffect(() => {
    mockCaseService.getCases().then((c) => setRecentCases(c.slice(0, 5)));
    mockAnalyticsService.getCrimeTrends().then((t) => {
      if (t && t.length > 0) setTrends(t);
    }).catch(() => {
      setTrends(fallbackCrimeTrends);
    });
  }, []);

  const topMetrics = [
    { label: 'Active Cases', value: '128', sub: '+4 this week', icon: FolderOpen, href: '/cases', color: '#4F46E5', bg: 'rgba(79, 70, 229, 0.08)' },
    { label: 'New FIRs', value: '23', sub: '8 pending review', icon: FileCheck, href: '/fir', color: '#16A34A', bg: 'rgba(22, 163, 74, 0.08)' },
    { label: 'SAMANVAYA AI', value: '10', sub: 'Agents online', icon: BrainCircuit, href: '/intelligence/samanvaya', color: '#6366F1', bg: 'rgba(99, 102, 241, 0.08)' },
    { label: 'High Priority Entities', value: '41', sub: '12 under watch', icon: Users, href: '/cases/CASE-102?tab=entities', color: '#D97706', bg: 'rgba(217, 119, 6, 0.08)' },
    { label: 'Historical Matches', value: '31', sub: '89% top match', icon: History, href: '/historical', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.08)' },
    { label: 'Evidence Reviews', value: '12', sub: 'SHA-256 sealed', icon: Package, href: '/evidence', color: '#0369A1', bg: 'rgba(3, 105, 161, 0.08)' },
    { label: 'Cross-Case Patterns', value: '9', sub: 'MANTHAN identified', icon: Activity, href: '/intelligence/samanvaya', color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
    { label: 'Case Leads', value: '34', sub: '6 ready for review', icon: AlertTriangle, href: '/cases', color: '#DC2626', bg: 'rgba(220, 38, 38, 0.08)' },
  ];

  const topEntities = [
    { id: 'PERSON-019', name: 'Karan Verma', role: 'Key POI / Operator', connections: 18, caseId: 'CASE-102' },
    { id: 'PERSON-016', name: 'Rahul Thakur', role: 'Key Associate', connections: 12, caseId: 'CASE-102' },
    { id: 'PERSON-015', name: 'Nisha Kapoor', role: 'Person of Interest', connections: 11, caseId: 'CASE-102' },
    { id: 'ORG-014', name: 'Nexus Trading Corp', role: 'Shell Company', connections: 14, caseId: 'CASE-102' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Investigation Intelligence Overview
          </h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Real-time criminal syndicate tracking, forensic signals, and live tactical telemetry
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/intelligence/samanvaya"
            className="px-4 py-2 rounded-full text-[12.5px] font-semibold border border-indigo-200/80 bg-white text-indigo-700 hover:bg-indigo-50/70 transition-all flex items-center gap-2 shadow-2xs cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
            SAMANVAYA AI
          </Link>
          <button
            onClick={() => router.push('/cases')}
            className="px-5 py-2 rounded-full text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-2 transition-all shadow-sm hover:shadow-md cursor-pointer"
          >
            View Cases
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* ── 8 Metric Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3.5">
        {topMetrics.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.label}
              onClick={() => router.push(m.href)}
              className="p-4 rounded-2xl border border-slate-200/80 bg-white text-left hover:-translate-y-0.5 transition-all hover:shadow-md group shadow-2xs cursor-pointer"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105"
                style={{ background: m.bg, color: m.color }}
              >
                <Icon size={18} strokeWidth={2} />
              </div>
              <div className="text-[26px] font-bold leading-none mb-1.5 tracking-tight" style={{ color: m.color }}>
                {m.value}
              </div>
              <div className="text-[12px] font-semibold text-slate-800 leading-snug">
                {m.label}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {m.sub}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Main Grid: Trends + Live Feed ───────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Crime Trends Chart (8 cols) */}
        <div className="xl:col-span-8 p-6 rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[17px] font-bold text-slate-900">
                Metropolitan Crime Trends
              </h3>
              <p className="text-[13px] text-slate-500 mt-0.5">
                Monthly caseload across jurisdictions
              </p>
            </div>
            <Link
              href="/analytics"
              className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
            >
              Full Analytics <ChevronRight size={14} />
            </Link>
          </div>

          <div className="h-[270px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="cFraud" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="cRobbery" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="cCyber" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.20} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: '#94A3B8' }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis
                  ticks={[0, 15, 30, 45, 60]}
                  domain={[0, 60]}
                  tick={{ fontSize: 12, fill: '#94A3B8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="robbery"
                  stroke="#F59E0B"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#cRobbery)"
                  name="Robbery"
                />
                <Area
                  type="monotone"
                  dataKey="fraud"
                  stroke="#4F46E5"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#cFraud)"
                  name="Fraud"
                />
                <Area
                  type="monotone"
                  dataKey="cybercrime"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#cCyber)"
                  name="Cybercrime"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center gap-6 text-[12px] pt-3.5 border-t border-slate-100 mt-2 font-medium">
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4F46E5]" />
              Fraud (+11%)
            </span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
              Robbery (+18%)
            </span>
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
              Cybercrime (+26%)
            </span>
          </div>
        </div>

        {/* Live Investigation Feed (4 cols) */}
        <div className="xl:col-span-4 p-6 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <h3 className="text-[17px] font-bold text-slate-900">
                Active Investigation Activity
              </h3>
            </div>
            <Link
              href="/cases"
              className="text-[12.5px] font-semibold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-0.5"
            >
              View all <ChevronRight size={13} />
            </Link>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[330px] pr-1.5">
            {liveFeedData.map((ev, i) => (
              <div key={i} className="flex gap-3 text-[13px]">
                <div className="flex flex-col items-center">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ background: ev.color }}
                  />
                  {i < liveFeedData.length - 1 && (
                    <div className="w-0.5 flex-1 mt-1 bg-slate-200/80 min-h-[24px]" />
                  )}
                </div>
                <div className="pb-2.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[11px] font-bold text-slate-400">
                      {ev.time}
                    </span>
                    <Link
                      href={`/cases/${ev.caseId}`}
                      className="text-[10.5px] font-bold px-1.5 py-0.5 rounded font-mono bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                    >
                      {ev.caseId}
                    </Link>
                  </div>
                  <p className="text-[12.5px] leading-snug text-slate-800">
                    {ev.event}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Grid: Cases, Entities, AI Insights ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Active Investigations */}
        <div className="p-6 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[16px] font-bold text-slate-900">Active Investigations</h3>
            <Link
              href="/cases"
              className="text-[13px] text-indigo-600 font-semibold hover:underline flex items-center gap-0.5"
            >
              All Cases <ChevronRight size={13} />
            </Link>
          </div>
          <div className="space-y-2.5 flex-1">
            {recentCases.map((c) => (
              <div
                key={c.id}
                onClick={() => router.push(`/cases/${c.id}`)}
                className="p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/70 hover:bg-indigo-50/50 hover:border-indigo-300 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-mono font-bold text-indigo-600">
                    {c.id}
                  </span>
                  <span
                    className="text-[11px] px-2 py-0.5 rounded font-semibold"
                    style={{
                      background: c.priority === 'Critical' ? '#FEE2E2' : '#FEF3C7',
                      color: c.priority === 'Critical' ? '#DC2626' : '#B45309',
                    }}
                  >
                    {c.priority}
                  </span>
                </div>
                <div className="text-[13.5px] font-semibold text-slate-900 truncate mt-1">
                  {c.title}
                </div>
                <div className="text-[11.5px] text-slate-500 mt-0.5">
                  {c.city} • {c.crime}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Network Entities */}
        <div className="p-6 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[16px] font-bold text-slate-900">Top Network Entities</h3>
              <p className="text-[12px] text-slate-500">Highest graph centrality</p>
            </div>
            <Link
              href="/cases/CASE-102?tab=network"
              className="text-[13px] text-indigo-600 font-semibold hover:underline flex items-center gap-0.5"
            >
              Graph <ChevronRight size={13} />
            </Link>
          </div>
          <div className="space-y-3 flex-1">
            {topEntities.map((ent) => (
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
                className="p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/70 hover:bg-indigo-50/50 hover:border-indigo-300 transition-all flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="text-[13.5px] font-semibold text-slate-900">
                    {ent.name}
                  </div>
                  <div className="text-[11.5px] text-slate-500 mt-0.5">
                    {ent.role} • {ent.caseId}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[16px] font-bold font-mono text-indigo-600">
                    {ent.connections}
                  </div>
                  <div className="text-[10.5px] font-mono text-slate-400">links</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insights */}
        <div className="p-6 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-50 text-indigo-600">
                <Brain size={15} />
              </div>
              <h3 className="text-[16px] font-bold text-slate-900">AI Insights</h3>
            </div>
            <Link
              href="/ai"
              className="text-[13px] text-indigo-600 font-semibold hover:underline flex items-center gap-0.5"
            >
              Ask AI <ChevronRight size={13} />
            </Link>
          </div>
          <div className="space-y-3 flex-1">
            {aiInsights.map((insight) => (
              <div
                key={insight.id}
                className="p-4 rounded-xl border border-slate-200/70 bg-slate-50/70"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <h4 className="text-[13px] font-bold leading-tight text-slate-900">
                    {insight.title}
                  </h4>
                </div>
                <p className="text-[12px] leading-relaxed mb-2.5 text-slate-600">
                  {insight.body}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 rounded-full overflow-hidden bg-slate-200">
                      <div
                        className="h-full rounded-full bg-indigo-600"
                        style={{ width: `${insight.confidence}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold font-mono text-indigo-600">
                      {insight.confidence}%
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono text-slate-400">
                    {insight.caseId}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
