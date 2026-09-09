'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { casesApi, BackendCase, invalidateClientCaseCache } from '@/lib/api/cases';

export interface CaseStoreContextType {
  cases: BackendCase[];
  activeCaseId: string | null;
  activeCase: BackendCase | null;
  loading: boolean;
  error: string | null;
  refreshCases: () => Promise<BackendCase[]>;
  selectCase: (caseId: string) => void;
  createCase: (data: any) => Promise<BackendCase>;
  createCaseFromFir: (firId: string) => Promise<BackendCase>;
  updateCase: (caseId: string, data: any) => Promise<BackendCase>;
}

const CaseContext = createContext<CaseStoreContextType | undefined>(undefined);

const ACTIVE_CASE_STORAGE_KEY = 'kritagas_active_case_id';

export function CaseProvider({ children }: { children: React.ReactNode }) {
  const [cases, setCases] = useState<BackendCase[]>(() => {
    return casesApi.getCachedCases() || [];
  });
  const [activeCaseId, setActiveCaseId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(ACTIVE_CASE_STORAGE_KEY) || null;
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(cases.length === 0);
  const [error, setError] = useState<string | null>(null);

  // Refresh cases from backend and synchronize state
  const refreshCases = useCallback(async (): Promise<BackendCase[]> => {
    invalidateClientCaseCache();
    setLoading(true);
    try {
      const res = await casesApi.listCases({ size: 100 });
      const items = res?.items || [];
      setCases(items);
      setError(null);

      // Auto-select if none selected or current selection is invalid
      setActiveCaseId((prev) => {
        if (prev && items.some((c) => c.id === prev || c.case_number === prev)) {
          return prev;
        }
        const fallback = items[0]?.id || null;
        if (fallback && typeof window !== 'undefined') {
          sessionStorage.setItem(ACTIVE_CASE_STORAGE_KEY, fallback);
        }
        return fallback;
      });

      return items;
    } catch (err: any) {
      console.warn('Failed to refresh cases list:', err);
      setError(err?.message || 'Failed to fetch cases');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Set active case and persist to sessionStorage
  const selectCase = useCallback((caseId: string) => {
    setActiveCaseId(caseId);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(ACTIVE_CASE_STORAGE_KEY, caseId);
      window.dispatchEvent(new CustomEvent('CASE_SELECTED', { detail: { caseId } }));
    }
  }, []);

  // Create direct case
  const createCase = useCallback(async (data: any): Promise<BackendCase> => {
    const newCase = await casesApi.createCase(data);
    setCases((prev) => [newCase, ...prev.filter((c) => c.id !== newCase.id)]);
    selectCase(newCase.id);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('CASE_CREATED', { detail: newCase }));
    }
    // Background full refresh to maintain order
    refreshCases().catch(() => null);
    return newCase;
  }, [refreshCases, selectCase]);

  // Create case from FIR
  const createCaseFromFir = useCallback(async (firId: string): Promise<BackendCase> => {
    const newCase = await casesApi.createCaseFromFir(firId);
    setCases((prev) => [newCase, ...prev.filter((c) => c.id !== newCase.id)]);
    selectCase(newCase.id);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('CASE_CREATED', { detail: newCase }));
    }
    refreshCases().catch(() => null);
    return newCase;
  }, [refreshCases, selectCase]);

  // Update existing case
  const updateCase = useCallback(async (caseId: string, data: any): Promise<BackendCase> => {
    const updated = await casesApi.updateCase(caseId, data);
    setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('CASE_UPDATED', { detail: updated }));
    }
    return updated;
  }, []);

  // Initial load
  useEffect(() => {
    refreshCases();
  }, [refreshCases]);

  // Cross-component event listeners for live synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleCreated = (e: Event) => {
      const custom = e as CustomEvent<BackendCase>;
      if (custom.detail?.id) {
        setCases((prev) => {
          if (prev.some((c) => c.id === custom.detail.id)) return prev;
          return [custom.detail, ...prev];
        });
        setActiveCaseId(custom.detail.id);
      } else {
        refreshCases();
      }
    };

    const handleInvalidated = () => {
      refreshCases();
    };

    window.addEventListener('CASE_CREATED', handleCreated);
    window.addEventListener('CASE_INVALIDATED', handleInvalidated);

    return () => {
      window.removeEventListener('CASE_CREATED', handleCreated);
      window.removeEventListener('CASE_INVALIDATED', handleInvalidated);
    };
  }, [refreshCases]);

  const activeCase = useMemo(() => {
    if (!activeCaseId) return cases[0] || null;
    return cases.find((c) => c.id === activeCaseId || c.case_number === activeCaseId) || cases[0] || null;
  }, [cases, activeCaseId]);

  const value = useMemo(
    () => ({
      cases,
      activeCaseId: activeCase?.id || activeCaseId,
      activeCase,
      loading,
      error,
      refreshCases,
      selectCase,
      createCase,
      createCaseFromFir,
      updateCase,
    }),
    [cases, activeCaseId, activeCase, loading, error, refreshCases, selectCase, createCase, createCaseFromFir, updateCase]
  );

  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>;
}

export function useCaseStore(): CaseStoreContextType {
  const ctx = useContext(CaseContext);
  if (!ctx) {
    throw new Error('useCaseStore must be used within a <CaseProvider>');
  }
  return ctx;
}
