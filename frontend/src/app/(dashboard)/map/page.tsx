'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { casesApi, BackendCase } from '@/lib/api/cases';
import { Map, FolderOpen, ArrowRight, Loader2 } from 'lucide-react';

export default function MapContextualPage() {
  const router = useRouter();
  const [cases, setCases] = useState<BackendCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const res = await casesApi.listCases({ size: 20 });
        const items = res.items || [];
        setCases(items);
        const saved = typeof window !== 'undefined' ? localStorage.getItem('kritagas_active_case') : null;
        if (saved && items.some(c => c.id === saved || c.case_number === saved)) {
          router.replace(`/cases/${saved}?tab=map`);
          return;
        }
        if (items.length === 1) {
          router.replace(`/cases/${items[0].case_number || items[0].id}?tab=map`);
          return;
        }
      } catch (err) {
        console.warn('Map router notice:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [router]);

  if (loading) {
    return (
      <div className="py-24 text-center text-[var(--ink-tertiary)] animate-pulse">
        <Loader2 size={32} className="mx-auto mb-2 animate-spin text-[var(--accent)]" />
        <p className="text-[13px]">Contextualizing geographic intelligence map...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in py-6">
      <div className="p-8 rounded-2xl border glass-panel space-y-3 text-center" style={{ borderColor: 'var(--border)' }}>
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-[var(--accent)] bg-[var(--accent-muted)]">
          <Map size={28} />
        </div>
        <h2 className="text-[20px] font-bold" style={{ color: 'var(--ink-primary)' }}>
          Case Geographic Intelligence Map
        </h2>
        <p className="text-[13px] text-[var(--ink-secondary)] max-w-lg mx-auto">
          Geographic intelligence and incident sightings are bound to investigation dossiers. Select an active case to open its tactical GIS map.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
          Select Investigation Case ({cases.length})
        </h3>
        {cases.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed text-center text-[var(--ink-tertiary)]" style={{ borderColor: 'var(--border)' }}>
            <FolderOpen size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-[13px]">No active cases found in database. Ingest an FIR to create a case.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cases.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  localStorage.setItem('kritagas_active_case', c.case_number || c.id);
                  router.push(`/cases/${c.case_number || c.id}?tab=map`);
                }}
                className="p-4 rounded-xl border text-left flex items-center justify-between hover:border-[var(--accent)] transition-all glass-panel cursor-pointer"
                style={{ borderColor: 'var(--border)' }}
              >
                <div>
                  <div className="font-mono-id font-bold text-[12.5px] text-[var(--accent)]">{c.case_number}</div>
                  <div className="font-semibold text-[13.5px] mt-0.5 line-clamp-1" style={{ color: 'var(--ink-primary)' }}>{c.title}</div>
                  <div className="text-[11.5px] text-[var(--ink-tertiary)] mt-0.5">{c.crime_category} • {c.status}</div>
                </div>
                <ArrowRight size={16} className="text-[var(--ink-tertiary)]" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
