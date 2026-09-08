'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { openInspector } from '@/store/slices/uiSlice';
import { casesApi, BackendCase } from '@/lib/api/cases';
import type { Case, CrimeType, CasePriority, CaseStatus } from '@/types';
import DataTable, { ColumnDef } from '@/components/shared/DataTable';
import FilterBar, { FilterOption } from '@/components/shared/FilterBar';
import { FolderOpen, Plus, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';

export default function CasesPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [casesList, setCasesList] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<{ [key: string]: string }>({
    crime: 'all',
    city: 'all',
  });

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await casesApi.listCases({ size: 50 });
      const backendCases = res.items || [];
      const mapped: Case[] = backendCases.map((bc) => ({
        id: bc.case_number || bc.id,
        backendId: bc.id,
        title: bc.title,
        crime: (bc.crime_category as any) || 'General Crime',
        location: bc.area ? `${bc.area}, ${bc.city || 'Mumbai'}` : (bc.city || 'Mumbai Jurisdiction'),
        city: bc.city || 'Mumbai',
        status: (bc.status === 'OPEN' ? 'Active' : bc.status === 'UNDER_INVESTIGATION' ? 'Under Investigation' : 'Active') as any,
        priority: (bc.priority === 'CRITICAL' ? 'Critical' : bc.priority === 'HIGH' ? 'High' : 'Medium') as any,
        assignedOfficer: bc.lead_investigator_id ? 'Assigned Lead Officer' : 'Pending Allocation',
        created: bc.created_at ? bc.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
        lastActivity: 'Just now',
        description: bc.description,
        firId: bc.fir_id || '',
        personIds: [],
        vehicleIds: [],
        phoneIds: [],
        locationIds: [],
        organizationIds: [],
        evidenceIds: [],
        alertIds: [],
      }));
      setCasesList(mapped);
    } catch (err) {
      console.warn('Backend cases fetch notice:', err);
      toast.error('Unable to fetch live cases from backend.');
      setCasesList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearAll = () => {
    setFilters({ crime: 'all', city: 'all' });
    setSearchQuery('');
  };

  // Filtered dataset
  const filteredCases = useMemo(() => {
    return casesList.filter((c) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          c.id.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.location.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }
      if (filters.crime !== 'all' && c.crime !== filters.crime) return false;
      if (filters.city !== 'all' && c.city !== filters.city) return false;
      return true;
    });
  }, [casesList, searchQuery, filters]);

  const filterOptions: FilterOption[] = [
    {
      key: 'crime',
      label: 'Crime',
      value: filters.crime,
      options: [
        { label: 'Robbery', value: 'Robbery' },
        { label: 'Fraud', value: 'Fraud' },
        { label: 'Money Laundering', value: 'Money Laundering' },
        { label: 'Drug Trafficking', value: 'Drug Trafficking' },
        { label: 'Cybercrime', value: 'Cybercrime' },
        { label: 'Vehicle Theft', value: 'Vehicle Theft' },
        { label: 'Extortion', value: 'Extortion' },
      ],
    },
    {
      key: 'city',
      label: 'Location',
      value: filters.city,
      options: [
        { label: 'Mumbai', value: 'Mumbai' },
        { label: 'Delhi', value: 'Delhi' },
        { label: 'Pune', value: 'Pune' },
        { label: 'Bengaluru', value: 'Bengaluru' },
        { label: 'Hyderabad', value: 'Hyderabad' },
        { label: 'Chennai', value: 'Chennai' },
        { label: 'Kolkata', value: 'Kolkata' },
      ],
    },
  ];

  const columns: ColumnDef<Case>[] = [
    {
      key: 'id',
      header: 'Case ID',
      sortable: true,
      width: '120px',
      render: (c) => (
        <span className="font-mono-id font-semibold text-[var(--accent)] hover:underline">
          {c.id}
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (c) => (
        <div>
          <div className="font-medium text-[var(--ink-primary)] truncate max-w-[340px]">{c.title}</div>
          <div className="text-[11px] text-[var(--ink-tertiary)] truncate max-w-[340px]">{c.description}</div>
        </div>
      ),
    },
    {
      key: 'crime',
      header: 'Crime',
      sortable: true,
      render: (c) => (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--surface-2)] text-[var(--ink-secondary)]">
          {c.crime}
        </span>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      sortable: true,
      render: (c) => (
        <span className="text-[12px] text-[var(--ink-secondary)] truncate">
          {c.location}
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      sortable: true,
      render: (c) => <span className="font-mono-id text-[11px] text-[var(--ink-tertiary)]">{c.created}</span>,
    },
    {
      key: 'lastActivity',
      header: 'Last Activity',
      sortable: true,
      render: (c) => (
        <span className="font-mono-id text-[11px] text-[var(--ink-secondary)]">{c.lastActivity}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Investigation Cases</h1>
          <p className="page-subtitle">Manage and track all active investigations</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/fir')}
            className="btn-primary"
          >
            <Plus size={16} />
            <span>New Case / FIR</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={filterOptions}
        onFilterChange={handleFilterChange}
        onClearAll={handleClearAll}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by Case ID, title, or location..."
      />

      {/* Cases Table */}
      <DataTable
        data={filteredCases}
        columns={columns}
        keyExtractor={(c) => c.id}
        loading={loading}
        pageSize={12}
        onRowClick={(c) => router.push(`/cases/${c.backendId || c.id}`)}
        emptyMessage="No cases found matching your search and filter criteria."
        bulkActions={[
          {
            label: 'Export Metadata',
            action: (selected) => {
              toast.success(`Exported metadata for ${selected.length} cases`);
            },
          },
          {
            label: 'Mark Priority Review',
            action: (selected) => {
              toast.info(`Flagged ${selected.length} cases for DCP review`);
            },
          },
        ]}
      />
    </div>
  );
}
