'use client';

import React from 'react';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { closeInspector, openInspector } from '@/store/slices/uiSlice';
import { addToWatchlist } from '@/store/slices/watchlistSlice';
import type { EntityType } from '@/types';
import { toast } from 'sonner';
import {
  X, User, FolderOpen, Car, ExternalLink, BookmarkPlus,
  ShieldAlert, Activity, Package
} from 'lucide-react';
import {
  people, cases, vehicles, phones, locations, organizations,
  evidence, alerts, historicalCases, forensicRecords
} from '@/mock';
import Link from 'next/link';

interface InspectorData {
  description?: string;
  details?: string;
  reason?: string;
  caseIds?: string[];
  personIds?: string[];
  vehicleIds?: string[];
  evidenceIds?: string[];
  [key: string]: unknown;
}

export default function EntityInspector() {
  const dispatch = useAppDispatch();
  const { inspectorOpen, inspectorEntity } = useAppSelector((s) => s.ui);

  if (!inspectorOpen || !inspectorEntity) return null;

  const { id, type } = inspectorEntity;

  // Resolve entity data based on type
  let title = id;
  let subtitle = type;
  let dataRecord: InspectorData | undefined = undefined;

  switch (type) {
    case 'Person': {
      const p = people.find((item) => item.id === id);
      dataRecord = p as unknown as InspectorData;
      if (p) {
        title = p.name;
        subtitle = `${p.id} • ${p.role} • ${p.city}`;
      }
      break;
    }
    case 'Case': {
      const c = cases.find((item) => item.id === id);
      dataRecord = c as unknown as InspectorData;
      if (c) {
        title = c.title;
        subtitle = `${c.id} • ${c.crime} • ${c.status}`;
      }
      break;
    }
    case 'Vehicle': {
      const v = vehicles.find((item) => item.id === id);
      dataRecord = v as unknown as InspectorData;
      if (v) {
        title = `${v.make} ${v.model} (${v.registrationNumber})`;
        subtitle = `${v.id} • ${v.color} • ${v.type}`;
      }
      break;
    }
    case 'Phone': {
      const ph = phones.find((item) => item.id === id);
      dataRecord = ph as unknown as InspectorData;
      if (ph) {
        title = ph.number;
        subtitle = `${ph.id} • ${ph.carrier} • IMEI: ${ph.imei.slice(0, 8)}...`;
      }
      break;
    }
    case 'Location': {
      const l = locations.find((item) => item.id === id);
      dataRecord = l as unknown as InspectorData;
      if (l) {
        title = l.name;
        subtitle = `${l.id} • ${l.type} • ${l.city}`;
      }
      break;
    }
    case 'Organization': {
      const org = organizations.find((item) => item.id === id);
      dataRecord = org as unknown as InspectorData;
      if (org) {
        title = org.name;
        subtitle = `${org.id} • ${org.type} • ${org.status}`;
      }
      break;
    }
    case 'Evidence': {
      const ev = evidence.find((item) => item.id === id);
      dataRecord = ev as unknown as InspectorData;
      if (ev) {
        title = ev.title;
        subtitle = `${ev.id} • ${ev.type} • ${ev.status}`;
      }
      break;
    }
    case 'Alert': {
      const al = alerts.find((item) => item.id === id);
      dataRecord = al as unknown as InspectorData;
      if (al) {
        title = al.title;
        subtitle = `${al.id} • ${al.type} • ${al.severity}`;
      }
      break;
    }
    case 'HistoricalCase': {
      const hc = historicalCases.find((item) => item.id === id);
      dataRecord = hc as unknown as InspectorData;
      if (hc) {
        title = hc.title;
        subtitle = `${hc.id} • ${hc.year} • Similarity: ${hc.similarity}%`;
      }
      break;
    }
    case 'ForensicRecord': {
      const fr = forensicRecords.find((item) => item.id === id);
      dataRecord = fr as unknown as InspectorData;
      if (fr) {
        title = `${fr.category} Analysis (${fr.id})`;
        subtitle = `Match: ${fr.matchPercentage}% • ${fr.status}`;
      }
      break;
    }
  }

  const handleAddToWatchlist = () => {
    dispatch(
      addToWatchlist({
        entityId: id,
        entityType: (type as EntityType) || 'Person',
        entityName: title,
        reason: 'Added via Right-Side Entity Inspector',
      })
    );
    toast.success(`Added ${id} (${title}) to Surveillance Watchlist`);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[420px] max-w-full flex flex-col border-l shadow-2xl animate-slide-in-right glass-panel-elevated"
      style={{ borderColor: 'var(--border-strong)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
            style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
            {type} Inspector
          </span>
          <span className="text-[11px] font-mono-id" style={{ color: 'var(--ink-tertiary)' }}>{id}</span>
        </div>
        <button
          onClick={() => dispatch(closeInspector())}
          className="p-1 rounded hover:bg-[var(--surface-2)] transition-colors"
          style={{ color: 'var(--ink-tertiary)' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Title block */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-[15px] font-semibold tracking-tight truncate" style={{ color: 'var(--ink-primary)' }}>
          {title}
        </h3>
        <p className="text-[12px] font-mono-id mt-0.5 truncate" style={{ color: 'var(--ink-secondary)' }}>
          {subtitle}
        </p>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            onClick={handleAddToWatchlist}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium border hover:bg-[var(--surface-2)] transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
          >
            <BookmarkPlus size={13} />
            <span>Watchlist</span>
          </button>

          {type === 'Person' && (
            <>
              <Link
                href={`/people/${id}`}
                onClick={() => dispatch(closeInspector())}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)' }}
              >
                <User size={13} />
                <span>History Profile</span>
              </Link>
              <Link
                href={`/network`}
                onClick={() => dispatch(closeInspector())}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-medium border hover:bg-[var(--surface-2)] transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
              >
                <Activity size={13} />
                <span>Graph</span>
              </Link>
            </>
          )}

          {type === 'Case' && (
            <Link
              href={`/cases/${id}`}
              onClick={() => dispatch(closeInspector())}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] font-medium border hover:bg-[var(--surface-2)] transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
            >
              <ExternalLink size={13} />
              <span>Full Workspace</span>
            </Link>
          )}
        </div>
      </div>

      {/* Content scroll area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Overview Section */}
        <div>
          <h4 className="text-[11px] font-semibold tracking-wider uppercase mb-2" style={{ color: 'var(--ink-tertiary)' }}>
            Investigative Overview
          </h4>
          <div className="p-3 rounded-md text-[13px] leading-relaxed border"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            {dataRecord?.description || dataRecord?.details || dataRecord?.reason || (
              <span>
                Entity catalogued in TRINETRA intelligence database. Investigative relevance identified across connected multi-agency records.
              </span>
            )}
          </div>
        </div>

        {/* Metadata Details */}
        <div>
          <h4 className="text-[11px] font-semibold tracking-wider uppercase mb-2" style={{ color: 'var(--ink-tertiary)' }}>
            Attributes &amp; Metadata
          </h4>
          <div className="rounded-md border divide-y overflow-hidden text-[12px]" style={{ borderColor: 'var(--border)' }}>
            {dataRecord &&
              Object.entries(dataRecord)
                .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
                .slice(0, 8)
                .map(([key, val]) => (
                  <div key={key} className="flex justify-between px-3 py-1.5 bg-[var(--surface-1)]">
                    <span className="capitalize" style={{ color: 'var(--ink-secondary)' }}>
                      {key.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <span className="font-mono-id font-medium" style={{ color: 'var(--ink-primary)' }}>
                      {String(val)}
                    </span>
                  </div>
                ))}
          </div>
        </div>

        {/* Cross-module Connections */}
        <div>
          <h4 className="text-[11px] font-semibold tracking-wider uppercase mb-2" style={{ color: 'var(--ink-tertiary)' }}>
            Cross-Module Relationships
          </h4>
          <div className="space-y-1.5">
            {Boolean(dataRecord?.caseIds && dataRecord.caseIds.length > 0) && (
              <div className="p-2 rounded border flex items-center justify-between text-[12px]"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
                <span className="flex items-center gap-1.5" style={{ color: 'var(--ink-secondary)' }}>
                  <FolderOpen size={13} /> Linked Cases
                </span>
                <div className="flex gap-1">
                  {dataRecord?.caseIds?.slice(0, 3).map((cid: string) => (
                    <button
                      key={cid}
                      onClick={() => dispatch(openInspector({ id: cid, type: 'Case' }))}
                      className="font-mono-id px-1.5 py-0.5 rounded text-[11px] bg-[var(--surface-2)] text-[var(--accent)] hover:underline"
                    >
                      {cid}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {Boolean(dataRecord?.personIds && dataRecord.personIds.length > 0) && (
              <div className="p-2 rounded border flex items-center justify-between text-[12px]"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
                <span className="flex items-center gap-1.5" style={{ color: 'var(--ink-secondary)' }}>
                  <User size={13} /> Associated People
                </span>
                <div className="flex gap-1">
                  {dataRecord?.personIds?.slice(0, 3).map((pid: string) => (
                    <button
                      key={pid}
                      onClick={() => dispatch(openInspector({ id: pid, type: 'Person' }))}
                      className="font-mono-id px-1.5 py-0.5 rounded text-[11px] bg-[var(--surface-2)] text-[var(--accent)] hover:underline"
                    >
                      {pid}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {Boolean(dataRecord?.vehicleIds && dataRecord.vehicleIds.length > 0) && (
              <div className="p-2 rounded border flex items-center justify-between text-[12px]"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
                <span className="flex items-center gap-1.5" style={{ color: 'var(--ink-secondary)' }}>
                  <Car size={13} /> Registered Vehicles
                </span>
                <div className="flex gap-1">
                  {dataRecord?.vehicleIds?.slice(0, 2).map((vid: string) => (
                    <button
                      key={vid}
                      onClick={() => dispatch(openInspector({ id: vid, type: 'Vehicle' }))}
                      className="font-mono-id px-1.5 py-0.5 rounded text-[11px] bg-[var(--surface-2)] text-[var(--accent)] hover:underline"
                    >
                      {vid}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {Boolean(dataRecord?.evidenceIds && dataRecord.evidenceIds.length > 0) && (
              <div className="p-2 rounded border flex items-center justify-between text-[12px]"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
                <span className="flex items-center gap-1.5" style={{ color: 'var(--ink-secondary)' }}>
                  <Package size={13} /> Evidence Items
                </span>
                <div className="flex gap-1">
                  {dataRecord?.evidenceIds?.slice(0, 3).map((eid: string) => (
                    <button
                      key={eid}
                      onClick={() => dispatch(openInspector({ id: eid, type: 'Evidence' }))}
                      className="font-mono-id px-1.5 py-0.5 rounded text-[11px] bg-[var(--surface-2)] text-[var(--accent)] hover:underline"
                    >
                      {eid}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cautionary notice */}
        <div className="p-2.5 rounded text-[11px] border flex gap-2"
          style={{ background: 'var(--warning-muted)', borderColor: 'rgba(245,158,11,0.2)', color: '#D97706' }}>
          <ShieldAlert size={15} className="shrink-0 mt-0.5" />
          <span>
            Synthetic intelligence record. Represents investigative connectivity and potential evidentiary correlation, not confirmed judicial finding.
          </span>
        </div>
      </div>
    </div>
  );
}
