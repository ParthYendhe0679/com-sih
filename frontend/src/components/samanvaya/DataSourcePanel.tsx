'use client';

// ============================================================
// STEP 2 — Evidence ingestion.
// Every card reflects a real backend lookup. The call-record card
// performs an actual upload, parse and analysis round-trip.
// ============================================================

import React, { useCallback, useRef, useState } from 'react';
import {
  FileText,
  Phone,
  Camera,
  Landmark,
  Car,
  Database,
  Archive,
  Network,
  UploadCloud,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  RefreshCw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { CDRAnalysis, DataSourceStatus } from '@/lib/api/samanvaya';
import { samanvayaApi } from '@/lib/api/samanvaya';
import { Panel, SectionHeading, Badge, ErrorState, ToolButton } from './primitives';
import { DATA_SOURCE_STATE, tint, fmt } from './theme';

const SOURCE_ICONS: Record<string, LucideIcon> = {
  fir: FileText,
  entities: Database,
  cdr: Phone,
  relationships: Network,
  historical: Archive,
  graph_db: Network,
  cache: Database,
  cctv: Camera,
  financial: Landmark,
  vehicle: Car,
};

interface Props {
  caseId: string;
  sources: DataSourceStatus[];
  cdr: CDRAnalysis | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onCdrChanged: (analysis: CDRAnalysis | null) => void;
  disabled?: boolean;
}

export default function DataSourcePanel({
  caseId,
  sources,
  cdr,
  loading,
  error,
  onRefresh,
  onCdrChanged,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!caseId) return;
      setUploading(true);
      setUploadError(null);
      try {
        const analysis = await samanvayaApi.uploadCallRecords(caseId, file);
        onCdrChanged(analysis);
        onRefresh();
        toast.success(
          `${fmt(analysis.parsedRecords)} call records indexed — ${analysis.patterns.length} anomalies flagged.`
        );
      } catch (err: any) {
        const message = err?.message || 'The call record file could not be processed.';
        setUploadError(message);
        toast.error(message);
      } finally {
        setUploading(false);
      }
    },
    [caseId, onCdrChanged, onRefresh]
  );

  const detach = useCallback(async () => {
    if (!caseId) return;
    try {
      await samanvayaApi.deleteCallRecords(caseId);
      onCdrChanged(null);
      onRefresh();
      toast.success('Call detail records detached from this case.');
    } catch (err: any) {
      toast.error(err?.message || 'Could not detach the call records.');
    }
  }, [caseId, onCdrChanged, onRefresh]);

  const connectedCount = sources.filter((s) => s.state === 'CONNECTED' || s.state === 'UPLOADED').length;

  return (
    <Panel>
      <SectionHeading
        icon={Database}
        title="Investigation data sources"
        subtitle={
          loading
            ? 'Checking source availability…'
            : `${connectedCount} of ${sources.length} sources available for this case`
        }
        accent="#0F766E"
        right={<ToolButton icon={RefreshCw} label="Recheck" onClick={onRefresh} disabled={loading || disabled} />}
      />

      {error && (
        <div className="mt-4">
          <ErrorState
            title="Data source check failed"
            message="The platform could not determine which sources are available for this case."
            onRetry={onRefresh}
            details={error}
          />
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sources.map((s) => {
          const Icon = SOURCE_ICONS[s.id] || Database;
          const meta = DATA_SOURCE_STATE[s.state] || DATA_SOURCE_STATE.NOT_AVAILABLE;
          const isCdr = s.uploadKind === 'cdr';

          return (
            <div
              key={s.id}
              className="rounded-xl border p-3.5 flex flex-col"
              style={{
                background: s.state === 'NOT_AVAILABLE' ? 'var(--surface-2)' : tint(meta.color, 0.05),
                borderColor: tint(meta.color, 0.3),
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: tint(meta.color, 0.14), color: meta.color }}
                >
                  <Icon size={16} />
                </span>
                <Badge color={meta.color}>
                  {s.state === 'AWAITING_AUTHORIZATION' && <Lock size={9} />}
                  {(s.state === 'CONNECTED' || s.state === 'UPLOADED') && <CheckCircle2 size={9} />}
                  {meta.label}
                </Badge>
              </div>

              <div className="text-[12.5px] font-semibold text-[var(--ink-primary)] mt-2.5">{s.name}</div>
              {s.recordCount > 0 && (
                <div className="text-[16px] font-semibold tabular-nums mt-0.5" style={{ color: meta.color }}>
                  {fmt(s.recordCount)}
                  <span className="text-[10px] font-semibold text-[var(--ink-tertiary)] ml-1 uppercase tracking-wide">
                    records
                  </span>
                </div>
              )}
              <p className="text-[11px] text-[var(--ink-secondary)] mt-1.5 leading-snug flex-1">{s.detail}</p>

              {isCdr && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  {cdr ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--ink-primary)] min-w-0">
                        <CheckCircle2 size={12} className="shrink-0 text-[#16A34A]" />
                        <span className="truncate">{cdr.fileName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ToolButton
                          icon={UploadCloud}
                          label="Replace"
                          onClick={() => inputRef.current?.click()}
                          disabled={uploading || disabled}
                        />
                        <ToolButton icon={Trash2} label="Detach" onClick={detach} disabled={uploading || disabled} />
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const f = e.dataTransfer.files?.[0];
                        if (f) upload(f);
                      }}
                      onClick={() => !uploading && !disabled && inputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
                      }}
                      className="rounded-lg border border-dashed px-3 py-3 text-center cursor-pointer transition-colors"
                      style={{
                        borderColor: dragOver ? '#5B4BC4' : 'var(--border-strong)',
                        background: dragOver ? tint('#5B4BC4', 0.08) : 'transparent',
                      }}
                    >
                      {uploading ? (
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--ink-secondary)]">
                          <Loader2 size={13} className="animate-spin" />
                          Parsing and indexing…
                        </span>
                      ) : (
                        <>
                          <UploadCloud size={16} className="mx-auto mb-1 text-[var(--ink-tertiary)]" />
                          <div className="text-[11.5px] font-semibold text-[var(--ink-primary)]">
                            Upload call records
                          </div>
                          <div className="text-[10px] text-[var(--ink-tertiary)] mt-0.5">
                            CSV, TSV or JSON — drop or click
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,.tsv,.txt,.json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(f);
                      e.target.value = '';
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {uploadError && (
        <div className="mt-4">
          <ErrorState
            title="Call records could not be read"
            message={uploadError}
            onRetry={() => inputRef.current?.click()}
          />
        </div>
      )}

      {cdr && cdr.notes.length > 0 && (
        <div
          className="mt-4 rounded-xl border px-4 py-3"
          style={{ background: tint('#D97706', 0.06), borderColor: tint('#D97706', 0.28) }}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#D97706]">
            <AlertTriangle size={12} />
            Analysis caveats
          </div>
          <ul className="mt-2 space-y-1">
            {cdr.notes.map((n, i) => (
              <li key={i} className="text-[11.5px] text-[var(--ink-secondary)] leading-snug">
                • {n}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
