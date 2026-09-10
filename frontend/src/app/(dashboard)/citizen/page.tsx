'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import type { CrimeType } from '@/types';
import {
  UserCheck, Plus, FileText, CheckCircle2, Clock, Shield,
  Upload, AlertTriangle, ChevronRight, FileCheck, ArrowRight,
  Send, Bell, FolderOpen, X, Paperclip, Loader2, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { firsApi, BackendFIR } from '@/lib/api/firs';
import { dashboardApi, CitizenDashboardStats } from '@/lib/api/dashboard';

type TabKey = 'overview' | 'file' | 'complaints' | 'notifications';

const statusSteps = [
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'CLOSED',
];

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  ACCEPTED: 'Accepted as FIR',
  REJECTED: 'Dismissed',
  MORE_INFORMATION_REQUIRED: 'Info Needed',
  CLOSED: 'Closed',
};

function CitizenContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey =
    tabParam && ['overview', 'file', 'complaints', 'notifications'].includes(tabParam)
      ? tabParam
      : 'overview';

  const navigateToTab = (tab: TabKey) => {
    if (tab === 'overview') {
      router.push('/citizen');
    } else {
      router.push(`/citizen?tab=${tab}`);
    }
  };

  const dispatch = useAppDispatch();

  // Real backend data states
  const [complaints, setComplaints] = useState<BackendFIR[]>([]);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string>('');
  const [stats, setStats] = useState<CitizenDashboardStats | null>(null);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [complainantName, setComplainantName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [crimeType, setCrimeType] = useState<CrimeType>('Fraud');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const fetchComplaints = async () => {
    setLoadingComplaints(true);
    try {
      const res = await firsApi.getMyFirs();
      const items = res.items || [];
      setComplaints(items);
      if (items.length > 0 && !selectedComplaintId) {
        setSelectedComplaintId(items[0].id);
      }
    } catch (err: any) {
      console.warn('Failed to load citizen complaints:', err);
    } finally {
      setLoadingComplaints(false);
    }
  };

  const fetchStats = async () => {
    try {
      const s = await dashboardApi.getCitizenDashboard();
      setStats(s);
    } catch (err) {
      console.warn('Dashboard stats fallback:', err);
    }
  };

  useEffect(() => {
    fetchComplaints();
    fetchStats();
  }, []);

  const selectedComplaint = complaints.find((c) => c.id === selectedComplaintId) || complaints[0];

  const getStatusIndex = (st: string) => {
    const idx = statusSteps.indexOf(st);
    return idx >= 0 ? idx : 1;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !location) {
      toast.error('Please fill mandatory fields: description and incident location.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await firsApi.createCitizenFir(
        {
          title: `${crimeType} incident at ${location}`,
          description,
          crime_category: crimeType,
          incident_date: date,
          incident_location: location,
        },
        true // auto-submit for review
      );
      toast.success(`Complaint filed successfully! Tracking Number: ${res.fir_number}`);
      await fetchComplaints();
      await fetchStats();
      navigateToTab('complaints');
    } catch (err: any) {
      toast.error(err.message || 'Failed to file complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  const overviewStats = [
    { label: 'Total Filed', value: stats?.total_complaints ?? complaints.length, color: '#12376E', bg: 'rgba(79,70,229,0.08)' },
    { label: 'Under Review', value: stats?.under_review_complaints ?? complaints.filter(c => c.status === 'UNDER_REVIEW' || c.status === 'SUBMITTED').length, color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
    { label: 'Accepted as FIR', value: stats?.accepted_complaints ?? complaints.filter(c => c.status === 'ACCEPTED').length, color: '#16A34A', bg: 'rgba(22,163,74,0.08)' },
    { label: 'Closed / Rejected', value: stats?.rejected_complaints ?? complaints.filter(c => c.status === 'REJECTED').length, color: '#9CA3AF', bg: 'rgba(107,114,128,0.08)' },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-[1200px] mx-auto">
      {/* Header — simple and friendly */}
      <div className="p-6 rounded-2xl border"
        style={{ background: 'var(--pastel-mint)', borderColor: 'var(--accent-subtle)' }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: '#16A34A14', color: '#16A34A' }}>
            <UserCheck size={28} />
          </div>
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
              Citizen Complaint &amp; Incident Portal
            </h1>
            <p className="text-[14px] mt-0.5" style={{ color: 'var(--ink-secondary)' }}>
              Official Police Grievance Lodgment and Tracking Desk
            </p>
          </div>
        </div>
      </div>

      {/* ── Overview ─────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {overviewStats.map((stat) => (
              <div key={stat.label} className="p-6 rounded-2xl border text-center"
                style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
                <div className="text-[36px] font-semibold font-mono-id" style={{ color: stat.color }}>{stat.value}</div>
                <div className="text-[13px] font-medium mt-1" style={{ color: 'var(--ink-secondary)' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <button onClick={() => navigateToTab('file')}
              className="p-6 rounded-2xl border text-left hover:border-[#16A34A] hover:-translate-y-0.5 transition-all group cursor-pointer"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{ background: '#16A34A14', color: '#16A34A' }}>
                <Plus size={20} />
              </div>
              <h3 className="text-[17px] font-semibold mb-1" style={{ color: 'var(--ink-primary)' }}>File a New Complaint</h3>
              <p className="text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
                Report an incident to the police. Provide details, upload documents, and get a tracking ID.
              </p>
            </button>
            <button onClick={() => navigateToTab('complaints')}
              className="p-6 rounded-2xl border text-left hover:border-[var(--accent)] hover:-translate-y-0.5 transition-all group cursor-pointer"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                <FolderOpen size={20} />
              </div>
              <h3 className="text-[17px] font-semibold mb-1" style={{ color: 'var(--ink-primary)' }}>Track My Complaints</h3>
              <p className="text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
                View status updates, timeline, and responses for all your submitted complaints.
              </p>
            </button>
          </div>

          {/* Most recent complaint status */}
          {selectedComplaint ? (
            <div className="p-6 rounded-2xl border" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[16px] font-semibold" style={{ color: 'var(--ink-primary)' }}>Recent Complaint Status</h3>
                <span className="font-mono-id text-[12px] font-semibold" style={{ color: 'var(--accent)' }}>{selectedComplaint.fir_number}</span>
              </div>
              <h4 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--ink-primary)' }}>
                {selectedComplaint.crime_category} — {selectedComplaint.incident_location}
              </h4>
              {/* Status stepper */}
              <div className="flex items-center gap-0">
                {statusSteps.map((step, i) => {
                  const currentIdx = getStatusIndex(selectedComplaint.status);
                  const isCompleted = i < currentIdx;
                  const isActive = i === currentIdx;
                  return (
                    <React.Fragment key={step}>
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold"
                          style={{
                            background: isCompleted ? '#16A34A' : isActive ? '#12376E' : 'var(--surface-3)',
                            color: (isCompleted || isActive) ? '#fff' : 'var(--ink-tertiary)',
                          }}>
                          {isCompleted ? <CheckCircle2 size={16} /> : i + 1}
                        </div>
                        <span className="text-[10px] mt-1 text-center max-w-[70px]"
                          style={{ color: isActive ? 'var(--accent)' : 'var(--ink-tertiary)' }}>
                          {statusLabels[step] || step}
                        </span>
                      </div>
                      {i < statusSteps.length - 1 && (
                        <div className="flex-1 h-0.5 mx-1 mb-4"
                          style={{ background: i < currentIdx ? '#16A34A' : 'var(--border)' }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-2xl border border-dashed text-center text-[var(--ink-tertiary)]"
              style={{ borderColor: 'var(--border)' }}>
              <FileText size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-[13.5px] font-semibold" style={{ color: 'var(--ink-secondary)' }}>
                No Complaints Filed Yet
              </p>
              <p className="text-[12px] mt-1">
                Click &quot;File a New Complaint&quot; above to lodge an incident with the police department.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── File a Complaint ─────────────────────────────────── */}
      {activeTab === 'file' && (
        <div className="animate-fade-in">
          <div className="p-6 rounded-2xl border max-w-2xl mx-auto" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
            <h2 className="text-[20px] font-semibold mb-1" style={{ color: 'var(--ink-primary)' }}>File a Complaint</h2>
            <p className="text-[13px] mb-6" style={{ color: 'var(--ink-secondary)' }}>
              All information provided will be directly logged into the official police station intake registry.
            </p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--ink-tertiary)' }}>Complainant Name</label>
                  <input type="text" value={complainantName} onChange={(e) => setComplainantName(e.target.value)} placeholder="e.g. Rahul Verma"
                    className="w-full h-11 px-4 rounded-xl border text-[14px] bg-[var(--surface-0)] outline-none focus:border-[#16A34A] transition-colors"
                    style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }} />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--ink-tertiary)' }}>Contact Phone</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +91 98201 55667"
                    className="w-full h-11 px-4 rounded-xl border text-[14px] bg-[var(--surface-0)] outline-none focus:border-[#16A34A] transition-colors"
                    style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--ink-tertiary)' }}>Crime Category *</label>
                  <select value={crimeType} onChange={(e) => setCrimeType(e.target.value as CrimeType)}
                    className="w-full h-11 px-4 rounded-xl border text-[14px] bg-[var(--surface-0)] outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}>
                    {['Fraud', 'Robbery', 'Assault', 'Theft', 'Cybercrime', 'Kidnapping', 'Drug Trafficking', 'Other'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--ink-tertiary)' }}>Incident Date *</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border text-[14px] bg-[var(--surface-0)] outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }} />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--ink-tertiary)' }}>Incident Location *</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Bandra Kurla Complex, Mumbai"
                  className="w-full h-11 px-4 rounded-xl border text-[14px] bg-[var(--surface-0)] outline-none focus:border-[#16A34A] transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }} />
              </div>

              <div>
                <label className="block text-[12px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--ink-tertiary)' }}>Incident Description *</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                  placeholder="Provide complete facts of the incident, including names, dates, amounts, and witness details..."
                  className="w-full px-4 py-3 rounded-xl border text-[14px] bg-[var(--surface-0)] outline-none resize-none"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }} />
              </div>

              <button type="submit" disabled={submitting}
                className="w-full h-12 rounded-xl text-[15px] font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 cursor-pointer disabled:opacity-50"
                style={{ background: '#16A34A' }}>
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                <span>{submitting ? 'Submitting to Police Station...' : 'Submit Complaint'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── My Complaints ───────────────────────────────────── */}
      {activeTab === 'complaints' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-semibold" style={{ color: 'var(--ink-primary)' }}>My Filed Complaints ({complaints.length})</h2>
            <div className="flex items-center gap-2">
              <button onClick={fetchComplaints} disabled={loadingComplaints}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12.5px] font-medium hover:bg-[var(--surface-2)] cursor-pointer"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}>
                <RefreshCw size={13} className={loadingComplaints ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
              <button onClick={() => navigateToTab('file')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white cursor-pointer"
                style={{ background: '#16A34A' }}>
                <Plus size={15} /> File New
              </button>
            </div>
          </div>

          {loadingComplaints ? (
            <div className="p-12 text-center text-[var(--ink-tertiary)]">
              <Loader2 size={28} className="mx-auto mb-2 animate-spin text-[var(--accent)]" />
              <p className="text-[13px]">Retrieving complaints from registry...</p>
            </div>
          ) : complaints.length === 0 ? (
            <div className="p-12 rounded-2xl border border-dashed text-center text-[var(--ink-tertiary)]"
              style={{ borderColor: 'var(--border)' }}>
              <FileText size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink-secondary)' }}>
                No Complaints on Record
              </p>
              <p className="text-[12px] mt-1">
                You have not filed any police complaints under this account.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {complaints.map((c) => (
                <div key={c.id}
                  onClick={() => setSelectedComplaintId(c.id)}
                  className="p-5 rounded-2xl border cursor-pointer transition-all hover:border-[#16A34A]"
                  style={{
                    background: 'var(--surface-1)',
                    borderColor: c.id === selectedComplaint?.id ? '#16A34A' : 'var(--border)',
                  }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono-id font-semibold text-[12.5px]" style={{ color: '#16A34A' }}>{c.fir_number}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: 'var(--surface-2)', color: 'var(--ink-secondary)' }}>
                          {c.crime_category}
                        </span>
                      </div>
                      <div className="text-[14px] font-semibold mb-0.5" style={{ color: 'var(--ink-primary)' }}>
                        {c.title}
                      </div>
                      <div className="text-[12.5px]" style={{ color: 'var(--ink-secondary)' }}>
                        Incident Date: {c.incident_date} • Location: {c.incident_location}
                      </div>
                      {c.description && (
                        <p className="mt-2 text-[12px] text-[var(--ink-secondary)] line-clamp-2">
                          {c.description}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      <span className="badge badge-active">{statusLabels[c.status] || c.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Notifications ──────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-[20px] font-semibold" style={{ color: 'var(--ink-primary)' }}>Official Notifications</h2>
          <div className="p-8 rounded-2xl border text-center text-[var(--ink-tertiary)]" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
            <Bell size={28} className="mx-auto mb-2 opacity-50" />
            <p className="text-[13px] font-semibold" style={{ color: 'var(--ink-secondary)' }}>
              All Notification Dispatches Delivered
            </p>
            <p className="text-[12px] mt-1">
              Case status updates and official requisitions from the investigating officer will appear here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CitizenPortalPage() {
  return (
    <Suspense fallback={<div className="h-32 flex items-center justify-center">Loading...</div>}>
      <CitizenContent />
    </Suspense>
  );
}
