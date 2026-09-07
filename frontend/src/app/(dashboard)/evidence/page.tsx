'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { openInspector } from '@/store/slices/uiSlice';
import { mockEvidenceService } from '@/services/mockServices';
import { casesApi } from '@/lib/api/cases';
import { evidenceApi } from '@/lib/api/evidence';
import { forensicRecords, contradictions } from '@/mock';
import type { Evidence, EvidenceType, EvidenceStatus, Contradiction } from '@/types';
import DataTable, { ColumnDef } from '@/components/shared/DataTable';
import FilterBar, { FilterOption } from '@/components/shared/FilterBar';
import {
  Package, ShieldCheck, CheckCircle2, AlertCircle,
  Camera, Video, DollarSign, GitCompare, AlertTriangle,
  FlaskConical, Dna, Fingerprint, Crosshair, Binary,
  Database, Hash, Lock, Clock, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

type TabKey = 'overview' | 'correlation' | 'forensics' | 'contradictions' | 'integrity';

const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'overview', label: 'Overview', icon: Package },
  { key: 'correlation', label: 'Correlation', icon: GitCompare },
  { key: 'forensics', label: 'Forensics', icon: FlaskConical },
  { key: 'contradictions', label: 'Contradictions', icon: AlertTriangle },
  { key: 'integrity', label: 'Integrity', icon: Database },
];

const correlationLinks = [
  { source: 'FIR-2026-0102', target: 'PERSON-014', relation: 'Names suspect', color: '#4F46E5' },
  { source: 'CDR-441', target: 'PHONE-019', relation: 'Device match', color: '#D97706' },
  { source: 'TRANSACTION-22', target: 'ORG-014', relation: 'Money transfer', color: '#DC2626' },
  { source: 'CCTV-031', target: 'PERSON-014', relation: 'Facial match 96%', color: '#16A34A' },
  { source: 'DOC-Cheque-044', target: 'ACCOUNT-012', relation: 'Account beneficiary', color: '#7C3AED' },
];

const chainOfCustody = [
  { time: '09:30', date: '06 Sep 2026', action: 'Evidence Collected', officer: 'Sub-Inspector P. Mehta', location: 'Crime Scene — Andheri West', icon: Package },
  { time: '10:15', date: '06 Sep 2026', action: 'Transferred to Station', officer: 'Head Constable K. Rao', location: 'Versova Police Station', icon: ArrowRight },
  { time: '13:45', date: '06 Sep 2026', action: 'Forensic Analysis', officer: 'Dr. S. Joshi (Forensic Expert)', location: 'FSL Mumbai', icon: FlaskConical },
  { time: '16:20', date: '06 Sep 2026', action: 'Report Uploaded', officer: 'DCP R. Sharma', location: 'KRITAGAS Evidence Ledger', icon: CheckCircle2 },
];

function getCategoryIcon(cat: string) {
  switch (cat) {
    case 'DNA': return <Dna size={16} className="text-[#EC4899]" />;
    case 'Fingerprint': return <Fingerprint size={16} className="text-[#3B82F6]" />;
    case 'Ballistics': return <Crosshair size={16} className="text-[#EF4444]" />;
    case 'Toxicology': return <FlaskConical size={16} className="text-[#8B5CF6]" />;
    case 'Digital Forensics': return <Binary size={16} className="text-[#10B981]" />;
    default: return <FlaskConical size={16} />;
  }
}

