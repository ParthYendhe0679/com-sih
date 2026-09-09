'use client';

// ============================================================
// Communication intelligence — call volumes, daily activity and
// the anomalies flagged in the uploaded records.
//
// Language here is deliberately investigative: patterns are
// "anomalous" or "require review", never accusations.
// ============================================================

import React, { useMemo, useState } from 'react';
import { Phone, AlertTriangle, ArrowRight, Activity, Radio } from 'lucide-react';
import type { CDRAnalysis, SuspiciousPattern } from '@/lib/api/samanvaya';
import { Panel, SectionHeading, Badge, MetricTile, BarRow, EmptyState, ConfidenceBar } from './primitives';
import { SEVERITY_COLORS, tint, fmt } from './theme';

const PATTERN_LABEL: Record<string, string> = {
  VOLUME_SPIKE: 'Volume spike',
  DORMANT_REACTIVATION: 'Dormant reactivation',
  NEW_CONTACT_BEFORE_INCIDENT: 'New contact',
  PRE_INCIDENT_BURST: 'Pre-event burst',
  COMMUNICATION_CHAIN: 'Relay chain',
  POST_INCIDENT_SILENCE: 'Post-event silence',
  ODD_HOUR_ACTIVITY: 'Odd-hour activity',
};

export default function CommunicationAnalysis({
  cdr,
  onUploadRequest,
}: {
  cdr: CDRAnalysis | null;
  onUploadRequest?: () => void;
}) {
  const [selected, setSelected] = useState<SuspiciousPattern | null>(null);

  const maxCalls = useMemo(
    () => Math.max(1, ...(cdr?.parties || []).map((p) => p.totalCalls)),
    [cdr]
  );
  const maxDaily = useMemo(
    () => Math.max(1, ...(cdr?.dailyVolume || []).map((d) => d.calls)),
    [cdr]
  );

  if (!cdr) {
    return (
      <Panel>
        <EmptyState
          icon={Phone}
          title="No call records connected"
          message="Upload a call detail record export for this case to analyse call volumes, detect anomalous communication and place phone numbers into the investigation network."
          accent="#7C3AED"
          action={
            onUploadRequest && (
              <button
                onClick={onUploadRequest}
                className="px-4 py-2 rounded-lg text-[12.5px] font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
                style={{ background: '#7C3AED' }}
              >
                Go to data sources
              </button>
            )
          }
        />
      </Panel>
    );
  }

  const active = selected || cdr.patterns[0] || null;

  return (
    <div className="space-y-5">
      {/* ── Headline metrics ─────────────────────────────── */}
      <Panel>
        <SectionHeading
          icon={Phone}
          title="Communication analysis"
          subtitle={`${cdr.fileName} — ${cdr.windowStart || '?'} to ${cdr.windowEnd || '?'}`}
          accent="#7C3AED"
          right={
            cdr.incidentReference ? (
              <Badge color="#EA580C">Reference event {cdr.incidentReference}</Badge>
            ) : undefined
          }
        />
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricTile label="Records scanned" value={cdr.parsedRecords} color="#2563EB" animate />
          <MetricTile label="Relevant records" value={cdr.relevantRecords} color="#059669" animate />
          <MetricTile label="Filtered out" value={cdr.filteredOut} color="#64748B" animate />
          <MetricTile label="Distinct numbers" value={cdr.uniqueNumbers} color="#7C3AED" animate />
          <MetricTile label="Anomalies flagged" value={cdr.patterns.length} color="#DC2626" animate />
          <MetricTile label="Rejected rows" value={cdr.rejectedRecords} color="#EA580C" animate
            hint="Rows without a usable pair of numbers" />
        </div>
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* ── Call activity per party ───────────────────── */}
        <Panel className="xl:col-span-7">
          <SectionHeading
            icon={Activity}
            title="Call activity by number"
            subtitle="Total calls in the supplied window, ranked"
            accent="#2563EB"
          />
          <div className="mt-4 space-y-2.5">
            {cdr.parties.slice(0, 10).map((p) => (
              <BarRow
                key={p.number}
                label={p.number}
                sublabel={p.displayName || p.role}
                value={p.totalCalls}
                max={maxCalls}
                color={p.isNewContact ? '#DC2626' : '#2563EB'}
                highlight={p.isNewContact}
              />
            ))}
          </div>

          {/* Daily volume sparkline */}
          {cdr.dailyVolume.length > 1 && (
            <div className="mt-6 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)] mb-2.5">
                Daily call volume
              </div>
              <div className="flex items-end gap-[3px] h-24" role="img" aria-label="Daily call volume chart">
                {cdr.dailyVolume.map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 min-w-[3px] rounded-t transition-all"
                    style={{
                      height: `${Math.max(4, (d.calls / maxDaily) * 100)}%`,
                      background: d.isIncidentDay ? '#DC2626' : tint('#2563EB', 0.55),
                    }}
                    title={`${d.date}: ${d.calls} calls${d.isIncidentDay ? ' (reference event day)' : ''}`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[10px] text-[var(--ink-tertiary)] font-mono">
                <span>{cdr.dailyVolume[0]?.date}</span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-sm" style={{ background: '#DC2626' }} />
                  reference event day
                </span>
                <span>{cdr.dailyVolume[cdr.dailyVolume.length - 1]?.date}</span>
              </div>
            </div>
          )}
        </Panel>

        {/* ── Anomaly list ──────────────────────────────── */}
        <Panel className="xl:col-span-5">
          <SectionHeading
            icon={AlertTriangle}
            title="Anomalous patterns"
            subtitle={`${cdr.patterns.length} flagged for investigator review`}
            accent="#DC2626"
          />

          {cdr.patterns.length === 0 ? (
            <p className="mt-4 text-[12.5px] text-[var(--ink-secondary)] leading-relaxed">
              No communication anomalies exceeded the detection thresholds in this dataset.
            </p>
          ) : (
            <div className="mt-4 space-y-2 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
              {cdr.patterns.map((p) => {
                const c = SEVERITY_COLORS[p.severity] || '#0891B2';
                const isActive = active?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className="w-full text-left rounded-xl border px-3.5 py-3 transition-all cursor-pointer"
                    style={{
                      background: isActive ? tint(c, 0.09) : 'var(--surface-2)',
                      borderColor: isActive ? c : 'var(--border)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-bold text-[var(--ink-primary)] truncate">{p.title}</span>
                      <Badge color={c}>{p.severity}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 text-[11.5px] font-mono text-[var(--ink-secondary)] min-w-0">
                      <span className="truncate">{p.partyA}</span>
                      {p.partyB && (
                        <>
                          <ArrowRight size={11} className="shrink-0" />
                          <span className="truncate">{p.partyB}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-2">
                      <ConfidenceBar value={p.riskScore} color={c} label="Anomaly strength" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Selected anomaly detail ─────────────────────── */}
      {active && (
        <Panel accent={SEVERITY_COLORS[active.severity]}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={SEVERITY_COLORS[active.severity]} solid>
              {PATTERN_LABEL[active.patternType] || active.patternType}
            </Badge>
            <h4 className="text-[15px] font-bold text-[var(--ink-primary)]">{active.title}</h4>
            {active.window && (
              <span className="text-[11px] font-mono text-[var(--ink-tertiary)]">{active.window}</span>
            )}
          </div>

          <p className="text-[13px] text-[var(--ink-secondary)] mt-2.5 leading-relaxed max-w-3xl">
            {active.description}
          </p>

          {/* Baseline vs observed, rendered as dots so the change reads at a glance */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <DotComparison
              label="Normal activity"
              value={active.baselineValue}
              color="#64748B"
              caption="baseline"
            />
            <DotComparison
              label="Observed in window"
              value={active.observedValue}
              color={SEVERITY_COLORS[active.severity]}
              caption="observed"
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {active.evidence.map((e, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono border"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  color: 'var(--ink-secondary)',
                }}
              >
                <Radio size={10} />
                {e}
              </span>
            ))}
            <Badge color="#EA580C">Requires investigator verification</Badge>
          </div>
        </Panel>
      )}
    </div>
  );
}

/** Render a count as discrete dots — 14 dots reads as "a lot" faster than "14". */
function DotComparison({
  label,
  value,
  color,
  caption,
}: {
  label: string;
  value: number;
  color: string;
  caption: string;
}) {
  const count = Math.min(30, Math.max(0, Math.round(value)));
  return (
    <div className="rounded-xl border px-4 py-3.5" style={{ background: tint(color, 0.05), borderColor: tint(color, 0.26) }}>
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">{label}</div>
      <div className="flex flex-wrap gap-1.5 mt-2.5 min-h-[16px]">
        {Array.from({ length: count }).map((_, i) => (
          <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        ))}
        {count === 0 && <span className="text-[11px] text-[var(--ink-tertiary)]">none</span>}
      </div>
      <div className="text-[15px] font-bold tabular-nums mt-2.5" style={{ color }}>
        {fmt(Math.round(value * 100) / 100)}
        <span className="text-[10.5px] font-semibold text-[var(--ink-tertiary)] ml-1.5 uppercase tracking-wide">
          {caption}
        </span>
      </div>
    </div>
  );
}
