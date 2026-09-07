'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { openInspector } from '@/store/slices/uiSlice';
import { casesApi, BackendCase } from '@/lib/api/cases';
import { mockCaseService } from '@/services/mockServices';
import type { Case } from '@/types';
import {
  people, vehicles, phones, locations, organizations,
  evidence, alerts, timelineEvents, transactions, firs, forensicRecords
} from '@/mock';
import CaseNetworkGraph from '@/components/case/CaseNetworkGraph';
import CaseLeafletMap from '@/components/case/CaseLeafletMap';
import {
  FolderOpen, User, Car, Phone as PhoneIcon, MapPin,
  Package, Network, Map, History, Clock, Bell, Bot, FileText,
  ShieldCheck, AlertTriangle, ArrowLeft, ArrowRight, GitFork, CheckCircle2,
  Calendar, FileCode, Check, Eye, RefreshCw, Share2, Sparkles,
  Layers, ChevronRight, ExternalLink, HelpCircle, Plus, BrainCircuit, Search
} from 'lucide-react';
import { toast } from 'sonner';

type TabKey =
  | 'overview'
  | 'fir'
  | 'entities'
  | 'relationships'
  | 'network'
  | 'map'
  | 'timeline'
  | 'evidence'
  | 'historical'
  | 'related'
  | 'insights'
  | 'ai';

const workspaceTabs: { key: TabKey; label: string; icon: React.ElementType; badge?: string }[] = [
  { key: 'overview', label: 'Overview', icon: FolderOpen },
  { key: 'fir', label: 'FIR & Documents', icon: FileText, badge: 'FIR-0102' },
  { key: 'entities', label: 'Entities', icon: User, badge: '14' },
  { key: 'relationships', label: 'Relationships', icon: Share2, badge: '55' },
  { key: 'network', label: 'Network', icon: Network, badge: '31' },
  { key: 'map', label: 'Case Map', icon: Map, badge: 'Live' },
  { key: 'timeline', label: 'Timeline', icon: Clock },
  { key: 'evidence', label: 'Evidence', icon: Package, badge: '9' },
  { key: 'historical', label: 'Historical Intelligence', icon: History, badge: '3' },
  { key: 'insights', label: 'Explainable Insights', icon: Sparkles, badge: 'AI' },
];

function CaseDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const caseId = (params.id as string) || 'CASE-102';
  const initialTab = (searchParams.get('tab') as TabKey) || 'overview';

  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [loading, setLoading] = useState(true);

  // Cross-tab interaction links
  const [focusedLocationName, setFocusedLocationName] = useState<string | null>(null);
  const [selectedEntityForNetwork, setSelectedEntityForNetwork] = useState<string | null>(null);
  const [relationshipFilter, setRelationshipFilter] = useState<string>('all');
  const [relationshipSearch, setRelationshipSearch] = useState<string>('');

  useEffect(() => {
    async function loadCase() {
      setLoading(true);
      try {
        let found: BackendCase | null = null;
        try {
          found = await casesApi.getCaseById(caseId);
        } catch {
          const res = await casesApi.listCases({ size: 100 });
          found = res.items.find((c) => c.case_number === caseId || c.id === caseId) || null;
        }

        if (found) {
          const mapped: Case = {
            id: found.case_number || found.id,
            title: found.title,
            crime: (found.crime_category as any) || 'General Crime',
            location: 'Police Station Jurisdiction',
            city: 'Mumbai',
            status: (found.status === 'OPEN' ? 'Active' : found.status === 'UNDER_INVESTIGATION' ? 'Under Investigation' : 'Active') as any,
            priority: (found.priority === 'CRITICAL' ? 'Critical' : found.priority === 'HIGH' ? 'High' : 'Medium') as any,
            assignedOfficer: found.lead_investigator_id ? 'Assigned Lead Officer' : 'Officer In-Charge',
            created: found.created_at ? found.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
            lastActivity: 'Active',
            description: found.description,
            firId: found.fir_id || '',
            personIds: [],
            vehicleIds: [],
            phoneIds: [],
            locationIds: [],
            organizationIds: [],
            evidenceIds: [],
            alertIds: [],
          };
          setCurrentCase(mapped);
        } else {
          const c = await mockCaseService.getCase(caseId);
          if (c) {
            setCurrentCase(c);
          } else {
            const fallback = await mockCaseService.getCase('CASE-102');
            setCurrentCase(fallback || null);
          }
        }
      } catch (err) {
        console.warn('Backend case load fallback:', err);
        const fallback = await mockCaseService.getCase('CASE-102');
        setCurrentCase(fallback || null);
      } finally {
        setLoading(false);
      }
    }
    loadCase();
  }, [caseId]);

  if (loading || !currentCase) {
    return (
      <div className="py-24 text-center text-[var(--ink-tertiary)] animate-pulse">
        <FolderOpen size={36} className="mx-auto mb-3 text-[var(--accent)]" />
        <p className="text-[14px]">Loading investigation workspace for {caseId}...</p>
      </div>
    );
  }

  // Cross-tab triggers
  const handleViewOnMap = (locationName: string) => {
    setFocusedLocationName(locationName);
    setActiveTab('map');
    toast.info(`Switched to Case Map focusing on ${locationName}`);
  };

  const handleViewInNetwork = (entityId: string) => {
    setSelectedEntityForNetwork(entityId);
    setActiveTab('network');
    toast.info(`Switched to Case Network focusing on entity ${entityId}`);
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-[1680px] mx-auto">
      {/* Breadcrumb back navigation */}
      <div className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--ink-tertiary)' }}>
        <button
          onClick={() => router.push('/cases')}
          className="flex items-center gap-1.5 hover:text-[var(--ink-primary)] transition-colors font-medium"
        >
          <ArrowLeft size={14} />
          <span>Case Database</span>
        </button>
        <span>/</span>
        <span className="font-mono-id font-bold text-[var(--accent)]">{currentCase.id}</span>
        <span>/</span>
        <span className="capitalize" style={{ color: 'var(--ink-secondary)' }}>{activeTab}</span>
      </div>

      {/* Case Intelligence Workspace Header Banner (Section 4) */}
      <div
        className="p-6 rounded-2xl border glass-panel-elevated"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Left: Case ID, Title, Status & Metadata */}
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <span className="text-[13px] font-mono-id font-bold px-2.5 py-1 rounded-lg shadow-sm"
                style={{ background: 'var(--accent)', color: '#FFFFFF' }}>
                {currentCase.id}
              </span>
              <span
                className="text-[11px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wide"
                style={{
                  background: currentCase.priority === 'Critical' ? 'var(--error-muted)' : 'var(--warning-muted)',
                  color: currentCase.priority === 'Critical' ? '#DC2626' : '#B45309',
                }}
              >
                {currentCase.priority} Priority
              </span>
              <span className="badge badge-active">{currentCase.status}</span>
              <span className="text-[12px] px-2.5 py-0.5 rounded-md font-medium border"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}>
                {currentCase.crime}
              </span>
            </div>

            <h1 className="text-[26px] font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
              {currentCase.title}
            </h1>
            <p className="text-[13.5px] mt-1 max-w-4xl leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
              {currentCase.description}
            </p>
          </div>

          {/* Right: Assigned Investigator, Location, Last Activity & Actions */}
          <div className="flex flex-col lg:items-end gap-3 shrink-0 lg:border-l lg:pl-6" style={{ borderColor: 'var(--border)' }}>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 text-[12.5px] text-right">
              <div>
                <span style={{ color: 'var(--ink-tertiary)' }}>Assigned: </span>
                <span className="font-semibold" style={{ color: 'var(--ink-primary)' }}>{currentCase.assignedOfficer}</span>
              </div>
              <div>
                <span style={{ color: 'var(--ink-tertiary)' }}>Location: </span>
                <span className="font-medium" style={{ color: 'var(--ink-primary)' }}>{currentCase.location}</span>
              </div>
              <div>
                <span style={{ color: 'var(--ink-tertiary)' }}>Last Activity: </span>
                <span className="font-mono-id font-bold text-[var(--accent)]">{currentCase.lastActivity}</span>
              </div>
            </div>

            {/* Quick Action Buttons (Section 4) */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => router.push(`/intelligence/samanvaya?case=${currentCase.id}`)}
                className="px-4 py-2 rounded-xl text-[12.5px] font-bold text-white flex items-center gap-1.5 shadow-md hover:opacity-90 transition-all cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)' }}
              >
                <BrainCircuit size={14} />
                <span>Launch SAMANVAYA Intelligence</span>
              </button>
              <button
                onClick={() => { router.push('/fir'); toast.info('Navigating to FIR Processing console'); }}
                className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold border hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
              >
                Process Data
              </button>
              <button
                onClick={() => { setActiveTab('network'); toast.success('Case network refreshed.'); }}
                className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold border hover:bg-[var(--surface-2)] transition-colors flex items-center gap-1 cursor-pointer"
                style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
              >
                <RefreshCw size={12} />
                <span>Case Network</span>
              </button>
            </div>
          </div>
        </div>

        {/* 8 Workspace Tabs (Section 4) */}
        <div className="flex flex-wrap items-center gap-1.5 mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          {workspaceTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                  isActive
                    ? 'shadow-sm text-white'
                    : 'hover:bg-[var(--glass-2)] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
                }`}
                style={{
                  background: isActive ? 'var(--accent)' : 'transparent',
                }}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10.5px] px-1.5 py-0.5 rounded-md font-mono-id font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[var(--surface-2)] text-[var(--ink-tertiary)]'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAB 1: OVERVIEW (Section 5) ─────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Top row: Case Summary & Case Data Status Pipeline */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Case Summary (7 cols) */}
            <div className="lg:col-span-7 p-6 rounded-2xl border space-y-4 glass-panel"
              style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-[16px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                  Case Dossier Summary
                </h3>
                <span className="font-mono-id text-[12px]" style={{ color: 'var(--accent)' }}>
                  FIR: FIR-2026-0102
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-[13px]">
                <div className="p-3 rounded-xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-[11px] block" style={{ color: 'var(--ink-tertiary)' }}>FIR Type</span>
                  <span className="font-bold" style={{ color: 'var(--ink-primary)' }}>Cognizable Offence</span>
                </div>
                <div className="p-3 rounded-xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-[11px] block" style={{ color: 'var(--ink-tertiary)' }}>Crime Category</span>
                  <span className="font-bold" style={{ color: 'var(--ink-primary)' }}>{currentCase.crime}</span>
                </div>
                <div className="p-3 rounded-xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-[11px] block" style={{ color: 'var(--ink-tertiary)' }}>Investigation Status</span>
                  <span className="font-bold text-[var(--success)]">{currentCase.status}</span>
                </div>
                <div className="p-3 rounded-xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-[11px] block" style={{ color: 'var(--ink-tertiary)' }}>Priority Level</span>
                  <span className="font-bold text-[#DC2626]">{currentCase.priority}</span>
                </div>
                <div className="p-3 rounded-xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-[11px] block" style={{ color: 'var(--ink-tertiary)' }}>Jurisdiction Base</span>
                  <span className="font-bold" style={{ color: 'var(--ink-primary)' }}>{currentCase.city}</span>
                </div>
                <div className="p-3 rounded-xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-[11px] block" style={{ color: 'var(--ink-tertiary)' }}>Date Ingested</span>
                  <span className="font-mono-id font-bold" style={{ color: 'var(--ink-primary)' }}>{currentCase.created}</span>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--ink-tertiary)' }}>
                  Investigation Brief
                </span>
                <p className="text-[13px] leading-relaxed p-3.5 rounded-xl border"
                  style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}>
                  {currentCase.description}
                </p>
              </div>
            </div>

            {/* Case Data Status Pipeline (5 cols) */}
            <div className="lg:col-span-5 p-6 rounded-2xl border space-y-4 glass-panel"
              style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-[16px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                  Case Data Status Pipeline
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-[var(--success-muted)] text-[var(--success)]">
                  100% Ingested
                </span>
              </div>

              <div className="space-y-2.5">
                {[
                  { step: 'FIR Processed', detail: 'Digital intake validated from FIR-2026-0102', done: true },
                  { step: 'OCR Completed', detail: 'High-res document text & vector parsing 100%', done: true },
                  { step: 'Entities Extracted', detail: '14 people, 22 phones, 6 vehicles, 18 locations', done: true },
                  { step: 'Related Records Correlated', detail: 'Multi-source cross-indexing completed', done: true },
                  { step: 'Relationships Identified', detail: '55 high-confidence connection edges mapped', done: true },
                  { step: 'Case Network Generated', detail: 'Force-directed graph active and ready', done: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl border"
                    style={{ background: 'var(--surface-0)', borderColor: 'var(--border)' }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 mt-0.5"
                      style={{ background: 'var(--success)' }}>
                      <Check size={12} strokeWidth={3} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold leading-tight" style={{ color: 'var(--ink-primary)' }}>
                        ✓ {item.step}
                      </div>
                      <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--ink-secondary)' }}>
                        {item.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Middle Row: Entity Summary Cards */}
          <div>
            <h3 className="text-[15px] font-bold mb-3" style={{ color: 'var(--ink-primary)' }}>
              Extracted Case Entity Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {[
                { label: 'People', count: 14, icon: User, color: '#4F46E5', sub: 'Karan Verma, Rahul Thakur' },
                { label: 'Phone Numbers', count: 22, icon: PhoneIcon, color: '#0EA5E9', sub: '5 target CDR logs' },
                { label: 'Vehicles', count: 6, icon: Car, color: '#10B981', sub: 'MH-01-AB-1234' },
                { label: 'Locations', count: 18, icon: MapPin, color: '#F59E0B', sub: 'Andheri West, Bandra' },
                { label: 'Financial Records', count: 12, icon: FileCode, color: '#14B8A6', sub: 'Shell company accounts' },
                { label: 'Evidence Items', count: 9, icon: Package, color: '#EC4899', sub: 'Toll CCTV, ROC records' },
              ].map((ent, i) => {
                const Icon = ent.icon;
                return (
                  <div key={i} className="p-4 rounded-2xl border glass-panel space-y-2"
                    style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                        style={{ background: ent.color }}>
                        <Icon size={16} />
                      </div>
                      <span className="text-[22px] font-bold font-mono-id" style={{ color: ent.color }}>
                        {ent.count}
                      </span>
                    </div>
                    <div>
                      <div className="text-[13px] font-bold" style={{ color: 'var(--ink-primary)' }}>{ent.label}</div>
                      <div className="text-[11px] truncate" style={{ color: 'var(--ink-tertiary)' }}>{ent.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Row: Network Summary & Big CTA */}
          <div className="p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-5 glass-panel-elevated"
            style={{ borderColor: 'var(--accent)', background: 'linear-gradient(135deg, rgba(79,70,229,0.06), rgba(79,70,229,0.01))' }}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Network size={18} style={{ color: 'var(--accent)' }} />
                <h3 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                  Case Network Intelligence Matrix
                </h3>
              </div>
              <p className="text-[13px] text-[var(--ink-secondary)] max-w-2xl leading-relaxed">
                Autonomous entity resolution and relationship discovery has synthesized <strong>31 nodes</strong>, <strong>55 relationships</strong>, <strong>6 key entities</strong>, and <strong>4 distinct fraud communities</strong>.
              </p>
            </div>

            <button
              onClick={() => setActiveTab('network')}
              className="px-6 py-3 rounded-xl text-[14px] font-bold text-white shadow-lg flex items-center gap-2 hover:opacity-95 transition-all shrink-0"
              style={{ background: 'var(--accent)' }}
            >
              <span>OPEN CASE NETWORK</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 2: FIR & LEGAL DOCUMENTS (Part 5 & Part 10) ────────── */}
      {activeTab === 'fir' && (
        <div className="space-y-6 animate-fade-in">
          <div className="p-6 rounded-2xl border glass-panel space-y-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-mono-id uppercase px-2.5 py-0.5 rounded font-bold bg-[var(--accent-muted)] text-[var(--accent)]">
                    ORIGINAL POLICE DOSSIER
                  </span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs font-mono-id text-gray-400">CR.P.C. SEC 154</span>
                </div>
                <h3 className="text-xl font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
                  First Information Report ({currentCase.firId || 'FIR-2026-0102'})
                </h3>
                <p className="text-[13px] text-[var(--ink-secondary)]">
                  Primary complaint document registered at Juhu Police Station establishing the factual scope of investigation
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/fir')}
                  className="px-4 py-2 rounded-xl text-[12.5px] font-semibold text-white shadow-sm flex items-center gap-1.5 hover:opacity-90 transition-all cursor-pointer"
                  style={{ background: 'var(--accent)' }}
                >
                  <FileText size={14} />
                  <span>Open in FIR Intake Console</span>
                </button>
              </div>
            </div>

            {/* Legal Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12.5px]">
              <div className="p-3 rounded-xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[11px] block text-[var(--ink-tertiary)]">Police Station</span>
                <strong className="font-semibold" style={{ color: 'var(--ink-primary)' }}>Juhu Police Station</strong>
              </div>
              <div className="p-3 rounded-xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[11px] block text-[var(--ink-tertiary)]">Date Registered</span>
                <strong className="font-mono-id font-semibold" style={{ color: 'var(--ink-primary)' }}>15-08-2026</strong>
              </div>
              <div className="p-3 rounded-xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[11px] block text-[var(--ink-tertiary)]">Jurisdiction</span>
                <strong className="font-semibold" style={{ color: 'var(--ink-primary)' }}>Mumbai Suburban</strong>
              </div>
              <div className="p-3 rounded-xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[11px] block text-[var(--ink-tertiary)]">Acts &amp; Sections</span>
                <strong className="font-mono-id font-semibold text-amber-500">IPC 420, 467, 468, 471 r/w 120(B)</strong>
              </div>
            </div>

            {/* Complainant & Accused Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-2" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)] block">
                  1. Complainant Information
                </span>
                <div className="text-[13px] space-y-1" style={{ color: 'var(--ink-primary)' }}>
                  <div>Name: <strong>Shri Manoj Tiwari</strong> (S/o Shri Ramesh Tiwari)</div>
                  <div>Address: <span className="text-[var(--ink-secondary)]">52 Hazratganj, New Delhi — 110001</span></div>
                  <div>Occupation: <span className="text-[var(--ink-secondary)]">Commercial Property Dealer</span></div>
                  <div>Contact: <span className="font-mono-id text-[var(--ink-secondary)]">+91 98110 02330</span></div>
                </div>
              </div>

              <div className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-2" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500 block">
                  2. Primary Investigation Subjects Named
                </span>
                <div className="text-[13px] space-y-1" style={{ color: 'var(--ink-primary)' }}>
                  <div>Subject 1: <strong>Karan Verma</strong> (Managing Director, M/s Nexus Trading Corp)</div>
                  <div>Subject 2: <strong>Rahul Thakur</strong> (Director, GlobalProp Realty Pvt Ltd)</div>
                  <div>Subject 3: <strong>Nisha Kapoor</strong> (Promoter, Horizon Digital Solutions)</div>
                  <div>Corporate Entity: <strong>M/s Nexus Trading Corp</strong> (22 Juhu Tara Road)</div>
                </div>
              </div>
            </div>

            {/* Full Legal Text OCR Transcript */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
                  Certified OCR Transcription (Raw Legal Text):
                </span>
                <span className="text-[11px] font-mono-id text-emerald-500 font-semibold">
                  ✓ Verified OCR Hash: sha256:8f4c29a071
                </span>
              </div>
              <div
                className="p-5 rounded-2xl border font-mono text-[12px] leading-relaxed max-h-[380px] overflow-y-auto"
                style={{
                  background: 'var(--surface-0)',
                  borderColor: 'var(--border)',
                  color: 'var(--ink-primary)',
                }}
              >
                <p className="font-bold text-[13px] text-indigo-400 mb-2">
                  FIRST INFORMATION REPORT (Under Section 154 Cr.P.C.) — Juhu Police Station
                </p>
                <p className="text-gray-400 mb-2">
                  District: Mumbai Suburban | Year: 2026 | FIR No.: 0102/2026 | Date: 15-08-2026
                  <br />
                  Acts &amp; Sections: IPC 420, 467, 468, 471 r/w 120(B) | Prevention of Money Laundering Act, 2002 — Sec 3, 4
                </p>
                <div className="space-y-2 text-gray-300">
                  <p>
                    <strong>BRIEF FACTS OF OFFENCE:</strong>
                    <br />
                    The complainant states that he entered into a property purchase agreement with M/s Nexus Trading Corp (Registered Office: 22 Juhu Tara Road, Juhu, Mumbai) represented by one Shri Aarav Mehta and Shri Karan Verma (Managing Director) for purchase of commercial property at Versova Business Centre, Mumbai for a consideration of Rs. 4,70,00,000/- (Rupees Four Crore Seventy Lakhs).
                  </p>
                  <p>
                    The complainant paid an advance of Rs. 95,00,000/- (Rupees Ninety Five Lakhs) by account transfer to M/s Nexus Trading Corp. Upon investigation by the complainant, it was discovered that:
                  </p>
                  <p className="pl-4">
                    (a) The property at Versova was previously sold to another entity, M/s Horizon Digital Solutions, allegedly controlled by one Smt. Nisha Kapoor.
                    <br />
                    (b) M/s Nexus Trading Corp appears to be a shell company with minimal legitimate business operations. Company registration records show Shri Aarav Mehta and Shri Vikram Sharma as co-directors.
                    <br />
                    (c) The complainant&apos;s advance amount was transferred through multiple entities including M/s AM Consultancy Services, M/s Apex Financial Services (Pune), and M/s GlobalProp Realty Pvt Ltd (Pune).
                    <br />
                    (d) Transport of documents and cash was facilitated through vehicles registered under the name of one Shri Ravi Thakur of Pune, associated with M/s GlobalProp Realty.
                    <br />
                    (e) Suspicious cash deposits were observed in accounts linked to Shri Vikram Sharma and M/s Westline Logistics Ltd.
                  </p>
                  <p>
                    <strong>VEHICLES OBSERVED:</strong> Mercedes-Benz E-Class (MH-01-AB-1234), Toyota Innova (MH-02-CD-4567), Tata LPT (MH-12-RT-2000).
                  </p>
                  <p>
                    <strong>COMMUNICATION REFERENCES:</strong> +91 98765 XXXXX, +91 98201 01421, +91 98201 02128.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="text-[12px] text-[var(--ink-secondary)]">
                Processed via <strong>Deep Neural OCR Pipeline</strong> • 14 People, 6 Vehicles, 18 Locations Extracted
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('entities')}
                  className="px-3.5 py-2 rounded-xl text-[12px] font-semibold border hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
                >
                  View Extracted Entities (14)
                </button>
                <button
                  onClick={() => setActiveTab('relationships')}
                  className="px-3.5 py-2 rounded-xl text-[12px] font-bold text-white transition-all hover:opacity-90 cursor-pointer"
                  style={{ background: 'var(--accent)' }}
                >
                  View Discovered Relationships →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: NETWORK (Section 13-17) ───────────────────────── */}
      {activeTab === 'network' && (
        <div className="space-y-3 animate-fade-in">
          {/* Header Banner for Case Network */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border glass-panel text-[13px]"
            style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--success)]" />
              <strong style={{ color: 'var(--ink-primary)' }}>{currentCase.id} ECOSYSTEM</strong>
              <span style={{ color: 'var(--ink-tertiary)' }}>•</span>
              <span style={{ color: 'var(--ink-secondary)' }}>31 nodes</span>
              <span style={{ color: 'var(--ink-tertiary)' }}>•</span>
              <span style={{ color: 'var(--ink-secondary)' }}>55 edges</span>
              <span style={{ color: 'var(--ink-tertiary)' }}>•</span>
              <span className="text-[var(--accent)] font-semibold">{currentCase.title}</span>
            </div>
            <div className="text-[12px]" style={{ color: 'var(--ink-tertiary)' }}>
              Click any node to open the Entity Details Inspector • Double-click node to center
            </div>
          </div>

          {/* Interactive Cytoscape Graph */}
          <CaseNetworkGraph
            caseId={currentCase.id}
            onViewOnMap={handleViewOnMap}
            initialSelectedEntityId={selectedEntityForNetwork}
          />
        </div>
      )}

      {/* ── TAB 3: MAP (Section 18) ─────────────────────────────── */}
      {activeTab === 'map' && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border glass-panel text-[13px]"
            style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <MapPin size={16} style={{ color: 'var(--accent)' }} />
              <strong style={{ color: 'var(--ink-primary)' }}>CASE MAP INTELLIGENCE</strong>
              <span style={{ color: 'var(--ink-tertiary)' }}>•</span>
              <span style={{ color: 'var(--ink-secondary)' }}>Analyzes {currentCase.id} specific geographic vectors</span>
            </div>
            <div className="text-[12px]" style={{ color: 'var(--ink-tertiary)' }}>
              Incident locations • Entity bases • Evidence Toll Cameras • Click marker to view in Network
            </div>
          </div>

          {/* Leaflet Real Map */}
          <CaseLeafletMap
            caseId={currentCase.id}
            onViewInNetwork={handleViewInNetwork}
            focusedLocationName={focusedLocationName}
          />
        </div>
      )}

      {/* ── TAB 4: TIMELINE (Section 19) ────────────────────────── */}
      {activeTab === 'timeline' && (
        <div className="p-6 rounded-2xl border glass-panel space-y-6 animate-fade-in"
          style={{ borderColor: 'var(--border)' }}>
          <div className="border-b pb-4">
            <h3 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>
              Chronological Case Event Sequence
            </h3>
            <p className="text-[13px] text-[var(--ink-secondary)]">
              Chronological synthesis of FIR filing, evidence ingestion, entity detection, and network generation
            </p>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border)]">
            {[
              {
                date: 'SEP 01, 2026',
                time: '10:20 AM',
                title: 'FIR Filed (FIR-2026-0102)',
                category: 'FIR',
                entity: 'Manoj Tiwari (Complainant)',
                desc: 'FIR registered at Andheri West Police Station alleging fraudulent diversion of property acquisition capital through shell company Nexus Trading Corp.',
                loc: 'Andheri West Police Station',
              },
              {
                date: 'SEP 02, 2026',
                time: '09:40 AM',
                title: 'Offline Evidence Added & Digitized',
                category: 'Evidence',
                entity: 'ROC Filings & Bank Slips',
                desc: 'Hardcopy corporate registration filings and bank statements uploaded via high-resolution scanner for OCR vector ingestion.',
                loc: 'Nexus Office, Juhu',
              },
              {
                date: 'SEP 02, 2026',
                time: '11:20 AM',
                title: 'Primary Entity Identified: Karan Verma',
                category: 'Entity',
                entity: 'Karan Verma (MD & Operator)',
                desc: 'OCR Named Entity Recognition extracted Karan Verma as sole signatory on foreign exchange transaction accounts.',
                loc: 'Sea Green Apts, Andheri West',
              },
              {
                date: 'SEP 03, 2026',
                time: '02:30 PM',
                title: 'Historical Record Pattern Found (CASE-087)',
                category: 'Pattern',
                entity: 'CASE-087 Westside Fraud Ring',
                desc: 'Cross-case correlation engine identified 87% pattern overlap with 2023 financial fraud case involving shared vehicle MH-01-AB-1234.',
                loc: 'Bandra West',
              },
              {
                date: 'SEP 03, 2026',
                time: '05:10 PM',
                title: 'Critical Relationship Discovered',
                category: 'Relationship',
                entity: 'Karan Verma ↔ Rahul Thakur',
                desc: 'Cell-tower CDR extraction confirmed 18 direct calls between Karan Verma and Rahul Thakur within 48 hours of asset liquidation.',
                loc: 'Bandra Bandstand Promenade',
              },
              {
                date: 'SEP 04, 2026',
                time: '10:00 AM',
                title: 'Case Network Generated & Synthesized',
                category: 'Network',
                entity: '31 Nodes, 55 Relationships',
                desc: 'Autonomous knowledge graph generated with complete centrality metrics and 4 detected fraud sub-clusters.',
                loc: 'KRITAGAS AI Engine',
              },
            ].map((evt, i) => (
              <div key={i} className="relative group">
                <div className="absolute -left-[30px] top-1 w-4 h-4 rounded-full border-2 border-white"
                  style={{ background: 'var(--accent)' }} />
                <div className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-2 hover:border-[var(--accent)] transition-all"
                  style={{ borderColor: 'var(--border)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-id text-[12px] font-bold px-2 py-0.5 rounded"
                        style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                        {evt.date} • {evt.time}
                      </span>
                      <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink-secondary)]">
                        {evt.category}
                      </span>
                    </div>
                    <span className="text-[12px] font-medium flex items-center gap-1" style={{ color: 'var(--ink-secondary)' }}>
                      <MapPin size={13} /> {evt.loc}
                    </span>
                  </div>
                  <h4 className="text-[15px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                    {evt.title}
                  </h4>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
                    {evt.desc}
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t text-[12px]" style={{ borderColor: 'var(--border)' }}>
                    <span style={{ color: 'var(--ink-tertiary)' }}>Related: <strong>{evt.entity}</strong></span>
                    <button
                      onClick={() => handleViewOnMap(evt.loc)}
                      className="text-[var(--accent)] font-semibold hover:underline flex items-center gap-1"
                    >
                      <span>View on Map</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 5: ENTITIES (Section 20) ────────────────────────── */}
      {activeTab === 'entities' && (
        <div className="p-6 rounded-2xl border glass-panel space-y-4 animate-fade-in"
          style={{ borderColor: 'var(--border)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4"
            style={{ borderColor: 'var(--border)' }}>
            <div>
              <h3 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                Extracted Case Entities Table
              </h3>
              <p className="text-[13px] text-[var(--ink-secondary)]">
                Structured tabular index of all extracted suspects, associates, assets, and organizations
              </p>
            </div>
            <span className="text-[12px] font-mono-id px-3 py-1 rounded-xl bg-[var(--surface-2)] text-[var(--ink-secondary)]">
              10 Primary Entities
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b text-left text-[11px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]"
                  style={{ borderColor: 'var(--border)' }}>
                  <th className="py-3 px-3">Entity Name</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Identifier</th>
                  <th className="py-3 px-3">Connections</th>
                  <th className="py-3 px-3">Related Cases</th>
                  <th className="py-3 px-3">Relevance</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {[
                  { name: 'Karan Verma', type: 'Person', id: 'PERSON-019', conns: 8, cases: 3, rel: 'High Relevance', status: 'Active POI', color: '#4F46E5' },
                  { name: 'Rahul Thakur', type: 'Person', id: 'PERSON-016', conns: 6, cases: 2, rel: 'High Relevance', status: 'Active Associate', color: '#4F46E5' },
                  { name: 'Nisha Kapoor', type: 'Person', id: 'PERSON-015', conns: 7, cases: 2, rel: 'High Relevance', status: 'Active POI', color: '#4F46E5' },
                  { name: 'Aarav Mehta', type: 'Person', id: 'PERSON-014', conns: 15, cases: 3, rel: 'Medium Relevance', status: 'Under Surveillance', color: '#4F46E5' },
                  { name: 'Vikram Sharma', type: 'Person', id: 'PERSON-021', conns: 12, cases: 2, rel: 'Medium Relevance', status: 'Active Associate', color: '#4F46E5' },
                  { name: 'Nexus Trading Corp', type: 'Organization', id: 'ORG-014', conns: 14, cases: 2, rel: 'Primary Shell', status: 'Frozen Assets', color: '#8B5CF6' },
                  { name: '+91 98765 XXXXX', type: 'Phone', id: 'PHONE-014', conns: 5, cases: 2, rel: 'High Relevance', status: 'Intercept Monitored', color: '#0EA5E9' },
                  { name: 'MH-01-AB-1234', type: 'Vehicle', id: 'VEHICLE-044', conns: 4, cases: 2, rel: 'High Relevance', status: 'ANPR Flagged', color: '#10B981' },
                  { name: 'Nexus Office, Juhu', type: 'Location', id: 'LOC-087', conns: 9, cases: 2, rel: 'Base Location', status: 'Under Search Warrant', color: '#F59E0B' },
                  { name: '₹25L Layered Transfer', type: 'Transaction', id: 'TXN-001', conns: 3, cases: 1, rel: 'High Relevance', status: 'Flagged STR', color: '#14B8A6' },
                ].map((ent) => (
                  <tr key={ent.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="py-3.5 px-3 font-semibold" style={{ color: 'var(--ink-primary)' }}>
                      {ent.name}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold font-mono-id"
                        style={{ background: `${ent.color}15`, color: ent.color }}>
                        {ent.type}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-mono-id text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
                      {ent.id}
                    </td>
                    <td className="py-3.5 px-3 font-mono-id font-semibold">
                      {ent.conns} nodes
                    </td>
                    <td className="py-3.5 px-3 font-mono-id text-[var(--accent)] font-semibold">
                      {ent.cases} cases
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-[12px]" style={{ color: '#DC2626' }}>
                      {ent.rel}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="badge badge-active">{ent.status}</span>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => dispatch(openInspector({ id: ent.id, type: ent.type }))}
                        className="px-3 py-1 rounded-lg text-[12px] font-semibold border hover:bg-[var(--surface-2)] transition-colors"
                        style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: RELATIONSHIPS (Part 9 & Part 10) ──────────────── */}
      {activeTab === 'relationships' && (
        <div className="p-6 rounded-2xl border glass-panel space-y-6 animate-fade-in" style={{ borderColor: 'var(--border)' }}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-mono-id uppercase px-2.5 py-0.5 rounded font-bold bg-[var(--accent-muted)] text-[var(--accent)]">
                  CROSS-ENTITY INTELLIGENCE
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs font-mono-id text-gray-400">MULTI-MODAL DISCOVERY</span>
              </div>
              <h3 className="text-xl font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
                Discovered Relationships Ledger
              </h3>
              <p className="text-[13px] text-[var(--ink-secondary)]">
                Corroborated connections between subjects, shell entities, vehicles, phones, and historical dossiers
              </p>
            </div>

            <button
              onClick={() => setActiveTab('network')}
              className="px-4 py-2 rounded-xl text-[12.5px] font-bold text-white flex items-center gap-1.5 shadow-md hover:opacity-90 transition-all cursor-pointer"
              style={{ background: 'var(--accent)' }}
            >
              <Network size={14} />
              <span>Explore on Network Graph</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter by entity, evidence, or location..."
                  value={relationshipSearch}
                  onChange={(e) => setRelationshipSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl text-[12.5px] border outline-none transition-all"
                  style={{ background: 'var(--surface-0)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11.5px] font-medium text-[var(--ink-tertiary)]">Type:</span>
              <select
                value={relationshipFilter}
                onChange={(e) => setRelationshipFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-[12.5px] font-medium border cursor-pointer outline-none"
                style={{ background: 'var(--surface-0)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
              >
                <option value="all">All Types (10 Key Connections)</option>
                <option value="OPERATES">OPERATES (Vehicles)</option>
                <option value="ASSOCIATED_WITH">ASSOCIATED_WITH (Associates)</option>
                <option value="DESIGNATED_DIRECTOR">DESIGNATED_DIRECTOR (Corporate)</option>
                <option value="TRANSFERRED_TO">TRANSFERRED_TO (Financial)</option>
                <option value="SUBSCRIBES_TO">SUBSCRIBES_TO (Telephony)</option>
                <option value="LINKED_TO">LINKED_TO (Historical)</option>
              </select>
            </div>
          </div>

          {/* Relationships Table */}
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b text-left text-[11px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-0)' }}>
                  <th className="py-3 px-4">Source Entity</th>
                  <th className="py-3 px-4">Discovered Relationship</th>
                  <th className="py-3 px-4">Target Entity</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Confidence</th>
                  <th className="py-3 px-4">Supporting Evidence / Proof</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {[
                  {
                    id: 'REL-01',
                    source: 'Karan Verma',
                    sourceId: 'PERSON-019',
                    type: 'OPERATES',
                    target: 'Vehicle MH-01-AB-1234',
                    targetId: 'VEHICLE-044',
                    confidence: 94,
                    category: 'Asset Operation',
                    evidence: 'Toll Plaza ANPR Camera Snapshots at Khalapur Km 38 (EVIDENCE-047)',
                    location: 'Khalapur Toll Plaza',
                    date: '2026-08-28',
                  },
                  {
                    id: 'REL-02',
                    source: 'Karan Verma',
                    sourceId: 'PERSON-019',
                    type: 'ASSOCIATED_WITH',
                    target: 'Rahul Thakur',
                    targetId: 'PERSON-016',
                    confidence: 87,
                    category: 'Co-Conspirator',
                    evidence: '18 Phone CDR Calls + Shared Attendance in historical case CASE-087',
                    location: 'Bandra Bandstand Promenade',
                    date: '2026-09-02',
                  },
                  {
                    id: 'REL-03',
                    source: 'Karan Verma',
                    sourceId: 'PERSON-019',
                    type: 'DESIGNATED_DIRECTOR',
                    target: 'Nexus Trading Corp',
                    targetId: 'ORG-014',
                    confidence: 98,
                    category: 'Corporate Control',
                    evidence: 'Ministry of Corporate Affairs (ROC) Incorporation Filing (EVIDENCE-045)',
                    location: '22 Juhu Tara Road, Juhu',
                    date: '2026-09-01',
                  },
                  {
                    id: 'REL-04',
                    source: 'Karan Verma',
                    sourceId: 'PERSON-019',
                    type: 'SUBSCRIBES_TO',
                    target: 'Phone +91 98765 XXXXX',
                    targetId: 'PHONE-014',
                    confidence: 98,
                    category: 'Telephony Account',
                    evidence: 'Aadhaar e-KYC Telco Verification File & SIM Registry Ledger',
                    location: 'Andheri West',
                    date: '2026-09-01',
                  },
                  {
                    id: 'REL-05',
                    source: 'Karan Verma',
                    sourceId: 'PERSON-019',
                    type: 'VISITED',
                    target: 'Central Road, Andheri West',
                    targetId: 'LOC-087',
                    confidence: 90,
                    category: 'Physical Presence',
                    evidence: 'CCTV Camera #14-B Footage at Versova Business Centre',
                    location: 'Andheri West, Mumbai',
                    date: '2026-08-15',
                  },
                  {
                    id: 'REL-06',
                    source: 'Karan Verma',
                    sourceId: 'PERSON-019',
                    type: 'LINKED_TO',
                    target: 'Historical Case CASE-041',
                    targetId: 'CASE-041',
                    confidence: 82,
                    category: 'Historical Pattern',
                    evidence: 'Overlapping Chartered Accountant Divya Saxena & Escrow diversion methodology',
                    location: 'Nariman Point, Mumbai',
                    date: '2024-11-10',
                  },
                  {
                    id: 'REL-07',
                    source: 'Transaction ₹25L (TXN-001)',
                    sourceId: 'TXN-001',
                    type: 'TRANSFERRED_TO',
                    target: 'Nexus Trading Corp',
                    targetId: 'ORG-014',
                    confidence: 98,
                    category: 'Financial Flow',
                    evidence: 'Forensic Bank wire audit slip signed by designated director (EVIDENCE-046)',
                    location: 'Bandra Branch, Mumbai',
                    date: '2026-09-02',
                  },
                  {
                    id: 'REL-08',
                    source: 'Rahul Thakur',
                    sourceId: 'PERSON-016',
                    type: 'OPERATES',
                    target: 'Vehicle MH-02-CD-4567',
                    targetId: 'VEHICLE-020',
                    confidence: 89,
                    category: 'Asset Operation',
                    evidence: 'Traffic ANPR Camera scan co-located near IT Park corridor',
                    location: 'Koregaon Park, Pune',
                    date: '2026-09-03',
                  },
                  {
                    id: 'REL-09',
                    source: 'Nisha Kapoor',
                    sourceId: 'PERSON-015',
                    type: 'CO_SIGNATORY_WITH',
                    target: 'Karan Verma',
                    targetId: 'PERSON-019',
                    confidence: 84,
                    category: 'Contractual Tie',
                    evidence: 'Real estate sale agreement counter-signature (Versova Property)',
                    location: 'Andheri West',
                    date: '2026-08-12',
                  },
                  {
                    id: 'REL-10',
                    source: 'Nexus Trading Corp',
                    sourceId: 'ORG-014',
                    type: 'MAINTAINS_ACCOUNT',
                    target: 'Account 9812-4410-9281',
                    targetId: 'ACC-012',
                    confidence: 99,
                    category: 'Banking Conduit',
                    evidence: 'Certified Bank Ledger showing ₹4.70 Cr aggregate incoming remittance',
                    location: 'Juhu Tara Road',
                    date: '2026-08-15',
                  },
                ]
                  .filter((rel) => {
                    if (relationshipFilter !== 'all' && rel.type !== relationshipFilter) return false;
                    if (relationshipSearch) {
                      const q = relationshipSearch.toLowerCase();
                      return (
                        rel.source.toLowerCase().includes(q) ||
                        rel.target.toLowerCase().includes(q) ||
                        rel.evidence.toLowerCase().includes(q) ||
                        rel.type.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map((rel) => (
                    <tr key={rel.id} className="hover:bg-[var(--surface-0)] transition-colors">
                      <td className="py-3.5 px-4 font-bold" style={{ color: 'var(--ink-primary)' }}>
                        {rel.source}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono-id text-[11px] font-bold px-2 py-1 rounded bg-[var(--surface-2)] text-[var(--accent)] border border-[var(--border)]">
                          → {rel.type} →
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold" style={{ color: 'var(--ink-primary)' }}>
                        {rel.target}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[11.5px] px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--ink-secondary)]">
                          {rel.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono-id font-bold text-emerald-500">
                          {rel.confidence}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs text-[12px] text-[var(--ink-secondary)] truncate" title={rel.evidence}>
                        {rel.evidence}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleViewInNetwork(rel.sourceId)}
                            className="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                            style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
                            title="Highlight in Network Graph"
                          >
                            Graph
                          </button>
                          <button
                            onClick={() => handleViewOnMap(rel.location)}
                            className="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                            style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
                            title="View Location on Map"
                          >
                            Map
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 8: EVIDENCE (Section 21) ────────────────────────── */}
      {activeTab === 'evidence' && (
        <div className="p-6 rounded-2xl border glass-panel space-y-5 animate-fade-in"
          style={{ borderColor: 'var(--border)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4"
            style={{ borderColor: 'var(--border)' }}>
            <div>
              <h3 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                Case Evidence Dossier
              </h3>
              <p className="text-[13px] text-[var(--ink-secondary)]">
                Digital forensic records, document scans, and cryptographic hash verification for {currentCase.id}
              </p>
            </div>
            <button
              onClick={() => router.push('/evidence')}
              className="px-4 py-2 rounded-xl text-[12.5px] font-semibold border flex items-center gap-1.5 hover:bg-[var(--surface-2)] transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
            >
              <ExternalLink size={13} />
              <span>Open Global Evidence Hub</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                id: 'EVIDENCE-044',
                title: 'Original FIR Physical Scan',
                category: 'Legal Document',
                date: '2026-09-01',
                status: 'Verified',
                hash: 'sha256:8f4c...3e1a',
                desc: 'Digitalized scanned copy of First Information Report registered at Andheri West.',
              },
              {
                id: 'EVIDENCE-045',
                title: 'Nexus Trading Corp ROC Articles',
                category: 'Corporate Registry',
                date: '2026-09-02',
                status: 'Verified',
                hash: 'sha256:1a7d...9c2b',
                desc: 'Certified company registration filings confirming Karan Verma as designated director.',
              },
              {
                id: 'EVIDENCE-047',
                title: 'Toll Plaza ANPR Camera Snapshots',
                category: 'CCTV / Surveillance',
                date: '2026-09-02',
                status: 'Verified',
                hash: 'sha256:6e2f...0d4c',
                desc: 'Vehicle license plate scan capturing MH-01-AB-1234 at Khalapur Toll Plaza at 14:43.',
              },
              {
                id: 'EVIDENCE-046',
                title: 'Forensic Bank Transfer Slips',
                category: 'Financial Record',
                date: '2026-09-03',
                status: 'Verified',
                hash: 'sha256:4b9a...117f',
                desc: 'Wire transfer transaction slips totaling ₹1.26 Crore across three intermediary accounts.',
              },
              {
                id: 'EVIDENCE-048',
                title: 'Cellular CDR Extraction File',
                category: 'Digital Telephony',
                date: '2026-09-03',
                status: 'Verified',
                hash: 'sha256:3d5c...881e',
                desc: 'Extracted call detail records covering subscriber +91 98765 XXXXX (Karan Verma).',
              },
              {
                id: 'EVIDENCE-054',
                title: 'Aadhaar Card Copy Verification',
                category: 'Identity Proof',
                date: '2026-09-03',
                status: 'Contradiction Flagged',
                hash: 'sha256:9f2c...7b4a',
                desc: 'Date of birth discrepancy detected between official Aadhaar and company registration papers.',
              },
            ].map((ev) => (
              <div key={ev.id} className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-2.5"
                style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-mono-id text-[11px] font-bold text-[var(--accent)]">{ev.id}</span>
                  <span className={`badge ${ev.status === 'Verified' ? 'badge-active' : 'badge-critical'}`}>
                    {ev.status}
                  </span>
                </div>
                <h4 className="font-bold text-[14px]" style={{ color: 'var(--ink-primary)' }}>{ev.title}</h4>
                <p className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>{ev.desc}</p>
                <div className="pt-2 border-t flex items-center justify-between text-[11px] font-mono-id"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-tertiary)' }}>
                  <span>{ev.date}</span>
                  <span>{ev.hash}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 9: HISTORICAL INTELLIGENCE (Section 21) ────────── */}
      {(activeTab === 'historical' || activeTab === 'related') && (
        <div className="p-6 rounded-2xl border glass-panel space-y-5 animate-fade-in"
          style={{ borderColor: 'var(--border)' }}>
          <div className="border-b pb-4">
            <h3 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>
              Historical Intelligence &amp; Correlated Cases
            </h3>
            <p className="text-[13px] text-[var(--ink-secondary)]">
              Automated pattern matching against historical crime database based on shared entities, locations, and modus operandi
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                id: 'CASE-087',
                title: 'Westside Financial Fraud Ring',
                similarity: 87,
                year: '2023–2024',
                crime: 'Fraud',
                location: 'Bandra, Mumbai',
                officer: 'ACP V. Patil',
                reasons: [
                  'Shared Key Entity: Karan Verma recorded as director on linked shell entity',
                  'Shared Asset: Vehicle MH-01-AB-1234 identified at multiple meetings',
                  'Identical Modus Operandi: Property undervaluation and rapid escrow cash transfers',
                ],
              },
              {
                id: 'CASE-041',
                title: 'Offshore Shell Entity Network',
                similarity: 74,
                year: '2024–2025',
                crime: 'Money Laundering',
                location: 'Nariman Point, Mumbai',
                officer: 'DI P. Reddy',
                reasons: [
                  'Shared Phone Reference: Subscriber +91 98765 XXXXX used across both transactions',
                  'Cross-Company Director Overlap with Nexus Trading Corp',
                  'Common Chartered Accountant: Divya Saxena',
                ],
              },
              {
                id: 'CASE-004',
                title: 'Delhi Construction Land Fraud',
                similarity: 68,
                year: '2026',
                crime: 'Fraud',
                location: 'Dwarka, Delhi',
                officer: 'DI P. Reddy',
                reasons: [
                  'Common Subsidiary Entity registered in Delhi NCR',
                  'Interstate hawala vehicle movement on Mumbai-Delhi corridor',
                ],
              },
            ].map((rel) => (
              <div key={rel.id} className="p-5 rounded-2xl border bg-[var(--surface-0)] space-y-3"
                style={{ borderColor: 'var(--border)' }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3"
                  style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-id font-bold text-[14px]" style={{ color: 'var(--accent)' }}>
                        {rel.id}
                      </span>
                      <span className="text-[11.5px] px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink-secondary)]">
                        {rel.crime} • {rel.location} ({rel.year})
                      </span>
                    </div>
                    <h4 className="text-[16px] font-bold mt-1" style={{ color: 'var(--ink-primary)' }}>
                      {rel.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[11px] block" style={{ color: 'var(--ink-tertiary)' }}>Pattern Similarity</span>
                      <span className="text-[18px] font-bold font-mono-id" style={{ color: 'var(--accent)' }}>
                        {rel.similarity}% Match
                      </span>
                    </div>
                    <button
                      onClick={() => router.push(`/cases/${rel.id}`)}
                      className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold border hover:bg-[var(--surface-2)] transition-colors flex items-center gap-1"
                      style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
                    >
                      <span>Open Case</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-[12.5px]">
                  <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--ink-tertiary)' }}>
                    Correlated Pattern Evidence:
                  </span>
                  {rel.reasons.map((r, ri) => (
                    <div key={ri} className="flex items-center gap-2 text-[var(--ink-secondary)]">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 10: EXPLAINABLE INSIGHTS (Section 22) ────────────── */}
      {(activeTab === 'insights' || activeTab === 'ai') && (
        <div className="p-6 rounded-2xl border glass-panel space-y-6 animate-fade-in"
          style={{ borderColor: 'var(--border)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4"
            style={{ borderColor: 'var(--border)' }}>
            <div>
              <div className="flex items-center gap-2">
                <Sparkles size={18} style={{ color: 'var(--accent)' }} />
                <h3 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                  Explainable Investigation Insights (KAVA AI)
                </h3>
              </div>
              <p className="text-[13px] text-[var(--ink-secondary)]">
                Autonomous heuristic pattern analysis for {currentCase.id}. All insights require investigator review.
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border"
              style={{ background: 'rgba(217,119,6,0.1)', borderColor: 'rgba(217,119,6,0.3)', color: '#D97706' }}>
              <AlertTriangle size={12} />
              <span>Requires Investigator Review</span>
            </div>
          </div>

          <div className="space-y-4">
            {[
              {
                title: 'Three entities appear synchronously across multiple closed financial fraud records.',
                confidence: 94,
                category: 'Network Multi-Case Overlap',
                why: 'Karan Verma, Rahul Thakur, and corporate entity Nexus Trading Corp overlap between CASE-102 and CASE-087. Financial transfer amounts match prior layering structures.',
                evidence: [
                  'Shared phone reference (+91 98765 XXXXX) in 2023 and 2026 ROC filings',
                  'Common operational address at 22 Juhu Tara Road recorded in both cases',
                  'Frequent telephonic communication clustered immediately prior to fund liquidation',
                ],
              },
              {
                title: 'Financial funnel anomaly detected between shell accounts within 48 hours of FIR.',
                confidence: 89,
                category: 'Transaction Laundering Flow',
                why: 'Sudden outflow of ₹1.26 Crore from primary account into three disparate regional branches in Pune and Delhi, bypassing standard escrow controls.',
                evidence: [
                  'TXN-001 (₹25L), TXN-006 (₹45L), and TXN-008 (₹56L) executed without commercial invoices',
                  'Accounts managed by chartered accountant Divya Saxena',
                ],
              },
              {
                title: 'Alibi timestamp discrepancy identified via highway toll ANPR camera surveillance.',
                confidence: 91,
                category: 'Evidence Contradiction',
                why: 'Subject statement claimed continuous physical presence in Pune, but ANPR toll record logs vehicle MH-01-AB-1234 departing Mumbai at 14:43.',
                evidence: [
                  'CCTV capture at Khalapur Toll Plaza (EVIDENCE-047) timestamp 14:43 on Aug 28',
                  'Contradicts written statement lodged in preliminary inquiry',
                ],
              },
            ].map((ins, i) => (
              <div key={i} className="p-5 rounded-2xl border bg-[var(--surface-0)] space-y-3"
                style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--accent)]">
                      {ins.category}
                    </span>
                    <h4 className="text-[16px] font-bold mt-1.5" style={{ color: 'var(--ink-primary)' }}>
                      "{ins.title}"
                    </h4>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] block" style={{ color: 'var(--ink-tertiary)' }}>Confidence</span>
                    <span className="text-[16px] font-mono-id font-bold text-[var(--success)]">
                      {ins.confidence}%
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
                  <span className="text-[11px] font-bold uppercase tracking-wider block mb-1 text-[var(--accent)]">
                    WHY? (Explainable Logic)
                  </span>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-primary)' }}>
                    {ins.why}
                  </p>
                </div>

                <div className="space-y-1.5 text-[12.5px]">
                  <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--ink-tertiary)' }}>
                    Supporting Correlated Evidence:
                  </span>
                  {ins.evidence.map((evItem, evi) => (
                    <div key={evi} className="flex items-center gap-2 text-[var(--ink-secondary)]">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
                      <span>{evItem}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t flex items-center justify-between text-[11.5px] font-semibold"
                  style={{ borderColor: 'var(--border)' }}>
                  <span style={{ color: 'var(--warning)' }}>⚠ Requires Investigator Review</span>
                  <button
                    onClick={() => { setActiveTab('network'); toast.info('Highlighting correlated pattern on network graph'); }}
                    className="text-[var(--accent)] hover:underline flex items-center gap-1"
                  >
                    <span>View Pattern in Network Graph</span>
                    <ArrowRight size={12} />
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

export default function CaseDetailPage() {
  return (
    <Suspense fallback={<div className="p-12 text-[14px]" style={{ color: 'var(--ink-secondary)' }}>Loading case intelligence workspace...</div>}>
      <CaseDetailContent />
    </Suspense>
  );
}
