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
          message="Run the analysis to produce classified findings, ranked leads and the official dossier for this case."
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
      <Panel accent="#12376E">
        <SectionHeading
          icon={Target}
          title="Case intelligence summary"
          subtitle={`${dossier.caseNumber} · ${dossier.crimeCategory}`}
          accent="#12376E"
          right={<Badge color="#16A34A" solid>Analysis complete</Badge>}
        />

        {dossier.investigationSummary && (
          <p className="mt-4 text-[13px] leading-relaxed text-[var(--ink-secondary)] max-w-4xl">
            {dossier.investigationSummary}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricTile label="Key findings" value={dossier.findings.length} color="#12376E" animate />
          <MetricTile label="Verified" value={verified} color="#16A34A" animate />
          <MetricTile label="Network nodes" value={dossier.graph.nodes.length} color="#5B4BC4" animate />
          <MetricTile label="Relationships" value={dossier.graph.edges.length} color="#2563EB" animate />
          <MetricTile label="Locations" value={dossier.geographicRoute.length} color="#D97706" animate />
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
          accent="#2563EB"
        />
        <ol className="mt-4 space-y-3">
          {leadsRanked.map((l, i) => {
            const c = SEVERITY_COLORS[l.urgency] || '#0F766E';
            return (
              <li
                key={i}
                className="rounded-xl px-4 py-3.5"
                style={{ background: 'var(--surface-2)' }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[13px] font-semibold text-white"
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
                    <h4 className="text-[13.5px] font-semibold text-[var(--ink-primary)] mt-1.5 leading-snug">
                      {l.lead}
                    </h4>
                    <div
                      className="mt-2 rounded-lg px-3 py-2"
                      style={{ background: 'var(--surface-1)' }}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-tertiary)' }}>
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
          accent="#16A34A"
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
            const c = CLASSIFICATION_COLORS[f.classification] || '#9CA3AF';
            return (
              // The finding itself is the point. The grade sits in one pill,
              // the confidence figure appears once, and the sources sit quietly
              // underneath — no coloured rail, no repeated percentage, no
              // per-card verification notice (the panel already carries it).
              <div
                key={i}
                className="rounded-xl px-4 py-4 flex flex-col"
                style={{ background: 'var(--surface-2)' }}
              >
                <p className="text-[13.5px] font-semibold text-[var(--ink-primary)] leading-relaxed flex-1">
                  {f.finding}
                </p>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Badge color={c}>{f.classification}</Badge>
                  <span
                    className="text-[11.5px] tabular-nums"
                    style={{ color: 'var(--ink-tertiary)' }}
                  >
                    {Math.round(f.confidence * 100)}% confidence
                  </span>
                </div>

                <div
                  className="text-[11px] mt-2.5 leading-relaxed"
                  style={{ color: 'var(--ink-tertiary)' }}
                >
                  {f.agentSource}
                  {f.evidence.length > 0 && <> · {f.evidence.join(' · ')}</>}
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
            accent="#D97706"
          />
          {dossier.evidenceGaps.length ? (
            <ul className="mt-3 space-y-2">
              {dossier.evidenceGaps.map((g, i) => (
                <li
                  key={i}
                  className="rounded-lg px-3 py-2.5 text-[12.5px] leading-relaxed text-[var(--ink-secondary)]"
                  style={{ background: tint('#D97706', 0.06), border: `1px solid ${tint('#D97706', 0.24)}` }}
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
                const c = SEVERITY_COLORS[r.severity] || '#D97706';
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