function EvidenceHubContent() {
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();

  const tabParam = searchParams.get('tab') as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>(
    tabParam && ['overview', 'correlation', 'forensics', 'contradictions', 'integrity'].includes(tabParam) ? tabParam : 'overview'
  );

  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [caseOptions, setCaseOptions] = useState<{ label: string; value: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<{ [key: string]: string }>({ type: 'all', status: 'all', case: 'all' });
  const [contraList, setContraList] = useState<Contradiction[]>(contradictions);

  useEffect(() => {
    let active = true;
    setLoading(true);

    async function loadData() {
      try {
        // Fetch cases to populate filter options
        const caseRes = await casesApi.listCases({ size: 50 }).catch(() => null);
        if (caseRes && caseRes.items && caseRes.items.length > 0) {
          const opts = caseRes.items.map(c => ({
            label: `${c.case_number} (${c.title.slice(0, 20)}...)`,
            value: c.case_number || c.id,
          }));
          if (active) setCaseOptions(opts);
        }

        // Fetch mock baseline evidence
        const mockData = await mockEvidenceService.getEvidence();
        if (active) {
          setEvidenceList(mockData);
        }
      } catch (err) {
        console.error('Failed to load evidence records:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, []);

  const filteredEvidence = useMemo(() => {
    return evidenceList.filter((e) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!e.id.toLowerCase().includes(q) && !e.title.toLowerCase().includes(q) &&
          !e.source.toLowerCase().includes(q) && !e.caseId.toLowerCase().includes(q)) return false;
      }
      if (filters.type !== 'all' && e.type !== filters.type) return false;
      if (filters.status !== 'all' && e.status !== filters.status) return false;
      if (filters.case !== 'all' && e.caseId !== filters.case) return false;
      return true;
    });
  }, [evidenceList, searchQuery, filters]);

  const filterOptions: FilterOption[] = [
    { key: 'type', label: 'Evidence Type', value: filters.type, options: [
      { label: 'FIR', value: 'FIR' }, { label: 'Document', value: 'Document' },
      { label: 'Transaction', value: 'Transaction' }, { label: 'CCTV', value: 'CCTV' },
      { label: 'Image', value: 'Image' }, { label: 'Video', value: 'Video' },
    ]},
    { key: 'status', label: 'Status', value: filters.status, options: [
      { label: 'Verified', value: 'Verified' }, { label: 'Under Analysis', value: 'Under Analysis' },
      { label: 'Flagged', value: 'Flagged' }, { label: 'Collected', value: 'Collected' },
    ]},
    { key: 'case', label: 'Case', value: filters.case, options: caseOptions.length > 0 ? caseOptions : [
      { label: 'CASE-102', value: 'CASE-102' }, { label: 'CASE-087', value: 'CASE-087' },
    ]},
  ];

  const columns: ColumnDef<Evidence>[] = [
    { key: 'id', header: 'Evidence ID', sortable: true, width: '140px', render: (e) => (
      <span className="font-mono-id font-semibold text-[var(--accent)]">{e.id}</span>
    )},
    { key: 'type', header: 'Type', sortable: true, render: (e) => (
      <span className="px-2 py-1 rounded-lg text-[12px] font-medium bg-[var(--surface-2)] text-[var(--ink-secondary)]">{e.type}</span>
    )},
    { key: 'title', header: 'Description', sortable: true, render: (e) => (
      <div>
        <div className="font-medium text-[var(--ink-primary)] truncate max-w-[300px]">{e.title}</div>
        <div className="text-[11px] text-[var(--ink-tertiary)] truncate max-w-[300px]">{e.description}</div>
      </div>
    )},
    { key: 'caseId', header: 'Case', sortable: true, render: (e) => (
      <span className="font-mono-id text-[12px] font-medium text-[var(--ink-primary)]">{e.caseId}</span>
    )},
    { key: 'date', header: 'Date', sortable: true, render: (e) => (
      <span className="font-mono-id text-[12px] text-[var(--ink-tertiary)]">{e.date}</span>
    )},
    { key: 'integrity', header: 'Integrity', render: (e) => (
      <div className="flex items-center gap-1.5">
        <ShieldCheck size={14} className={e.integrity.verified ? 'text-[var(--success)]' : 'text-[var(--warning)]'} />
        <span className="font-mono-id text-[11px]" style={{ color: 'var(--ink-tertiary)' }}>{e.integrity.hash.slice(0, 10)}...</span>
      </div>
    )},
    { key: 'status', header: 'Status', sortable: true, render: (e) => {
      const cls = e.status === 'Verified' ? 'badge-active' : e.status === 'Flagged' ? 'badge-critical' : e.status === 'Under Analysis' ? 'badge-review' : 'badge-low';
      return <span className={`badge ${cls}`}>{e.status}</span>;
    }},
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>Evidence Hub</h1>
        <p className="text-[14px] mt-1" style={{ color: 'var(--ink-secondary)' }}>
          Comprehensive evidence intelligence — correlation, forensics, contradictions, and integrity verification
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 rounded-xl border w-fit" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13.5px] font-semibold transition-all"
              style={{
                background: isActive ? 'var(--surface-1)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--ink-secondary)',
                boxShadow: isActive ? 'var(--glass-shadow-sm)' : 'none',
              }}>
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Overview Tab ──────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-4 animate-fade-in">
          <FilterBar filters={filterOptions} onFilterChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))}
            onClearAll={() => { setFilters({ type: 'all', status: 'all', case: 'all' }); setSearchQuery(''); }}
            searchQuery={searchQuery} onSearchChange={setSearchQuery}
            searchPlaceholder="Search evidence by ID, description, or case..." />
          <DataTable data={filteredEvidence} columns={columns} keyExtractor={(e) => e.id} loading={loading} pageSize={12}
            onRowClick={(e) => dispatch(openInspector({ id: e.id, type: 'Evidence' }))}
            emptyMessage="No evidence items found."
            bulkActions={[{ label: 'Verify Hash Checksum', action: (selected) => toast.success(`SHA-256 check complete for ${selected.length} items.`) }]} />
        </div>
      )}

      {/* ── Correlation Tab ───────────────────────────────────── */}
      {activeTab === 'correlation' && (
        <div className="space-y-5 animate-fade-in">
          <div className="p-6 rounded-2xl border" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
            <h3 className="text-[17px] font-bold mb-5" style={{ color: 'var(--ink-primary)' }}>Evidence Correlation Map</h3>
            <div className="space-y-3">
              {correlationLinks.map((link, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl border"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                  <span className="font-mono-id font-bold text-[13px] min-w-[140px]" style={{ color: link.color }}>{link.source}</span>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="flex-1 h-0.5 rounded-full" style={{ background: `${link.color}40` }} />
                    <span className="text-[12px] px-3 py-1 rounded-full font-medium whitespace-nowrap"
                      style={{ background: `${link.color}14`, color: link.color }}>{link.relation}</span>
                    <div className="flex-1 h-0.5 rounded-full" style={{ background: `${link.color}40` }} />
                  </div>
                  <span className="font-mono-id font-bold text-[13px] min-w-[120px] text-right" style={{ color: link.color }}>{link.target}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Forensics Tab ─────────────────────────────────────── */}
      {activeTab === 'forensics' && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {forensicRecords.map((record) => (
              <div key={record.id} onClick={() => dispatch(openInspector({ id: record.id, type: 'ForensicRecord' }))}
                className="p-5 rounded-2xl border cursor-pointer hover:border-[var(--accent)] transition-all"
                style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(record.category)}
                    <span className="font-semibold text-[13.5px]" style={{ color: 'var(--ink-primary)' }}>{record.category}</span>
                  </div>
                  <span className={`badge ${record.status === 'Complete' ? 'badge-active' : record.status === 'In Progress' ? 'badge-review' : 'badge-low'}`}>
                    {record.status}
                  </span>
                </div>
                <div className="space-y-1.5 text-[12.5px]" style={{ color: 'var(--ink-secondary)' }}>
                  <div className="flex justify-between"><span>Record ID</span><span className="font-mono-id" style={{ color: 'var(--accent)' }}>{record.id}</span></div>
                  <div className="flex justify-between"><span>Case</span><span className="font-mono-id">{record.caseId}</span></div>
                  <div className="flex justify-between"><span>Match</span>
                    <span className="font-bold font-mono-id" style={{ color: record.matchPercentage > 85 ? 'var(--success)' : 'var(--warning)' }}>
                      {record.matchPercentage}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Contradictions Tab ────────────────────────────────── */}
      {activeTab === 'contradictions' && (
        <div className="space-y-4 animate-fade-in">
          {contraList.map((c) => (
            <div key={c.id} className="p-5 rounded-2xl border"
              style={{ background: 'var(--surface-1)', borderColor: c.status === 'Open' ? 'rgba(220,38,38,0.3)' : 'var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} style={{ color: c.status === 'Open' ? '#DC2626' : 'var(--ink-tertiary)' }} />
                  <span className="font-bold text-[14px]" style={{ color: 'var(--ink-primary)' }}>{c.type}</span>
                  <span className="font-mono-id text-[11px]" style={{ color: 'var(--ink-tertiary)' }}>{c.id}</span>
                </div>
                <span className={`badge ${c.status === 'Open' ? 'badge-critical' : c.status === 'Resolved' ? 'badge-active' : 'badge-low'}`}>{c.status}</span>
              </div>
              <p className="text-[13px] mb-3" style={{ color: 'var(--ink-secondary)' }}>{c.description}</p>
              <div className="flex flex-wrap items-center gap-2 text-[12px] mb-3" style={{ color: 'var(--ink-tertiary)' }}>
                <span>Source A: <span className="font-mono-id font-medium" style={{ color: 'var(--ink-primary)' }}>{c.sourceA.id} ({c.sourceA.type})</span></span>
                <span>•</span>
                <span>Source B: <span className="font-mono-id font-medium" style={{ color: 'var(--ink-primary)' }}>{c.sourceB.id} ({c.sourceB.type})</span></span>
                <span>•</span>
                <span>Case: <span className="font-mono-id font-medium" style={{ color: 'var(--accent)' }}>{c.caseId}</span></span>
              </div>
              {c.status === 'Open' && (
                <div className="flex gap-2">
                  <button onClick={() => { setContraList(p => p.map(x => x.id === c.id ? { ...x, status: 'Resolved' as const } : x)); toast.success(`${c.id} marked resolved.`); }}
                    className="px-4 py-2 rounded-lg text-[12.5px] font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: 'var(--success)' }}>Mark Resolved</button>
                  <button onClick={() => { setContraList(p => p.map(x => x.id === c.id ? { ...x, status: 'Dismissed' as const } : x)); toast.info(`${c.id} dismissed.`); }}
                    className="px-4 py-2 rounded-lg text-[12.5px] font-medium border transition-all hover:bg-[var(--surface-2)]"
                    style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}>Dismiss</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Integrity Tab ─────────────────────────────────────── */}
      {activeTab === 'integrity' && (
        <div className="space-y-6 animate-fade-in">
          {/* Blockchain Evidence Record */}
          <div className="p-6 rounded-2xl border" style={{ background: 'var(--surface-1)', borderColor: 'var(--accent-subtle)' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                <Database size={20} />
              </div>
              <div>
                <h3 className="text-[17px] font-bold" style={{ color: 'var(--ink-primary)' }}>Blockchain Evidence Integrity</h3>
                <p className="text-[13px]" style={{ color: 'var(--ink-secondary)' }}>Immutable cryptographic verification registry</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: 'Evidence ID', value: 'EVIDENCE-044', icon: Package },
                { label: 'Document Hash', value: 'A83F...X91D', icon: Hash },
                { label: 'Block Number', value: '#892341', icon: Database },
                { label: 'Transaction ID', value: 'TX-1298-AF92', icon: Lock },
                { label: 'Timestamp', value: '06 Sep 2026', icon: Clock },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="p-4 rounded-xl border text-center"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                    <Icon size={18} style={{ color: 'var(--accent)', margin: '0 auto 8px' }} />
                    <div className="text-[12px]" style={{ color: 'var(--ink-tertiary)' }}>{item.label}</div>
                    <div className="font-mono-id font-bold text-[13px] mt-1" style={{ color: 'var(--ink-primary)' }}>{item.value}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-center gap-3 p-4 rounded-xl"
              style={{ background: 'var(--success-muted)', border: '1px solid rgba(22,163,74,0.25)' }}>
              <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
              <div>
                <div className="font-bold text-[14px]" style={{ color: 'var(--success)' }}>✓ INTEGRITY VERIFIED</div>
                <div className="text-[12.5px]" style={{ color: 'var(--ink-secondary)' }}>SHA-256 hash matches blockchain record. No tampering detected.</div>
              </div>
            </div>
          </div>

          {/* Chain of Custody */}
          <div className="p-6 rounded-2xl border" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
            <h3 className="text-[17px] font-bold mb-5" style={{ color: 'var(--ink-primary)' }}>Chain of Custody</h3>
            <div className="space-y-0">
              {chainOfCustody.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                        <Icon size={16} />
                      </div>
                      {i < chainOfCustody.length - 1 && (
                        <div className="w-0.5 flex-1 my-1" style={{ background: 'var(--border)' }} />
                      )}
                    </div>
                    <div className="pb-6 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono-id text-[12px] font-bold" style={{ color: 'var(--ink-tertiary)' }}>{step.time} • {step.date}</span>
                      </div>
                      <div className="text-[14px] font-semibold" style={{ color: 'var(--ink-primary)' }}>{step.action}</div>
                      <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--ink-secondary)' }}>{step.officer}</div>
                      <div className="text-[12px] mt-0.5" style={{ color: 'var(--ink-tertiary)' }}>{step.location}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EvidencePage() {
  return (
    <Suspense fallback={<div className="h-32 flex items-center justify-center text-[var(--ink-tertiary)]">Loading...</div>}>
      <EvidenceHubContent />
    </Suspense>
  );
}
