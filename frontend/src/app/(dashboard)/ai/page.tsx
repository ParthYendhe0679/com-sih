'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { openInspector } from '@/store/slices/uiSlice';
import { mockAIService } from '@/services/mockServices';
import { cases } from '@/mock/cases';
import type { AIMessage } from '@/types';
import {
  Bot,
  User,
  Sparkles,
  Send,
  AlertTriangle,
  ChevronDown,
  ShieldCheck,
  FolderOpen,
  HelpCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

export default function KAVAAIPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Case Context
  const [selectedCaseId, setSelectedCaseId] = useState('CASE-102');
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedCase = cases.find((c) => c.id === selectedCaseId) || cases[0];

  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'msg-0',
      role: 'assistant',
      content:
        'Welcome to **KAVA AI** — Criminal Case Intelligence Assistant.\n\nI am grounded in active investigation data for **CASE-102** (*Organized Financial Fraud Investigation*). I have cross-correlated the underlying FIR, 31 network entities, 55 relationships, verified banking ledgers, and historical precedents.\n\nYou can query entity connections, ask for evidentiary proof, inspect timeline anomalies, or analyze modus operandi similarities. Select a suggested inquiry below or enter your tactical question.',
      timestamp: new Date().toISOString(),
      confidence: 96,
      sources: [{ id: 'CASE-102', type: 'Case', title: 'CASE-102 (Flagship)' }],
    },
  ]);

  const suggestedQuestions = mockAIService.getSuggestedQuestions();

  const handleSend = useCallback(async (textToSend?: string) => {
    const query = textToSend || inputQuery;
    if (!query.trim() || loading) return;

    const userMsg: AIMessage = {
      id: `usr-${Math.random().toString(36).substring(2, 9)}`,
      role: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const aiReply = await mockAIService.ask(query);
      setMessages((prev) => [...prev, aiReply]);
    } catch {
      toast.error('Error generating AI analysis');
    } finally {
      setLoading(false);
    }
  }, [inputQuery, loading]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleCaseChange = (newCaseId: string) => {
    setSelectedCaseId(newCaseId);
    toast.info(`KAVA AI context switched to ${newCaseId}`);
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        role: 'assistant',
        content: `**Investigative Context Updated:** Switched to **${newCaseId}** (*${
          cases.find((c) => c.id === newCaseId)?.title || 'Case Dossier'
        }*). All subsequent queries will be grounded in records associated with this case.`,
        timestamp: new Date().toISOString(),
        confidence: 98,
        sources: [{ id: newCaseId, type: 'Case', title: newCaseId }],
      },
    ]);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-12">
      {/* ── HEADER & CASE CONTEXT (Part 16) ──────────────────────── */}
      <div
        className="p-6 md:p-8 rounded-3xl border glass-panel transition-all"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)' }}
            >
              <Bot size={30} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10.5px] font-mono-id uppercase px-2.5 py-0.5 rounded-full font-bold tracking-widest bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  CASE INTELLIGENCE ASSISTANT
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs font-mono-id text-gray-400">GROUNDED REASONING</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
                KAVA AI
              </h1>
              <p className="text-[14px] mt-1 font-medium" style={{ color: 'var(--ink-secondary)' }}>
                Investigative assistant grounded strictly in verified case facts, evidence ledgers, and network relationships.
              </p>
            </div>
          </div>

          {/* Right: Case Context Switcher */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1">
                Active Case Grounding Context
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
                  {cases.map((c, idx) => (
                    <option key={`${c.id}-${idx}`} value={c.id}>
                      {c.id} — {c.crime} ({c.city})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
            </div>

            <button
              onClick={() => router.push(`/cases/${selectedCaseId}`)}
              className="self-end sm:self-auto px-4 py-2.5 mt-4 rounded-xl text-[12.5px] font-semibold border hover:bg-[var(--surface-2)] transition-colors flex items-center gap-1.5 cursor-pointer"
              style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
            >
              <FolderOpen size={14} />
              <span>Open Workspace</span>
            </button>
          </div>
        </div>

        {/* Investigator Notice */}
        <div className="mt-5 pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-[12px]">
          <div className="flex items-center gap-2 text-amber-500 font-medium">
            <AlertTriangle size={14} />
            <span>KAVA AI outputs provide investigative assistance only. The investigator remains the final decision maker.</span>
          </div>
          <div className="font-mono-id text-gray-400">
            Target: <strong>{selectedCase.id}</strong> ({selectedCase.title})
          </div>
        </div>
      </div>

      {/* ── SUGGESTED QUESTIONS (Part 16) ─────────────────────────── */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)] block">
          Suggested Investigative Inquiries:
        </span>
        <div className="flex flex-wrap gap-2">
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              className="px-3.5 py-2 rounded-xl border text-[12.5px] hover:bg-[var(--surface-2)] hover:border-indigo-500/40 transition-all text-left font-medium cursor-pointer shadow-sm"
              style={{
                background: 'var(--surface-1)',
                borderColor: 'var(--border)',
                color: 'var(--ink-secondary)',
              }}
            >
              &ldquo;{q}&rdquo;
            </button>
          ))}
        </div>
      </div>

      {/* ── CHAT VIEWPORT ─────────────────────────────────────────── */}
      <div
        className="rounded-3xl border flex flex-col h-[620px] overflow-hidden glass-panel"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}
      >
        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5">
          {messages.map((msg) => {
            const isAI = msg.role === 'assistant';
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3.5 ${isAI ? '' : 'flex-row-reverse'}`}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-white text-[13px] shadow-sm"
                  style={{
                    background: isAI ? 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)' : 'var(--accent)',
                  }}
                >
                  {isAI ? <Bot size={18} /> : <User size={18} />}
                </div>

                <div
                  className={`p-5 rounded-2xl max-w-[88%] text-[13.5px] leading-relaxed border space-y-3.5 shadow-sm ${
                    isAI ? 'bg-[var(--surface-0)]' : 'bg-[var(--accent-muted)]'
                  }`}
                  style={{
                    borderColor: isAI ? 'var(--border)' : 'var(--accent-subtle)',
                    color: 'var(--ink-primary)',
                  }}
                >
                  {/* Message body */}
                  <div className="whitespace-pre-wrap font-sans space-y-2">
                    {msg.content}
                  </div>

                  {/* Grounded Sources, Entities, & Confidence */}
                  {isAI && (msg.sources?.length || msg.entities?.length || msg.confidence) ? (
                    <div className="pt-3 border-t space-y-2.5 text-[11.5px]" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {/* Linked Cases */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-[var(--ink-tertiary)] uppercase text-[10px]">
                            Related Cases:
                          </span>
                          {msg.sources?.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => router.push(`/cases/${s.id}`)}
                              className="font-mono-id px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 font-semibold hover:underline border border-indigo-500/20"
                            >
                              {s.id}
                            </button>
                          ))}
                        </div>

                        {/* Confidence score */}
                        {msg.confidence && (
                          <div className="font-mono-id font-bold text-emerald-500 flex items-center gap-1">
                            <ShieldCheck size={13} />
                            <span>Corroboration: {msg.confidence}%</span>
                          </div>
                        )}
                      </div>

                      {/* Linked Entities */}
                      {msg.entities && msg.entities.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-[var(--ink-tertiary)] uppercase text-[10px]">
                            Referenced Entities:
                          </span>
                          {msg.entities.map((ent) => (
                            <button
                              key={ent.id}
                              onClick={() => dispatch(openInspector({ id: ent.id, type: ent.type }))}
                              className="px-2 py-0.5 rounded-md text-[11px] border font-mono-id text-[var(--ink-primary)] hover:border-indigo-500 transition-colors"
                              style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
                            >
                              {ent.name} ({ent.id})
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Investigator signoff reminder */}
                      <div className="text-[11px] text-amber-500 flex items-center gap-1 pt-1">
                        <span>⚠ Analytical lead only. Investigator verification required.</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-3.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-[13px] shadow-sm"
                style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)' }}
              >
                <Bot size={18} />
              </div>
              <div
                className="p-4 rounded-2xl border text-[13px] flex items-center gap-2.5 shadow-sm"
                style={{ background: 'var(--surface-0)', borderColor: 'var(--border)' }}
              >
                <Sparkles size={16} className="animate-spin text-indigo-400" />
                <span className="text-[var(--ink-secondary)]">
                  KAVA AI is querying case ledgers, resolving entities, and synthesizing cross-case paths...
                </span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Input Bar */}
        <div
          className="p-4 border-t flex items-center gap-2.5"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-0)' }}
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask KAVA AI about CASE-102 entities, evidence, or connections..."
            className="flex-1 h-11 px-4 rounded-xl border text-[13.5px] outline-none transition-all focus:border-indigo-500"
            style={{
              background: 'var(--surface-1)',
              borderColor: 'var(--border)',
              color: 'var(--ink-primary)',
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputQuery.trim() || loading}
            className="h-11 px-5 rounded-xl font-bold text-white shadow-md flex items-center gap-2 transition-all hover:opacity-90 disabled:opacity-40 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)' }}
          >
            <Send size={15} />
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
