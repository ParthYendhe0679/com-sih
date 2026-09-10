'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { setCommandPaletteOpen } from '@/store/slices/uiSlice';
import { searchApi } from '@/lib/api/search';
import { mockSearchService } from '@/services/mockServices';
import {
  Search, FolderOpen, User, Car, FileText, MapPin, Building2,
  Network, Map, History, Package, Bot, BrainCircuit, X, Loader2
} from 'lucide-react';

const actionItems = [
  { label: 'Open Cases', icon: FolderOpen, action: '/cases' },
  { label: 'Ingest Offline FIR', icon: FileText, action: '/fir' },
  { label: 'Police Triage Queue', icon: FileText, action: '/police' },
  { label: 'Run TRINETRA Analysis', icon: BrainCircuit, action: '/intelligence/samanvaya' },
  { label: 'Open Network Analysis', icon: Network, action: '/network' },
  { label: 'Open Geospatial Map', icon: Map, action: '/map' },
  { label: 'Search Historical Intelligence', icon: History, action: '/historical' },
  { label: 'Open Evidence Hub', icon: Package, action: '/evidence' },
  { label: 'Ask TRINETRA AI', icon: Bot, action: '/ai' },
];

const typeIcons: Record<string, React.ElementType> = {
  Case: FolderOpen, Person: User, Vehicle: Car, Evidence: Package,
  Organization: Building2, Location: MapPin, FIR: FileText,
};

