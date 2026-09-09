'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { casesApi, type BackendCase } from '@/lib/api/cases';
import { kavaApi, type KavaChatMessage, type KavaChatResponse } from '@/lib/api/kava';
import { useCaseStore } from '@/context/CaseContext';
import {
  Bot, User, Sparkles, Send, AlertTriangle, ChevronDown, ShieldCheck,
  FolderOpen, RefreshCw, Database, Network, FileText, Clock, MapPin,
  CheckCircle2, Circle, Loader2, Zap, XCircle, Info,
  PanelLeftClose, PanelLeftOpen, History, Plus, Trash2, MessageSquare, Search,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: string[];
  groundingLevel?: string;
  contextStats?: KavaChatResponse['contextStats'];
  error?: boolean;
}

export interface ChatSession {
  id: string;
  caseId: string;
  caseNumber: string;
  title: string;
  timestamp: string;
  messages: Message[];
}

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  } catch (_) {
    return 'Recently';
  }
}

// ── Dynamic suggested questions by crime type ────────────────────────────────

function getSuggestions(crimeCategory: string): string[] {
  const cat = crimeCategory.toLowerCase();
  if (cat.includes('kidnap') || cat.includes('abduct')) {
    return [
      'Who are the primary persons of interest in this case?',
      'Show suspicious calls in the 48 hours before the incident.',
      'What happened in the 24 hours before the incident?',
      'Identify the strongest network connections in this case.',
      'What did the SAMANVAYA agents discover?',
      'Summarize the key findings of this investigation.',
    ];
  }
  if (cat.includes('fraud') || cat.includes('financial') || cat.includes('cyber')) {
    return [
      'Who are the primary suspects in this financial case?',
      'Show suspicious transaction patterns.',
      'What entities are connected to the fraud network?',
      'What historical fraud patterns are similar?',
      'What communication anomalies were detected?',
      'Give me a complete case summary.',
    ];
  }
  if (cat.includes('homicide') || cat.includes('murder')) {
    return [
      'Who are the persons of interest in this case?',
      'Show location intelligence and movement patterns.',
      'What evidence supports the main findings?',
      'Analyze communication patterns before the incident.',
      'What did the network analysis reveal?',
      'Summarize all agent findings.',
    ];
  }
  return [
    'Summarize this investigation case.',
    'Who are the main suspects or persons of interest?',
    'Show suspicious communications in this case.',
    'What did all five SAMANVAYA agents discover?',
    'Identify the strongest network connections.',
    'What evidence is available in this case?',
  ];
}

// ── Loading step animator ────────────────────────────────────────────────────

const LOAD_STEPS = [
  'Retrieving FIR and case details',
  'Searching evidence records',
  'Analyzing entities and identities',
  'Examining network relationships',
  'Reviewing SAMANVAYA agent outputs',
  'Generating grounded analysis',
];

