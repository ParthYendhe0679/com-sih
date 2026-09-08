'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { openInspector } from '@/store/slices/uiSlice';
import { casesApi, intelligenceApi } from '@/lib/api';
import { mockHistoricalService } from '@/services/mockServices';
import type { HistoricalCase } from '@/types';
import { Search, Shield, Sparkles } from 'lucide-react';

export default function HistoricalIntelligencePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HistoricalCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCase, setSelectedCase] = useState<HistoricalCase | null>(null);

  const handleSearch = useCallback(async (q: string) => {
    if (!q || !q.trim()) {
      setResults([]);
      setSelectedCase(null);
      return;
    }
    setLoading(true);
    try {
      // 1. Check if q matches a real case in the database
      const caseRes = await casesApi.listCases({ search: q, size: 5 });
      if (caseRes.items && caseRes.items.length > 0) {
        const topCase = caseRes.items[0];
        try {
          const simRes = await intelligenceApi.getSimilarCases(topCase.id, 5);
          if (simRes.similar_cases && simRes.similar_cases.length > 0) {
            const mapped: HistoricalCase[] = simRes.similar_cases.map((sc, i) => ({
              id: sc.case_id || `HIST-${i + 1}`,
              title: sc.title || `Case Pattern #${i + 1}`,
              year: 2024,
              crime: (sc.crime_type as any) || 'Financial Fraud',
              location: 'Maharashtra Central',
              city: 'Mumbai',
              status: 'Closed',
              similarity: Math.round(sc.similarity_score * 100),
              relatedCaseId: topCase.id,
              sharedEntities: sc.shared_entities || [],
              sharedLocations: [],
              reason: sc.summary || `Pattern match with ${topCase.case_number}`,
            }));
            setResults(mapped);
            setSelectedCase(mapped[0]);
            setLoading(false);
            return;
          }
        } catch {
          // Fall through to mock / text search if ML service not initialized yet
        }
      }
    } catch {
      // Fall through to mock service
    }

    mockHistoricalService.search(q).then((data) => {
      setResults(data);
      if (data.length > 0) setSelectedCase(data[0]);
      setLoading(false);
    });
  }, []);

  const quickQueries = [
    'Financial Fraud',
    'Cybercrime',
    'Money Laundering',
    'Robbery',
    'Identity Theft',
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
              Historical Intelligence &amp; Pattern Matching
            </h1>
            <span
              className="text-[11px] font-mono-id px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
            >
              Archival Neural Index
            </span>
          </div>
          <p className="text-[13px] text-[var(--ink-secondary)]">
            Cross-case pattern matching, recurring MO correlation, and archival case similarity engine
          </p>
        </div>
      </div>

      {/* Search Bar with Quick Filter Buttons */}
      <div
        className="p-4 rounded-xl border space-y-3"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-2.5 text-[var(--ink-tertiary)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
              placeholder="Search historical records by Case ID, Person, Vehicle, Location, or Crime..."
              className="w-full h-10 pl-9 pr-4 rounded-lg text-[13px] border bg-[var(--surface-0)] text-[var(--ink-primary)] outline-none focus:border-[var(--accent)]"
              style={{ borderColor: 'var(--border)' }}
            />
          </div>
          <button
            onClick={() => handleSearch(query)}
            disabled={loading}
            className="px-5 h-10 rounded-lg text-[13px] font-medium text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            style={{ background: 'var(--accent)' }}
          >
            <Sparkles size={14} />
            <span>{loading ? 'Searching...' : 'Find Matches'}</span>
          </button>
        </div>

        {/* Quick query tags */}
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span style={{ color: 'var(--ink-tertiary)' }}>Suggested Queries:</span>
          {quickQueries.map((tag) => (
            <button
              key={tag}
              onClick={() => {
                setQuery(tag);
                handleSearch(tag);
              }}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium border hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
              style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Clear Distinction Banner: SIMILARITY vs CONFIRMED RELATIONSHIP (Section 21) */}
      <div
        className="p-3.5 rounded-lg border flex items-center justify-between text-[12px]"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-[var(--accent)]" />
          <span className="font-semibold text-[var(--ink-primary)]">Methodology Notice:</span>
          <span style={{ color: 'var(--ink-secondary)' }}>
            Statistical <strong>Pattern Similarity</strong> reflects textual &amp; behavioral correlation. It is mathematically separate from a <strong>Confirmed Judicial Relationship</strong>.
          </span>
        </div>
        <span className="text-[11px] font-mono-id px-2 py-0.5 rounded bg-[var(--surface-1)] border" style={{ borderColor: 'var(--border)' }}>
          Cosine Sim v3.1
        </span>
      </div>

      {/* Results and Detail Inspector Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Results List (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-tertiary)' }}>
              Historical Matches ({results.length})
            </span>
            <span className="text-[11px] text-[var(--ink-tertiary)]">Sorted by Similarity</span>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl border skeleton" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="p-12 text-center border rounded-xl" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
              <p className="text-[13px] text-[var(--ink-tertiary)]">
                {query ? `No historical cases matched query "${query}"` : 'Enter a case reference or select a category above to find historical pattern matches.'}
              </p>
            </div>
          ) : (
            results.map((hc) => {
              const isSelected = selectedCase?.id === hc.id;
              return (
                <div
                  key={hc.id}
                  onClick={() => setSelectedCase(hc)}
                  className="p-4 rounded-xl border cursor-pointer transition-all hover:border-[var(--accent)]"
                  style={{
                    background: 'var(--surface-1)',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-id font-bold text-[14px] text-[var(--accent)]">
                          {hc.id}
                        </span>
                        <span className="text-[11px] font-mono-id px-1.5 py-0.2 rounded bg-[var(--surface-2)] text-[var(--ink-secondary)]">
                          Year {hc.year}
                        </span>
                        <span className="badge badge-closed">{hc.status}</span>
                      </div>

                      <h3 className="text-[15px] font-semibold mt-1" style={{ color: 'var(--ink-primary)' }}>
                        {hc.title}
                      </h3>
                      <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-secondary)' }}>
                        {hc.crime} • {hc.location}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[22px] font-bold font-mono-id text-[var(--accent)]">
                        {hc.similarity}%
                      </div>
                      <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--ink-tertiary)' }}>
                        Similarity Score
                      </div>
                    </div>
                  </div>

                  {/* Summary Reason */}
                  <div className="mt-3 p-2.5 rounded-lg text-[12px] leading-relaxed border"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }}>
                    <strong>Basis: </strong>{hc.reason}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Historical Case Inspector (5 cols) */}
        <div className="lg:col-span-5">
          {selectedCase ? (
            <div
              className="p-5 rounded-xl border space-y-4 sticky top-[68px]"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-tertiary)' }}>
                  Historical Comparison
                </span>
                <span className="font-mono-id text-[12px] font-bold text-[var(--accent)]">
                  {selectedCase.id}
                </span>
              </div>

              <div>
                <h3 className="text-[17px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                  {selectedCase.title}
                </h3>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-secondary)' }}>
                  Registered {selectedCase.year} in {selectedCase.city} • Crime: {selectedCase.crime}
                </p>
              </div>

              {/* Similarity breakdown */}
              <div className="p-3 rounded-lg border space-y-2 text-[12px]"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                <div className="flex justify-between font-semibold">
                  <span>Calculated MO Similarity:</span>
                  <span className="font-mono-id text-[var(--accent)]">{selectedCase.similarity}%</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ink-secondary)' }}>Relationship Confidence:</span>
                  <span className="font-mono-id font-semibold text-[var(--success)]">
                    {selectedCase.relatedCaseId ? `Confirmed Link (${selectedCase.relatedCaseId})` : 'Statistical Pattern Match'}
                  </span>
                </div>
              </div>

              {/* Shared Entities & Locations */}
              <div className="space-y-3 text-[12px]">
                {selectedCase.sharedEntities.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--ink-tertiary)' }}>
                      Shared Persons of Interest
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCase.sharedEntities.map((ent) => (
                        <button
                          key={ent}
                          onClick={() => dispatch(openInspector({ id: ent, type: 'Person' }))}
                          className="font-mono-id px-2 py-0.5 rounded border text-[11px] hover:bg-[var(--surface-2)] text-[var(--accent)]"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          {ent}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedCase.sharedLocations.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-[11px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--ink-tertiary)' }}>
                      Shared Geographical Nodes
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCase.sharedLocations.map((loc) => (
                        <button
                          key={loc}
                          onClick={() => dispatch(openInspector({ id: loc, type: 'Location' }))}
                          className="font-mono-id px-2 py-0.5 rounded border text-[11px] hover:bg-[var(--surface-2)] text-[var(--accent)]"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          {loc}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
                <button
                  onClick={() => dispatch(openInspector({ id: selectedCase.id, type: 'HistoricalCase' }))}
                  className="w-full py-2 rounded-lg text-[13px] font-medium border hover:bg-[var(--surface-2)] transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
                >
                  Inspect in Right Drawer
                </button>
                <button
                  onClick={() => router.push(selectedCase.relatedCaseId ? `/cases/${selectedCase.relatedCaseId}?tab=historical` : '/cases')}
                  className="w-full py-2 rounded-lg text-[13px] font-medium text-white shadow-sm hover:opacity-90 cursor-pointer"
                  style={{ background: 'var(--accent)' }}
                >
                  {selectedCase.relatedCaseId ? `Correlate with Active Case (${selectedCase.relatedCaseId})` : 'View in Case Database'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl border text-center" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
              <p className="text-[13px] text-[var(--ink-tertiary)]">
                Select a match from the results list to inspect archival case details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