export default function CommandPalette() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector(s => s.ui.commandPaletteOpen);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ type: string; id: string; routeId?: string; title: string; subtitle: string }[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searching, setSearching] = useState(false);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        dispatch(setCommandPaletteOpen(!isOpen));
      }
      if (e.key === 'Escape' && isOpen) {
        dispatch(setCommandPaletteOpen(false));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch, isOpen]);

  // Real Multi-Entity Search with graceful fallback
  useEffect(() => {
    let active = true;
    if (query.trim().length >= 2) {
      setSearching(true);
      searchApi.search(query.trim())
        .then(res => {
          if (!active) return;
          const mapped: { type: string; id: string; routeId?: string; title: string; subtitle: string }[] = [];
          if (res.cases && res.cases.length > 0) {
            for (const c of res.cases) {
              mapped.push({
                type: 'Case',
                id: c.case_number || c.id,
                routeId: c.id,
                title: c.title,
                subtitle: `${c.case_number} • ${c.crime_category || 'General'} • ${c.status}`,
              });
            }
          }
          if (res.firs && res.firs.length > 0) {
            for (const f of res.firs) {
              mapped.push({
                type: 'FIR',
                id: f.fir_number || f.id,
                title: f.title || f.crime_category || 'FIR Record',
                subtitle: `${f.fir_number} • ${f.description?.slice(0, 45) || f.crime_category || 'Incident Report'} • ${f.status}`,
              });
            }
          }
          if (mapped.length > 0) {
            setResults(mapped);
            setSelectedIndex(0);
          } else {
            // If backend search returned 0 items, check mock dataset
            mockSearchService.search(query).then(mockRes => {
              if (active) {
                setResults(mockRes);
                setSelectedIndex(0);
              }
            });
          }
        })
        .catch(() => {
          // Backend token not present or endpoint failed -> fallback to mock
          if (active) {
            mockSearchService.search(query).then(mockRes => {
              if (active) {
                setResults(mockRes);
                setSelectedIndex(0);
              }
            });
          }
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    } else {
      setResults([]);
      setSearching(false);
    }
    return () => {
      active = false;
    };
  }, [query]);

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    if (newQuery.length < 2) {
      setResults([]);
    }
  };

  const navigate = useCallback((path: string) => {
    dispatch(setCommandPaletteOpen(false));
    setQuery('');
    setResults([]);
    router.push(path);
  }, [dispatch, router]);

  const handleSelect = useCallback((item: { type: string; id: string; routeId?: string }) => {
    const routes: Record<string, string> = {
      Case: `/cases/${item.routeId || item.id}`,
      Person: `/network?entity=${item.id}`,
      Vehicle: `/network?entity=${item.id}`,
      Evidence: `/evidence`,
      Organization: `/network?entity=${item.id}`,
      Location: `/map`,
      FIR: `/fir`,
    };
    navigate(routes[item.type] || '/dashboard');
  }, [navigate]);

  // Keyboard nav
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const totalItems = results.length > 0 ? results.length : actionItems.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => (i + 1) % totalItems); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => (i - 1 + totalItems) % totalItems); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0) {
        handleSelect(results[selectedIndex]);
      } else {
        navigate(actionItems[selectedIndex].action);
      }
    }
  }, [results, selectedIndex, handleSelect, navigate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]" onClick={() => dispatch(setCommandPaletteOpen(false))}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 animate-fade-in" />

      {/* Palette */}
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-[560px] max-h-[420px] rounded-lg shadow-2xl overflow-hidden animate-slide-in-down"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-strong)' }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 h-[48px] border-b" style={{ borderColor: 'var(--border)' }}>
          <Search size={16} strokeWidth={1.5} style={{ color: 'var(--ink-tertiary)' }} />
          <input
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search cases, people, evidence... or type a command"
            autoFocus
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--ink-tertiary)]"
            style={{ color: 'var(--ink-primary)' }}
          />
          <button onClick={() => dispatch(setCommandPaletteOpen(false))} className="p-1 rounded hover:bg-[var(--surface-2)]">
            <X size={14} style={{ color: 'var(--ink-tertiary)' }} />
          </button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto max-h-[360px] py-2">
          {results.length > 0 ? (
            <div>
              <div className="px-4 py-1 text-[11px] font-medium tracking-wider" style={{ color: 'var(--ink-tertiary)' }}>
                RESULTS
              </div>
              {results.map((item, i) => {
                const Icon = typeIcons[item.type] || FileText;
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item)}
                    className="flex items-center gap-3 w-full px-4 py-2 text-left transition-colors"
                    style={{
                      background: i === selectedIndex ? 'var(--accent-muted)' : 'transparent',
                      color: 'var(--ink-primary)',
                    }}
                  >
                    <Icon size={14} strokeWidth={1.5} style={{ color: 'var(--ink-tertiary)' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">{item.title}</div>
                      <div className="text-[11px] font-mono-id truncate" style={{ color: 'var(--ink-tertiary)' }}>
                        {item.subtitle}
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--ink-tertiary)' }}>
                      {item.type}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : query.length === 0 ? (
            <div>
              <div className="px-4 py-1 text-[11px] font-medium tracking-wider" style={{ color: 'var(--ink-tertiary)' }}>
                ACTIONS
              </div>
              {actionItems.map((item, i) => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.action)}
                  className="flex items-center gap-3 w-full px-4 py-2 text-left transition-colors"
                  style={{
                    background: i === selectedIndex ? 'var(--accent-muted)' : 'transparent',
                    color: 'var(--ink-primary)',
                  }}
                >
                  <item.icon size={14} strokeWidth={1.5} style={{ color: 'var(--ink-tertiary)' }} />
                  <span className="text-[13px]">{item.label}</span>
                </button>
              ))}
              <div className="px-4 py-3 text-[11px] border-t mt-2" style={{ color: 'var(--ink-tertiary)', borderColor: 'var(--border)' }}>
                <span className="font-medium">Tip:</span> Search by Case ID, Person Name, Vehicle Plate, or Crime Type
              </div>
            </div>
          ) : query.length < 2 ? (
            <div className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--ink-tertiary)' }}>
              Type at least 2 characters to search
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-[13px]" style={{ color: 'var(--ink-tertiary)' }}>
              No results found for &quot;{query}&quot;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