function LoadingBubble({ step }: { step: number }) {
  return (
    <div className="flex items-start gap-3.5">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow"
        style={{ background: 'linear-gradient(135deg,#6366F1 0%,#4F46E5 100%)' }}
      >
        <Bot size={18} />
      </div>
      <div
        className="p-4 rounded-2xl border text-[13px] space-y-2 min-w-[280px] shadow-sm"
        style={{ background: 'var(--surface-0)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2 font-semibold text-indigo-400">
          <Loader2 size={14} className="animate-spin" />
          <span>KAVA is retrieving case intelligence…</span>
        </div>
        <div className="space-y-1 pt-1">
          {LOAD_STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
              {i < step ? (
                <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
              ) : i === step ? (
                <Loader2 size={12} className="animate-spin text-indigo-400 shrink-0" />
              ) : (
                <Circle size={12} className="shrink-0 opacity-30" />
              )}
              <span className={i < step ? 'text-emerald-500' : i === step ? 'text-indigo-400' : 'opacity-40'}>
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Grounding badge ──────────────────────────────────────────────────────────

function GroundingBadge({ level }: { level: string }) {
  const cfg: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
    FULL: { color: '#10B981', label: 'Fully Grounded', icon: <ShieldCheck size={11} /> },
    PARTIAL: { color: '#F59E0B', label: 'Partially Grounded', icon: <Info size={11} /> },
    LIMITED: { color: '#6B7280', label: 'Limited Context', icon: <AlertTriangle size={11} /> },
    ERROR: { color: '#EF4444', label: 'Generation Error', icon: <XCircle size={11} /> },
    NONE: { color: '#6B7280', label: 'No Case Context', icon: <Circle size={11} /> },
  };
  const c = cfg[level] || cfg.LIMITED;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold"
      style={{ background: `${c.color}18`, color: c.color, border: `1px solid ${c.color}33` }}
    >
      {c.icon}{c.label}
    </span>
  );
}

// ── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
    >
      <Database size={9} />{label}
    </span>
  );
}

// ── Context stats panel ───────────────────────────────────────────────────────

function ContextPanel({ case: c, stats }: { case: BackendCase | null; stats: KavaChatResponse['contextStats'] | null }) {
  if (!c) {
    return (
      <div
        className="rounded-2xl border p-5 flex flex-col items-center justify-center gap-3 text-center h-full min-h-[200px]"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
      >
        <Bot size={32} className="opacity-20" />
        <p className="text-[13px]" style={{ color: 'var(--ink-tertiary)' }}>
          Select a case to ground KAVA AI in real investigation data.
        </p>
      </div>
    );
  }
  const statusColor = c.status === 'OPEN' || c.status === 'UNDER_INVESTIGATION' ? '#10B981' : '#6B7280';
  const rows = [
    { icon: <FileText size={13} />, label: 'Case', value: c.case_number },
    { icon: <Zap size={13} />, label: 'Crime', value: c.crime_category },
    { icon: <Circle size={13} />, label: 'Status', value: c.status.replace(/_/g, ' ') },
    { icon: <Database size={13} />, label: 'Evidence', value: stats?.evidenceCount != null ? `${stats.evidenceCount} Records` : (c.evidence_count != null ? `${c.evidence_count} Records` : '0 Records') },
    { icon: <User size={13} />, label: 'Entities', value: stats?.entityCount != null ? `${stats.entityCount} Identified` : (c ? '0 Identified' : '—') },
    { icon: <Network size={13} />, label: 'Relationships', value: stats?.relationshipCount != null ? `${stats.relationshipCount} Detected` : (c ? '0 Detected' : '—') },
    { icon: <Clock size={13} />, label: 'Timeline', value: stats?.timelineEvents != null ? `${stats.timelineEvents} Events` : (c ? '0 Events' : '—') },
    { icon: <Bot size={13} />, label: 'Agents', value: stats?.agentCount != null ? `${stats.agentCount}/5 Complete` : '0/5 Complete' },
  ];
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center gap-2"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
      >
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: statusColor }}
        />
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ink-tertiary)' }}>
          Active Case Context
        </span>
      </div>
      {/* Rows */}
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between px-4 py-2.5 gap-2">
            <div className="flex items-center gap-1.5 shrink-0" style={{ color: 'var(--ink-tertiary)' }}>
              {r.icon}
              <span className="text-[11.5px] font-medium">{r.label}</span>
            </div>
            <span className="text-[11.5px] font-semibold text-right truncate max-w-[140px]" style={{ color: 'var(--ink-primary)' }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
      {/* Grounding status */}
      <div
        className="px-4 py-3 border-t flex items-center gap-2"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
      >
        {stats?.samanvayaComplete ? (
          <CheckCircle2 size={13} className="text-emerald-500" />
        ) : (
          <AlertTriangle size={13} className="text-amber-500" />
        )}
        <span className="text-[11px]" style={{ color: 'var(--ink-secondary)' }}>
          {stats?.samanvayaComplete
            ? 'SAMANVAYA analysis complete'
            : 'Run SAMANVAYA for deeper intelligence'}
        </span>
      </div>
    </div>
  );
}

// ── Markdown-lite renderer ────────────────────────────────────────────────────

