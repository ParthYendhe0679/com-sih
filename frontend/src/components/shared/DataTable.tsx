'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, Square
} from 'lucide-react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  pageSize?: number;
  loading?: boolean;
  emptyMessage?: string;
  bulkActions?: {
    label: string;
    action: (selectedItems: T[]) => void;
  }[];
}

export default function DataTable<T extends object>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  pageSize = 15,
  loading = false,
  emptyMessage = 'No records found matching current criteria.',
  bulkActions,
}: DataTableProps<T>) {
  // The server renders this table before any data has been fetched, so it emits
  // skeleton rows. By the time React hydrates, the client often already has the
  // rows — the two trees disagree and hydration fails. Holding the skeleton for
  // the first client paint makes both renders identical.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const showSkeleton = loading || !hydrated;

  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const valA = (a as Record<string, unknown>)[sortKey];
      const valB = (b as Record<string, unknown>)[sortKey];
      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      return sortOrder === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [data, sortKey, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else {
        setSortKey(null);
        setSortOrder('asc');
      }
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedKeys.size === paginatedData.length && paginatedData.length > 0) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(paginatedData.map((d) => keyExtractor(d))));
    }
  };

  const toggleSelect = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedKeys(next);
  };

  const activeColumns = columns;

  return (
    <div className="flex flex-col rounded-lg border overflow-hidden" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
      {/* Bulk action toolbar if items selected */}
      {selectedKeys.size > 0 && bulkActions && bulkActions.length > 0 && (
        <div
          className="px-4 py-2 border-b flex items-center justify-between text-[12px] animate-fade-in"
          style={{ background: 'var(--accent-muted)', borderColor: 'var(--border)' }}
        >
          <span className="font-medium" style={{ color: 'var(--accent)' }}>
            {selectedKeys.size} item{selectedKeys.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            {bulkActions.map((ba) => (
              <button
                key={ba.label}
                onClick={() => {
                  const selectedItems = data.filter((d) => selectedKeys.has(keyExtractor(d)));
                  ba.action(selectedItems);
                  setSelectedKeys(new Set());
                }}
                className="px-2.5 py-1 rounded bg-[var(--surface-1)] border font-medium hover:bg-[var(--surface-2)] transition-colors"
                style={{ borderColor: 'var(--border)' }}
              >
                {ba.label}
              </button>
            ))}
            <button
              onClick={() => setSelectedKeys(new Set())}
              className="text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)] px-2 py-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table container */}
      <div className="overflow-x-auto max-h-[640px]">
        <table className="w-full border-collapse table-dense text-left">
          <thead>
            <tr>
              {/* Row selection checkbox header */}
              <th className="w-10 text-center">
                <button onClick={handleSelectAll} className="p-1 text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]">
                  {selectedKeys.size > 0 && selectedKeys.size === paginatedData.length ? (
                    <CheckSquare size={14} className="text-[var(--accent)]" />
                  ) : (
                    <Square size={14} />
                  )}
                </button>
              </th>
              {activeColumns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={col.sortable ? 'cursor-pointer select-none' : ''}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="text-[var(--ink-tertiary)]">
                        {sortKey === col.key ? (
                          sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                        ) : (
                          <ArrowUpDown size={11} className="opacity-40" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {showSkeleton ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="w-10 text-center">
                    <div className="w-4 h-4 mx-auto rounded skeleton" />
                  </td>
                  {activeColumns.map((c) => (
                    <td key={c.key}>
                      <div className="h-4 rounded skeleton w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={activeColumns.length + 1} className="py-12 text-center text-[var(--ink-tertiary)]">
                  <div className="max-w-md mx-auto flex flex-col items-center gap-2">
                    <p className="text-[13px]">{emptyMessage}</p>
                    <p className="text-[11px]">Adjust your active filters or clear search query to inspect more records.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((item) => {
                const key = keyExtractor(item);
                const isSelected = selectedKeys.has(key);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(item)}
                    className={onRowClick ? 'cursor-pointer' : ''}
                    style={isSelected ? { background: 'var(--accent-muted)' } : undefined}
                  >
                    <td className="w-10 text-center" onClick={(e) => toggleSelect(key, e)}>
                      <button className="p-1 text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]">
                        {isSelected ? (
                          <CheckSquare size={14} className="text-[var(--accent)]" />
                        ) : (
                          <Square size={14} />
                        )}
                      </button>
                    </td>
                    {activeColumns.map((col) => (
                      <td key={col.key}>
                        {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / Pagination */}
      <div
        className="px-4 py-2 border-t flex flex-wrap items-center justify-between gap-2 text-[12px]"
        style={{ borderColor: 'var(--border)' }}
      >
        <span style={{ color: 'var(--ink-secondary)' }}>
          {/* Counts depend on fetched data, so they only settle after mount.
              Rendering them during hydration produced a 0-vs-1 text mismatch. */}
          {showSkeleton ? (
            'Loading records…'
          ) : (
            <>
              Showing {sortedData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} total records
            </>
          )}
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage <= 1}
            className="p-1 rounded hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronsLeft size={14} />
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1 rounded hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2 font-mono-id" style={{ color: 'var(--ink-primary)' }}>
            {/* totalPages derives from fetched rows, so it differs between the
                server render and the first client render. Hold it until mount. */}
            Page {currentPage} of {showSkeleton ? '–' : totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-1 rounded hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage >= totalPages}
            className="p-1 rounded hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
