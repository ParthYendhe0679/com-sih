'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addComplaint, setSelectedComplaint } from '@/store/slices/citizenPortalSlice';
import type { CrimeType, ComplaintStatus } from '@/types';
import {
  UserCheck, Plus, FileText, CheckCircle2, Clock, Shield,
  Upload, AlertTriangle, ChevronRight, FileCheck, ArrowRight,
  Send, Bell, FolderOpen, X, Paperclip
} from 'lucide-react';
import { toast } from 'sonner';

type TabKey = 'overview' | 'file' | 'complaints' | 'notifications';

const statusSteps: ComplaintStatus[] = [
  'Submitted', 'Under Verification', 'Verified', 'Converted to FIR', 'Investigation', 'Closed',
];

const notifications = [
  { id: 'N-001', time: '2 hours ago', title: 'Complaint Received', body: 'Your complaint CMP-2026-0102 has been received and acknowledged.', type: 'info' },
  { id: 'N-002', time: '1 day ago', title: 'Under Verification', body: 'Your complaint is currently being verified by the duty officer.', type: 'review' },
  { id: 'N-003', time: '2 days ago', title: 'Document Required', body: 'Please upload an additional supporting document for your complaint CMP-2026-0102.', type: 'warning' },
];

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
  const { complaints, selectedComplaintId } = useAppSelector((s) => s.citizenPortal);

  const [complainantName, setComplainantName] = useState('Vikramaditya Rao');
  const [phone, setPhone] = useState('+91 98201 55667');
  const [email, setEmail] = useState('v.rao@cloudmail.com');
  const [crimeType, setCrimeType] = useState<CrimeType>('Fraud');
  const [description, setDescription] = useState('Received unauthorized transaction alerts totaling Rs 1,45,000 via forged cheque clearance at local branch.');
  const [location, setLocation] = useState('Bandra West, Mumbai');
  const [city, setCity] = useState('Mumbai');
  const [date, setDate] = useState('2026-09-03');
  const [evidenceName, setEvidenceName] = useState('cheque_scan_copy.pdf');

  const selectedComplaint = complaints.find((c) => c.id === selectedComplaintId) || complaints[0];

  const getStatusIndex = (st: ComplaintStatus) => statusSteps.indexOf(st);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!complainantName || !description) { toast.error('Please fill mandatory fields.'); return; }
    dispatch(addComplaint({ complainantName, phone, email, crimeType, description, location, city, date, time: '11:30', evidenceFiles: evidenceName ? [evidenceName] : [] }));
    toast.success('Complaint successfully filed! Acknowledgement has been generated.');
    navigateToTab('complaints');
  };

  const overviewStats = [
    { label: 'Total Filed', value: complaints.length, color: '#4F46E5', bg: 'rgba(79,70,229,0.08)' },
    { label: 'Under Review', value: complaints.filter(c => c.status === 'Under Verification').length, color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
    { label: 'Accepted', value: complaints.filter(c => ['Verified', 'Converted to FIR', 'Investigation'].includes(c.status)).length, color: '#16A34A', bg: 'rgba(22,163,74,0.08)' },
    { label: 'Resolved', value: complaints.filter(c => c.status === 'Closed').length, color: '#6B7280', bg: 'rgba(107,114,128,0.08)' },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-[1200px]">
      {/* Header — simple and friendly */}
      <div className="p-6 rounded-2xl border"
        style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.06) 0%, rgba(22,163,74,0.04) 100%)', borderColor: 'var(--accent-subtle)' }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: '#16A34A14', color: '#16A34A' }}>
            <UserCheck size={28} />
          </div>
          <div>
            <h1 className="text-[26px] font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
              Welcome, Vikramaditya
            </h1>
            <p className="text-[14px] mt-0.5" style={{ color: 'var(--ink-secondary)' }}>
              Citizen Complaint & Reporting Portal — Your gateway to justice
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
                <div className="text-[36px] font-bold font-mono-id" style={{ color: stat.color }}>{stat.value}</div>
                <div className="text-[13px] font-medium mt-1" style={{ color: 'var(--ink-secondary)' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <button onClick={() => navigateToTab('file')}
              className="p-6 rounded-2xl border text-left hover:border-[#16A34A] hover:-translate-y-0.5 transition-all group"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{ background: '#16A34A14', color: '#16A34A' }}>
                <Plus size={20} />
              </div>
              <h3 className="text-[17px] font-bold mb-1" style={{ color: 'var(--ink-primary)' }}>File a New Complaint</h3>
              <p className="text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
                Report an incident to the police. Provide details, upload documents, and get a tracking ID.
              </p>
            </button>
            <button onClick={() => navigateToTab('complaints')}
              className="p-6 rounded-2xl border text-left hover:border-[var(--accent)] hover:-translate-y-0.5 transition-all group"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                <FolderOpen size={20} />
              </div>
              <h3 className="text-[17px] font-bold mb-1" style={{ color: 'var(--ink-primary)' }}>Track My Complaints</h3>
              <p className="text-[13px]" style={{ color: 'var(--ink-secondary)' }}>
                View status updates, timeline, and responses for all your submitted complaints.
              </p>
            </button>
          </div>

          {/* Most recent complaint status */}
          {selectedComplaint && (
            <div className="p-6 rounded-2xl border" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[16px] font-bold" style={{ color: 'var(--ink-primary)' }}>Recent Complaint Status</h3>
                <span className="font-mono-id text-[12px]" style={{ color: 'var(--accent)' }}>{selectedComplaint.id}</span>
              </div>
              <h4 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--ink-primary)' }}>{selectedComplaint.crimeType} — {selectedComplaint.location}</h4>
              {/* Status stepper */}
              <div className="flex items-center gap-0">
                {statusSteps.map((step, i) => {
                  const currentIdx = getStatusIndex(selectedComplaint.status);
                  const isCompleted = i < currentIdx;
                  const isActive = i === currentIdx;
                  return (
                    <React.Fragment key={step}>
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold`}
                          style={{
                            background: isCompleted ? '#16A34A' : isActive ? '#4F46E5' : 'var(--surface-3)',
                            color: (isCompleted || isActive) ? '#fff' : 'var(--ink-tertiary)',
                          }}>
                          {isCompleted ? <CheckCircle2 size={16} /> : i + 1}
                        </div>
                        <span className="text-[10px] mt-1 text-center max-w-[60px]"
                          style={{ color: isActive ? 'var(--accent)' : 'var(--ink-tertiary)' }}>
                          {step}
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
          )}
        </div>
      )}

      {/* ── File a Complaint ─────────────────────────────────── */}
      {activeTab === 'file' && (
        <div className="animate-fade-in">
          <div className="p-6 rounded-2xl border max-w-2xl" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
            <h2 className="text-[20px] font-bold mb-1" style={{ color: 'var(--ink-primary)' }}>File a Complaint</h2>
            <p className="text-[13px] mb-6" style={{ color: 'var(--ink-secondary)' }}>
              All information provided will be kept confidential and used only for investigation purposes.
            </p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Your Name *', value: complainantName, onChange: setComplainantName, type: 'text' },
                  { label: 'Phone Number *', value: phone, onChange: setPhone, type: 'tel' },
                  { label: 'Email Address', value: email, onChange: setEmail, type: 'email' },
                  { label: 'Incident Location *', value: location, onChange: setLocation, type: 'text' },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="block text-[12px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--ink-tertiary)' }}>{f.label}</label>
                    <input type={f.type} value={f.value} onChange={(e) => f.onChange(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl border text-[14px] bg-[var(--surface-0)] outline-none focus:border-[#16A34A] transition-colors"
                      style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }} />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--ink-tertiary)' }}>Crime Type *</label>
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
                <label className="block text-[12px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--ink-tertiary)' }}>Incident Description *</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                  className="w-full px-4 py-3 rounded-xl border text-[14px] bg-[var(--surface-0)] outline-none resize-none"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }} />
              </div>

              <div>
                <label className="block text-[12px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--ink-tertiary)' }}>Supporting Document</label>
                <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <Paperclip size={16} style={{ color: 'var(--ink-tertiary)' }} />
                  <input type="text" value={evidenceName} onChange={(e) => setEvidenceName(e.target.value)} placeholder="filename.pdf"
                    className="flex-1 bg-transparent outline-none text-[13px]" style={{ color: 'var(--ink-primary)' }} />
                  <button type="button" onClick={() => toast.info('File upload dialog (simulated)')}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors hover:bg-[var(--surface-3)]"
                    style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}>
                    Browse
                  </button>
                </div>
              </div>

              <button type="submit"
                className="w-full h-12 rounded-xl text-[15px] font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                style={{ background: '#16A34A' }}>
                <Send size={16} />
                Submit Complaint
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── My Complaints ───────────────────────────────────── */}
      {activeTab === 'complaints' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-[20px] font-bold" style={{ color: 'var(--ink-primary)' }}>My Complaints ({complaints.length})</h2>
            <button onClick={() => navigateToTab('file')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white"
              style={{ background: '#16A34A' }}>
              <Plus size={15} /> File New
            </button>
          </div>

          <div className="space-y-3">
            {complaints.map((c) => (
              <div key={c.id}
                onClick={() => dispatch(setSelectedComplaint(c.id))}
                className="p-5 rounded-2xl border cursor-pointer transition-all hover:border-[#16A34A]"
                style={{
                  background: 'var(--surface-1)',
                  borderColor: c.id === selectedComplaint?.id ? '#16A34A' : 'var(--border)',
                }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono-id font-bold text-[12px]" style={{ color: '#16A34A' }}>{c.id}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: 'var(--surface-2)', color: 'var(--ink-secondary)' }}>
                        {c.crimeType}
                      </span>
                    </div>
                    <div className="text-[14px] font-semibold mb-0.5" style={{ color: 'var(--ink-primary)' }}>
                      {c.location}
                    </div>
                    <div className="text-[12.5px]" style={{ color: 'var(--ink-secondary)' }}>
                      Filed: {c.date} • {c.complainantName}
                    </div>
                    {c.investigatorNotes.length > 0 && (
                      <div className="mt-2 text-[12px] px-3 py-1.5 rounded-lg"
                        style={{ background: 'var(--surface-2)', color: 'var(--ink-secondary)' }}>
                        Latest: {c.investigatorNotes[c.investigatorNotes.length - 1].note}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    <span className={`badge ${
                      c.status === 'Submitted' ? 'badge-submitted' :
                      c.status === 'Under Verification' ? 'badge-review' :
                      c.status === 'Verified' || c.status === 'Converted to FIR' ? 'badge-active' :
                      c.status === 'Closed' ? 'badge-closed' : 'badge-investigation'
                    }`}>{c.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Notifications ──────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-[20px] font-bold" style={{ color: 'var(--ink-primary)' }}>Notifications</h2>
          <div className="space-y-3">
            {notifications.map((n) => (
              <div key={n.id} className="p-5 rounded-2xl border" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: n.type === 'warning' ? 'rgba(217,119,6,0.1)' : n.type === 'review' ? 'rgba(37,99,235,0.1)' : 'rgba(79,70,229,0.1)',
                      color: n.type === 'warning' ? '#D97706' : n.type === 'review' ? '#2563EB' : '#4F46E5',
                    }}>
                    <Bell size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-[14px] font-semibold" style={{ color: 'var(--ink-primary)' }}>{n.title}</h4>
                      <span className="text-[11px]" style={{ color: 'var(--ink-tertiary)' }}>{n.time}</span>
                    </div>
                    <p className="text-[13px]" style={{ color: 'var(--ink-secondary)' }}>{n.body}</p>
                  </div>
                </div>
              </div>
            ))}
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
