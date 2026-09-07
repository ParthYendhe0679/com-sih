'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { setCommandPaletteOpen } from '@/store/slices/uiSlice';
import { mockSearchService } from '@/services/mockServices';
import {
  Search, FolderOpen, User, Car, FileText, MapPin, Building2,
  Network, Map, History, Package, Bot, BrainCircuit, X
} from 'lucide-react';

const actionItems = [
  { label: 'Open Case', icon: FolderOpen, action: '/cases' },
  { label: 'Launch SAMANVAYA Intelligence', icon: BrainCircuit, action: '/intelligence/samanvaya' },
  { label: 'Open Network', icon: Network, action: '/network' },
  { label: 'Open Map', icon: Map, action: '/map' },
  { label: 'Search Historical Intelligence', icon: History, action: '/historical' },
  { label: 'Open Evidence', icon: Package, action: '/evidence' },
  { label: 'Ask KRITAGAS AI', icon: Bot, action: '/ai' },
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
  const [results, setResults] = useState<{ type: string; id: string; title: string; subtitle: string }[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

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

  // Search
  useEffect(() => {
    let active = true;
    if (query.length >= 2) {
      mockSearchService.search(query).then(r => {
        if (active) {
          setResults(r);
          setSelectedIndex(0);
        }
      });
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

  const handleSelect = useCallback((item: { type: string; id: string }) => {
    const routes: Record<string, string> = {
      Case: `/cases/${item.id}`,
      Person: `/cases/CASE-102?entity=${item.id}`,
      Vehicle: `/cases/CASE-102?entity=${item.id}`,
      Evidence: `/evidence`,
      Organization: `/cases/CASE-102?entity=${item.id}`,
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
                <span className="font-medium">Tip:</span> Search by ID (CASE-102, PERSON-014), name, or crime type
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
