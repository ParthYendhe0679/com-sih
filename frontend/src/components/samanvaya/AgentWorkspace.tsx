'use client';

// ============================================================
// STEPS 3-7 — the five agents.
// A vertical rail of agent cards on the left; the selected agent's
// live console, metrics and findings on the right. Consoles reveal
// their lines progressively while an agent is running so processing
// is visible rather than merely asserted.
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Terminal,
  ArrowDown,
  AlertTriangle,
  Loader2,
  CircleDashed,
  Database,
  ShieldQuestion,
  CornerDownRight,
} from 'lucide-react';
import type { AgentCardData, TelemetryLine } from '@/lib/api/samanvaya';
import { AGENTS, TELEMETRY_COLORS, tint, fmt } from './theme';
import { Panel, Badge, MetricTile, EmptyState, SectionHeading } from './primitives';

export interface MergedAgent {
  agentId: string;
  agentNumber: number;
  displayName: string;
  shortName: string;
  sanskritName: string;
  role: string;
  purpose: string;
  color: string;
  icon: React.ComponentType<{ size?: number }>;
  live: AgentCardData | null;
  status: 'WAITING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

/** Fuse the static agent identities with whatever telemetry has arrived. */
export function mergeAgents(
  cards: AgentCardData[],
  currentAgentIndex: number,
  running: boolean,
  failed: boolean
): MergedAgent[] {
  return AGENTS.map((meta) => {
    const live = cards.find((c) => c.agentNumber === meta.agentNumber) || null;
    let status: MergedAgent['status'] = 'WAITING';
    if (live) status = live.status;
    else if (failed && currentAgentIndex === meta.agentNumber) status = 'FAILED';
    else if (running && currentAgentIndex === meta.agentNumber) status = 'PROCESSING';

    return {
      agentId: meta.agentId,
      agentNumber: meta.agentNumber,
      displayName: live?.name || meta.name,
      shortName: meta.shortName,
      sanskritName: meta.sanskritName,
      role: meta.role,
      purpose: meta.purpose,
      color: meta.color,
      icon: meta.icon,
      live,
      status,
    };
  });
}

export default function AgentWorkspace({
  agents,
  selectedId,
  onSelect,
  running,
}: {
  agents: MergedAgent[];
  selectedId: string;
  onSelect: (id: string) => void;
  running: boolean;
}) {
  const active = agents.find((a) => a.agentId === selectedId) || agents[0];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* ── Vertical agent rail ────────────────────────── */}
      <div className="xl:col-span-4 space-y-2.5">
        {agents.map((a, i) => (
          <React.Fragment key={a.agentId}>
            <AgentRailCard agent={a} selected={a.agentId === selectedId} onSelect={() => onSelect(a.agentId)} />
            {i < agents.length - 1 && (
              <div className="flex justify-center py-0.5" aria-hidden>
                <ArrowDown
                  size={14}
                  style={{
                    color: a.status === 'COMPLETED' ? a.color : 'var(--border-strong)',
                  }}
                  className={a.status === 'COMPLETED' && running ? 'animate-bounce' : ''}
                />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── Selected agent detail ──────────────────────── */}
      <div className="xl:col-span-8 space-y-5">
        {active && <AgentDetail agent={active} />}
      </div>
    </div>
  );
}

// ── Rail card ───────────────────────────────────────────────
function AgentRailCard({
  agent,
  selected,
  onSelect,
}: {
  agent: MergedAgent;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = agent.icon;
  const done = agent.status === 'COMPLETED';
  const processing = agent.status === 'PROCESSING';
  const failed = agent.status === 'FAILED';
  const waiting = agent.status === 'WAITING';
  const accent = failed ? '#DC2626' : agent.color;

  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className="w-full text-left rounded-xl border p-3.5 transition-all cursor-pointer"
      style={{
        background: waiting ? 'var(--surface-2)' : tint(accent, 0.07),
        borderColor: selected ? accent : tint(accent, waiting ? 0.14 : 0.3),
        boxShadow: selected ? `0 0 0 2px ${tint(accent, 0.35)}` : 'none',
        opacity: waiting ? 0.72 : 1,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${processing ? 'animate-pulse' : ''}`}
          style={{
            background: waiting ? 'var(--surface-3)' : accent,
            color: waiting ? 'var(--ink-tertiary)' : '#FFFFFF',
          }}
        >
          {done ? <Check size={17} /> : processing ? <Loader2 size={17} className="animate-spin" /> : <Icon size={17} />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: accent }}>
              Agent {agent.agentNumber}
            </span>

          </div>
          <div className="text-[13px] font-semibold text-[var(--ink-primary)] leading-snug mt-0.5">
            {agent.displayName}
          </div>
          <div className="text-[11px] text-[var(--ink-secondary)] mt-0.5 leading-snug">{agent.role}</div>

          {agent.live ? (
            <div className="flex items-center gap-3 mt-2 text-[10.5px] font-mono text-[var(--ink-tertiary)]">
              <span>
                records checked <strong className="text-[var(--ink-primary)]">{fmt(agent.live.recordsSearched)}</strong>
              </span>
              <span>
                useful <strong style={{ color: accent }}>{fmt(agent.live.relevantFound)}</strong>
              </span>
              <span>{(agent.live.executionTimeMs / 1000).toFixed(2)}s</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-2 text-[10.5px] text-[var(--ink-tertiary)]">
              {processing ? (
                <>
                  <Loader2 size={10} className="animate-spin" /> working…
                </>
              ) : failed ? (
                <>
                  <AlertTriangle size={10} /> failed
                </>
              ) : (
                <>
                  <CircleDashed size={10} /> waiting for the previous step
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Detail pane ─────────────────────────────────────────────
function AgentDetail({ agent }: { agent: MergedAgent }) {
  const live = agent.live;
  const Icon = agent.icon;

  if (!live) {
    return (
      <Panel accent={agent.color}>
        <SectionHeading
          icon={Icon as any}
          title={`Agent ${agent.agentNumber} — ${agent.displayName}`}
          subtitle={agent.sanskritName}
          accent={agent.color}
        />
        <div className="mt-4">
          <EmptyState
            icon={agent.agentNumber === 1 ? Database : CircleDashed}
            accent={agent.color}
            title={
              agent.status === 'PROCESSING'
                ? 'Analysis in progress'
                : agent.status === 'FAILED'
                  ? 'This agent did not complete'
                  : `Waiting for Agent ${agent.agentNumber - 1}`
            }
            message={
              agent.status === 'PROCESSING'
                ? agent.purpose
                : agent.status === 'FAILED'
                  ? 'The analysis stopped here. Check the activity log below, then run it again.'
                  : agent.agentNumber === 1
                    ? 'Start the analysis to begin case context extraction.'
                    : `${agent.purpose} It begins once Agent ${agent.agentNumber - 1} hands over its findings.`
            }
          />
        </div>
      </Panel>
    );
  }

  return (
    <>
      <Panel accent={agent.color}>
        <SectionHeading
          icon={Icon as any}
          title={`Agent ${agent.agentNumber} — ${agent.displayName}`}
          subtitle={agent.purpose}
          accent={agent.color}
          right={
            <div className="flex items-center gap-2">
              <Badge color={agent.color} solid>
                {live.status}
              </Badge>
              <Badge color="#9CA3AF">{live.executionTimeMs.toFixed(0)} ms</Badge>
            </div>
          }
        />

        {/* Metrics */}
        {live.metrics.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {live.metrics.map((m) => (
              <MetricTile
                key={m.label}
                label={m.label}
                value={m.value}
                unit={m.unit}
                hint={m.hint}
                animate
                color={
                  m.tone === 'critical'
                    ? '#DC2626'
                    : m.tone === 'warning'
                      ? '#D97706'
                      : m.tone === 'positive'
                        ? '#16A34A'
                        : m.tone === 'info'
                          ? '#2563EB'
                          : '#9CA3AF'
                }
              />
            ))}
          </div>
        )}

        {/* What it found */}
        {live.highlights.length > 0 && (
          <div className="mt-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-tertiary)] mb-2">
              What this agent found
            </div>
            <ul className="space-y-1.5">
              {live.highlights.map((h, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-[12.5px] leading-relaxed text-[var(--ink-secondary)]"
                >
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Data sources */}
        <div className="mt-5 flex flex-wrap items-center gap-1.5">
          {live.dataSources.map((d) => (
            <span
              key={d}
              className="px-2 py-0.5 rounded-md text-[10.5px] font-semibold border"
              style={{
                background: tint(agent.color, 0.08),
                borderColor: tint(agent.color, 0.24),
                color: agent.color,
              }}
            >
              {d}
            </span>
          ))}
        </div>

        {/* Handoff */}
        {live.handoff && (
          <div
            className="mt-5 rounded-xl border px-4 py-3 flex items-start gap-2"
            style={{ background: tint(agent.color, 0.06), borderColor: tint(agent.color, 0.26) }}
          >
            <CornerDownRight size={14} className="shrink-0 mt-0.5" style={{ color: agent.color }} />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: agent.color }}>
                Sent to the next step
              </div>
              <div className="text-[12.5px] text-[var(--ink-secondary)] mt-0.5 leading-relaxed">{live.handoff}</div>
            </div>
          </div>
        )}
      </Panel>

      {/* Console */}
      <AgentConsole
        lines={live.telemetry}
        color={agent.color}
        title={`Agent ${String(agent.agentNumber).padStart(2, '0')} processing log`}
        animate={agent.status === 'PROCESSING'}
      />

      {/* Limitations */}
      {live.limitations.length > 0 && (
        <Panel>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#D97706]">
            <ShieldQuestion size={13} />
            What we could not confirm
          </div>
          <ul className="mt-2.5 space-y-1.5">
            {live.limitations.map((l, i) => (
              <li key={i} className="text-[12.5px] text-[var(--ink-secondary)] leading-relaxed flex items-start gap-2">
                <AlertTriangle size={12} className="shrink-0 mt-1 text-[#D97706]" />
                {l}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

// ── Progressive console ─────────────────────────────────────
export function AgentConsole({
  lines,
  color,
  title,
  animate = false,
  defaultOpen = true,
  maxHeight = 260,
}: {
  lines: TelemetryLine[];
  color: string;
  title: string;
  animate?: boolean;
  defaultOpen?: boolean;
  maxHeight?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [revealed, setRevealed] = useState(animate ? 0 : lines.length);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reveal lines one at a time so the log reads as work happening.
  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setRevealed((r) => (r >= lines.length ? r : r + 1));
    }, 180);
    return () => window.clearInterval(id);
  }, [lines.length, animate]);

  // Derived, so a finished agent shows its whole log without an extra commit.
  const revealCount = animate ? Math.min(revealed, lines.length) : lines.length;

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [revealCount, open]);

  const shown = useMemo(() => lines.slice(0, revealCount), [lines, revealCount]);

  if (lines.length === 0) return null;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Terminal size={14} style={{ color }} />
          <span className="text-[12.5px] font-semibold text-[var(--ink-primary)] truncate">{title}</span>
          <span className="text-[10.5px] font-mono text-[var(--ink-tertiary)]">{lines.length} lines</span>
        </span>
        <ChevronDown
          size={15}
          className="shrink-0 transition-transform text-[var(--ink-tertiary)]"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {open && (
        <div
          ref={scrollRef}
          className="px-4 pb-4 overflow-y-auto custom-scrollbar font-mono text-[11.5px] leading-relaxed"
          style={{ maxHeight, background: 'var(--surface-2)' }}
        >
          {shown.map((l, i) => {
            const c = TELEMETRY_COLORS[l.level] || '#9CA3AF';
            return (
              <div key={i} className="flex items-start gap-2 py-[3px]">
                <span className="text-[var(--ink-tertiary)] shrink-0 tabular-nums">{l.ts}</span>
                <span className="shrink-0 font-semibold w-[38px]" style={{ color: c }}>
                  {l.level === 'OK' ? '✓' : l.level === 'WORK' ? '›' : l.level === 'WARN' ? '!' : l.level === 'ERROR' ? '✕' : '·'}
                </span>
                <span className="min-w-0">
                  <span className="text-[var(--ink-primary)]">{l.text}</span>
                  {l.detail && <span className="text-[var(--ink-tertiary)]"> — {l.detail}</span>}
                  {typeof l.progress === 'number' && (
                    <span
                      className="inline-block align-middle ml-2 h-1.5 w-24 rounded-full overflow-hidden"
                      style={{ background: 'var(--surface-3)' }}
                    >
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${l.progress}%`, background: c }}
                      />
                    </span>
                  )}
                </span>
              </div>
            );
          })}
          {animate && revealCount < lines.length && (
            <div className="flex items-center gap-2 py-1 text-[var(--ink-tertiary)]">
              <Loader2 size={11} className="animate-spin" /> streaming…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
