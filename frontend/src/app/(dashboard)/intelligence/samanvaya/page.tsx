'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { casesApi } from '@/lib/api/cases';
import { cases } from '@/mock/cases';
import { mockCaseService } from '@/services/mockServices';
import type { Case } from '@/types';
import CaseNetworkGraph from '@/components/case/CaseNetworkGraph';
import CaseLeafletMap from '@/components/case/CaseLeafletMap';
import {
  BrainCircuit,
  Database,
  Users,
  Share2,
  History,
  PhoneCall,
  Coins,
  Eye,
  MessageSquare,
  Sparkles,
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  Layers,
  MapPin,
  FileText,
  Filter,
  Play,
  RotateCcw,
  ExternalLink,
  Plus,
  Info,
  Check,
  Search,
  Network as NetworkIcon,
  Map as MapIcon,
  Calendar,
  Lock,
  Printer,
  Download
} from 'lucide-react';
import { toast } from 'sonner';

// ── AGENT DEFINITIONS ──────────────────────────────────────
export interface IntelligenceAgent {
  id: string;
  name: string;
  sanskritName: string;
  meaning: string;
  category: 'ingestion' | 'entity' | 'sources' | 'synthesis' | 'explainability';
  icon: React.ElementType;
  color: string;
  bg: string;
  shortDesc: string;
  status: 'Ready' | 'Analyzing' | 'Data Available' | 'Awaiting Authorized Records' | 'Awaiting Data' | 'Complete';
  inputs: string[];
  outputs: string[];
  analyzedSummary: string;
}

