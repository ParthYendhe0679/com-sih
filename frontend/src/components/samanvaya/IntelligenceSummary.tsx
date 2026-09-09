'use client';

// ============================================================
// The executive view: what the five agents concluded, ranked, with
// every claim carrying its classification, confidence and source.
// ============================================================

import React from 'react';
import { Target, Compass, ShieldAlert, FileWarning, CheckCircle2 } from 'lucide-react';
import type { SamanvayaFinalDossier } from '@/lib/api/samanvaya';
import { Panel, SectionHeading, Badge, MetricTile, ConfidenceBar, EmptyState } from './primitives';
import { CLASSIFICATION_COLORS, SEVERITY_COLORS, tint } from './theme';

export default function IntelligenceSummary({ dossier }: { dossier: SamanvayaFinalDossier | null }) {
  if (!dossier) {
    return (
      <Panel>
        <EmptyState
          icon={Target}
          title="No intelligence synthesised yet"
          message="Run the SAMANVAYA investigation to produce classified findings, ranked leads and the official dossier for this case."
        />
      </Panel>
    );
  }

  const verified = dossier.findings.filter((f) => f.classification === 'VERIFIED').length;
  const leadsRanked = [...dossier.investigativeLeads].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as Record<string, number>;
    return (order[a.urgency] ?? 9) - (order[b.urgency] ?? 9);
  });

  return (
    <div className="space-y-5">
      {/* Headline */}
      <Panel accent="#4F46E5">
        <SectionHeading
          icon={Target}
          title="Case intelligence summary"
          subtitle={`${dossier.caseNumber} · ${dossier.crimeCategory}`}
          accent="#4F46E5"
          right={<Badge color="#059669" solid>Analysis complete</Badge>}
        />

        {dossier.investigationSummary && (
          <p className="mt-4 text-[13px] leading-relaxed text-[var(--ink-secondary)] max-w-4xl">
            {dossier.investigationSummary}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricTile label="Key findings" value={dossier.findings.length} color="#4F46E5" animate />
          <MetricTile label="Verified" value={verified} color="#059669" animate />
          <MetricTile label="Network nodes" value={dossier.graph.nodes.length} color="#7C3AED" animate />
          <MetricTile label="Relationships" value={dossier.graph.edges.length} color="#2563EB" animate />
          <MetricTile label="Locations" value={dossier.geographicRoute.length} color="#EA580C" animate />
          <MetricTile
            label="Anomalies"
            value={dossier.communications?.patterns.length ?? 0}
            color="#DC2626"
            animate
            hint="Communication patterns flagged for review"
          />
        </div>
      </Panel>

      {/* Leads */}
      <Panel>
        <SectionHeading
          icon={Compass}
          title="Top investigative leads"
          subtitle="Ranked by urgency — each requires officer verification before action"
          accent="#0EA5E9"
        />
        <ol className="mt-4 space-y-3">
          {leadsRanked.map((l, i) => {
            const c = SEVERITY_COLORS[l.urgency] || '#0891B2';
            return (
              <li
                key={i}
                className="rounded-xl border px-4 py-3.5"
                style={{ background: tint(c, 0.05), borderColor: tint(c, 0.28) }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[13px] font-bold text-white"
                    style={{ background: c }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge color={c} solid>
                        {l.urgency}
                      </Badge>
                    </div>
                    <h4 className="text-[13.5px] font-bold text-[var(--ink-primary)] mt-1.5 leading-snug">
                      {l.lead}
                    </h4>
                    <div
                      className="mt-2 rounded-lg px-3 py-2"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: c }}>
                        Recommended action
                      </div>
                      <p className="text-[12.5px] text-[var(--ink-secondary)] mt-0.5 leading-relaxed">
                        {l.recommendedAction}
                      </p>
                    </div>
                    <p className="text-[11.5px] text-[var(--ink-tertiary)] mt-2 leading-relaxed">
                      <strong className="font-semibold">Basis:</strong> {l.basis}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>

      {/* Findings */}
      <Panel>
        <SectionHeading
          icon={CheckCircle2}
          title="Classified findings"
          subtitle="Every finding is graded and traced to the agent that produced it"
          accent="#059669"
          right={
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(CLASSIFICATION_COLORS).map(([k, c]) => {
                const n = dossier.findings.filter((f) => f.classification === k).length;
                if (!n) return null;
                return (
                  <Badge key={k} color={c}>
                    {k} {n}
                  </Badge>
                );
              })}
            </div>
          }
        />

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {dossier.findings.map((f, i) => {
            const c = CLASSIFICATION_COLORS[f.classification] || '#64748B';
            return (
              <div
                key={i}
                className="rounded-xl border px-4 py-3.5 flex flex-col"
                style={{ background: 'var(--surface-2)', borderColor: tint(c, 0.3), borderLeft: `4px solid ${c}` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge color={c} solid>
                    {f.classification}
                  </Badge>
                  <span className="text-[11px] font-bold tabular-nums" style={{ color: c }}>
                    {Math.round(f.confidence * 100)}%
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-[var(--ink-primary)] mt-2.5 leading-relaxed flex-1">
                  {f.finding}
                </p>
                <div className="mt-3">
                  <ConfidenceBar value={f.confidence} color={c} label="Analytical confidence" />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {f.evidence.map((e, j) => (
                    <span
                      key={j}
                      className="px-2 py-0.5 rounded-md text-[10.5px] font-mono border"
                      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
                    >
                      {e}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 mt-2.5 text-[10.5px] text-[var(--ink-tertiary)]">
                  <span>{f.agentSource}</span>
                  <span className="font-semibold" style={{ color: '#EA580C' }}>
                    Requires verification
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Gaps & risks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel>
          <SectionHeading
            icon={FileWarning}
            title="Evidence gaps"
            subtitle="What the analysis could not see"
            accent="#EA580C"
          />
          {dossier.evidenceGaps.length ? (
            <ul className="mt-3 space-y-2">
              {dossier.evidenceGaps.map((g, i) => (
                <li
                  key={i}
                  className="rounded-lg px-3 py-2.5 text-[12.5px] leading-relaxed text-[var(--ink-secondary)]"
                  style={{ background: tint('#EA580C', 0.06), border: `1px solid ${tint('#EA580C', 0.24)}` }}
                >
                  {g}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[12.5px] text-[var(--ink-tertiary)]">No outstanding evidence gaps recorded.</p>
          )}
        </Panel>

        <Panel>
          <SectionHeading
            icon={ShieldAlert}
            title="Risk indicators"
            subtitle="Operational risks flagged during synthesis"
            accent="#DC2626"
          />
          {dossier.riskIndicators.length ? (
            <ul className="mt-3 space-y-2">
              {dossier.riskIndicators.map((r, i) => {
                const c = SEVERITY_COLORS[r.severity] || '#CA8A04';
                return (
                  <li
                    key={i}
                    className="rounded-lg px-3 py-2.5"
                    style={{ background: tint(c, 0.06), border: `1px solid ${tint(c, 0.24)}` }}
                  >
                    <div className="flex items-center gap-2">
                      <Badge color={c}>{r.severity}</Badge>
                      <span className="text-[12.5px] font-semibold text-[var(--ink-primary)]">{r.indicator}</span>
                    </div>
                    <p className="text-[11.5px] text-[var(--ink-secondary)] mt-1 leading-relaxed">{r.rationale}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-[12.5px] text-[var(--ink-tertiary)]">No risk indicators recorded.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
