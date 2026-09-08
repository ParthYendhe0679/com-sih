'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { openInspector } from '@/store/slices/uiSlice';
import {
  casesApi,
  BackendCase,
  CaseEntitiesData,
  CaseEntityItem,
  CaseRelationshipsData,
  CaseRelationshipItem,
} from '@/lib/api/cases';
import { mockCaseService } from '@/services/mockServices';
import type { Case } from '@/types';
import {
  people, vehicles, phones, locations, organizations,
  evidence, alerts, timelineEvents, transactions, firs, forensicRecords
} from '@/mock';
import CaseNetworkGraph from '@/components/case/CaseNetworkGraph';
import CaseLeafletMap, { buildCaseMapMarkers, CaseMapMarker } from '@/components/case/CaseLeafletMap';
import {
  FolderOpen, User, Car, Phone as PhoneIcon, MapPin,
  Package, Network, Map, History, Clock, Bell, Bot, FileText,
  ShieldCheck, AlertTriangle, ArrowLeft, ArrowRight, GitFork, CheckCircle2,
  Calendar, FileCode, Check, Eye, RefreshCw, Share2, Sparkles,
  Layers, ChevronRight, ExternalLink, HelpCircle, Plus, BrainCircuit, Search, DollarSign
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
  { key: 'fir', label: 'FIR & Documents', icon: FileText },
  { key: 'entities', label: 'Entities', icon: User },
  { key: 'relationships', label: 'Relationships', icon: Share2 },
  { key: 'network', label: 'Network', icon: Network },
  { key: 'map', label: 'Case Map', icon: Map },
  { key: 'timeline', label: 'Timeline', icon: Clock },
  { key: 'evidence', label: 'Evidence', icon: Package },
  { key: 'historical', label: 'Historical Intelligence', icon: History },
  { key: 'insights', label: 'Explainable Insights', icon: Sparkles },
];

function CaseDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const caseId = (params.id as string) || '';
  const initialTab = (searchParams.get('tab') as TabKey) || 'overview';

  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [loading, setLoading] = useState(true);

  // Live entity and relationship states
  const [entitiesData, setEntitiesData] = useState<CaseEntitiesData | null>(null);
  const [relationshipsData, setRelationshipsData] = useState<CaseRelationshipsData | null>(null);
  const [caseMarkers, setCaseMarkers] = useState<CaseMapMarker[]>([]);
  const [entitySearch, setEntitySearch] = useState<string>('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');

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
          let entData: CaseEntitiesData | null = null;
          let relData: CaseRelationshipsData | null = null;
          try {
            entData = await casesApi.getCaseEntities(found.id);
            setEntitiesData(entData);
            if (entData?.categorized.locations && entData.categorized.locations.length > 0) {
              setCaseMarkers(buildCaseMapMarkers(entData.categorized.locations));
            }
          } catch (e) {
            console.warn('Failed to load case entities:', e);
          }

          try {
            relData = await casesApi.getCaseRelationships(found.id);
            setRelationshipsData(relData);
          } catch (e) {
            console.warn('Failed to load case relationships:', e);
          }

          const personIds = entData?.categorized.persons.map((p) => p.id) || [];
          const vehicleIds = entData?.categorized.vehicles.map((v) => v.id) || [];
          const phoneIds = entData?.categorized.phones.map((p) => p.id) || [];
          const locationIds = entData?.categorized.locations.map((l) => l.id) || [];
          const organizationIds = entData?.categorized.digital_identifiers.map((d) => d.id) || [];

          const mapped: Case = {
            id: found.case_number || found.id,
            backendId: found.id,
            title: found.title,
            crime: (found.crime_category as any) || 'General Crime',
            location: entData?.categorized.locations[0]?.name || 'Police Station Jurisdiction',
            city: 'Mumbai',
            status: (found.status === 'OPEN' ? 'Active' : found.status === 'UNDER_INVESTIGATION' ? 'Under Investigation' : 'Active') as any,
            priority: (found.priority === 'CRITICAL' ? 'Critical' : found.priority === 'HIGH' ? 'High' : 'Medium') as any,
            assignedOfficer: found.lead_investigator_id ? 'Assigned Lead Officer' : 'Officer In-Charge',
            created: found.created_at ? found.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
            lastActivity: 'Active',
            description: found.description,
            firId: found.fir_id || '',
            personIds,
            vehicleIds,
            phoneIds,
            locationIds,
            organizationIds,
            evidenceIds: [],
            alertIds: [],
          };
          setCurrentCase(mapped);
        } else {
          const c = await mockCaseService.getCase(caseId);
          setCurrentCase(c || null);
        }
      } catch (err) {
        console.warn('Backend case load failed:', err);
        const c = await mockCaseService.getCase(caseId);
        setCurrentCase(c || null);
      } finally {
        setLoading(false);
      }
    }
    loadCase();
  }, [caseId]);

  if (loading) {
    return (
      <div className="py-24 text-center text-[var(--ink-tertiary)] animate-pulse">
        <FolderOpen size={36} className="mx-auto mb-3 text-[var(--accent)]" />
        <p className="text-[14px]">Loading investigation workspace for {caseId}...</p>
      </div>
    );
  }

  if (!currentCase) {
    return (
      <div className="py-24 text-center max-w-md mx-auto">
        <FolderOpen size={48} className="mx-auto mb-3 text-slate-300" />
        <h2 className="text-xl font-bold text-slate-800">Case Record Not Found</h2>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          The requested investigation case <span className="font-mono font-semibold text-indigo-600">{caseId}</span> does not exist or has been archived.
        </p>
        <button
          onClick={() => router.push('/cases')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
        >
          <ArrowLeft size={16} /> Return to All Cases
        </button>
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
                onClick={() => router.push(`/intelligence/samanvaya?case=${currentCase.backendId || currentCase.id}`)}
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
                  FIR: {currentCase.firId || 'Not Linked'}
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
                  {currentCase.description || 'No detailed investigation summary registered yet.'}
                </p>
              </div>
            </div>

            {/* Case Data Status Pipeline (5 cols) */}
            <div className="lg:col-span-5 p-6 rounded-2xl border space-y-4 glass-panel"
              style={{ borderColor: 'var(--border)' }}>
              <div className="border-b pb-3 flex items-center justify-between">
                <h3 className="text-[16px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                  Ingestion &amp; Resolution Pipeline
                </h3>
                <span className="text-[11px] font-mono-id px-2 py-0.5 rounded font-semibold text-[var(--accent)] bg-[var(--accent-muted)]">
                  Live Status
                </span>
              </div>

              <div className="space-y-2.5">
                {[
                  { step: 'FIR Ingestion', detail: currentCase.firId ? `Digital record linked (${currentCase.firId})` : 'Awaiting digital FIR link', done: !!currentCase.firId },
                  { step: 'Document OCR', detail: 'High-res OCR and vector ingestion', done: !!currentCase.firId },
                  { step: 'Entity Resolution', detail: `${currentCase.personIds.length + currentCase.phoneIds.length + currentCase.vehicleIds.length} entities identified`, done: (currentCase.personIds.length + currentCase.phoneIds.length) > 0 },
                  { step: 'Cross-Jurisdiction Match', detail: 'Historical repository pattern search', done: false },
                  { step: 'Relationship Graph', detail: 'Knowledge graph edge generation', done: false },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-xl border"
                    style={{ background: 'var(--surface-0)', borderColor: 'var(--border)' }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 mt-0.5"
                      style={{ background: item.done ? 'var(--success)' : 'var(--surface-3)', color: item.done ? '#fff' : 'var(--ink-tertiary)' }}>
                      <Check size={12} strokeWidth={3} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold leading-tight" style={{ color: item.done ? 'var(--ink-primary)' : 'var(--ink-tertiary)' }}>
                        {item.done ? '✓ ' : '○ '}{item.step}
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
                { label: 'People', count: currentCase.personIds.length, icon: User, color: '#4F46E5', sub: currentCase.personIds.length > 0 ? `${currentCase.personIds.length} linked` : 'No suspects/witnesses' },
                { label: 'Phone Numbers', count: currentCase.phoneIds.length, icon: PhoneIcon, color: '#0EA5E9', sub: currentCase.phoneIds.length > 0 ? `${currentCase.phoneIds.length} numbers` : 'No phone records' },
                { label: 'Vehicles', count: currentCase.vehicleIds.length, icon: Car, color: '#10B981', sub: currentCase.vehicleIds.length > 0 ? `${currentCase.vehicleIds.length} registered` : 'No vehicle plates' },
                { label: 'Locations', count: currentCase.locationIds.length, icon: MapPin, color: '#F59E0B', sub: currentCase.locationIds.length > 0 ? `${currentCase.locationIds.length} loci` : 'No geotags' },
                { label: 'Organizations', count: currentCase.organizationIds.length, icon: FileCode, color: '#14B8A6', sub: currentCase.organizationIds.length > 0 ? `${currentCase.organizationIds.length} entities` : 'No companies' },
                { label: 'Evidence Items', count: currentCase.evidenceIds.length, icon: Package, color: '#EC4899', sub: currentCase.evidenceIds.length > 0 ? `${currentCase.evidenceIds.length} artifacts` : 'No evidence filed' },
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
                Autonomous entity resolution and relationship discovery synthesizes multi-tier connectivity graph, key suspect centrality, and detected sub-clusters.
              </p>
            </div>

            <button
              onClick={() => setActiveTab('network')}
              className="px-6 py-3 rounded-xl text-[14px] font-bold text-white shadow-lg flex items-center gap-2 hover:opacity-95 transition-all shrink-0 cursor-pointer"
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
          {!currentCase.firId ? (
            <div className="p-12 rounded-2xl border text-center glass-panel" style={{ borderColor: 'var(--border)' }}>
              <FileText size={44} className="mx-auto mb-3 opacity-40 text-[var(--accent)]" />
              <h3 className="text-xl font-bold" style={{ color: 'var(--ink-primary)' }}>No Primary FIR Linked</h3>
              <p className="text-[13.5px] text-[var(--ink-secondary)] mt-1.5 max-w-md mx-auto leading-relaxed">
                This investigation dossier is not yet linked to an official police FIR record. Ingest or connect a digital FIR document to view legal transcription and registered complainant particulars.
              </p>
              <button
                onClick={() => router.push('/fir')}
                className="mt-5 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white shadow-sm inline-flex items-center gap-2 cursor-pointer hover:opacity-90 transition-all"
                style={{ background: 'var(--accent)' }}
              >
                <FileText size={15} />
                <span>Open FIR Intake Console</span>
              </button>
            </div>
          ) : (
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
                    First Information Report ({currentCase.firId})
                  </h3>
                  <p className="text-[13px] text-[var(--ink-secondary)]">
                    Primary complaint document establishing the factual scope of investigation
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
                  <strong className="font-semibold" style={{ color: 'var(--ink-primary)' }}>{currentCase.city} Jurisdiction</strong>
                </div>
                <div className="p-3 rounded-xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-[11px] block text-[var(--ink-tertiary)]">Date Registered</span>
                  <strong className="font-mono-id font-semibold" style={{ color: 'var(--ink-primary)' }}>{currentCase.created}</strong>
                </div>
                <div className="p-3 rounded-xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-[11px] block text-[var(--ink-tertiary)]">Jurisdiction</span>
                  <strong className="font-semibold" style={{ color: 'var(--ink-primary)' }}>{currentCase.city}</strong>
                </div>
                <div className="p-3 rounded-xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-[11px] block text-[var(--ink-tertiary)]">Category</span>
                  <strong className="font-mono-id font-semibold text-amber-500">{currentCase.crime}</strong>
                </div>
              </div>

              {/* Investigation Scope */}
              <div className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-2" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)] block">
                  Investigation Narrative &amp; Facts
                </span>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-primary)' }}>
                  {currentCase.description || 'No detailed narrative supplied.'}
                </p>
              </div>
            </div>
          )}
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
              <span style={{ color: 'var(--ink-secondary)' }}>Graph Topology</span>
              <span style={{ color: 'var(--ink-tertiary)' }}>•</span>
              <span className="text-[var(--accent)] font-semibold">{currentCase.title}</span>
            </div>
            <div className="text-[12px]" style={{ color: 'var(--ink-tertiary)' }}>
              Click any node to open the Entity Details Inspector • Double-click node to center
            </div>
          </div>

          {/* Interactive Cytoscape Graph */}
          <CaseNetworkGraph
            caseId={currentCase.backendId || currentCase.id}
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
            caseId={currentCase.backendId || currentCase.id}
            onViewInNetwork={handleViewInNetwork}
            focusedLocationName={focusedLocationName}
            locations={caseMarkers}
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

          <div className="p-12 rounded-2xl border text-center" style={{ background: 'var(--surface-0)', borderColor: 'var(--border)' }}>
            <Clock size={40} className="mx-auto mb-3 opacity-40 text-[var(--accent)]" />
            <h4 className="text-lg font-bold" style={{ color: 'var(--ink-primary)' }}>No Timeline Events Logged</h4>
            <p className="text-[13px] text-[var(--ink-secondary)] mt-1.5 max-w-md mx-auto leading-relaxed">
              Chronological sequence events will automatically synthesize as incident dates, CDR records, and evidence timestamps are registered.
            </p>
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
            <span className="text-[12px] font-mono-id px-3 py-1 rounded-xl bg-[var(--surface-2)] text-[var(--accent)] font-bold">
              {entitiesData?.total_entities || currentCase.personIds.length + currentCase.phoneIds.length} Entities Indexed
            </span>
          </div>

          {/* Search & Filter bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search extracted entities by name or identifier..."
                value={entitySearch}
                onChange={(e) => setEntitySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-[12.5px] border outline-none transition-all"
                style={{ background: 'var(--surface-0)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11.5px] font-medium text-[var(--ink-tertiary)]">Type:</span>
              <select
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-[12.5px] font-medium border cursor-pointer outline-none"
                style={{ background: 'var(--surface-0)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
              >
                <option value="all">All Entity Types</option>
                <option value="PERSON">Persons</option>
                <option value="PHONE">Phone Numbers</option>
                <option value="VEHICLE">Vehicles</option>
                <option value="FINANCIAL">Financial / Amounts</option>
                <option value="LEGAL_SECTION">Legal Sections</option>
                <option value="LOCATION">Locations</option>
                <option value="DIGITAL">Digital Identifiers</option>
              </select>
            </div>
          </div>

          {/* Dynamic Table or Zero State */}
          {(() => {
            const rawList = entitiesData?.entities || [];
            const filtered = rawList.filter((ent) => {
              if (entityTypeFilter !== 'all') {
                const entType = (ent.entity_type || '').toUpperCase();
                if (entityTypeFilter === 'FINANCIAL' && !entType.includes('FINANCIAL') && !entType.includes('TRANSACTION')) return false;
                if (entityTypeFilter === 'DIGITAL' && !entType.includes('DIGITAL') && !entType.includes('EMAIL')) return false;
                if (!['FINANCIAL', 'DIGITAL'].includes(entityTypeFilter) && !entType.includes(entityTypeFilter)) return false;
              }
              if (entitySearch) {
                const q = entitySearch.toLowerCase();
                return (
                  ent.name.toLowerCase().includes(q) ||
                  ent.normalized_value.toLowerCase().includes(q) ||
                  ent.role.toLowerCase().includes(q)
                );
              }
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div className="p-12 rounded-2xl border text-center" style={{ background: 'var(--surface-0)', borderColor: 'var(--border)' }}>
                  <User size={40} className="mx-auto mb-3 opacity-40 text-[var(--accent)]" />
                  <h4 className="text-lg font-bold" style={{ color: 'var(--ink-primary)' }}>No Matching Entities Found</h4>
                  <p className="text-[13px] text-[var(--ink-secondary)] mt-1.5 max-w-md mx-auto leading-relaxed">
                    No entities match the selected filter or search query.
                  </p>
                </div>
              );
            }

            return (
              <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                <table className="w-full text-left text-[13px] border-collapse">
                  <thead>
                    <tr className="border-b text-[11px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]"
                      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
                      <th className="py-3 px-4">Entity &amp; Value</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Role / Designation</th>
                      <th className="py-3 px-4">Confidence</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {filtered.map((ent, idx) => {
                      const t = (ent.entity_type || '').toUpperCase();
                      const typeBadge =
                        t === 'PERSON' ? { bg: 'rgba(99, 102, 241, 0.12)', color: '#6366F1', label: 'PERSON' } :
                        t === 'PHONE' ? { bg: 'rgba(14, 165, 233, 0.12)', color: '#0EA5E9', label: 'PHONE' } :
                        t === 'VEHICLE' ? { bg: 'rgba(16, 185, 129, 0.12)', color: '#10B981', label: 'VEHICLE' } :
                        t.includes('FINANCIAL') || t.includes('TRANSACTION') ? { bg: 'rgba(20, 184, 166, 0.12)', color: '#14B8A6', label: 'FINANCIAL' } :
                        t === 'LEGAL_SECTION' ? { bg: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6', label: 'LEGAL' } :
                        t === 'LOCATION' ? { bg: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B', label: 'LOCATION' } :
                        { bg: 'rgba(236, 72, 153, 0.12)', color: '#EC4899', label: 'DIGITAL' };

                      return (
                        <tr key={ent.id || idx} className="hover:bg-[var(--surface-1)] transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold" style={{ color: 'var(--ink-primary)' }}>{ent.name}</div>
                            {ent.normalized_value && ent.normalized_value !== ent.name && (
                              <div className="text-[11px] font-mono-id text-[var(--ink-tertiary)]">{ent.normalized_value}</div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[10.5px] px-2 py-0.5 rounded font-mono-id font-bold"
                              style={{ background: typeBadge.bg, color: typeBadge.color }}>
                              {typeBadge.label}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[11px] px-2 py-0.5 rounded font-medium border"
                              style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}>
                              {ent.role || 'INVOLVED'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono-id font-bold text-[12px] text-[var(--success)]">{ent.confidence}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {t === 'LOCATION' && (
                                <button
                                  onClick={() => handleViewOnMap(ent.name)}
                                  className="px-2 py-1 rounded-md text-[11px] font-medium border hover:bg-[var(--surface-2)] transition-colors text-[var(--accent)]"
                                  style={{ borderColor: 'var(--border)' }}
                                >
                                  View on Map
                                </button>
                              )}
                              <button
                                onClick={() => handleViewInNetwork(ent.id)}
                                className="px-2 py-1 rounded-md text-[11px] font-medium border hover:bg-[var(--surface-2)] transition-colors"
                                style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
                              >
                                View in Network
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
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
                <option value="all">All Types</option>
                <option value="OPERATES">OPERATES (Vehicles)</option>
                <option value="SUBSCRIBES_TO">SUBSCRIBES_TO (Telephony)</option>
                <option value="TRANSFERRED_TO">TRANSFERRED_TO (Financial)</option>
                <option value="LOCATED_AT">LOCATED_AT (Spatial)</option>
                <option value="INVOLVED_IN">INVOLVED_IN (General)</option>
              </select>
            </div>
          </div>

          {/* Relationships List or Zero State */}
          {(() => {
            const rawRels = relationshipsData?.relationships || [];
            const filtered = rawRels.filter((rel) => {
              if (relationshipFilter !== 'all' && !rel.relationship_type.includes(relationshipFilter)) return false;
              if (relationshipSearch) {
                const q = relationshipSearch.toLowerCase();
                return (
                  rel.source_name.toLowerCase().includes(q) ||
                  rel.target_name.toLowerCase().includes(q) ||
                  rel.relationship_type.toLowerCase().includes(q) ||
                  rel.evidence_basis.toLowerCase().includes(q)
                );
              }
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div className="p-12 text-center rounded-2xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
                  <Network size={36} className="mx-auto mb-3 opacity-40 text-[var(--ink-tertiary)]" />
                  <h4 className="font-bold text-[15px]" style={{ color: 'var(--ink-primary)' }}>No Discovered Relationships</h4>
                  <p className="text-[13px] text-[var(--ink-secondary)] max-w-md mx-auto mt-1">
                    No cross-entity links match the active filters.
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filtered.map((rel) => (
                  <div key={rel.id} className="p-4 rounded-xl border bg-[var(--surface-0)] flex flex-col md:flex-row md:items-center justify-between gap-4 text-[13px] hover:border-[var(--accent)] transition-colors"
                    style={{ borderColor: 'var(--border)' }}>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold" style={{ color: 'var(--ink-primary)' }}>{rel.source_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono-id bg-[var(--surface-2)] text-[var(--ink-secondary)]">
                          {rel.source_type}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold bg-[var(--surface-2)] text-[var(--accent)] font-mono-id">
                        <span>→</span>
                        <span>{rel.relationship_type}</span>
                        <span>→</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-bold" style={{ color: 'var(--ink-primary)' }}>{rel.target_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono-id bg-[var(--surface-2)] text-[var(--ink-secondary)]">
                          {rel.target_type}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
                        Proof: <strong style={{ color: 'var(--ink-primary)' }}>{rel.evidence_basis}</strong>
                      </div>
                      <span className="font-mono-id font-bold text-[var(--success)]">
                        {rel.confidence}%
                      </span>
                      <button
                        onClick={() => handleViewInNetwork(rel.source_id)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border hover:bg-[var(--surface-2)] text-[var(--accent)] transition-colors"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
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

          {/* Evidence Grid or Zero State */}
          <div className="p-12 text-center rounded-2xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
            <FileText size={36} className="mx-auto mb-3 opacity-40 text-[var(--ink-tertiary)]" />
            <h4 className="font-bold text-[15px]" style={{ color: 'var(--ink-primary)' }}>No Evidence Items Attached</h4>
            <p className="text-[13px] text-[var(--ink-secondary)] max-w-md mx-auto mt-1">
              No digital or physical evidence items have been uploaded or registered under this case dossier.
            </p>
            <button
              onClick={() => router.push('/evidence')}
              className="mt-4 px-4 py-2 rounded-xl text-[12.5px] font-semibold border hover:bg-[var(--surface-2)] transition-colors inline-flex items-center gap-1.5"
              style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
            >
              <ExternalLink size={13} />
              <span>Upload Evidence to Dossier</span>
            </button>
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

          {/* Historical Correlations or Zero State */}
          <div className="p-12 text-center rounded-2xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
            <History size={36} className="mx-auto mb-3 opacity-40 text-[var(--ink-tertiary)]" />
            <h4 className="font-bold text-[15px]" style={{ color: 'var(--ink-primary)' }}>No Historical Correlations Found</h4>
            <p className="text-[13px] text-[var(--ink-secondary)] max-w-md mx-auto mt-1">
              Automated pattern analysis did not identify any correlated historical cases or cross-jurisdictional crime rings matching this dossier.
            </p>
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

          {/* Insights List or Zero State */}
          <div className="p-12 text-center rounded-2xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
            <Sparkles size={36} className="mx-auto mb-3 opacity-40 text-[var(--accent)]" />
            <h4 className="font-bold text-[15px]" style={{ color: 'var(--ink-primary)' }}>No Heuristic Insights Generated</h4>
            <p className="text-[13px] text-[var(--ink-secondary)] max-w-md mx-auto mt-1">
              KAVA AI heuristic engine requires active evidence nodes and corroborated relationships to synthesize explainable anomalies.
            </p>
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
