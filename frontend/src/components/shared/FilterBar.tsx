'use client';

import React from 'react';
import { Filter, X, Calendar, MapPin, AlertCircle, Shield, Layers } from 'lucide-react';

export interface FilterOption {
  key: string;
  label: string;
  options: { label: string; value: string }[];
  value: string;
  icon?: React.ReactNode;
}

interface FilterBarProps {
  filters: FilterOption[];
  onFilterChange: (key: string, value: string) => void;
  onClearAll: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
}

export default function FilterBar({
  filters,
  onFilterChange,
  onClearAll,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Filter records...',
}: FilterBarProps) {
  const activeCount = filters.filter((f) => f.value !== '' && f.value !== 'all').length + (searchQuery ? 1 : 0);

  return (
    <div
      className="p-3 rounded-lg border flex flex-wrap items-center justify-between gap-3 text-[13px]"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
    >
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
        {/* Search input if provided */}
        {onSearchChange && (
          <div className="relative min-w-[200px] flex-1 max-w-[320px]">
            <input
              type="text"
              value={searchQuery || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-8 px-3 py-1 rounded text-[13px] border bg-[var(--surface-0)] text-[var(--ink-primary)] placeholder:text-[var(--ink-tertiary)] outline-none focus:border-[var(--accent)]"
              style={{ borderColor: 'var(--border)' }}
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-2 text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Dropdown Filters */}
        {filters.map((filter) => (
          <div key={filter.key} className="relative inline-flex items-center">
            <select
              value={filter.value}
              onChange={(e) => onFilterChange(filter.key, e.target.value)}
              className="h-8 px-2.5 py-1 pr-7 text-[12px] font-medium rounded border appearance-none outline-none cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
              style={{
                background: filter.value && filter.value !== 'all' ? 'var(--accent-muted)' : 'var(--surface-1)',
                color: filter.value && filter.value !== 'all' ? 'var(--accent)' : 'var(--ink-secondary)',
                borderColor: filter.value && filter.value !== 'all' ? 'var(--accent)' : 'var(--border)',
              }}
            >
              <option value="all">{filter.label}: All</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {filter.label}: {opt.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2 text-[10px]" style={{ color: 'var(--ink-tertiary)' }}>
              ▼
            </div>
          </div>
        ))}
      </div>

      {/* Right: Active counter & Clear all */}
      <div className="flex items-center gap-2">
        {activeCount > 0 && (
          <>
            <span
              className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
            >
              {activeCount} active filter{activeCount > 1 ? 's' : ''}
            </span>
            <button
              onClick={onClearAll}
              className="flex items-center gap-1 text-[12px] font-medium px-2 py-1 rounded hover:bg-[var(--surface-2)] transition-colors"
              style={{ color: 'var(--ink-tertiary)' }}
            >
              <X size={12} />
              <span>Clear all</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
