'use client';

// ============================================================
// The investigation pipeline rail — where am I, what is running,
// what is still ahead. Completed stages carry a check, the active
// stage pulses, future stages stay muted.
// ============================================================

import React from 'react';
import { Check, FolderOpen, Database, FileCheck2, Loader2 } from 'lucide-react';
import { AGENTS, tint } from './theme';

export type StageState = 'done' | 'active' | 'pending' | 'failed';

/** A soft fill per stage so the rail reads as a sequence of distinct steps
 *  rather than one repeated block of colour. */
const STAGE_TINT: Record<string, { fill: string; ink: string }> = {
  case:    { fill: 'var(--pastel-sky)',   ink: 'var(--pastel-sky-ink)' },
  ingest:  { fill: 'var(--pastel-teal)',  ink: 'var(--pastel-teal-ink)' },
  'agent-1': { fill: 'var(--pastel-mint)',  ink: 'var(--pastel-mint-ink)' },
  'agent-2': { fill: 'var(--pastel-lilac)', ink: 'var(--pastel-lilac-ink)' },
  'agent-3': { fill: 'var(--pastel-sky)',   ink: 'var(--pastel-sky-ink)' },
  'agent-4': { fill: 'var(--pastel-peach)', ink: 'var(--pastel-peach-ink)' },
  'agent-5': { fill: 'var(--pastel-rose)',  ink: 'var(--pastel-rose-ink)' },
  report:  { fill: 'var(--pastel-sand)',  ink: 'var(--pastel-sand-ink)' },
};

/** Short, plain names for the rail — what each step actually does. */
const RAIL_LABELS: Record<number, string> = {
  1: 'Read case',
  2: 'Match people',
  3: 'Link chart',
  4: 'Old cases',
  5: 'Write report',
};

export interface RailStage {
  key: string;
  label: string;
  caption: string;
  color: string;
  icon: React.ComponentType<{ size?: number }>;
  state: StageState;
  progress?: number;
}

/** Build the eight-stage rail from live pipeline state. */
export function buildStages(opts: {
  hasCase: boolean;
  sourcesConnected: number;
  currentAgentIndex: number;
  running: boolean;
  complete: boolean;
  failed: boolean;
}): RailStage[] {
  const { hasCase, sourcesConnected, currentAgentIndex, running, complete, failed } = opts;

  const agentState = (n: number): StageState => {
    if (failed && currentAgentIndex === n) return 'failed';
    if (complete) return 'done';
    if (!running) return 'pending';
    if (currentAgentIndex > n) return 'done';
    if (currentAgentIndex === n) return 'active';
    return 'pending';
  };

  return [
    {
      key: 'case',
      label: 'Case',
      caption: hasCase ? 'Selected' : 'Not selected',
      color: 'var(--ink-primary)',
      icon: FolderOpen,
      state: hasCase ? 'done' : 'active',
    },
    {
      key: 'ingest',
      label: 'Data',
      caption: sourcesConnected ? `${sourcesConnected} sources` : 'None connected',
      color: 'var(--ink-primary)',
      icon: Database,
      state: sourcesConnected > 0 ? 'done' : hasCase ? 'active' : 'pending',
    },
    // The rail is read at a glance, so each stage is named by what it does.
    // The Sanskrit codenames stay on the agent cards, not here.
    ...AGENTS.map((a) => ({
      key: a.agentId,
      label: RAIL_LABELS[a.agentNumber] ?? `Step ${a.agentNumber}`,
      caption: `Step ${a.agentNumber}`,
      color: 'var(--ink-primary)',
      icon: a.icon,
      state: agentState(a.agentNumber),
    })),
    {
      key: 'report',
      label: 'Final report',
      caption: complete ? 'Ready' : 'Pending',
      color: 'var(--ink-primary)',
      icon: FileCheck2,
      state: complete ? 'done' : 'pending',
    },
  ];
}

export default function PipelineRail({
  stages,
  progress,
  stageText,
  running,
}: {
  stages: RailStage[];
  progress: number;
  stageText: string;
  running: boolean;
}) {
  return (
    <div
      className="rounded-2xl border p-4 md:p-5"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2 min-w-0">
          {running && <Loader2 size={14} className="animate-spin shrink-0 text-[var(--accent)]" />}
          <span className="text-[12.5px] font-semibold text-[var(--ink-primary)] truncate">{stageText}</span>
        </div>
        <span className="text-[13px] font-semibold tabular-nums shrink-0" style={{ color: 'var(--accent)' }}>
          {progress}%
        </span>
      </div>

      {/* Overall progress */}
      <div className="h-1.5 rounded-full overflow-hidden mb-5" style={{ background: 'var(--surface-3)' }}>
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${progress}%`,
            background: 'var(--accent)',
          }}
        />
      </div>

      {/* Stage rail */}
      <ol className="flex items-stretch gap-1 overflow-x-auto pb-1 custom-scrollbar" aria-label="Investigation pipeline">
        {stages.map((s, i) => {
          const Icon = s.icon;
          const done = s.state === 'done';
          const active = s.state === 'active';
          const failed = s.state === 'failed';
          const dim = s.state === 'pending';
          const tintPair = STAGE_TINT[s.key] ?? { fill: 'var(--pastel-teal)', ink: 'var(--pastel-teal-ink)' };

          return (
            <li key={s.key} className="flex items-stretch shrink-0">
              <div
                className="rounded-xl border px-3 py-2.5 min-w-[104px] transition-all"
                style={{
                  background: failed ? 'var(--error-muted)' : dim ? 'var(--surface-1)' : tintPair.fill,
                  border: 'none',
                  opacity: dim ? 0.75 : 1,
                  boxShadow: dim ? 'inset 0 0 0 1px var(--border-strong)' : undefined,
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${active ? 'animate-pulse' : ''}`}
                    style={{
                      background: failed ? 'var(--error)' : dim ? 'var(--surface-3)' : tintPair.ink,
                      color: failed || !dim ? '#FFFFFF' : 'var(--ink-tertiary)',
                    }}
                  >
                    {done ? <Check size={13} /> : <Icon size={13} />}
                  </span>
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wide truncate"
                    style={{ color: dim ? 'var(--ink-tertiary)' : tintPair.ink }}
                  >
                    {s.label}
                  </span>
                </div>
                <div className="text-[10.5px] text-[var(--ink-secondary)] mt-1 truncate">{s.caption}</div>
              </div>

              {i < stages.length - 1 && (
                <span
                  className="self-center w-3 h-[2px] mx-0.5 rounded-full shrink-0"
                  style={{ background: done ? 'var(--border-strong)' : 'var(--border-strong)' }}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
