'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import {
  CheckCircle2, XCircle, HelpCircle,
  Upload, Sparkles, RefreshCw, FolderPlus,
  FileUp, FileText, Loader2, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { firsApi, BackendFIR, UploadFirResponse } from '@/lib/api/firs';
import { casesApi } from '@/lib/api/cases';

export default function PolicePortalPage() {
  const [activeTab, setActiveTab] = useState<'queue' | 'upload'>('queue');
  const [queue, setQueue] = useState<BackendFIR[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string>('');

  // Real FIR upload state
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [firTitle, setFirTitle] = useState('Offline FIR Ingestion');
  const [station, setStation] = useState('Andheri East Police Station');
  const [crimeCategory, setCrimeCategory] = useState('Cybercrime');
  const [uploadResult, setUploadResult] = useState<UploadFirResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchQueue = async () => {
    setLoadingQueue(true);
    try {
      const res = await firsApi.getPoliceQueue();
      const items = res.items || [];
      setQueue(items);
      if (items.length > 0 && !selectedComplaintId) {
        setSelectedComplaintId(items[0].id);
      }
    } catch (err: any) {
      console.warn('Failed to load queue:', err);
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const selectedComplaint = queue.find((c) => c.id === selectedComplaintId) || queue[0];

  const handleAction = async (
    action: 'approve' | 'reject' | 'request' | 'convert',
    complaintId: string
  ) => {
    try {
      if (action === 'approve') {
        await firsApi.reviewFir(complaintId, { status: 'ACCEPTED', remarks: 'Verified by Station Duty Officer.' });
        toast.success(`Complaint ${selectedComplaint?.fir_number || complaintId} marked as Verified / Accepted`);
        fetchQueue();
      } else if (action === 'request') {
        await firsApi.reviewFir(complaintId, { status: 'MORE_INFORMATION_REQUIRED', remarks: 'Additional documentary verification requested.' });
        toast.info(`Additional info requested from citizen for ${selectedComplaint?.fir_number || complaintId}`);
        fetchQueue();
      } else if (action === 'reject') {
        await firsApi.reviewFir(complaintId, { status: 'REJECTED', rejection_reason: 'Civil dispute nature. Beyond police cognizance.' });
        toast.error(`Complaint ${selectedComplaint?.fir_number || complaintId} closed / rejected`);
        fetchQueue();
      } else if (action === 'convert') {
        const newCase = await casesApi.createCaseFromFir(complaintId);
        toast.success(`FIR converted to Investigation Case ${newCase.case_number}!`);
        fetchQueue();
      }
    } catch (err: any) {
      toast.error(err.message || 'Action failed.');
    }
  };

  const handleRealUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select an FIR document file (PDF, TXT, PNG, or JPG).');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', firTitle || selectedFile.name);
      formData.append('crime_category', crimeCategory);
      formData.append('incident_location', station);

      const res = await firsApi.uploadOfflineFir(formData);
      setUploadResult(res);
      toast.success(`FIR ${res.fir.fir_number} scanned and ingested into KRITAGAS intelligence index.`);
      fetchQueue();
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload and ingest document.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
              Police Intake &amp; Case Verification Console
            </h1>
            <span
              className="text-[11px] font-mono-id px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
            >
              Law Enforcement Desk
            </span>
          </div>
          <p className="text-[13px] text-[var(--ink-secondary)]">
            Complaint triage, investigation review, and digital FIR registration gateway
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-lg border glass-panel" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setActiveTab('queue')}
            className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer"
            style={{
              background: activeTab === 'queue' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'queue' ? '#FFFFFF' : 'var(--ink-secondary)',
            }}
          >
            Complaint Triage ({queue.length})
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer"
            style={{
              background: activeTab === 'upload' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'upload' ? '#FFFFFF' : 'var(--ink-secondary)',
            }}
          >
            Upload FIR (OCR)
          </button>
        </div>
      </div>

      {/* VIEW 1: COMPLAINT TRIAGE & VERIFICATION QUEUE */}
      {activeTab === 'queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Complaints List (5 cols) */}
          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
                Incoming Complaints
              </span>
              <button
                onClick={fetchQueue}
                disabled={loadingQueue}
                className="text-[11px] flex items-center gap-1 text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] cursor-pointer"
              >
                <RefreshCw size={12} className={loadingQueue ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingQueue ? (
              <div className="p-8 text-center text-[var(--ink-tertiary)]">
                <Loader2 size={24} className="mx-auto mb-2 animate-spin text-[var(--accent)]" />
                <p className="text-[12px]">Loading station triage queue...</p>
              </div>
            ) : queue.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed text-center text-[var(--ink-tertiary)]"
                style={{ borderColor: 'var(--border)' }}>
                <FileText size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-[13px] font-semibold" style={{ color: 'var(--ink-secondary)' }}>
                  Queue Empty
                </p>
                <p className="text-[11.5px] mt-1">
                  All submitted citizen complaints have been triaged.
                </p>
              </div>
            ) : (
              queue.map((comp) => {
                const isSelected = selectedComplaint?.id === comp.id;
                return (
                  <div
                    key={comp.id}
                    onClick={() => setSelectedComplaintId(comp.id)}
                    className="p-4 rounded-xl border cursor-pointer transition-all hover:border-[var(--accent)] space-y-1 glass-panel"
                    style={{
                      borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                      background: isSelected ? 'var(--glass-2)' : 'var(--glass-1)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono-id font-bold text-[13px] text-[var(--accent)]">
                        {comp.fir_number}
                      </span>
                      <span className="badge badge-review text-[10px]">
                        {comp.status}
                      </span>
                    </div>

                    <h3 className="font-semibold text-[13px]" style={{ color: 'var(--ink-primary)' }}>
                      {comp.title}
                    </h3>

                    <div className="text-[11px] text-[var(--ink-secondary)] truncate">
                      {comp.incident_location} • Filed {comp.incident_date}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Action Console (7 cols) */}
          <div className="lg:col-span-7">
            {selectedComplaint ? (
              <div
                className="p-6 rounded-2xl border space-y-5 glass-panel-elevated"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <span className="font-mono-id font-bold text-[14px] text-[var(--accent)]">
                      {selectedComplaint.fir_number}
                    </span>
                    <h3 className="text-[17px] font-bold mt-0.5" style={{ color: 'var(--ink-primary)' }}>
                      {selectedComplaint.title}
                    </h3>
                  </div>
                  <span className="badge badge-active">{selectedComplaint.status}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-tertiary)]">
                    Reported Allegation / Description
                  </span>
                  <p className="text-[13px] leading-relaxed p-3 rounded-lg border bg-[var(--glass-1)]" style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}>
                    {selectedComplaint.description || 'No detailed narrative supplied.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[12px]">
                  <div className="p-2.5 rounded-lg border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-[10px] text-[var(--ink-tertiary)] uppercase font-semibold block">Crime Category</span>
                    <span className="font-medium">{selectedComplaint.crime_category}</span>
                  </div>
                  <div className="p-2.5 rounded-lg border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-[10px] text-[var(--ink-tertiary)] uppercase font-semibold block">Incident Locus</span>
                    <span className="font-medium truncate block">{selectedComplaint.incident_location}</span>
                  </div>
                </div>

                {/* Desk Verification Actions */}
                <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-tertiary)] block">
                    Investigative Action Gate
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      onClick={() => handleAction('approve', selectedComplaint.id)}
                      className="p-2 rounded-lg border text-[12px] font-semibold flex items-center justify-center gap-1 hover:bg-[var(--surface-2)] text-[var(--success)] cursor-pointer"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <CheckCircle2 size={14} />
                      <span>Verify</span>
                    </button>

                    <button
                      onClick={() => handleAction('request', selectedComplaint.id)}
                      className="p-2 rounded-lg border text-[12px] font-semibold flex items-center justify-center gap-1 hover:bg-[var(--surface-2)] text-[var(--warning)] cursor-pointer"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <HelpCircle size={14} />
                      <span>Request Info</span>
                    </button>

                    <button
                      onClick={() => handleAction('convert', selectedComplaint.id)}
                      className="p-2 rounded-lg text-[12px] font-semibold text-white shadow-sm flex items-center justify-center gap-1 hover:opacity-90 transition-all col-span-2 sm:col-span-1 cursor-pointer"
                      style={{ background: 'var(--accent)' }}
                    >
                      <FolderPlus size={14} />
                      <span>Convert to Case</span>
                    </button>

                    <button
                      onClick={() => handleAction('reject', selectedComplaint.id)}
                      className="p-2 rounded-lg border text-[12px] font-semibold flex items-center justify-center gap-1 hover:bg-[var(--surface-2)] text-[var(--error)] cursor-pointer"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <XCircle size={14} />
                      <span>Dismiss</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-[var(--ink-tertiary)] border border-dashed rounded-xl"
                style={{ borderColor: 'var(--border)' }}>
                <p>Select a complaint from the list to review details and take investigative action.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: OFFLINE FIR UPLOAD & OCR */}
      {activeTab === 'upload' && (
        <div className="max-w-2xl mx-auto p-6 rounded-2xl border space-y-6 glass-panel"
          style={{ borderColor: 'var(--border)' }}>
          <div className="border-b pb-3" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-[17px] font-bold" style={{ color: 'var(--ink-primary)' }}>
              Scan &amp; Ingest Physical FIR Document
            </h3>
            <p className="text-[12.5px] text-[var(--ink-secondary)]">
              Upload scanned FIR document copies for text extraction and intelligence vectorization.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-tertiary)]">
                  FIR Title / Reference
                </label>
                <input
                  type="text"
                  value={firTitle}
                  onChange={(e) => setFirTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-[13px] bg-[var(--surface-0)] font-medium"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-tertiary)]">
                  Police Station / Jurisdiction
                </label>
                <input
                  type="text"
                  value={station}
                  onChange={(e) => setStation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-[13px] bg-[var(--surface-0)] font-medium"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
                />
              </div>
            </div>

            {/* Document Picker */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 rounded-xl border-2 border-dashed text-center space-y-2 cursor-pointer hover:border-[var(--accent)] transition-all bg-[var(--surface-0)]"
              style={{ borderColor: 'var(--border)' }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.text,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
              />
              <FileUp size={32} className="mx-auto text-[var(--accent)]" />
              <p className="text-[13px] font-semibold" style={{ color: 'var(--ink-primary)' }}>
                {selectedFile ? selectedFile.name : 'Click to select physical FIR scan (PDF, TXT, PNG, JPG)'}
              </p>
              {selectedFile && (
                <p className="text-[11.5px] font-mono-id text-[var(--ink-tertiary)]">
                  Size: {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>

            {uploadResult && (
              <div className="p-4 rounded-xl border bg-[var(--surface-1)] space-y-2" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[var(--success)] flex items-center gap-1">
                    <Check size={14} /> Ingested as {uploadResult.fir.fir_number}
                  </span>
                  <span className="font-mono-id text-[11px] text-[var(--ink-tertiary)]">
                    SHA-256: {uploadResult.file_hash.slice(0, 16)}...
                  </span>
                </div>
                <p className="text-[12px] font-mono-id text-[var(--ink-secondary)] max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {uploadResult.extracted_text}
                </p>
              </div>
            )}

            <button
              onClick={handleRealUpload}
              disabled={uploading || !selectedFile}
              className="w-full py-2.5 rounded-xl text-[13px] font-bold text-white shadow-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
              style={{ background: 'var(--accent)' }}
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Uploading and Extracting Text...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Upload and Ingest FIR Document</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