const initialAgents: IntelligenceAgent[] = [
  {
    id: 'sangraha',
    name: 'SOOCHNA / SANGRAHA',
    sanskritName: 'सूचना / संग्रह',
    meaning: 'Open & Evidentiary Intelligence',
    category: 'ingestion',
    icon: Database,
    color: '#3B82F6',
    bg: 'rgba(59, 130, 246, 0.1)',
    shortDesc: 'Organizes available intelligence and evidentiary documents into a unified case context.',
    status: 'Data Available',
    inputs: ['FIR Documents', 'Witness Statements', 'Officer Field Notes', 'Uploaded Seizure Memos'],
    outputs: ['Unified Case Ingestion Context', 'Indexed Document Corpus (8 items)'],
    analyzedSummary: '8 authorized case documents indexed and normalized into structured multi-vector space.',
  },
  {
    id: 'abhijnana',
    name: 'ABHIJNANA',
    sanskritName: 'अभिज्ञान',
    meaning: 'Entity Recognition & Resolution',
    category: 'entity',
    icon: Users,
    color: '#6366F1',
    bg: 'rgba(99, 102, 241, 0.1)',
    shortDesc: 'Identifies entities and resolves references across multiple records.',
    status: 'Ready',
    inputs: ['Parsed FIR Text', 'Entity Mentions', 'Alias Dictionaries'],
    outputs: ['31 Resolved Entities', 'Name Disambiguation (e.g. R. Sharma → Rahul Sharma)'],
    analyzedSummary: 'Extracted 10 persons, 6 vehicles, 5 phones, 6 organizations, and 4 locations.',
  },
  {
    id: 'sutra',
    name: 'SUTRA',
    sanskritName: 'सूत्र',
    meaning: 'Thread & Network Synthesis',
    category: 'synthesis',
    icon: Share2,
    color: '#8B5CF6',
    bg: 'rgba(139, 92, 246, 0.1)',
    shortDesc: 'Connects entities and discovers relationships across intelligence sources.',
    status: 'Ready',
    inputs: ['Resolved Entities', 'Direct Evidence', 'Financial Flow Records', 'Surveillance Sightings'],
    outputs: ['Case-Specific Network Graph', '54 Verified Relationships', 'Network Centrality Scores'],
    analyzedSummary: 'Built dynamic multi-tier graph with 31 nodes and 54 connecting edges.',
  },
  {
    id: 'smriti',
    name: 'ITIHAS / SMRITI',
    sanskritName: 'इतिहास / स्मृति',
    meaning: 'Historical Intelligence',
    category: 'synthesis',
    icon: History,
    color: '#EC4899',
    bg: 'rgba(236, 72, 153, 0.1)',
    shortDesc: 'Searches historical records for related people, cases, and recurring modus operandi.',
    status: 'Data Available',
    inputs: ['National Criminal Database', 'Past FIRs (2018-2025)', 'Modus Operandi Archives'],
    outputs: ['3 Cross-Case Entity Matches', '87% MO Match with CASE-2019-042'],
    analyzedSummary: 'Discovered PERSON-014 was previously investigated in CASE-041 (Shell Corp Network).',
  },
  {
    id: 'vak',
    name: 'SAMVAD / VAK',
    sanskritName: 'संवाद / वाक्',
    meaning: 'Communication Intelligence',
    category: 'sources',
    icon: PhoneCall,
    color: '#0EA5E9',
    bg: 'rgba(14, 165, 233, 0.1)',
    shortDesc: 'Analyzes authorized communication records, call frequency, and contact relationships.',
    status: 'Awaiting Authorized Records',
    inputs: ['Lawfully Obtained CDR Metadata', 'Warrant Registry #MUM-2026-441'],
    outputs: ['Tower Geolocation Cluster', 'Frequent Contact Sub-groups'],
    analyzedSummary: 'Awaiting formal court order endorsement for subscriber cell site integration.',
  },
  {
    id: 'artha',
    name: 'VITTA / ARTHA',
    sanskritName: 'वित्त / अर्थ',
    meaning: 'Financial Intelligence (Simulated)',
    category: 'sources',
    icon: Coins,
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.1)',
    shortDesc: 'Analyzes simulated financial flows and account patterns (Mock Investigation Dataset).',
    status: 'Data Available',
    inputs: ['Mock FIU-IND Reports', 'Simulated Bank Statements', 'Shell Ledger Files'],
    outputs: ['₹4.70 Cr Traced Fund Flow', 'Layered Transaction Sequence', '3 Shell Intermediaries'],
    analyzedSummary: 'Traced round-tripping transfer sequence across ORG-014 and offshore accounts.',
  },
  {
    id: 'drishti',
    name: 'DRISHTI',
    sanskritName: 'दृष्टि',
    meaning: 'Visual & Surveillance Intelligence',
    category: 'sources',
    icon: Eye,
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.1)',
    shortDesc: 'Processes CCTV observations, ANPR vehicle detections, and surveillance logs.',
    status: 'Data Available',
    inputs: ['Traffic ANPR Vehicle Logs', 'Station Observation Briefings', 'CCTV Field Reports'],
    outputs: ['4 Co-Location Sightings', 'Vehicle Sighting (VEHICLE-044 at BKC)'],
    analyzedSummary: 'Correlated physical observation of PERSON-014 meeting PERSON-019 in Bandra.',
  },
  {
    id: 'samvad',
    name: 'SAMVAD (SOCIAL)',
    sanskritName: 'संवाद (सामाजिक)',
    meaning: 'Open & Lawfully Obtained Intelligence',
    category: 'sources',
    icon: MessageSquare,
    color: '#14B8A6',
    bg: 'rgba(20, 184, 166, 0.1)',
    shortDesc: 'Analyzes case-relevant, lawfully obtained open registries and public records.',
    status: 'Awaiting Data',
    inputs: ['Public Corporate Registry Filings', 'ROC Director Disclosures'],
    outputs: ['Director Cross-Directorship Flags', 'Shared Commercial Addresses'],
    analyzedSummary: 'No social intelligence records attached to current case scope.',
  },
  {
    id: 'manthan',
    name: 'MANTHAN',
    sanskritName: 'मन्थन',
    meaning: 'Deep Pattern Synthesis',
    category: 'synthesis',
    icon: Sparkles,
    color: '#D946EF',
    bg: 'rgba(217, 70, 239, 0.1)',
    shortDesc: 'Synthesizes suspicious multi-hop patterns requiring investigator review.',
    status: 'Ready',
    inputs: ['Multi-Agent Correlated Graphs', 'Temporal Spans', 'Geospatial Clusters'],
    outputs: ['4 Notable Investigative Patterns', 'Syndicate Operational Modus Operandi'],
    analyzedSummary: 'Identified 3-stage laundering ring with tight 48-hour cash conversion cycles.',
  },
  {
    id: 'vyakhya',
    name: 'SAMANVAYA / VYAKHYA',
    sanskritName: 'समन्वय / व्याख्या',
    meaning: 'Case Coordination & Investigation Report',
    category: 'explainability',
    icon: FileCheck2,
    color: '#4F46E5',
    bg: 'rgba(79, 70, 229, 0.12)',
    shortDesc: 'Coordinates all specialized agent outputs into a unified, explainable investigation report.',
    status: 'Ready',
    inputs: ['All Agent Findings', 'Confidence Matrices', 'Evidence Citations'],
    outputs: ['Explainable Case Reasoning Dossier', 'Official Formatted Intelligence Report'],
    analyzedSummary: 'Full provenance tracking with direct links to underlying FIR and evidentiary logs.',
  },
];

// ── KEY INVESTIGATIVE FINDINGS ─────────────────────────────
interface KeyFinding {
  id: string;
  title: string;
  category: string;
  description: string;
  confidence: string;
  confidenceColor: string;
  evidenceSources: string[];
  agentsInvolved: string[];
  actionTarget: string;
}

const keyFindings: KeyFinding[] = [];

interface SamanvayaCase {
  id: string;
  title: string;
  crime: string;
  city: string;
  status?: string;
  description?: string;
  location?: string;
  assignedOfficer?: string;
}

function SamanvayaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Case Selection
  const requestedCaseId = searchParams.get('case') || '';
  const [selectedCaseId, setSelectedCaseId] = useState(requestedCaseId);
  const [availableCases, setAvailableCases] = useState<SamanvayaCase[]>(
    cases.map((c) => ({
      id: c.id,
      title: c.title,
      crime: c.crime,
      city: c.city,
      status: c.status,
      description: c.description,
      location: c.location,
      assignedOfficer: c.assignedOfficer,
    }))
  );
  const [activeTab, setActiveTab] = useState<'orchestration' | 'network' | 'map' | 'timeline' | 'report'>('orchestration');

  // Selected agent for inspection
  const [selectedAgentId, setSelectedAgentId] = useState<string>('sutra');
  const [agents, setAgents] = useState<IntelligenceAgent[]>(initialAgents);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStageText, setAnalysisStageText] = useState('');
  const [isAnalyzed, setIsAnalyzed] = useState(true);

  // Filter modal / records modal
  const [addRecordsOpen, setAddRecordsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    casesApi.listCases({ size: 50 }).then((res) => {
      if (active && res && res.items && res.items.length > 0) {
        const mapped: SamanvayaCase[] = res.items.map((bc) => ({
          id: bc.case_number || bc.id,
          title: bc.title,
          crime: bc.crime_category || 'Investigation',
          city: 'Mumbai Jurisdiction',
          status: bc.status || 'Active',
          description: bc.description || 'Active investigation case.',
          location: 'Maharashtra Central Command',
          assignedOfficer: 'Investigating Officer',
        }));
        setAvailableCases(mapped);
        const reqCase = searchParams.get('case');
        if (reqCase) {
          setSelectedCaseId(reqCase);
        } else if (mapped[0]) {
          setSelectedCaseId(mapped[0].id);
        }
      }
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, [searchParams]);

  // Get current case metadata
  const currentCase = useMemo(() => {
    return availableCases.find((c) => c.id === selectedCaseId) || availableCases[0];
  }, [availableCases, selectedCaseId]);

  const activeAgent = useMemo(() => {
    return agents.find((a) => a.id === selectedAgentId) || agents[2];
  }, [agents, selectedAgentId]);

  // Handle case change
  const handleCaseChange = (newCaseId: string) => {
    setSelectedCaseId(newCaseId);
    toast.info(`SAMANVAYA context switched to ${newCaseId}`);
  };

  // Run multi-agent simulation
  const handleRunAnalysis = () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysisProgress(5);
    setAnalysisStageText('Initializing SAMANVAYA Multi-Agent Orchestrator...');

    const stages = [
      { progress: 20, text: 'SANGRAHA: Normalizing FIR & evidentiary corpus...', agent: 'sangraha' },
      { progress: 40, text: 'ABHIJNANA: Resolving entity identities and alias clusters...', agent: 'abhijnana' },
      { progress: 60, text: 'SMRITI & ARTHA: Correlating historical cases and financial ledgers...', agent: 'smriti' },
      { progress: 80, text: 'SUTRA & MANTHAN: Synthesizing multi-tier case network and anomaly patterns...', agent: 'sutra' },
      { progress: 95, text: 'VYAKHYA: Compiling explainable intelligence report and citations...', agent: 'vyakhya' },
      { progress: 100, text: 'SAMANVAYA Analysis Complete. 31 entities, 54 relationships ready for review.', agent: 'vyakhya' },
    ];

    stages.forEach((stage, idx) => {
      setTimeout(() => {
        setAnalysisProgress(stage.progress);
        setAnalysisStageText(stage.text);
        setSelectedAgentId(stage.agent);

        if (stage.progress === 100) {
          setIsAnalyzing(false);
          setIsAnalyzed(true);
          toast.success('SAMANVAYA Multi-Agent Analysis Completed Successfully!');
        }
      }, (idx + 1) * 700);
    });
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-[1680px] mx-auto pb-16">
      {/* ── TOP HEADER ────────────────────────────────────────── */}
      <div className="p-6 md:p-8 rounded-3xl border glass-panel transition-all"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)' }}
            >
              <BrainCircuit size={30} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full font-bold tracking-widest bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                  MULTI-AGENT INTELLIGENCE
                </span>
                <span className="text-xs font-mono text-gray-400">•</span>
                <span className="text-xs font-mono text-gray-400">CRIMINAL CASE SPECIFIC</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
                SAMANVAYA
              </h1>
              <p className="text-[14px] mt-1 font-medium" style={{ color: 'var(--ink-secondary)' }}>
                &ldquo;Multiple intelligence agents. One connected investigation.&rdquo;
              </p>
            </div>
          </div>

          {/* Right: Case Selector Dropdown */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1">
                Target Case Context
              </label>
              <div className="relative">
                <select
                  value={selectedCaseId}
                  onChange={(e) => handleCaseChange(e.target.value)}
                  className="w-full sm:w-[280px] appearance-none pl-3.5 pr-9 py-2.5 rounded-xl border text-[13px] font-semibold transition-all cursor-pointer"
                  style={{
                    background: 'var(--surface-2)',
                    borderColor: 'var(--border)',
                    color: 'var(--ink-primary)',
                  }}
                >
                  {availableCases.length === 0 ? (
                    <option value="">No Active Investigation Cases</option>
                  ) : (
                    availableCases.map((c, idx) => (
                      <option key={`${c.id}-${idx}`} value={c.id}>
                        {c.id} — {c.crime} ({c.city})
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
            </div>

            <div className="self-end sm:self-auto">
              <button
                onClick={handleRunAnalysis}
                disabled={isAnalyzing || availableCases.length === 0}
                className="w-full sm:w-auto px-5 py-2.5 mt-4 sm:mt-4 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 transition-all shadow-md hover:opacity-90 cursor-pointer disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)' }}
              >
                {isAnalyzing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    <span>Run SAMANVAYA Analysis</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Live Simulation Progress Bar */}
        {isAnalyzing && (
          <div className="mt-6 pt-5 border-t border-white/[0.08] animate-fade-in space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-indigo-400 font-semibold">{analysisStageText}</span>
              <span className="text-gray-400 font-bold">{analysisProgress}%</span>
            </div>
            <div className="h-2 w-full rounded-full overflow-hidden bg-black/20">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── CASE CONTEXT & DATA AVAILABILITY PANELS ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Case Context Panel (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-2xl border glass-panel flex flex-col justify-between"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          {currentCase ? (
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono-id text-base font-bold text-indigo-500">{currentCase.id}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--ink-primary)' }}>{currentCase.title}</span>
                </div>
                <span className="badge badge-active text-[11px] font-semibold">{currentCase.status || 'Active'}</span>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed mb-5">
                {currentCase.description || 'Active investigation case records.'}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 px-4 rounded-xl border mb-2 text-xs font-mono"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                <div>
                  <span className="text-gray-400 block text-[10px]">CRIME TYPE</span>
                  <span className="font-semibold" style={{ color: 'var(--ink-primary)' }}>{currentCase.crime || 'General'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">PRIMARY LOCATION</span>
                  <span className="font-semibold" style={{ color: 'var(--ink-primary)' }}>{currentCase.location || currentCase.city || 'Headquarters'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">ASSIGNED OFFICER</span>
                  <span className="font-semibold" style={{ color: 'var(--ink-primary)' }}>{currentCase.assignedOfficer || 'Investigating Officer'}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">KNOWN ENTITIES</span>
                  <span className="font-semibold text-indigo-500">Live indexed</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-semibold" style={{ color: 'var(--ink-primary)' }}>No Active Case Selected</p>
              <p className="text-xs text-gray-500">Register an FIR or create an investigation case to run multi-agent analysis.</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-xs text-gray-400">
            <div className="flex items-center gap-2 text-amber-500 font-medium">
              <Lock size={12} />
              <span>Findings require investigator review. AI provides assisted intelligence.</span>
            </div>
            <button
              onClick={() => router.push(`/cases/${currentCase.id}`)}
              className="text-indigo-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              Open Full Case Dossier <ExternalLink size={12} />
            </button>
          </div>
        </div>

        {/* Case Intelligence Sources Panel (5 cols) */}
        <div className="lg:col-span-5 p-6 rounded-2xl border glass-panel flex flex-col justify-between"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--ink-primary)' }}>
                Case Intelligence Sources
              </h3>
              <span className="text-[11px] font-mono text-emerald-500 font-semibold">
                {currentCase ? 'Active Scope Attached' : '0 Sources Connected'}
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white/[0.04] text-[var(--ink-secondary)] border border-white/10">
                <span className="flex items-center gap-1.5"><Check size={13} /> FIR &amp; Case Documents</span>
                <span className="font-bold">{currentCase ? '1 attached' : '0'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white/[0.04] text-[var(--ink-secondary)] border border-white/10">
                <span className="flex items-center gap-1.5"><Check size={13} /> Criminal Network Archive</span>
                <span className="font-bold">0 entities</span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white/[0.04] text-[var(--ink-secondary)] border border-white/10">
                <span className="flex items-center gap-1.5"><Check size={13} /> Historical Match Database</span>
                <span className="font-bold">0 connections</span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white/[0.04] text-[var(--ink-secondary)] border border-white/10">
                <span className="flex items-center gap-1.5"><Check size={13} /> Authorized Financial Records</span>
                <span className="font-bold">₹0 traced</span>
              </div>
              <div className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-gray-500/10 text-gray-400 border border-gray-500/20">
                <span className="flex items-center gap-1.5"><Clock size={13} /> Lawful Communication Records</span>
                <span>Awaiting authorization</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06] mt-4">
            <button
              onClick={() => {
                setAddRecordsOpen(true);
                toast.info('Attach authorized supplementary records to current case scope');
              }}
              className="flex-1 py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-colors hover:bg-[var(--surface-2)] cursor-pointer"
              style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
            >
              + Add Authorized Records
            </button>
            <button
              onClick={() => router.push('/fir')}
              className="py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-colors hover:bg-[var(--surface-2)] cursor-pointer"
              style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
            >
              Upload Physical FIR
            </button>
          </div>
        </div>
      </div>

      {/* ── INTELLIGENCE NAVIGATION TABS ───────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-1 overflow-x-auto">
        <div className="flex items-center gap-1">
          {[
            { key: 'orchestration', label: '10 Intelligence Agents & Findings', icon: BrainCircuit },
            { key: 'network', label: 'Case Network Graph', icon: NetworkIcon, badge: '54 links' },
            { key: 'map', label: 'Case Geospatial Map', icon: MapIcon, badge: 'Live' },
            { key: 'timeline', label: 'Chronological Timeline', icon: Calendar },
            { key: 'report', label: 'Explainable Intelligence Report', icon: FileCheck2 },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-3 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  isActive
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]'
                }`}
              >
                <Icon size={15} />
                <span>{t.label}</span>
                {t.badge && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-white/10 text-gray-300">
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAB 1: AGENT ORCHESTRATION & FINDINGS ─────────────── */}
      {activeTab === 'orchestration' && (
        <div className="space-y-8 animate-fade-in">
          {/* Summary metrics strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
            {[
              { label: 'Entities Resolved', value: currentCase ? '0' : '0', sub: 'ABHIJNANA agent', color: '#6366F1' },
              { label: 'Relationships', value: currentCase ? '0' : '0', sub: 'SUTRA graph engine', color: '#8B5CF6' },
              { label: 'Historical Ties', value: currentCase ? '0' : '0', sub: 'SMRITI cross-case', color: '#EC4899' },
              { label: 'Notable Patterns', value: currentCase ? '0' : '0', sub: 'MANTHAN deep cluster', color: '#D946EF' },
              { label: 'Hotspot Locations', value: currentCase ? '0' : '0', sub: 'DRISHTI surveillance', color: '#F59E0B' },
              { label: 'Timeline Events', value: currentCase ? '0' : '0', sub: 'Chronological corpus', color: '#10B981' },
            ].map((m) => (
              <div
                key={m.label}
                className="p-4 rounded-2xl border glass-panel"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
              >
                <div className="text-[10px] font-mono uppercase text-gray-400 mb-1">{m.label}</div>
                <div className="text-2xl font-bold font-mono" style={{ color: m.color }}>{m.value}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{m.sub}</div>
              </div>
            ))}
          </div>

          {/* 10 Intelligence Agents Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--ink-primary)' }}>
                  SAMANVAYA Intelligence Agents
                </h2>
                <p className="text-xs text-gray-500">
                  Specialized AI agents collaborate to build a connected understanding of this case.
                </p>
              </div>
              <span className="text-xs font-mono text-gray-400">Click any agent to inspect operational telemetry</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              {agents.map((agent) => {
                const Icon = agent.icon;
                const isSelected = selectedAgentId === agent.id;
                return (
                  <div
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'ring-2 ring-indigo-500 -translate-y-1 shadow-lg'
                        : 'hover:-translate-y-0.5'
                    }`}
                    style={{
                      background: 'var(--surface-1)',
                      borderColor: isSelected ? agent.color : 'var(--border)',
                    }}
                  >
                    <div>
                      {/* Icon & Status */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform"
                          style={{ background: agent.bg, color: agent.color }}
                        >
                          <Icon size={20} />
                        </div>
                        <span
                          className="text-[9.5px] font-mono px-2 py-0.5 rounded-full font-bold uppercase"
                          style={{
                            background: agent.status.includes('Available') || agent.status === 'Ready'
                              ? 'rgba(16, 185, 129, 0.1)'
                              : 'rgba(107, 114, 128, 0.1)',
                            color: agent.status.includes('Available') || agent.status === 'Ready'
                              ? '#10B981'
                              : '#9CA3AF',
                          }}
                        >
                          ● {agent.status}
                        </span>
                      </div>

                      {/* Name & Meaning */}
                      <div className="mb-2">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
                            {agent.name}
                          </h3>
                          <span className="text-[11px] font-mono text-gray-400 font-medium">
                            ({agent.sanskritName})
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-indigo-400 block mt-0.5">
                          {agent.meaning}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-gray-400 leading-relaxed mb-3">
                        {agent.shortDesc}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-gray-500">
                      <span>{agent.outputs.length} outputs</span>
                      <span className="text-indigo-400 hover:underline">Inspect →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── AGENT FLOW VISUALIZATION PIPELINE ────────────────── */}
          <div className="p-6 md:p-8 rounded-3xl border glass-panel space-y-6"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--ink-primary)' }}>
                  Interactive Multi-Agent Flow Pipeline
                </h3>
                <p className="text-xs text-gray-500">
                  Data lineage from case ingestion through specialized multi-agent analysis to investigator review.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-gray-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Authorized Source
                <span className="w-2 h-2 rounded-full bg-indigo-500 ml-2" /> AI Synthesis
                <span className="w-2 h-2 rounded-full bg-amber-500 ml-2" /> Human Review
              </div>
            </div>

            {/* Pipeline flowchart */}
            <div className="py-6 px-4 rounded-2xl border bg-black/20 overflow-x-auto"
              style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between min-w-[980px] gap-2 text-xs font-mono">
                {/* 1. Case Root */}
                <div className="p-3 rounded-xl border text-center bg-indigo-500/10 border-indigo-500/30 text-indigo-300 w-32 shrink-0">
                  <div className="text-[10px] uppercase font-bold text-indigo-400">INPUT</div>
                  <div className="font-bold text-white text-sm mt-0.5">{currentCase.id}</div>
                  <div className="text-[10px] text-gray-400">FIR &amp; Case Records</div>
                </div>

                <ArrowRight size={16} className="text-gray-500 shrink-0" />

                {/* 2. SANGRAHA */}
                <button
                  onClick={() => setSelectedAgentId('sangraha')}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer w-32 shrink-0 ${
                    selectedAgentId === 'sangraha' ? 'ring-2 ring-blue-500 bg-blue-500/20' : 'bg-white/[0.04] border-white/10'
                  }`}
                >
                  <div className="text-[10px] text-blue-400 font-bold">SANGRAHA</div>
                  <div className="font-semibold text-white text-xs mt-0.5">Data Intake</div>
                  <div className="text-[9px] text-gray-400">Corpus Unified</div>
                </button>

                <ArrowRight size={16} className="text-gray-500 shrink-0" />

                {/* 3. ABHIJNANA */}
                <button
                  onClick={() => setSelectedAgentId('abhijnana')}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer w-36 shrink-0 ${
                    selectedAgentId === 'abhijnana' ? 'ring-2 ring-indigo-500 bg-indigo-500/20' : 'bg-white/[0.04] border-white/10'
                  }`}
                >
                  <div className="text-[10px] text-indigo-400 font-bold">ABHIJNANA</div>
                  <div className="font-semibold text-white text-xs mt-0.5">Entity Resolution</div>
                  <div className="text-[9px] text-gray-400">31 Entities Identified</div>
                </button>

                <ArrowRight size={16} className="text-gray-500 shrink-0" />

                {/* 4. Specialized Sources (VAK, ARTHA, DRISHTI) */}
                <div className="p-2.5 rounded-xl border border-dashed border-white/20 bg-white/[0.02] flex flex-col gap-1.5 w-44 shrink-0">
                  <div className="text-[9px] font-bold text-gray-400 uppercase text-center">AUTHORIZED STREAMS</div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-center">
                    <button onClick={() => setSelectedAgentId('vak')} className="p-1 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">VAK</button>
                    <button onClick={() => setSelectedAgentId('artha')} className="p-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ARTHA</button>
                    <button onClick={() => setSelectedAgentId('drishti')} className="p-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">DRISHTI</button>
                  </div>
                </div>

                <ArrowRight size={16} className="text-gray-500 shrink-0" />

                {/* 5. SUTRA */}
                <button
                  onClick={() => setSelectedAgentId('sutra')}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer w-32 shrink-0 ${
                    selectedAgentId === 'sutra' ? 'ring-2 ring-purple-500 bg-purple-500/20' : 'bg-white/[0.04] border-white/10'
                  }`}
                >
                  <div className="text-[10px] text-purple-400 font-bold">SUTRA</div>
                  <div className="font-semibold text-white text-xs mt-0.5">Network Synthesis</div>
                  <div className="text-[9px] text-gray-400">54 Link Edges</div>
                </button>

                <ArrowRight size={16} className="text-gray-500 shrink-0" />

                {/* 6. MANTHAN */}
                <button
                  onClick={() => setSelectedAgentId('manthan')}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer w-32 shrink-0 ${
                    selectedAgentId === 'manthan' ? 'ring-2 ring-fuchsia-500 bg-fuchsia-500/20' : 'bg-white/[0.04] border-white/10'
                  }`}
                >
                  <div className="text-[10px] text-fuchsia-400 font-bold">MANTHAN</div>
                  <div className="font-semibold text-white text-xs mt-0.5">Pattern Engine</div>
                  <div className="text-[9px] text-gray-400">4 Clusters</div>
                </button>

                <ArrowRight size={16} className="text-gray-500 shrink-0" />

                {/* 7. VYAKHYA */}
                <button
                  onClick={() => setSelectedAgentId('vyakhya')}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer w-32 shrink-0 ${
                    selectedAgentId === 'vyakhya' ? 'ring-2 ring-indigo-500 bg-indigo-500/20' : 'bg-white/[0.04] border-white/10'
                  }`}
                >
                  <div className="text-[10px] text-indigo-300 font-bold">VYAKHYA</div>
                  <div className="font-semibold text-white text-xs mt-0.5">Explainability</div>
                  <div className="text-[9px] text-gray-400">Why &amp; Evidence</div>
                </button>

                <ArrowRight size={16} className="text-gray-500 shrink-0" />

                {/* 8. Investigator Signoff */}
                <div className="p-3 rounded-xl border text-center bg-amber-500/10 border-amber-500/30 text-amber-400 w-36 shrink-0">
                  <div className="text-[10px] uppercase font-bold text-amber-500">HUMAN IN THE LOOP</div>
                  <div className="font-bold text-white text-xs mt-0.5">Investigator Review</div>
                  <div className="text-[9px] text-amber-300">Final Decision</div>
                </div>
              </div>
            </div>

            {/* Selected Agent Inspector Banner */}
            <div className="p-5 rounded-2xl border bg-black/40 space-y-4"
              style={{ borderColor: activeAgent.color, background: 'var(--surface-2)' }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
                    style={{ background: activeAgent.color }}>
                    <activeAgent.icon size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base" style={{ color: 'var(--ink-primary)' }}>
                        {activeAgent.name} ({activeAgent.sanskritName})
                      </span>
                      <span className="text-xs text-indigo-400 font-mono">[{activeAgent.meaning}]</span>
                    </div>
                    <p className="text-xs text-gray-400">{activeAgent.shortDesc}</p>
                  </div>
                </div>
                <div className="text-xs font-mono px-3 py-1 rounded-full border border-white/10 bg-white/[0.05]">
                  Status: <span className="font-bold text-emerald-400">{activeAgent.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono pt-3 border-t border-white/[0.06]">
                <div>
                  <span className="text-gray-400 uppercase text-[10px] font-bold block mb-1">INPUT STREAMS</span>
                  <ul className="space-y-1 text-gray-300">
                    {activeAgent.inputs.map((inp) => (
                      <li key={inp} className="flex items-center gap-1.5 truncate">
                        <span className="w-1 h-1 rounded-full bg-indigo-400" />
                        {inp}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-gray-400 uppercase text-[10px] font-bold block mb-1">SYNTHESIZED OUTPUTS</span>
                  <ul className="space-y-1 text-gray-300">
                    {activeAgent.outputs.map((out) => (
                      <li key={out} className="flex items-center gap-1.5 truncate">
                        <span className="w-1 h-1 rounded-full bg-emerald-400" />
                        {out}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-gray-400 uppercase text-[10px] font-bold block mb-1">OPERATIONAL TELEMETRY</span>
                  <p className="text-gray-300 leading-relaxed text-[11px]">
                    {activeAgent.analyzedSummary}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── KEY INVESTIGATIVE FINDINGS (EXPLAINABLE) ─────────── */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--ink-primary)' }}>
                  Key Investigative Findings
                </h2>
                <p className="text-xs text-gray-500">
                  AI-assisted findings with direct evidence sources. All findings require human investigator verification.
                </p>
              </div>
              <span className="text-xs font-mono text-indigo-400">{keyFindings.length} Verified Intelligence Leads</span>
            </div>

            {keyFindings.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {keyFindings.map((finding) => (
                  <div
                    key={finding.id}
                    className="p-6 rounded-2xl border glass-panel flex flex-col justify-between transition-all hover:border-indigo-500/50 space-y-4"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-mono font-bold text-indigo-400">{finding.id}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Requires Investigator Review
                          </span>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase"
                            style={{ background: 'rgba(16, 185, 129, 0.1)', color: finding.confidenceColor }}>
                            {finding.confidence}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-white leading-snug">
                        {finding.title}
                      </h3>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        {finding.description}
                      </p>
                    </div>

                    {/* Evidence Citations */}
                    <div className="space-y-2 pt-3 border-t border-white/[0.06]">
                      <span className="text-[10px] font-mono text-gray-500 uppercase font-bold block">
                        Underlying Evidence Sources:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {finding.evidenceSources.map((ev) => (
                          <span key={ev} className="text-[11px] font-mono px-2 py-1 rounded bg-black/30 border border-white/10 text-gray-300 flex items-center gap-1">
                            <CheckCircle2 size={11} className="text-emerald-400" />
                            {ev}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-1 text-[10px] font-mono text-gray-500">
                          <span>Agents: </span>
                          {finding.agentsInvolved.map((ag) => (
                            <span key={ag} className="text-indigo-400 font-semibold">{ag} </span>
                          ))}
                        </div>
                        <button
                          onClick={() => {
                            if (finding.actionTarget === 'network') setActiveTab('network');
                            else if (finding.actionTarget === 'map') setActiveTab('map');
                            else setActiveTab('timeline');
                            toast.info(`Switched to ${finding.actionTarget} view for ${finding.id}`);
                          }}
                          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                        >
                          Explore in {finding.actionTarget.toUpperCase()} →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl border glass-panel space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
                <BrainCircuit size={36} className="mx-auto text-indigo-400 opacity-40 mb-2" />
                <h4 className="font-bold text-base text-white">No Agent Findings Synthesized</h4>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  Execute a SAMANVAYA multi-agent synthesis pass on an active case dossier to aggregate corroborated findings.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: CASE NETWORK (CYTOSCAPE GRAPH) ─────────────── */}
      {activeTab === 'network' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--ink-primary)' }}>
                Case-Specific Criminal Network
              </h2>
              <p className="text-xs text-gray-500">
                SUTRA Network Agent synthesized graph for {currentCase.id}. Click entities to inspect connections and evidence.
              </p>
            </div>
            <div className="text-xs font-mono text-gray-400">
              31 Entities • 54 Links • Multi-Tier Clusters
            </div>
          </div>

          <div className="rounded-2xl border glass-panel overflow-hidden"
            style={{ borderColor: 'var(--border)', minHeight: '620px' }}>
            <CaseNetworkGraph
              caseId={currentCase.id}
              onViewOnMap={() => setActiveTab('map')}
            />
          </div>
        </div>
      )}

      {/* ── TAB 3: CASE MAP (LEAFLET GEOSPATIAL) ──────────────── */}
      {activeTab === 'map' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--ink-primary)' }}>
                Geospatial Incident &amp; Surveillance Map
              </h2>
              <p className="text-xs text-gray-500">
                DRISHTI Surveillance Agent observations correlated with FIR location clusters.
              </p>
            </div>
            <div className="text-xs font-mono text-gray-400">
              Mumbai / Thane Metropolitan Jurisdiction
            </div>
          </div>

          <div className="rounded-2xl border glass-panel overflow-hidden"
            style={{ borderColor: 'var(--border)', minHeight: '600px' }}>
            <CaseLeafletMap caseId={currentCase.id} />
          </div>
        </div>
      )}

      {/* ── TAB 4: CHRONOLOGICAL TIMELINE ──────────────────────── */}
      {activeTab === 'timeline' && (
        <div className="p-6 md:p-8 rounded-2xl border glass-panel space-y-6 animate-fade-in"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--ink-primary)' }}>
              Case Event Timeline
            </h2>
            <p className="text-xs text-gray-500">
              Correlated temporal event sequence reconstructed from FIR filings, financial transfers, and sightings.
            </p>
          </div>

          <div className="relative pl-6 border-l-2 border-indigo-500/30 space-y-8 my-4">
            {[
              {
                time: '2026-09-04 14:30',
                title: 'Primary FIR Lodged at Andheri West PS',
                agent: 'SANGRAHA',
                type: 'FIR Event',
                desc: 'Complainant reported ₹4.70 Cr unauthorized diversion from escrow account to Nexus Trading Corp.',
              },
              {
                time: '2026-09-04 11:15',
                title: 'Final Layered Transfer Cleared',
                agent: 'ARTHA',
                type: 'Financial Anomaly',
                desc: '₹1.85 Cr transferred from ORG-014 to overseas intermediate shell entity.',
              },
              {
                time: '2026-09-03 18:40',
                title: 'ANPR Surveillance Hit: VEHICLE-044',
                agent: 'DRISHTI',
                type: 'Surveillance Hit',
                desc: 'Vehicle registered to Rahul Thakur observed at BKC junction near corporate office.',
              },
              {
                time: '2026-08-28 10:00',
                title: 'Historical Connection Precedent (CASE-041)',
                agent: 'SMRITI',
                type: 'Historical Link',
                desc: 'PERSON-014 previously documented using identical shell incorporation agents in Mumbai.',
              },
            ].map((item, idx) => (
              <div key={idx} className="relative">
                <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-indigo-600 border-4 border-[#0C0D12]" />
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-indigo-400">{item.time}</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-semibold">
                    {item.agent}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">[{item.type}]</span>
                </div>
                <h4 className="text-sm font-bold text-white">{item.title}</h4>
                <p className="text-xs text-gray-400 mt-0.5 max-w-2xl">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 5: INTELLIGENCE REPORT (VYAKHYA) ───────────────── */}
      {activeTab === 'report' && (
        <div className="p-6 md:p-10 rounded-3xl border glass-panel space-y-8 animate-fade-in max-w-[1200px] mx-auto"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          {/* Official Report Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-6 gap-4"
            style={{ borderColor: 'var(--border)' }}>
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-gray-400 mb-1">
                <span>KRITAGAS INTELLIGENCE DOSSIER</span>
                <span>•</span>
                <span>DOC REF: KRT-SAM-2026-0102</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Comprehensive Case Intelligence Report
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Generated by VYAKHYA Explainability Agent for {currentCase.id} ({currentCase.title})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors hover:bg-white/10 cursor-pointer"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
              >
                <Printer size={14} />
                <span>Print / PDF</span>
              </button>
              <button
                onClick={() => toast.success('Intelligence Dossier exported with cryptographic SHA-256 seal.')}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm cursor-pointer"
              >
                <Download size={14} />
                <span>Export Signed Copy</span>
              </button>
            </div>
          </div>

          {/* Section 1: Executive Summary */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 font-mono">
              1. Executive Case Summary
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              {currentCase
                ? `SAMANVAYA multi-agent analysis initialized for case ${currentCase.id} (${currentCase.title}). Ingest FIR records, transaction statements, or surveillance pings to synthesize cross-jurisdictional intelligence.`
                : 'Select an active case dossier from the selector above to generate an executive intelligence summary.'}
            </p>
          </div>

          {/* Section 2: Explainable Findings (WHY) */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 font-mono">
              2. Key Findings &amp; AI Explainability (WHY Connections Exist)
            </h3>
            <div className="p-8 text-center rounded-xl border bg-black/30 space-y-2" style={{ borderColor: 'var(--border)' }}>
              <ShieldCheck size={32} className="mx-auto text-indigo-400 opacity-40 mb-2" />
              <div className="font-bold text-sm text-white">
                No Entity Centrality Ranks Generated
              </div>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Ingest case documents and run agent synthesis to compute graph centrality and generate autonomous explainability dossiers.
              </p>
            </div>
          </div>

          {/* Section 3: Legal Disclaimer & Investigator Signoff */}
          <div className="p-6 rounded-2xl border bg-amber-500/10 border-amber-500/30 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase font-mono">
              <ShieldCheck size={16} />
              <span>Mandatory Legal Disclaimer &amp; Human Review</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              AI-generated findings are investigative intelligence intended to assist sworn law enforcement officers and require
              formal evidentiary verification. The system does not make final decisions, criminal accusations, or arrests.
            </p>
            <div className="pt-3 border-t border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="font-mono text-gray-400">
                Case Officer: <span className="text-white font-bold">{currentCase?.assignedOfficer || 'Investigating Officer'}</span> • Status: <span className="text-amber-400">Pending Review</span>
              </div>
              <button
                onClick={() => toast.success('Investigator endorsed findings for inclusion in case chargesheet folder.')}
                className="px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-colors cursor-pointer"
              >
                Endorse Findings as Investigator
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SamanvayaPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center font-mono text-xs text-gray-500">Loading SAMANVAYA Intelligence...</div>}>
      <SamanvayaContent />
    </Suspense>
  );
}
