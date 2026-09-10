'use client';

// ============================================================
// SAMANVAYA — Multi-Agent Criminal Intelligence workspace.
//
// The page is an orchestrator: it owns the case selection, the
// evidence-ingestion state and the pipeline polling loop, and hands
// each stage to a dedicated component. Nothing here fabricates data —
// when the backend has nothing, the UI says so.
// ============================================================

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BrainCircuit,
  Loader2,
  Play,
  RotateCcw,
  LayoutDashboard,
  Database,
  Cpu,
  Target,
  Share2,
  Layers,
  MapPin,
  Clock,
  Phone,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

import { casesApi, type BackendCase } from '@/lib/api/cases';
import { useCaseStore } from '@/context/CaseContext';
import {
  samanvayaApi,
  type CDRAnalysis,
  type DataSourceStatus,
  type SamanvayaFinalDossier,
  type SamanvayaPipelineStatus,
} from '@/lib/api/samanvaya';

import CaseSelector from '@/components/samanvaya/CaseSelector';
import PipelineRail, { buildStages } from '@/components/samanvaya/PipelineRail';
import DataSourcePanel from '@/components/samanvaya/DataSourcePanel';
import AgentWorkspace, { AgentConsole, mergeAgents } from '@/components/samanvaya/AgentWorkspace';
import CommunicationAnalysis from '@/components/samanvaya/CommunicationAnalysis';
import InvestigationNetwork from '@/components/samanvaya/InvestigationNetwork';
import InvestigationTreeCanvas from '@/components/samanvaya/InvestigationTreeCanvas';
import IntelligenceMap from '@/components/samanvaya/IntelligenceMap';
import InvestigationTimeline from '@/components/samanvaya/InvestigationTimeline';
import IntelligenceSummary from '@/components/samanvaya/IntelligenceSummary';
import OfficialDossier from '@/components/samanvaya/OfficialDossier';
import { Panel, Badge, ErrorState } from '@/components/samanvaya/primitives';
import { SEVERITY_COLORS } from '@/components/samanvaya/theme';

type TabKey =
  | 'select'
  | 'data'
  | 'agents'
  | 'summary'
  | 'network'
  | 'tree'
  | 'map'
  | 'timeline'
  | 'comms'
  | 'dossier';

const TABS: Array<{ key: TabKey; label: string; icon: typeof LayoutDashboard; needsDossier?: boolean }> = [
  { key: 'select', label: 'Case', icon: LayoutDashboard },
  { key: 'data', label: 'Evidence sources', icon: Database },
  { key: 'agents', label: 'Analysis steps', icon: Cpu },
  { key: 'summary', label: 'Summary', icon: Target, needsDossier: true },
  { key: 'network', label: 'Network', icon: Share2, needsDossier: true },
  { key: 'tree', label: 'Case tree', icon: Layers, needsDossier: true },
  { key: 'map', label: 'Map', icon: MapPin, needsDossier: true },
  { key: 'timeline', label: 'Timeline', icon: Clock, needsDossier: true },
  { key: 'comms', label: 'Phone calls', icon: Phone },
  { key: 'dossier', label: 'Final report', icon: FileText, needsDossier: true },
];

const POLL_MS = 1500;

function SamanvayaWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedCase = searchParams.get('case') || '';

  // ── Centralized Case Store ───────────────────────────────
  const {
    cases,
    activeCaseId,
    loading: loadingCases,
    error: caseError,
    selectCase: setGlobalCase,
  } = useCaseStore();

  const [selectedCaseId, setSelectedCaseId] = useState<string>(() => {
    return requestedCase || activeCaseId || '';
  });

  // Synchronize selection with requestedCase query param or activeCaseId
  useEffect(() => {
    if (requestedCase) {
      if (requestedCase !== selectedCaseId) {
        setSelectedCaseId(requestedCase);
        setGlobalCase(requestedCase);
      }
    } else if (activeCaseId && !selectedCaseId) {
      setSelectedCaseId(activeCaseId);
    } else if (!selectedCaseId && cases.length > 0) {
      setSelectedCaseId(cases[0].id);
      setGlobalCase(cases[0].id);
    }
  }, [requestedCase, activeCaseId, selectedCaseId, cases, setGlobalCase]);

  // ── Pipeline ─────────────────────────────────────────────
  const [status, setStatus] = useState<SamanvayaPipelineStatus | null>(null);
  const [dossier, setDossier] = useState<SamanvayaFinalDossier | null>(null);
  const [starting, setStarting] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  // ── Evidence ─────────────────────────────────────────────
  const [sources, setSources] = useState<DataSourceStatus[]>([]);
  const [cdr, setCdr] = useState<CDRAnalysis | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>('select');
  const [selectedAgentId, setSelectedAgentId] = useState('agent-1');

  const selectedCase = useMemo(
    () => cases.find((c) => c.id === selectedCaseId) || null,
    [cases, selectedCaseId]
  );

  // ── Load evidence availability for the selected case ─────
  const loadSources = useCallback(async (caseId: string) => {
    if (!caseId) return;
    setSourcesLoading(true);
    setSourcesError(null);
    try {
      const [srcs, records] = await Promise.all([
        samanvayaApi.getDataSources(caseId),
        samanvayaApi.getCallRecords(caseId).catch(() => null),
      ]);
      setSources(srcs || []);
      setCdr(records);
    } catch (err: any) {
      setSourcesError(err?.message || 'Data source availability could not be determined.');
      setSources([]);
    } finally {
      setSourcesLoading(false);
    }
  }, []);

  // ── Polling ──────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const beginPolling = useCallback(
    (caseId: string) => {
      stopPolling();
      pollRef.current = window.setInterval(async () => {
        try {
          const live = await samanvayaApi.getPipelineStatus(caseId);
          setStatus(live);

          if (live.status === 'COMPLETED') {
            stopPolling();
            setStarting(false);
            const finished = await samanvayaApi.getFinalResults(caseId);
            setDossier(finished);
            loadSources(caseId);
            toast.success('Analysis complete — all five steps finished.');
            setTab('summary');
          } else if (live.status === 'FAILED') {
            stopPolling();
            setStarting(false);
            setPipelineError(live.error || 'The pipeline stopped before completing.');
            toast.error('Analysis failed.');
          }
        } catch (err: any) {
          // A single dropped poll is not fatal; surface it only if it persists.
          console.warn('SAMANVAYA status poll failed:', err);
        }
      }, POLL_MS);
    },
    [stopPolling, loadSources]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ── Load any existing analysis (never triggers a new run) ─
  const loadExisting = useCallback(async (caseId: string) => {
    if (!caseId) return;
    setPipelineError(null);
    try {
      const [existing, live] = await Promise.all([
        samanvayaApi.getFinalResults(caseId).catch(() => null),
        samanvayaApi.getPipelineStatus(caseId).catch(() => null),
      ]);
      setDossier(existing);
      setStatus(live);
      if (live?.status === 'RUNNING' || live?.status === 'INITIALIZING') {
        beginPolling(caseId);
      }
    } catch (err: any) {
      setPipelineError(err?.message || 'Could not read the analysis state for this case.');
    }
  }, [beginPolling]);

  // Switching case invalidates every derived view. Clearing during render (the
  // documented pattern for resetting state when a key prop changes) means the
  // stale dossier is never painted for the newly selected case.
  const [loadedCaseId, setLoadedCaseId] = useState('');
  if (selectedCaseId && selectedCaseId !== loadedCaseId) {
    setLoadedCaseId(selectedCaseId);
    setDossier(null);
    setStatus(null);
    setCdr(null);
    setSources([]);
  }

  useEffect(() => {
    if (!selectedCaseId) return;
    stopPolling();
    loadSources(selectedCaseId);
    loadExisting(selectedCaseId);
  }, [selectedCaseId, stopPolling, loadSources, loadExisting]);

  // ── Start ────────────────────────────────────────────────
  const startPipeline = useCallback(async () => {
    if (!selectedCaseId) {
      toast.error('Select an investigation case first.');
      return;
    }
    setStarting(true);
    setPipelineError(null);
    setDossier(null);
    try {
      await samanvayaApi.startPipeline(selectedCaseId, false);
      toast.success('TRINETRA Analysis started.');
      setTab('agents');
      setSelectedAgentId('agent-1');
      beginPolling(selectedCaseId);
    } catch (err: any) {
      setStarting(false);
      const message = err?.message || 'The analysis could not be started.';
      setPipelineError(message);
      toast.error(message);
    }
  }, [selectedCaseId, beginPolling]);

  const changeCase = useCallback(
    (id: string) => {
      stopPolling();
      setStarting(false);
      setSelectedCaseId(id);
      setGlobalCase(id);
      setTab('select');
      router.replace(`/intelligence/samanvaya?case=${id}`);
    },
    [router, stopPolling, setGlobalCase]
  );

  // ── Derived state ────────────────────────────────────────
  const running = status?.status === 'RUNNING' || status?.status === 'INITIALIZING' || starting;
  const failed = status?.status === 'FAILED';
  const complete = Boolean(dossier);
  // Live telemetry wins while a run is in flight; the stored dossier supplies
  // the cards once it has finished.
  const agentCards = useMemo(
    () => (status?.agents?.length ? status.agents : dossier?.agents || []),
    [status?.agents, dossier?.agents]
  );

  const agents = useMemo(
    () => mergeAgents(agentCards, status?.currentAgentIndex ?? 0, Boolean(running), Boolean(failed)),
    [agentCards, status?.currentAgentIndex, running, failed]
  );

  const liveSources = status?.dataSources?.length ? status.dataSources : sources;
  const connectedCount = liveSources.filter((s) => s.state === 'CONNECTED' || s.state === 'UPLOADED').length;

  const stages = useMemo(
    () =>
      buildStages({
        hasCase: Boolean(selectedCaseId),
        sourcesConnected: connectedCount,
        currentAgentIndex: status?.currentAgentIndex ?? 0,
        running: Boolean(running),
        complete,
        failed: Boolean(failed),
      }),
    [selectedCaseId, connectedCount, status?.currentAgentIndex, running, complete, failed]
  );

  const unmappedCount = useMemo(() => {
    if (!dossier) return 0;
    const treeLocations =
      dossier.tree?.root?.children
        ?.find((b) => b.id === 'tree-branch-incident')
        ?.children?.filter((n) => n.badge === 'UNMAPPED').length ?? 0;
    return treeLocations;
  }, [dossier]);

  const progress = status?.progress ?? (complete ? 100 : 0);
  const stageText =
    status?.stageText ||
    (complete
      ? 'Analysis complete — explore the investigation outputs below'
      : selectedCaseId
        ? 'Ready to start the multi-agent investigation'
        : 'Select a case to begin');

  const priorityColor = SEVERITY_COLORS[(selectedCase?.priority || '').toUpperCase()] || '#12376E';

  return (
    <div className="max-w-[1680px] mx-auto pb-16 space-y-5">
      {/* ── Command centre header ──────────────────────── */}
      <div
        className="rounded-2xl border p-5 md:p-6"
        style={{
          background: 'var(--surface-1)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            {/* A soft tile instead of a heavy black block, and the badge and
                step count are dropped — the rail below already shows both. */}
            <span
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--pastel-teal)', color: 'var(--pastel-teal-ink)' }}
            >
              <BrainCircuit size={21} />
            </span>
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold tracking-tight text-[var(--ink-primary)] leading-none">
                TRINETRA Analysis
              </h1>
              {selectedCase ? (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="font-mono text-[13px] font-semibold text-[var(--ink-primary)]">
                    {selectedCase.case_number}
                  </span>
                  <span className="text-[13px] text-[var(--ink-secondary)]">
                    {selectedCase.crime_category}
                  </span>
                  <Badge color={priorityColor}>{selectedCase.priority}</Badge>
                  <Badge color="var(--accent)">{selectedCase.status}</Badge>
                </div>
              ) : (
                <p className="text-[12.5px] text-[var(--ink-secondary)] mt-1.5">
                  Select an investigation case to begin.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cases.length > 0 && (
              <select
                value={selectedCaseId}
                onChange={(e) => changeCase(e.target.value)}
                disabled={running}
                aria-label="Active case"
                className="px-3 py-2 rounded-xl text-[12.5px] font-semibold border outline-none cursor-pointer disabled:opacity-50 max-w-[280px]"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--ink-primary)',
                }}
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_number} — {c.crime_category}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={startPipeline}
              disabled={running || !selectedCaseId}
              className="px-4 py-2 rounded-lg text-[12.5px] font-semibold flex items-center gap-2 cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ background: 'var(--highlight)', color: 'var(--highlight-ink)' }}
            >
              {running ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Running…
                </>
              ) : complete ? (
                <>
                  <RotateCcw size={15} />
                  Re-run
                </>
              ) : (
                <>
                  <Play size={15} />
                  Start investigation
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Pipeline rail ──────────────────────────────── */}
      <PipelineRail stages={stages} progress={progress} stageText={stageText} running={Boolean(running)} />

      {/* ── Errors ─────────────────────────────────────── */}
      {caseError && (
        <ErrorState
          title="Cases unavailable"
          message="The platform could not reach the case service."
          details={caseError}
          onRetry={() => window.location.reload()}
        />
      )}
      {pipelineError && (
        <ErrorState
          title="Analysis error"
          message="The analysis reported an error for this case."
          details={pipelineError}
          onRetry={startPipeline}
        />
      )}

      {/* ── Tabs ───────────────────────────────────────── */}
      <nav
        className="flex items-center gap-1 overflow-x-auto pb-px border-b custom-scrollbar"
        style={{ borderColor: 'var(--border)' }}
        aria-label="Investigation views"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          const locked = t.needsDossier && !complete;
          const badge = tabBadge(t.key, dossier, cdr, liveSources, agents.filter((a) => a.live).length);
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={active ? 'page' : undefined}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-[12.5px] font-semibold whitespace-nowrap border-b-2 -mb-px cursor-pointer transition-colors"
              style={{
                borderColor: active ? 'var(--accent)' : 'transparent',
                color: active ? 'var(--accent)' : locked ? 'var(--ink-tertiary)' : 'var(--ink-secondary)',
                background: active ? 'var(--accent-muted)' : 'transparent',
                opacity: locked ? 0.6 : 1,
              }}
            >
              <Icon size={14} />
              {t.label}
              {badge !== null && (
                <span
                  className="px-1.5 py-px rounded text-[10px] font-semibold tabular-nums"
                  style={{
                    background: active ? 'var(--accent)' : 'var(--surface-3)',
                    color: active ? '#FFFFFF' : 'var(--ink-secondary)',
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Views ──────────────────────────────────────── */}
      <div className="animate-fade-in">
        {tab === 'select' && (
          <CaseSelector
            cases={cases}
            loading={loadingCases}
            selectedCaseId={selectedCaseId}
            onSelect={changeCase}
            onStart={startPipeline}
            starting={Boolean(running)}
            alreadyAnalysed={complete}
            onOpenIngestion={() => setTab('data')}
          />
        )}

        {tab === 'data' && (
          <DataSourcePanel
            caseId={selectedCaseId}
            sources={liveSources}
            cdr={cdr}
            loading={sourcesLoading}
            error={sourcesError}
            onRefresh={() => loadSources(selectedCaseId)}
            onCdrChanged={(analysis) => {
              setCdr(analysis);
              // A change of evidence invalidates the previous dossier server-side.
              setDossier(null);
            }}
            disabled={Boolean(running)}
          />
        )}

        {tab === 'agents' && (
          <div className="space-y-5">
            {status?.console && status.console.length > 0 && (
              <AgentConsole
                lines={status.console}
                color="#12376E"
                title="What the system is doing right now"
                animate={Boolean(running)}
                defaultOpen={Boolean(running)}
                maxHeight={220}
              />
            )}
            <AgentWorkspace
              agents={agents}
              selectedId={selectedAgentId}
              onSelect={setSelectedAgentId}
              running={Boolean(running)}
            />
          </div>
        )}

        {tab === 'summary' && <IntelligenceSummary dossier={dossier} />}

        {tab === 'network' && (
          <InvestigationNetwork data={dossier?.graph || null} />
        )}

        {tab === 'tree' && (
          <InvestigationTreeCanvas data={dossier?.tree || null} />
        )}

        {tab === 'map' && (
          <IntelligenceMap
            points={dossier?.geographicRoute || []}
            links={dossier?.geographicLinks || []}
            unmappedCount={unmappedCount}
          />
        )}

        {tab === 'timeline' && <InvestigationTimeline events={dossier?.timeline || []} />}

        {tab === 'comms' && (
          <CommunicationAnalysis cdr={cdr || dossier?.communications || null} onUploadRequest={() => setTab('data')} />
        )}

        {tab === 'dossier' && <OfficialDossier dossier={dossier} caseRecord={selectedCase} />}
      </div>

      {/* ── Standing disclaimer ────────────────────────── */}
      <Panel>
        <p className="text-[12px] leading-relaxed text-[var(--ink-secondary)]">
          <strong className="text-[var(--ink-primary)]">AI-assisted analysis.</strong> Every finding,
          relationship and lead produced by TRINETRA Analysis requires independent verification by the investigating
          officer. Confidence values describe confidence in a data relationship or analytical match — they are
          not probabilities of guilt.
        </p>
      </Panel>
    </div>
  );
}

/** Counts shown on the tab strip, or null when a tab has nothing to count. */
function tabBadge(
  key: TabKey,
  dossier: SamanvayaFinalDossier | null,
  cdr: CDRAnalysis | null,
  sources: DataSourceStatus[],
  agentsDone: number
): number | null {
  switch (key) {
    case 'data': {
      const n = sources.filter((s) => s.state === 'CONNECTED' || s.state === 'UPLOADED').length;
      return n || null;
    }
    case 'agents':
      return agentsDone || null;
    case 'summary':
      return dossier?.findings.length || null;
    case 'network':
      return dossier?.graph.nodes.length || null;
    case 'map':
      return dossier?.geographicRoute.length || null;
    case 'timeline':
      return dossier?.timeline.length || null;
    case 'comms':
      return (cdr || dossier?.communications)?.patterns.length || null;
    default:
      return null;
  }
}

export default function SamanvayaPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 flex items-center justify-center gap-3 text-[var(--ink-secondary)]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px] font-medium">Loading TRINETRA Analysis…</span>
        </div>
      }
    >
      <SamanvayaWorkspace />
    </Suspense>
  );
}
