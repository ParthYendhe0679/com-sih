'use client';

// ============================================================
// STEP 1 — Case selection.
// Rich case cards on the left, a preview of the selected case on
// the right, and one unambiguous action to start the pipeline.
// ============================================================

import React, { useMemo, useState } from 'react';
import {
  Search,
  MapPin,
  Calendar,
  Play,
  FolderOpen,
  ShieldAlert,
  Building2,
  Loader2,
  FileText,
  ChevronRight,
} from 'lucide-react';
import type { BackendCase } from '@/lib/api/cases';
import { Panel, Badge, EmptyState, SectionHeading } from './primitives';
import { SEVERITY_COLORS, tint } from './theme';

interface Props {
  cases: BackendCase[];
  loading: boolean;
  selectedCaseId: string;
  onSelect: (caseId: string) => void;
  onStart: () => void;
  starting: boolean;
  alreadyAnalysed: boolean;
  onOpenIngestion: () => void;
}

const priorityColor = (p?: string) => SEVERITY_COLORS[(p || '').toUpperCase()] || '#0891B2';

export default function CaseSelector({
  cases,
  loading,
  selectedCaseId,
  onSelect,
  onStart,
  starting,
  alreadyAnalysed,
  onOpenIngestion,
}: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((c) =>
      [c.case_number, c.title, c.crime_category, c.city, c.area, c.police_station]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [cases, query]);

  const selected = cases.find((c) => c.id === selectedCaseId) || null;

  if (loading && cases.length === 0) {
    return (
      <Panel>
        <div className="flex items-center gap-3 py-10 justify-center text-[var(--ink-secondary)]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px] font-medium">Loading active investigation cases…</span>
        </div>
      </Panel>
    );
  }

  if (cases.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={FolderOpen}
          title="No active cases available"
          message="SAMANVAYA analyses registered cases. Once a case is created and linked to an FIR it will appear here for selection."
        />
      </Panel>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* ── Case list ─────────────────────────────────────── */}
      <Panel className="xl:col-span-7">
        <SectionHeading
          icon={FolderOpen}
          title="Select an investigation case"
          subtitle={`${cases.length} case${cases.length === 1 ? '' : 's'} available for multi-agent analysis`}
          right={
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-tertiary)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search case number, crime, city…"
                aria-label="Search cases"
                className="w-[230px] pl-8 pr-3 py-1.5 rounded-lg text-[12px] border outline-none transition-colors focus:border-[var(--accent)]"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--ink-primary)',
                }}
              />
            </div>
          }
        />

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
          {filtered.map((c) => {
            const active = c.id === selectedCaseId;
            const pc = priorityColor(c.priority);
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                aria-pressed={active}
                className="text-left rounded-xl border p-3.5 transition-all cursor-pointer hover:-translate-y-0.5"
                style={{
                  background: active ? tint(pc, 0.07) : 'var(--surface-2)',
                  borderColor: active ? pc : 'var(--border)',
                  boxShadow: active ? `0 0 0 1px ${pc}` : 'none',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[12.5px] font-bold text-[var(--ink-primary)] truncate">
                    {c.case_number}
                  </span>
                  <Badge color={pc}>{c.priority}</Badge>
                </div>

                <div className="text-[13px] font-semibold text-[var(--ink-primary)] mt-1.5 line-clamp-2 leading-snug">
                  {c.title}
                </div>

                <div className="text-[11.5px] font-semibold mt-1.5" style={{ color: pc }}>
                  {c.crime_category}
                </div>

                <div className="flex items-center gap-3 mt-2.5 text-[11px] text-[var(--ink-tertiary)]">
                  <span className="inline-flex items-center gap-1 min-w-0">
                    <MapPin size={11} className="shrink-0" />
                    <span className="truncate">{c.area || c.city || 'Jurisdiction'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 shrink-0">
                    <Calendar size={11} />
                    {c.opened_at ? new Date(c.opened_at).toLocaleDateString('en-IN') : '—'}
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="sm:col-span-2 py-10 text-center text-[12.5px] text-[var(--ink-tertiary)]">
              No cases match “{query}”.
            </div>
          )}
        </div>
      </Panel>

      {/* ── Case preview ──────────────────────────────────── */}
      <Panel className="xl:col-span-5" accent={selected ? priorityColor(selected.priority) : undefined}>
        {selected ? (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[13px] font-bold text-[var(--ink-primary)]">
                  {selected.case_number}
                </span>
                <Badge color={priorityColor(selected.priority)} solid>
                  {selected.priority}
                </Badge>
                <Badge color="#0891B2">{selected.status}</Badge>
                {alreadyAnalysed && <Badge color="#059669">Analysed</Badge>}
              </div>
              <h3 className="text-[17px] font-bold text-[var(--ink-primary)] mt-2 leading-snug">
                {selected.title}
              </h3>
              <div className="text-[13px] font-semibold mt-1" style={{ color: priorityColor(selected.priority) }}>
                {selected.crime_category}
              </div>
            </div>

            <p className="text-[12.5px] leading-relaxed text-[var(--ink-secondary)] line-clamp-6">
              {selected.description || 'No narrative recorded against this case.'}
            </p>

            <dl className="grid grid-cols-2 gap-2.5">
              {[
                { icon: Building2, label: 'Police station', value: selected.police_station || '—' },
                { icon: MapPin, label: 'Location', value: selected.area || selected.city || '—' },
                { icon: Calendar, label: 'Opened', value: selected.opened_at ? new Date(selected.opened_at).toLocaleDateString('en-IN') : '—' },
                { icon: FileText, label: 'FIR linked', value: selected.fir_id ? 'Yes' : 'No' },
              ].map((f) => (
                <div
                  key={f.label}
                  className="rounded-lg border px-3 py-2.5"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                >
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)] flex items-center gap-1">
                    <f.icon size={11} />
                    {f.label}
                  </dt>
                  <dd className="text-[12.5px] font-semibold text-[var(--ink-primary)] mt-1 truncate">{f.value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={onStart}
                disabled={starting}
                className="w-full px-4 py-3 rounded-xl text-[13.5px] font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
              >
                {starting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Starting pipeline…
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    {alreadyAnalysed ? 'Re-run SAMANVAYA investigation' : 'Start SAMANVAYA investigation'}
                  </>
                )}
              </button>

              <button
                onClick={onOpenIngestion}
                className="w-full px-4 py-2.5 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer hover:bg-[var(--surface-2)]"
                style={{ borderColor: 'var(--border-strong)', color: 'var(--ink-secondary)' }}
              >
                Connect or upload evidence first
                <ChevronRight size={14} />
              </button>
            </div>

            <p className="text-[11px] leading-relaxed text-[var(--ink-tertiary)] flex items-start gap-1.5">
              <ShieldAlert size={13} className="shrink-0 mt-0.5" />
              Analysis is AI-assisted. Every finding it produces requires verification by the
              investigating officer before it is acted upon.
            </p>
          </div>
        ) : (
          <EmptyState
            icon={FolderOpen}
            title="No case selected"
            message="Select an active case from the list to review its details and begin SAMANVAYA intelligence analysis."
          />
        )}
      </Panel>
    </div>
  );
}
