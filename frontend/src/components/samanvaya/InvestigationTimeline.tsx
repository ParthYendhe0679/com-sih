'use client';

// ============================================================
// Chronological reconstruction. Each event carries its type, its
// source and the agent that surfaced it, so the officer can trace
// any entry back to the record it came from.
// ============================================================

import React, { useMemo, useState } from 'react';
import { Clock, Filter } from 'lucide-react';
import type { TimelineEvent } from '@/lib/api/samanvaya';
import { Panel, SectionHeading, Badge, EmptyState, ConfidenceBar } from './primitives';
import { typeStyle, tint } from './theme';

const EVENT_COLOR: Record<string, string> = {
  CASE: '#12376E',
  COMMUNICATION: '#5B4BC4',
  MOVEMENT: '#D97706',
  EVIDENCE: '#DC2626',
  HISTORICAL: '#5B4BC4',
  ANALYSIS: '#16A34A',
};

export default function InvestigationTimeline({ events }: { events: TimelineEvent[] }) {
  const [filter, setFilter] = useState<string>('ALL');

  const types = useMemo(() => Array.from(new Set(events.map((e) => e.eventType))), [events]);
  const shown = useMemo(
    () => (filter === 'ALL' ? events : events.filter((e) => e.eventType === filter)),
    [events, filter]
  );

  if (events.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={Clock}
          title="No timeline reconstructed"
          message="The chronological timeline is assembled from case dates, communication windows and historical precedents once the SAMANVAYA analysis has run."
        />
      </Panel>
    );
  }

  return (
    <Panel>
      <SectionHeading
        icon={Clock}
        title="Chronological timeline"
        subtitle={`${events.length} correlated event${events.length === 1 ? '' : 's'}`}
        accent="#0F766E"
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter size={13} className="text-[var(--ink-tertiary)]" />
            {['ALL', ...types].map((t) => {
              const active = filter === t;
              const c = t === 'ALL' ? '#12376E' : EVENT_COLOR[t] || '#9CA3AF';
              return (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border cursor-pointer transition-colors"
                  style={{
                    background: active ? tint(c, 0.14) : 'transparent',
                    borderColor: active ? c : 'var(--border-strong)',
                    color: active ? c : 'var(--ink-tertiary)',
                  }}
                >
                  {t === 'ALL' ? `All (${events.length})` : t}
                </button>
              );
            })}
          </div>
        }
      />

      <ol className="mt-5 relative pl-8">
        {/* Spine */}
        <span
          className="absolute left-[13px] top-2 bottom-2 w-[2px] rounded-full"
          style={{ background: 'var(--border-strong)' }}
          aria-hidden
        />

        {shown.map((e) => {
          const c = EVENT_COLOR[e.eventType] || typeStyle(e.eventType).color;
          return (
            <li key={e.id} className="relative pb-5 last:pb-0">
              <span
                className="absolute -left-8 top-1 w-[26px] h-[26px] rounded-full border-[3px] flex items-center justify-center"
                style={{ background: c, borderColor: 'var(--surface-1)' }}
                aria-hidden
              />
              <div
                className="rounded-xl border px-4 py-3"
                style={{ background: tint(c, 0.045), borderColor: tint(c, 0.26) }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-semibold font-mono" style={{ color: c }}>
                    {e.time}
                  </span>
                  <Badge color={c}>{e.eventType}</Badge>
                </div>
                <h4 className="text-[13.5px] font-semibold text-[var(--ink-primary)] mt-1.5 leading-snug">{e.title}</h4>
                {e.description && (
                  <p className="text-[12.5px] text-[var(--ink-secondary)] mt-1 leading-relaxed">{e.description}</p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 mt-2.5">
                  <span className="text-[10.5px] text-[var(--ink-tertiary)]">
                    {e.source} · {e.agent}
                  </span>
                  <span className="w-28">
                    <ConfidenceBar value={e.confidence} color={c} compact />
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
