'use client';

// ============================================================
// The official dossier — a structured, printable document rather
// than a wall of monospace. Every export button here does real work:
// print opens the browser print dialogue against a print stylesheet,
// and the two downloads produce genuine files from the live dossier.
// ============================================================

import React, { useCallback, useState } from 'react';
import {
  Printer,
  Copy,
  Download,
  FileJson,
  ShieldCheck,
  Check,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import type { SamanvayaFinalDossier } from '@/lib/api/samanvaya';
import type { BackendCase } from '@/lib/api/cases';
import { Panel, Badge, ConfidenceBar, EmptyState, ToolButton } from './primitives';
import { AGENTS, CLASSIFICATION_COLORS, SEVERITY_COLORS, DATA_SOURCE_STATE, tint, fmt } from './theme';

/** Trigger a browser download for generated content. */
function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so Safari has finished reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function OfficialDossier({
  dossier,
  caseRecord,
}: {
  dossier: SamanvayaFinalDossier | null;
  caseRecord: BackendCase | null;
}) {
  const [copied, setCopied] = useState(false);

  const copySummary = useCallback(async () => {
    if (!dossier) return;
    const summary = [
      `${dossier.caseNumber} — ${dossier.caseTitle}`,
      `Crime category: ${dossier.crimeCategory}`,
      '',
      dossier.investigationSummary,
      '',
      'KEY FINDINGS',
      ...dossier.findings.map(
        (f, i) => `${i + 1}. [${f.classification} ${Math.round(f.confidence * 100)}%] ${f.finding}`
      ),
      '',
      'INVESTIGATIVE LEADS',
      ...dossier.investigativeLeads.map((l, i) => `${i + 1}. [${l.urgency}] ${l.lead} — ${l.recommendedAction}`),
      '',
      'All findings are AI-assisted and require investigator verification.',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
      toast.success('Executive summary copied to clipboard.');
    } catch {
      toast.error('Clipboard access was denied by the browser.');
    }
  }, [dossier]);

  const exportText = useCallback(() => {
    if (!dossier) return;
    download(`${dossier.caseNumber}_SAMANVAYA_dossier.txt`, dossier.reportText, 'text/plain;charset=utf-8');
    toast.success('Dossier downloaded as a text file.');
  }, [dossier]);

  const exportJson = useCallback(() => {
    if (!dossier) return;
    download(
      `${dossier.caseNumber}_SAMANVAYA_investigation_data.json`,
      JSON.stringify(dossier, null, 2),
      'application/json'
    );
    toast.success('Full investigation data exported as JSON.');
  }, [dossier]);

  if (!dossier) {
    return (
      <Panel>
        <EmptyState
          icon={FileText}
          title="No dossier compiled"
          message="The official dossier is produced by Agent 5 after all five agents complete. Run the SAMANVAYA investigation to generate it."
        />
      </Panel>
    );
  }

  return (
    <>
      {/* Print rules keep the dossier readable on paper and drop the chrome. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #samanvaya-dossier, #samanvaya-dossier * { visibility: visible !important; }
          #samanvaya-dossier {
            position: absolute; left: 0; top: 0; width: 100%;
            background: #FFFFFF !important; color: #111827 !important;
            box-shadow: none !important; border: none !important;
          }
          #samanvaya-dossier .no-print { display: none !important; }
          #samanvaya-dossier section { break-inside: avoid; }
        }
      `}</style>

      <div id="samanvaya-dossier" className="space-y-5">
        {/* ── Masthead ─────────────────────────────────── */}
        <Panel accent="#4338CA">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ink-tertiary)]">
                KRITAGAS · Criminal Intelligence Platform
              </div>
              <h2 className="text-[24px] font-bold tracking-tight text-[var(--ink-primary)] mt-1 leading-tight">
                SAMANVAYA Investigation Intelligence Report
              </h2>
              <p className="text-[12.5px] text-[var(--ink-secondary)] mt-1">
                Multi-agent synthesis · five specialised agents · one connected investigation
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 no-print">
              <ToolButton icon={copied ? Check : Copy} label={copied ? 'Copied' : 'Copy summary'} onClick={copySummary} />
              <ToolButton icon={Printer} label="Print / PDF" onClick={() => window.print()} />
              <ToolButton icon={Download} label="Export text" onClick={exportText} />
              <ToolButton icon={FileJson} label="Export data" onClick={exportJson} />
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {[
              ['Case number', dossier.caseNumber, true],
              ['Crime type', dossier.crimeCategory, false],
              ['Priority', caseRecord?.priority || '—', false],
              ['Jurisdiction', caseRecord?.police_station || caseRecord?.city || '—', false],
              ['Generated', new Date(dossier.generatedAt).toLocaleString('en-IN'), true],
              ['Analysis time', `${(dossier.executionDurationMs / 1000).toFixed(1)}s`, true],
            ].map(([label, value, mono]) => (
              <div key={String(label)} className="rounded-lg px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
                <dt className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">{label}</dt>
                <dd
                  className={`text-[12px] font-semibold text-[var(--ink-primary)] mt-1 break-words ${mono ? 'font-mono' : ''}`}
                >
                  {String(value)}
                </dd>
              </div>
            ))}
          </dl>

          {dossier.blockchainHash && (
            <div
              className="mt-3 rounded-lg px-3.5 py-2.5 flex flex-wrap items-center gap-2"
              style={{ background: tint('#4338CA', 0.07), border: `1px solid ${tint('#4338CA', 0.24)}` }}
            >
              <ShieldCheck size={14} style={{ color: '#4338CA' }} />
              <span className="text-[11px] font-semibold text-[var(--ink-secondary)]">Audit ledger seal</span>
              <code className="text-[11px] font-mono text-[var(--ink-primary)] break-all">{dossier.blockchainHash}</code>
            </div>
          )}
        </Panel>

        {/* ── 1. Case overview ─────────────────────────── */}
        <DossierSection number={1} title="Case overview">
          <p className="text-[13px] leading-relaxed text-[var(--ink-secondary)] max-w-4xl">
            {dossier.investigationSummary || dossier.caseTitle}
          </p>
        </DossierSection>

        {/* ── 2. Data sources ──────────────────────────── */}
        <DossierSection number={2} title="Data sources analysed">
          <div className="flex flex-wrap gap-2">
            {dossier.dataSources.map((s) => {
              const meta = DATA_SOURCE_STATE[s.state] || DATA_SOURCE_STATE.NOT_AVAILABLE;
              return (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11.5px] font-semibold"
                  style={{ background: tint(meta.color, 0.07), borderColor: tint(meta.color, 0.28), color: meta.color }}
                >
                  {s.name}
                  {s.recordCount > 0 && (
                    <span className="text-[10.5px] font-mono opacity-80">{fmt(s.recordCount)}</span>
                  )}
                  <span className="text-[9.5px] uppercase tracking-wide opacity-70">{meta.label}</span>
                </span>
              );
            })}
          </div>
        </DossierSection>

        {/* ── 3. Agent analysis ────────────────────────── */}
        <DossierSection number={3} title="Agent analysis">
          <div className="space-y-3">
            {dossier.agents.map((a) => {
              const meta = AGENTS.find((m) => m.agentNumber === a.agentNumber) || AGENTS[0];
              const Icon = meta.icon;
              return (
                <div
                  key={a.agentId}
                  className="rounded-xl border px-4 py-3.5"
                  style={{ background: tint(meta.color, 0.045), borderColor: tint(meta.color, 0.26) }}
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white"
                      style={{ background: meta.color }}
                    >
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-[var(--ink-primary)]">
                        Agent {a.agentNumber} — {a.name}
                      </div>
                      <div className="text-[10.5px] font-mono text-[var(--ink-tertiary)]">{meta.sanskritName}</div>
                    </div>
                    <div className="ml-auto flex flex-wrap gap-2">
                      <Badge color={meta.color}>{fmt(a.recordsSearched)} scanned</Badge>
                      <Badge color={meta.color}>{fmt(a.relevantFound)} relevant</Badge>
                      <Badge color="#64748B">{a.executionTimeMs.toFixed(0)} ms</Badge>
                    </div>
                  </div>
                  {a.highlights.length > 0 && (
                    <ul className="mt-2.5 space-y-1 pl-1">
                      {a.highlights.map((h, i) => (
                        <li key={i} className="text-[12px] text-[var(--ink-secondary)] leading-relaxed flex gap-2">
                          <span className="w-1 h-1 rounded-full mt-[7px] shrink-0" style={{ background: meta.color }} />
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </DossierSection>

        {/* ── 4. Key findings ──────────────────────────── */}
        <DossierSection number={4} title="Key findings">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-strong)' }}>
                <th className="py-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)] w-[110px]">
                  Grade
                </th>
                <th className="py-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
                  Finding
                </th>
                <th className="py-2 pr-3 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)] w-[120px]">
                  Confidence
                </th>
                <th className="py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)] w-[180px]">
                  Source
                </th>
              </tr>
            </thead>
            <tbody>
              {dossier.findings.map((f, i) => {
                const c = CLASSIFICATION_COLORS[f.classification] || '#64748B';
                return (
                  <tr key={i} className="border-b align-top" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2.5 pr-3">
                      <Badge color={c}>{f.classification}</Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-[12.5px] text-[var(--ink-primary)] leading-relaxed">
                      {f.finding}
                      {f.evidence.length > 0 && (
                        <div className="text-[10.5px] text-[var(--ink-tertiary)] mt-1 font-mono">
                          {f.evidence.join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <ConfidenceBar value={f.confidence} color={c} compact />
                      <span className="text-[10.5px] font-bold tabular-nums" style={{ color: c }}>
                        {Math.round(f.confidence * 100)}%
                      </span>
                    </td>
                    <td className="py-2.5 text-[11px] text-[var(--ink-secondary)]">{f.agentSource}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DossierSection>

        {/* ── 5. Suspicious communications ─────────────── */}
        <DossierSection number={5} title="Suspicious communications">
          {dossier.communications && dossier.communications.patterns.length > 0 ? (
            <>
              <p className="text-[11.5px] text-[var(--ink-tertiary)] mb-3 font-mono">
                {dossier.communications.fileName} — {fmt(dossier.communications.parsedRecords)} records,{' '}
                {dossier.communications.uniqueNumbers} distinct numbers
              </p>
              <div className="space-y-2">
                {dossier.communications.patterns.map((p) => {
                  const c = SEVERITY_COLORS[p.severity] || '#CA8A04';
                  return (
                    <div
                      key={p.id}
                      className="rounded-lg border px-3.5 py-2.5"
                      style={{ background: tint(c, 0.05), borderColor: tint(c, 0.26) }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge color={c} solid>
                          {p.severity}
                        </Badge>
                        <span className="text-[12.5px] font-bold text-[var(--ink-primary)]">{p.title}</span>
                        <span className="text-[11px] font-mono text-[var(--ink-secondary)]">
                          {p.partyA}
                          {p.partyB ? ` → ${p.partyB}` : ''}
                        </span>
                        <span className="ml-auto text-[11px] font-bold tabular-nums" style={{ color: c }}>
                          {Math.round(p.riskScore * 100)}% anomaly strength
                        </span>
                      </div>
                      <p className="text-[12px] text-[var(--ink-secondary)] mt-1.5 leading-relaxed">{p.description}</p>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-[12.5px] text-[var(--ink-tertiary)]">
              No call detail records were supplied for this case, so communication analysis was not performed.
            </p>
          )}
        </DossierSection>

        {/* ── 6. Network ───────────────────────────────── */}
        <DossierSection number={6} title="Investigation network">
          <div className="flex flex-wrap gap-2.5 mb-3">
            <Badge color="#7C3AED">{dossier.graph.nodes.length} nodes</Badge>
            <Badge color="#2563EB">{dossier.graph.edges.length} relationships</Badge>
            <Badge color="#059669">{dossier.graph.clusters.length} clusters</Badge>
          </div>
          <div className="space-y-1">
            {dossier.graph.edges.slice(0, 14).map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-center gap-2 text-[11.5px] font-mono px-3 py-1.5 rounded-md"
                style={{ background: 'var(--surface-2)' }}
              >
                <span className="text-[var(--ink-primary)] truncate max-w-[220px]">{e.source}</span>
                <span className="font-bold text-[10px] uppercase" style={{ color: '#7C3AED' }}>
                  ─ {e.relationshipType} →
                </span>
                <span className="text-[var(--ink-primary)] truncate max-w-[220px]">{e.target}</span>
                <span className="ml-auto text-[10.5px] text-[var(--ink-tertiary)]">
                  {Math.round(e.confidence * 100)}%
                </span>
              </div>
            ))}
            {dossier.graph.edges.length > 14 && (
              <p className="text-[11px] text-[var(--ink-tertiary)] pt-1">
                …and {dossier.graph.edges.length - 14} further relationships in the network tab.
              </p>
            )}
          </div>
        </DossierSection>

        {/* ── 7. Geographic ────────────────────────────── */}
        <DossierSection number={7} title="Geographic intelligence">
          {dossier.geographicRoute.length ? (
            <ol className="space-y-2">
              {dossier.geographicRoute.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-2.5 px-3 py-2 rounded-lg"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ background: '#EA580C' }}
                  >
                    {p.sequence}
                  </span>
                  <span className="text-[12.5px] font-semibold text-[var(--ink-primary)]">{p.name}</span>
                  <Badge color="#EA580C">{p.pointType.replace(/_/g, ' ')}</Badge>
                  <span className="text-[10.5px] font-mono text-[var(--ink-tertiary)] ml-auto">
                    {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[12.5px] text-[var(--ink-tertiary)]">
              No location in this case could be resolved to verified coordinates.
            </p>
          )}
        </DossierSection>

        {/* ── 8. Timeline ──────────────────────────────── */}
        <DossierSection number={8} title="Timeline">
          <ol className="space-y-1.5">
            {dossier.timeline.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-2 text-[12px] px-3 py-2 rounded-lg"
                style={{ background: 'var(--surface-2)' }}>
                <span className="font-mono font-bold text-[var(--ink-primary)] w-[150px] shrink-0">{e.time}</span>
                <span className="text-[var(--ink-primary)] font-semibold">{e.title}</span>
                <span className="text-[var(--ink-tertiary)] text-[11px] w-full pl-[158px]">{e.description}</span>
              </li>
            ))}
          </ol>
        </DossierSection>

        {/* ── 9. Leads ─────────────────────────────────── */}
        <DossierSection number={9} title="Key investigative leads">
          <ol className="space-y-2">
            {dossier.investigativeLeads.map((l, i) => {
              const c = SEVERITY_COLORS[l.urgency] || '#0891B2';
              return (
                <li
                  key={i}
                  className="rounded-lg border px-3.5 py-2.5"
                  style={{ background: tint(c, 0.05), borderColor: tint(c, 0.26) }}
                >
                  <div className="flex items-center gap-2">
                    <Badge color={c} solid>
                      {l.urgency}
                    </Badge>
                    <span className="text-[12.5px] font-bold text-[var(--ink-primary)]">{l.lead}</span>
                  </div>
                  <p className="text-[12px] text-[var(--ink-secondary)] mt-1.5 leading-relaxed">
                    <strong className="font-semibold">Action:</strong> {l.recommendedAction}
                  </p>
                  <p className="text-[11.5px] text-[var(--ink-tertiary)] mt-1 leading-relaxed">
                    <strong className="font-semibold">Basis:</strong> {l.basis}
                  </p>
                </li>
              );
            })}
          </ol>
        </DossierSection>

        {/* ── 10. Evidence & risk ──────────────────────── */}
        <DossierSection number={10} title="Evidence gaps and risk indicators">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)] mb-2">
                Outstanding evidence
              </div>
              <ul className="space-y-1.5">
                {dossier.evidenceGaps.map((g, i) => (
                  <li key={i} className="text-[12px] text-[var(--ink-secondary)] leading-relaxed px-3 py-2 rounded-lg"
                    style={{ background: 'var(--surface-2)' }}>
                    {g}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)] mb-2">
                Risk indicators
              </div>
              <ul className="space-y-1.5">
                {dossier.riskIndicators.map((r, i) => (
                  <li key={i} className="text-[12px] px-3 py-2 rounded-lg" style={{ background: 'var(--surface-2)' }}>
                    <Badge color={SEVERITY_COLORS[r.severity] || '#CA8A04'}>{r.severity}</Badge>
                    <span className="text-[var(--ink-primary)] font-semibold ml-2">{r.indicator}</span>
                    <div className="text-[var(--ink-secondary)] mt-0.5 leading-relaxed">{r.rationale}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </DossierSection>

        {/* ── 11. Limitations ──────────────────────────── */}
        <section
          className="rounded-2xl border px-5 py-4"
          style={{ background: tint('#EA580C', 0.06), borderColor: tint('#EA580C', 0.3) }}
        >
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#EA580C]">
            <ShieldCheck size={14} />
            Section 11 · AI limitations and investigator review
          </div>
          <div className="mt-2.5 space-y-2 text-[12.5px] leading-relaxed text-[var(--ink-secondary)] max-w-4xl">
            <p>
              This report is AI-assisted analytical intelligence. Every finding, relationship and lead
              in it requires independent verification by the investigating officer before it is relied
              upon for any operational or judicial decision.
            </p>
            <p>
              Confidence values express confidence in a data relationship or an analytical match. They
              are <strong className="text-[var(--ink-primary)]">not</strong> probabilities of guilt, and
              must not be presented as such.
            </p>
            <p>
              Communication patterns are flagged as anomalous relative to the supplied dataset only. An
              anomaly is a reason to look, not a conclusion.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

function DossierSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border p-5"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center gap-2.5 pb-3 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold text-white shrink-0"
          style={{ background: '#4338CA' }}
        >
          {number}
        </span>
        <h3 className="text-[15px] font-bold tracking-tight text-[var(--ink-primary)]">{title}</h3>
      </div>
      {children}
    </section>
  );
}