function MessageBody({ content }: { content: string }) {
  // Minimal: bold, code, headers, bullets
  const lines = content.split('\n');
  return (
    <div className="space-y-1 text-[13.5px] leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h3 key={i} className="font-bold text-[14px] mt-3 mb-1" style={{ color: 'var(--ink-primary)' }}>{line.slice(4)}</h3>;
        if (line.startsWith('## ')) return <h2 key={i} className="font-extrabold text-[15px] mt-4 mb-1 pb-1 border-b" style={{ color: 'var(--ink-primary)', borderColor: 'var(--border)' }}>{line.slice(3)}</h2>;
        if (line.startsWith('# ')) return <h1 key={i} className="font-extrabold text-[16px] mt-4 mb-2" style={{ color: 'var(--ink-primary)' }}>{line.slice(2)}</h1>;
        if (line.startsWith('- ') || line.startsWith('• ')) {
          const text = line.slice(2);
          return (
            <div key={i} className="flex gap-2">
              <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-400 opacity-80" />
              <span style={{ color: 'var(--ink-primary)' }} dangerouslySetInnerHTML={{ __html: renderInline(text) }} />
            </div>
          );
        }
        if (line.startsWith('  •') || line.startsWith('  - ')) {
          const text = line.trimStart().slice(2);
          return (
            <div key={i} className="flex gap-2 ml-4">
              <span className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-indigo-300 opacity-60" />
              <span style={{ color: 'var(--ink-secondary)' }} dangerouslySetInnerHTML={{ __html: renderInline(text) }} />
            </div>
          );
        }
        if (line.startsWith('⚠')) return <p key={i} className="text-amber-500 font-medium" dangerouslySetInnerHTML={{ __html: renderInline(line) }} />;
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i} style={{ color: 'var(--ink-primary)' }} dangerouslySetInnerHTML={{ __html: renderInline(line) }} />;
      })}
    </div>
  );
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--surface-2);padding:1px 5px;border-radius:4px;font-size:12px">$1</code>');
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function KAVAAIPage() {
  const router = useRouter();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Centralized Case State from Single Source of Truth
  const {
    cases: availableCases,
    activeCaseId: selectedCaseId,
    activeCase: selectedCase,
    selectCase,
    loading: casesLoading,
  } = useCaseStore();

  // Chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '## Welcome to KAVA AI\n\nI am your **Case-Grounded Investigative Intelligence Assistant**.\n\nSelect an active investigation case above, then ask me anything about that case — suspects, call records, network connections, agent findings, or evidence.\n\nI answer strictly based on verified case data. I never fabricate facts.\n\n⚠ All outputs require investigator verification before use in formal proceedings.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [lastStats, setLastStats] = useState<KavaChatResponse['contextStats'] | null>(null);

  // ── Collapsible History Sidebar State ─────────────────────────────────────
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [historyFilter, setHistoryFilter] = useState<'case' | 'all'>('case');
  const [historySearch, setHistorySearch] = useState('');
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('kritagas_kava_chat_sessions_v1');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (_) {}
    }
    return [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Save or update active session in localStorage
  const saveSession = useCallback((msgs: Message[], caseObj: BackendCase | null, sessId: string | null): string => {
    const userMsgs = msgs.filter((m) => m.role === 'user');
    if (userMsgs.length === 0) return sessId || '';

    const firstQuestion = userMsgs[0].content;
    const title = firstQuestion.length > 34 ? firstQuestion.slice(0, 34) + '…' : firstQuestion;
    const activeId = sessId || `sess-${Date.now()}`;
    const sessionCaseId = caseObj?.id || selectedCaseId || '';
    const sessionCaseNumber = caseObj?.case_number || 'Investigation Case';

    const sessionObj: ChatSession = {
      id: activeId,
      caseId: sessionCaseId,
      caseNumber: sessionCaseNumber,
      title,
      timestamp: new Date().toISOString(),
      messages: msgs,
    };

    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== activeId);
      const updated = [sessionObj, ...filtered];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('kritagas_kava_chat_sessions_v1', JSON.stringify(updated.slice(0, 40)));
        } catch (_) {}
      }
      return updated;
    });

    return activeId;
  }, [selectedCaseId]);

  // Start fresh chat
  const handleNewChat = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `## Investigation Chat Initialized\n\nActive Grounding: **${selectedCase?.case_number ?? 'General Case'}** — ${selectedCase?.title ?? 'Case Dossier'}\n\nAsk any question regarding suspects, call detail records, graph relationships, or timeline facts.`,
        timestamp: new Date().toISOString(),
      },
    ]);
    toast.info('New chat thread ready.');
  }, [selectedCase]);

  // Select historical session
  const handleSelectSession = useCallback((session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    if (session.caseId && session.caseId !== selectedCaseId) {
      selectCase(session.caseId);
    }
  }, [selectedCaseId, selectCase]);

  // Delete historical session
  const handleDeleteSession = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessions((prev) => {
      const updated = prev.filter((s) => s.id !== sessionId);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('kritagas_kava_chat_sessions_v1', JSON.stringify(updated));
        } catch (_) {}
      }
      return updated;
    });
    if (currentSessionId === sessionId) {
      handleNewChat();
    }
    toast.info('Chat session removed.');
  }, [currentSessionId, handleNewChat]);

  // Filtered sessions for sidebar
  const displaySessions = useMemo(() => {
    return sessions.filter((s) => {
      if (historyFilter === 'case' && selectedCaseId) {
        if (s.caseId !== selectedCaseId && s.caseNumber !== selectedCase?.case_number) return false;
      }
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        return s.title.toLowerCase().includes(q) || s.caseNumber.toLowerCase().includes(q);
      }
      return true;
    });
  }, [sessions, historyFilter, historySearch, selectedCaseId, selectedCase?.case_number]);

  // ── Pre-fetch real intelligence stats immediately on case selection ───────
  useEffect(() => {
    if (!selectedCaseId) return;
    let active = true;
    casesApi
      .getIntelligenceContext(selectedCaseId)
      .then((res: any) => {
        if (!active) return;
        const stats = res?.stats || res?.data?.stats || res;
        if (stats && (stats.entityCount !== undefined || stats.caseNumber !== undefined)) {
          setLastStats(stats);
        }
      })
      .catch((err) => {
        console.warn('Could not load case intelligence context:', err);
      });
    return () => {
      active = false;
    };
  }, [selectedCaseId]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Case switch ────────────────────────────────────────────────────────────
  const handleCaseChange = (newId: string) => {
    if (newId === selectedCaseId) return;
    selectCase(newId);
    setLastStats(null);
    setCurrentSessionId(null);
    const newCase = availableCases.find((c) => c.id === newId);
    setMessages([
      {
        id: `switch-${Date.now()}`,
        role: 'assistant',
        content: `## Investigation Context Switched\n\nNow grounded in: **${newCase?.case_number ?? newId}** — ${newCase?.title ?? 'Case Dossier'}\n\nAll subsequent queries will be answered using intelligence from this case only.`,
        timestamp: new Date().toISOString(),
      },
    ]);
    toast.info(`Switched to ${newCase?.case_number ?? newId}`);
  };

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    if (!selectedCaseId) {
      toast.error('Please select an investigation case first.');
      return;
    }

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setLoadStep(0);

    // Animate load steps
    const stepTimer = setInterval(() => {
      setLoadStep((s) => (s < LOAD_STEPS.length - 1 ? s + 1 : s));
    }, 600);

    // Build history (last 6 turns, no welcome message)
    const history: KavaChatMessage[] = messages
      .filter((m) => m.id !== 'welcome' && !m.id.startsWith('switch-'))
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await kavaApi.chat({ caseId: selectedCaseId, message: text, history });
      clearInterval(stepTimer);
      setLoadStep(LOAD_STEPS.length);
      if (res.contextStats) setLastStats(res.contextStats);

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        timestamp: new Date().toISOString(),
        sources: res.sources,
        groundingLevel: res.groundingLevel,
        contextStats: res.contextStats,
      };
      setMessages((prev) => {
        const updated = [...prev, aiMsg];
        const sid = saveSession(updated, selectedCase, currentSessionId);
        setCurrentSessionId(sid);
        return updated;
      });
    } catch (err: any) {
      clearInterval(stepTimer);
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `## Unable to Generate Analysis\n\n${err?.message ?? 'An unexpected error occurred.'}\n\nPlease check your connection and retry. If the issue persists, verify that the backend is running and Gemini is configured.`,
        timestamp: new Date().toISOString(),
        error: true,
      };
      setMessages((prev) => {
        const updated = [...prev, errMsg];
        const sid = saveSession(updated, selectedCase, currentSessionId);
        setCurrentSessionId(sid);
        return updated;
      });
      toast.error('KAVA AI analysis failed. Please retry.');
    } finally {
      setLoading(false);
      setLoadStep(0);
    }
  }, [input, loading, selectedCaseId, selectedCase, messages, currentSessionId, saveSession]);

  const handleRetry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) handleSend(lastUser.content);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in max-w-7xl mx-auto pb-12">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div
        className="p-5 md:p-6 rounded-3xl border"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Left: branding */}
          <div className="flex items-center gap-3.5">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0"
              style={{ background: 'linear-gradient(135deg,#6366F1 0%,#4F46E5 100%)' }}
            >
              <Bot size={24} />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
              KAVA AI
            </h1>
          </div>

          {/* Right: case switcher */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--ink-tertiary)' }}>
                Active Case Grounding Context
              </label>
              <div className="relative">
                <select
                  value={selectedCaseId ?? ''}
                  onChange={(e) => handleCaseChange(e.target.value)}
                  disabled={casesLoading}
                  className="w-full sm:w-[300px] appearance-none pl-3.5 pr-9 py-2.5 rounded-xl border text-[13px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
                >
                  {casesLoading && <option value="">Loading cases…</option>}
                  {!casesLoading && availableCases.length === 0 && (
                    <option value="">No investigation cases available</option>
                  )}
                  {availableCases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_number} — {c.crime_category}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ink-tertiary)' }} />
              </div>
            </div>

            {selectedCase && (
              <button
                onClick={() => router.push(`/cases/${selectedCaseId}`)}
                className="px-3.5 py-2.5 rounded-xl border text-[12.5px] font-semibold hover:bg-[var(--surface-2)] transition-colors flex items-center gap-1.5 cursor-pointer"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
              >
                <FolderOpen size={13} />
                Open Workspace
              </button>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="mt-4 pt-3.5 border-t flex flex-wrap items-center justify-between gap-3 text-[12px]" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2" style={{ color: 'var(--ink-tertiary)' }}>
            {selectedCase ? (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  <strong style={{ color: 'var(--ink-primary)' }}>{selectedCase.case_number}</strong>
                  {' · '}{selectedCase.title}
                  {' · '}{selectedCase.status.replace(/_/g, ' ')}
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-gray-400" />
                <span>No active case selected</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-amber-500 font-medium">
            <AlertTriangle size={13} />
            <span>Investigative assistance only — human verification required.</span>
          </div>
        </div>
      </div>

      {/* ── MAIN LAYOUT: history + chat + context panel ─────────────────── */}
      <div className="flex gap-4 items-start">

        {/* ── COLLAPSIBLE HISTORY SIDEBAR (LEFT) ── */}
        {isHistoryOpen ? (
          <aside
            aria-label="Investigation chat history"
            className="w-64 sm:w-72 shrink-0 rounded-3xl border flex flex-col overflow-hidden transition-all duration-300 shadow-sm"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', height: '620px' }}
          >
            {/* Header: Title + Close button */}
            <div
              className="p-3.5 border-b flex items-center justify-between gap-2"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            >
              <div className="flex items-center gap-2">
                <History size={16} className="text-indigo-500" />
                <span className="text-[12.5px] font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
                  Chat History
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold bg-indigo-500/10 text-indigo-500">
                  {displaySessions.length}
                </span>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                title="Collapse history"
                className="p-1.5 rounded-lg border text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-3)] transition-colors cursor-pointer"
                style={{ borderColor: 'var(--border)' }}
              >
                <PanelLeftClose size={15} />
              </button>
            </div>

            {/* New Chat Button */}
            <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={handleNewChat}
                className="w-full py-2 px-3 rounded-xl text-[12px] font-bold text-white flex items-center justify-center gap-2 shadow-sm transition-all hover:opacity-90 cursor-pointer"
                style={{ background: 'linear-gradient(135deg,#6366F1 0%,#4F46E5 100%)' }}
              >
                <Plus size={14} />
                <span>New Chat</span>
              </button>
            </div>

            {/* Search & Filter */}
            <div className="px-3 pt-2.5 pb-2 space-y-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-tertiary)] pointer-events-none" />
                <input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Filter history..."
                  className="w-full pl-7 pr-2.5 py-1.5 rounded-lg text-[11.5px] border outline-none transition-all"
                  style={{ background: 'var(--surface-0)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
                />
              </div>
              <div className="flex items-center gap-1 text-[10.5px]">
                <button
                  onClick={() => setHistoryFilter('case')}
                  className={`px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    historyFilter === 'case'
                      ? 'bg-indigo-500/15 text-indigo-600 font-bold'
                      : 'text-[var(--ink-secondary)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  This Case
                </button>
                <button
                  onClick={() => setHistoryFilter('all')}
                  className={`px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    historyFilter === 'all'
                      ? 'bg-indigo-500/15 text-indigo-600 font-bold'
                      : 'text-[var(--ink-secondary)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  All Cases
                </button>
              </div>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
              {displaySessions.length === 0 ? (
                <div className="py-8 px-4 text-center space-y-1.5">
                  <MessageSquare size={22} className="mx-auto opacity-20" />
                  <p className="text-[11.5px] font-medium text-[var(--ink-tertiary)]">
                    {historySearch ? 'No matching chats found' : 'No previous chats yet'}
                  </p>
                  <p className="text-[10px] text-[var(--ink-tertiary)]">
                    Chats for this case will be saved here automatically.
                  </p>
                </div>
              ) : (
                displaySessions.map((s) => {
                  const isSelected = s.id === currentSessionId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectSession(s)}
                      className={`group relative p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-500/60 bg-indigo-500/10 shadow-sm'
                          : 'hover:bg-[var(--surface-2)]'
                      }`}
                      style={{ borderColor: isSelected ? 'var(--accent)' : 'var(--border)' }}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span
                          className="text-[12px] font-semibold truncate leading-tight flex-1"
                          style={{ color: isSelected ? 'var(--accent)' : 'var(--ink-primary)' }}
                        >
                          {s.title}
                        </span>
                        <button
                          onClick={(e) => handleDeleteSession(e, s.id)}
                          title="Delete session"
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/10 hover:text-rose-500 text-[var(--ink-tertiary)] transition-all shrink-0"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-[10px] text-[var(--ink-tertiary)]">
                        <span className="font-mono truncate max-w-[120px]">{s.caseNumber}</span>
                        <span>{formatRelativeTime(s.timestamp)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        ) : (
          <button
            onClick={() => setIsHistoryOpen(true)}
            title="Open chat history"
            className="h-11 px-3 rounded-2xl border flex items-center gap-2 text-[12px] font-semibold shrink-0 shadow-sm transition-all hover:bg-[var(--surface-2)] cursor-pointer"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
          >
            <PanelLeftOpen size={16} className="text-indigo-500" />
            <span className="hidden sm:inline">History ({displaySessions.length})</span>
          </button>
        )}

        {/* ── CHAT COLUMN ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div
            className="rounded-3xl border flex flex-col overflow-hidden"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-1)', height: '620px' }}
          >
            {/* Top Bar inside Chat with Toggle History button */}
            <div
              className="px-4 py-2.5 border-b flex items-center justify-between gap-3 text-[12px]"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsHistoryOpen((v) => !v)}
                  title={isHistoryOpen ? 'Collapse chat history' : 'Open chat history'}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all hover:bg-[var(--surface-3)] cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
                >
                  {isHistoryOpen ? (
                    <>
                      <PanelLeftClose size={13} className="text-indigo-500" />
                      <span className="hidden sm:inline">Hide History</span>
                    </>
                  ) : (
                    <>
                      <PanelLeftOpen size={13} className="text-indigo-500" />
                      <span>History ({displaySessions.length})</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleNewChat}
                  title="Start fresh chat"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all hover:bg-[var(--surface-3)] cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
                >
                  <Plus size={12} />
                  <span className="hidden sm:inline">New Thread</span>
                </button>
              </div>

              {selectedCase && (
                <div className="flex items-center gap-2 text-[11px] text-[var(--ink-tertiary)] truncate">
                  <span className="font-mono font-bold text-indigo-500">{selectedCase.case_number}</span>
                  <span className="hidden md:inline truncate max-w-[200px]">{selectedCase.title}</span>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {messages.map((msg) => {
                const isAI = msg.role === 'assistant';
                return (
                  <div key={msg.id} className={`flex items-start gap-3.5 ${isAI ? '' : 'flex-row-reverse'}`}>
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow"
                      style={{ background: isAI ? 'linear-gradient(135deg,#6366F1 0%,#4F46E5 100%)' : 'var(--accent)' }}
                    >
                      {isAI ? <Bot size={17} /> : <User size={17} />}
                    </div>
                    <div
                      className={`p-4 rounded-2xl max-w-[86%] border shadow-sm space-y-3 ${isAI ? '' : ''}`}
                      style={{
                        background: isAI ? 'var(--surface-0)' : 'var(--accent-muted)',
                        borderColor: isAI ? (msg.error ? '#EF444433' : 'var(--border)') : 'var(--accent-subtle)',
                      }}
                    >
                      <MessageBody content={msg.content} />

                      {/* Footer: sources + grounding */}
                      {isAI && (msg.sources?.length || msg.groundingLevel) && (
                        <div className="pt-2.5 border-t space-y-2 text-[11.5px]" style={{ borderColor: 'var(--border)' }}>
                          {msg.groundingLevel && <GroundingBadge level={msg.groundingLevel} />}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ink-tertiary)' }}>
                                Sources:
                              </span>
                              {msg.sources.map((s) => <SourceBadge key={s} label={s} />)}
                            </div>
                          )}
                          {msg.error && (
                            <button
                              onClick={handleRetry}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-all hover:opacity-90 cursor-pointer"
                              style={{ background: 'linear-gradient(135deg,#6366F1,#4F46E5)' }}
                            >
                              <RefreshCw size={12} /> Retry
                            </button>
                          )}
                          <div className="text-[10.5px] text-amber-500 flex items-center gap-1">
                            <AlertTriangle size={10} />
                            Analytical lead only. Investigator verification required.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && <LoadingBubble step={loadStep} />}
              <div ref={chatBottomRef} />
            </div>

            {/* Input bar */}
            <div
              className="p-4 border-t flex items-center gap-2.5"
              style={{ borderColor: 'var(--border)', background: 'var(--surface-0)' }}
            >
              {selectedCase && (
                <span className="px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold shrink-0 hidden sm:block"
                  style={{ background: 'var(--surface-2)', color: 'var(--ink-tertiary)', border: '1px solid var(--border)' }}>
                  {selectedCase.case_number}
                </span>
              )}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder={
                  selectedCase
                    ? `Ask KAVA about ${selectedCase.case_number}…`
                    : 'Select a case to begin investigation analysis…'
                }
                disabled={!selectedCaseId || loading}
                className="flex-1 h-11 px-4 rounded-xl border text-[13.5px] outline-none transition-all focus:border-indigo-500 disabled:opacity-50"
                style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading || !selectedCaseId}
                className="h-11 px-5 rounded-xl font-bold text-white shadow-md flex items-center gap-2 transition-all hover:opacity-90 disabled:opacity-40 cursor-pointer"
                style={{ background: 'linear-gradient(135deg,#6366F1 0%,#4F46E5 100%)' }}
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                <span className="hidden sm:inline">{loading ? 'Analyzing…' : 'Send'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── CONTEXT PANEL (right, hidden on small screens) ───────────────── */}
        <div className="w-72 shrink-0 hidden xl:block sticky top-4">
          <ContextPanel case={selectedCase} stats={lastStats} />

          {/* No cases empty state */}
          {!casesLoading && availableCases.length === 0 && (
            <div className="mt-4 rounded-2xl border p-5 text-center space-y-3"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
              <p className="text-[13px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
                No investigation cases available.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => router.push('/cases/new')}
                  className="w-full py-2 rounded-xl text-[12.5px] font-bold text-white cursor-pointer hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg,#6366F1,#4F46E5)' }}
                >
                  Create Case
                </button>
                <button
                  onClick={() => router.push('/fir/upload')}
                  className="w-full py-2 rounded-xl border text-[12.5px] font-semibold cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
                >
                  Upload FIR
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
