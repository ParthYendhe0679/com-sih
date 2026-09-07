'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { openInspector } from '@/store/slices/uiSlice';
import {
  cases, people, vehicles, phones, locations, organizations,
  evidence, historicalCases, firs
} from '@/mock';
import {
  Search, FolderOpen, User, Car, Phone, MapPin, Building2,
  Package, History, FileText, ArrowRight, Filter, ChevronRight
} from 'lucide-react';

interface SearchResultItem {
  type: string;
  id: string;
  name: string;
  category: string;
  relatedCases: string[];
  lastActivity: string;
}

export default function CaseSearcherPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [searchQuery, setSearchQuery] = useState('');
  const [targetDimension, setTargetDimension] = useState<string>('all');

  const executeSearch = (): SearchResultItem[] => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return [];

    const results: SearchResultItem[] = [];

    // Cases
    if (targetDimension === 'all' || targetDimension === 'cases') {
      cases
        .filter((c) => c.id.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.crime.toLowerCase().includes(q))
        .forEach((c) => {
          results.push({
            type: 'Case',
            id: c.id,
            name: c.title,
            category: c.crime,
            relatedCases: [c.id],
            lastActivity: c.lastActivity,
          });
        });
    }

    // FIRs
    if (targetDimension === 'all' || targetDimension === 'fir') {
      firs
        .filter((f) => f.id.toLowerCase().includes(q) || f.policeStation.toLowerCase().includes(q) || f.crimeType.toLowerCase().includes(q))
        .forEach((f) => {
          results.push({
            type: 'FIR',
            id: f.id,
            name: `${f.policeStation} (${f.crimeType})`,
            category: 'Legal Document',
            relatedCases: [f.caseId],
            lastActivity: f.date,
          });
        });
    }

    // People
    if (targetDimension === 'all' || targetDimension === 'people') {
      people
        .filter((p) => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q))
        .forEach((p) => {
          results.push({
            type: 'Person',
            id: p.id,
            name: p.name,
            category: p.role,
            relatedCases: p.caseIds,
            lastActivity: '2026-09-03',
          });
        });
    }

    // Vehicles
    if (targetDimension === 'all' || targetDimension === 'vehicles') {
      vehicles
        .filter((v) => v.id.toLowerCase().includes(q) || v.registrationNumber.toLowerCase().includes(q) || v.make.toLowerCase().includes(q))
        .forEach((v) => {
          results.push({
            type: 'Vehicle',
            id: v.id,
            name: `${v.registrationNumber} (${v.make} ${v.model})`,
            category: v.type,
            relatedCases: v.caseIds,
            lastActivity: '2026-09-03',
          });
        });
    }

    // Phones
    if (targetDimension === 'all' || targetDimension === 'phones') {
      phones
        .filter((ph) => ph.id.toLowerCase().includes(q) || ph.number.includes(q) || ph.imei.includes(q))
        .forEach((ph) => {
          results.push({
            type: 'Phone',
            id: ph.id,
            name: ph.number,
            category: ph.carrier,
            relatedCases: ph.caseIds,
            lastActivity: '2026-09-02',
          });
        });
    }

    // Locations
    if (targetDimension === 'all' || targetDimension === 'locations') {
      locations
        .filter((l) => l.id.toLowerCase().includes(q) || l.name.toLowerCase().includes(q) || l.address.toLowerCase().includes(q))
        .forEach((l) => {
          results.push({
            type: 'Location',
            id: l.id,
            name: l.name,
            category: l.type,
            relatedCases: l.caseIds,
            lastActivity: '2026-09-03',
          });
        });
    }

    // Organizations
    if (targetDimension === 'all' || targetDimension === 'organizations') {
      organizations
        .filter((o) => o.id.toLowerCase().includes(q) || o.name.toLowerCase().includes(q))
        .forEach((o) => {
          results.push({
            type: 'Organization',
            id: o.id,
            name: o.name,
            category: o.type,
            relatedCases: o.caseIds,
            lastActivity: '2026-08-30',
          });
        });
    }

    // Evidence
    if (targetDimension === 'all' || targetDimension === 'evidence') {
      evidence
        .filter((e) => e.id.toLowerCase().includes(q) || e.title.toLowerCase().includes(q))
        .forEach((e) => {
          results.push({
            type: 'Evidence',
            id: e.id,
            name: e.title,
            category: e.type,
            relatedCases: [e.caseId],
            lastActivity: e.date,
          });
        });
    }

    return results;
  };

  const results = executeSearch();

  const handleSelectResult = (item: SearchResultItem) => {
    if (item.type === 'Case') {
      router.push(`/cases/${item.id}`);
    } else if (item.type === 'FIR') {
      router.push('/fir');
    } else {
      dispatch(openInspector({ id: item.id, type: item.type }));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-[20px] font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
          Multi-Dimensional Case Searcher
        </h1>
        <p className="text-[13px] text-[var(--ink-secondary)]">
          Search across 8 investigative dimensions: Case ID, FIR, Person, Vehicle, Phone, Location, Org, and Evidence
        </p>
      </div>

      {/* Query Builder Panel */}
      <div
        className="p-5 rounded-2xl border space-y-4 glass-panel-elevated"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3.5 top-3 text-[var(--ink-tertiary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across all intelligence entities (e.g., CASE-102, Aarav Mehta, Fortuner, Juhu)..."
              className="w-full h-11 pl-10 pr-4 rounded-xl border bg-[var(--surface-0)] text-[13px] text-[var(--ink-primary)] outline-none focus:border-[var(--accent)]"
              style={{ borderColor: 'var(--border)' }}
              autoFocus
            />
          </div>

          <select
            value={targetDimension}
            onChange={(e) => setTargetDimension(e.target.value)}
            className="h-11 px-3 rounded-xl border bg-[var(--surface-1)] text-[13px] text-[var(--ink-secondary)] outline-none w-full sm:w-auto"
            style={{ borderColor: 'var(--border)' }}
          >
            <option value="all">All Dimensions</option>
            <option value="cases">Cases Only</option>
            <option value="fir">FIRs Only</option>
            <option value="people">People</option>
            <option value="vehicles">Vehicles</option>
            <option value="phones">Phones</option>
            <option value="locations">Locations</option>
            <option value="organizations">Organizations</option>
            <option value="evidence">Evidence</option>
          </select>
        </div>

        {/* Suggested Quick Searches */}
        <div className="flex flex-wrap items-center gap-2 text-[12px] pt-1">
          <span style={{ color: 'var(--ink-tertiary)' }}>Suggested Queries:</span>
          {['CASE-102', 'PERSON-014', 'Nexus Trading', 'MH-02-CD-4411', 'Juhu Tara Road', 'FIR-2026-0102'].map((tag) => (
            <button
              key={tag}
              onClick={() => setSearchQuery(tag)}
              className="px-2.5 py-1 rounded-md text-[11px] font-mono-id border hover:bg-[var(--surface-2)] transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Results Ledger */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--ink-tertiary)]">
            Correlated Records ({results.length})
          </span>
        </div>

        {results.length === 0 ? (
          <div className="p-12 text-center border rounded-2xl glass-panel" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[13px] text-[var(--ink-tertiary)]">
              {searchQuery ? `No records found matching "${searchQuery}".` : 'Enter a search term above to query the intelligence database.'}
            </p>
          </div>
        ) : (
          <div className="divide-y rounded-2xl border overflow-hidden glass-panel-elevated" style={{ borderColor: 'var(--border)' }}>
            {results.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                onClick={() => handleSelectResult(item)}
                className="p-4 flex items-center justify-between hover:bg-[var(--accent-muted)] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[12px] font-mono-id font-bold"
                    style={{ background: 'var(--glass-2)', color: 'var(--accent)' }}
                  >
                    {item.type.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[14px] truncate" style={{ color: 'var(--ink-primary)' }}>
                        {item.name}
                      </span>
                      <span className="font-mono-id text-[11px] text-[var(--accent)] font-semibold">
                        {item.id}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--ink-secondary)] truncate mt-0.5">
                      {item.category} • Linked to: {item.relatedCases.join(', ')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] font-mono-id text-[var(--ink-tertiary)] hidden sm:inline">
                    Active: {item.lastActivity}
                  </span>
                  <ChevronRight size={16} className="text-[var(--ink-tertiary)]" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
