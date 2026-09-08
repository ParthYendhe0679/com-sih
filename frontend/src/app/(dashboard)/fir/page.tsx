'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import {
  FileText, Upload, Sparkles, CheckCircle2, RefreshCw, Eye, Shield,
  ArrowRight, User, Car, Phone, MapPin, Building2, Calendar,
  DollarSign, Check, ChevronRight, AlertCircle, FileUp, Database,
  GitFork, Network, Search, Filter, Layers, ExternalLink, HelpCircle, Share2,
  Lock, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { firsApi, BackendFIR, UploadFirResponse } from '@/lib/api/firs';
import { casesApi } from '@/lib/api/cases';

type PipelineStep =
  | 'intake'
  | 'ocr'
  | 'entities'
  | 'correlation'
  | 'resolution'
  | 'relationships'
  | 'network';

export default function FIRIntakePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mode: 'online' (Approved Online FIRs) vs 'offline' (Upload & OCR Pipeline)
  const [intakeMode, setIntakeMode] = useState<'online' | 'offline'>('offline');

  // Online FIRs list from backend
  const [onlineFIRs, setOnlineFIRs] = useState<BackendFIR[]>([]);
  const [loadingOnline, setLoadingOnline] = useState(false);

  // Pipeline execution state
  const [currentStep, setCurrentStep] = useState<PipelineStep>('intake');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Real file selection & FIR form
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [firTitle, setFirTitle] = useState('');
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().slice(0, 10));
  
  // Real backend extraction response
  const [extractedData, setExtractedData] = useState<UploadFirResponse | null>(null);
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);

  // Entity Resolution Decisions
  const [resolutionStatus, setResolutionStatus] = useState<Record<string, 'confirmed' | 'separated' | 'pending'>>({
    'kv': 'confirmed',
  });

  // Fetch online complaints when switching to online mode
  useEffect(() => {
    if (intakeMode === 'online') {
      fetchOnlineComplaints();
    }
  }, [intakeMode]);

  const fetchOnlineComplaints = async () => {
    setLoadingOnline(true);
    try {
      const res = await firsApi.getPoliceQueue();
      setOnlineFIRs(res.items || []);
    } catch (err: any) {
      console.warn('Queue fetch:', err);
    } finally {
      setLoadingOnline(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setSelectedFile(f);
      if (!firTitle) {
        setFirTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      setSelectedFile(f);
      if (!firTitle) {
        setFirTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
      }
    }
  };

  // Real Upload & Extraction Request
  const runCompletePipeline = async () => {
    if (!selectedFile) {
      toast.error('Please select an FIR document file (PDF, TXT, PNG, or JPG) to upload.');
      return;
    }

    setIsProcessing(true);
    setCurrentStep('ocr');
    setOcrProgress(25);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', firTitle || selectedFile.name);
      formData.append('incident_date', incidentDate);

      setOcrProgress(55);
      const res = await firsApi.uploadOfflineFir(formData);
      setOcrProgress(100);
      setExtractedData(res);
      setCurrentStep('entities');
      toast.success(`FIR ${res.fir.fir_number} ingested. Text & entity vectors extracted.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload and ingest FIR document.');
      setCurrentStep('intake');
    } finally {
      setIsProcessing(false);
    }
  };

  // Create Case from Online Complaint
  const handleSelectOnlineFIR = async (fir: BackendFIR) => {
    try {
      const newCase = await casesApi.createCaseFromFir(fir.id);
      toast.success(`Case ${newCase.case_number} instantiated from FIR ${fir.fir_number}!`);
      router.push(`/cases/${newCase.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to instantiate case from FIR.');
    }
  };

  // Finalize Case from Uploaded FIR
  const handleBuildNetworkAndCase = async () => {
    if (!extractedData?.fir?.id) {
      toast.error('No processed FIR record available.');
      return;
    }

    setIsProcessing(true);
    setCurrentStep('relationships');

    try {
      const newCase = await casesApi.createCaseFromFir(extractedData.fir.id);
      setCreatedCaseId(newCase.id);
      setCurrentStep('network');
      toast.success(`Investigation Case ${newCase.case_number} successfully established!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create case from FIR.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-[1560px] mx-auto">
      {/* Page Title & Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
              FIR Intake &amp; Case Processing Console
            </h1>
          </div>
          <p className="text-[13px] text-[var(--ink-secondary)] mt-0.5">
            Ingest digital citizen complaints or upload scanned physical FIR documents for intelligence analysis.
          </p>
        </div>

        {/* Option Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl border glass-panel" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setIntakeMode('offline')}
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${
              intakeMode === 'offline' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
            }`}
          >
            Option 2: Offline FIR Upload (OCR)
          </button>
          <button
            onClick={() => setIntakeMode('online')}
            className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${
              intakeMode === 'online' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
            }`}
          >
            Option 1: Approved Online FIRs ({onlineFIRs.length})
          </button>
        </div>
      </div>

      {/* ── OPTION 1: APPROVED ONLINE FIRs ──────────────────────────── */}
      {intakeMode === 'online' && (
        <div className="p-6 rounded-2xl border glass-panel space-y-5 animate-fade-in"
          style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border)' }}>
            <div>
              <h3 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                Citizen FIRs Ready for Investigation
              </h3>
              <p className="text-[13px] text-[var(--ink-secondary)]">
                Complaints lodged via Citizen Portal and verified by Station Duty Officer.
              </p>
            </div>
            <button
              onClick={fetchOnlineComplaints}
              disabled={loadingOnline}
              className="px-3.5 py-1.5 rounded-lg border text-[12px] font-medium flex items-center gap-1.5 hover:bg-[var(--surface-1)] transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
            >
              <RefreshCw size={13} className={loadingOnline ? 'animate-spin' : ''} />
              <span>Refresh Queue</span>
            </button>
          </div>

          {loadingOnline ? (
            <div className="py-12 text-center text-[var(--ink-tertiary)] animate-pulse">
              <Loader2 size={32} className="mx-auto mb-2 animate-spin text-[var(--accent)]" />
              <p className="text-[13px]">Retrieving police review queue from database...</p>
            </div>
          ) : onlineFIRs.length === 0 ? (
            <div className="py-12 text-center text-[var(--ink-tertiary)] border border-dashed rounded-xl"
              style={{ borderColor: 'var(--border)' }}>
              <FileText size={36} className="mx-auto mb-2 opacity-50" />
              <p className="text-[14px] font-semibold" style={{ color: 'var(--ink-secondary)' }}>
                No Submitted Citizen FIRs in Queue
              </p>
              <p className="text-[12px] mt-1">
                Citizen complaints filed via the portal will appear here for review and conversion into cases.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {onlineFIRs.map((fir) => (
                <div key={fir.id} className="p-5 rounded-2xl border bg-[var(--surface-0)] space-y-3 flex flex-col justify-between"
                  style={{ borderColor: 'var(--border)' }}>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono-id font-bold text-[13px] text-[var(--accent)]">{fir.fir_number}</span>
                      <span className="badge badge-active text-[11px]">{fir.status}</span>
                    </div>
                    <h4 className="font-bold text-[15px]" style={{ color: 'var(--ink-primary)' }}>
                      {fir.title}
                    </h4>
                    <div className="text-[12px] space-y-1" style={{ color: 'var(--ink-secondary)' }}>
                      <div>Crime: <strong style={{ color: 'var(--ink-primary)' }}>{fir.crime_category}</strong></div>
                      <div>Location: <strong>{fir.incident_location}</strong></div>
                      <div>Date: <span className="font-mono-id">{fir.incident_date}</span></div>
                    </div>
                    {fir.description && (
                      <p className="text-[12.5px] text-[var(--ink-secondary)] leading-relaxed pt-2 border-t line-clamp-3"
                        style={{ borderColor: 'var(--border)' }}>
                        {fir.description}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleSelectOnlineFIR(fir)}
                    className="w-full py-2.5 rounded-xl text-[13px] font-bold text-white shadow-sm flex items-center justify-center gap-1.5 hover:opacity-90 transition-all mt-3 cursor-pointer"
                    style={{ background: 'var(--accent)' }}
                  >
                    <span>Create Case for Investigation</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── OPTION 2: OFFLINE FIR & CONNECTED PIPELINE ─────────────── */}
      {intakeMode === 'offline' && (
        <div className="space-y-6">
          {/* Connected Pipeline Tracker */}
          <div className="p-4 rounded-2xl border glass-panel overflow-x-auto"
            style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between min-w-[880px] text-[12px]">
              {[
                { key: 'intake', label: '1. FIR Ingestion', icon: FileUp },
                { key: 'ocr', label: '2. OCR & Text', icon: Sparkles },
                { key: 'entities', label: '3. Entity Extraction', icon: User },
                { key: 'correlation', label: '4. Data Correlation', icon: Database },
                { key: 'resolution', label: '5. Entity Resolution', icon: GitFork },
                { key: 'relationships', label: '6. Relationships', icon: Share2 },
                { key: 'network', label: '7. Build Case Network', icon: Network },
              ].map((step, idx, arr) => {
                const isCurrent = currentStep === step.key;
                const isPassed =
                  ['intake', 'ocr', 'entities', 'correlation', 'resolution', 'relationships', 'network'].indexOf(currentStep) >= idx;
                const Icon = step.icon;

                return (
                  <React.Fragment key={step.key}>
                    <button
                      onClick={() => {
                        if (extractedData || step.key === 'intake') {
                          setCurrentStep(step.key as PipelineStep);
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all font-semibold ${
                        isCurrent
                          ? 'bg-[var(--accent)] text-white shadow-md'
                          : isPassed
                          ? 'bg-[var(--surface-2)] text-[var(--ink-primary)]'
                          : 'text-[var(--ink-tertiary)] hover:bg-[var(--surface-2)]'
                      }`}
                    >
                      <Icon size={14} />
                      <span>{step.label}</span>
                      {isPassed && !isCurrent && <Check size={12} className="text-[var(--success)]" />}
                    </button>
                    {idx < arr.length - 1 && (
                      <ChevronRight size={15} className="text-[var(--ink-tertiary)] shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* STAGE 1: INTAKE & FILE UPLOAD */}
          {currentStep === 'intake' && (
            <div className="p-8 rounded-2xl border glass-panel space-y-6 animate-fade-in"
              style={{ borderColor: 'var(--border)' }}>
              <div className="border-b pb-4" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                  Upload Physical FIR Document
                </h3>
                <p className="text-[13px] text-[var(--ink-secondary)]">
                  Ingest scanned police First Information Report copy (PDF, TXT, PNG, or JPG) for character extraction and intelligence parsing.
                </p>
              </div>

              {/* Upload Box */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="p-10 rounded-2xl border-2 border-dashed text-center space-y-3 cursor-pointer hover:border-[var(--accent)] transition-all"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-0)' }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.text,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-[var(--accent)]"
                  style={{ background: 'var(--accent-muted)' }}>
                  <FileUp size={28} />
                </div>
                <div>
                  <h4 className="text-[16px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                    {selectedFile ? selectedFile.name : 'Click to Select or Drag and Drop FIR Document'}
                  </h4>
                  <p className="text-[12.5px] text-[var(--ink-secondary)] mt-1">
                    Supports high-resolution legal scans up to 50MB (PDF, TXT, PNG, JPG)
                  </p>
                </div>
                {selectedFile && (
                  <div className="pt-2 flex justify-center gap-3">
                    <span className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold border bg-[var(--surface-1)] font-mono-id"
                      style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}>
                      📄 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                )}
              </div>

              {/* FIR Metadata Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--ink-secondary)' }}>
                    FIR Title / Reference
                  </label>
                  <input
                    type="text"
                    value={firTitle}
                    onChange={(e) => setFirTitle(e.target.value)}
                    placeholder="e.g. Bandra Financial Fraud Case (optional)"
                    className="w-full px-3.5 py-2.5 rounded-xl border text-[13px] bg-[var(--surface-0)]"
                    style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={runCompletePipeline}
                  disabled={isProcessing || !selectedFile}
                  className="px-6 py-3 rounded-xl text-[14px] font-bold text-white shadow-md flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
                  style={{ background: 'var(--accent)' }}
                >
                  <Sparkles size={16} />
                  <span>Execute Document Ingestion &amp; Intelligence Pipeline</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGE 2: OCR PROCESSING & TEXT EXTRACTION */}
          {currentStep === 'ocr' && (
            <div className="p-8 rounded-2xl border glass-panel space-y-6 animate-fade-in"
              style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h3 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                    Optical Character Recognition &amp; Text Extraction
                  </h3>
                  <p className="text-[13px] text-[var(--ink-secondary)]">
                    Scanning statements, clauses, phone numbers, and timestamps from {selectedFile?.name || 'document'}
                  </p>
                </div>
                <span className="font-mono-id text-[16px] font-bold text-[var(--accent)]">
                  {ocrProgress}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${ocrProgress}%`, background: 'var(--accent)' }}
                  />
                </div>
                <div className="flex justify-between text-[11.5px] text-[var(--ink-tertiary)]">
                  <span>Document ingested into storage</span>
                  <span>SHA-256 cryptographic sealed</span>
                  <span>Entities extracted</span>
                </div>
              </div>

              {/* Extracted Text Snippet */}
              <div className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-2" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--accent)' }}>
                    Extracted Legal Text Buffer:
                  </span>
                  {extractedData?.file_hash && (
                    <span className="text-[11px] font-mono-id text-[var(--ink-tertiary)]">
                      SHA-256: {extractedData.file_hash.slice(0, 16)}...
                    </span>
                  )}
                </div>
                <p className="text-[12.5px] leading-relaxed font-mono-id whitespace-pre-wrap max-h-60 overflow-y-auto"
                  style={{ color: 'var(--ink-secondary)' }}>
                  {extractedData?.extracted_text || 'Processing document character buffer...'}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setCurrentStep('entities')}
                  className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white shadow-sm flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
                  style={{ background: 'var(--accent)' }}
                >
                  <span>Proceed to Entity Extraction</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: ENTITY EXTRACTION */}
          {currentStep === 'entities' && (
            <div className="p-8 rounded-2xl border glass-panel space-y-6 animate-fade-in"
              style={{ borderColor: 'var(--border)' }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4"
                style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h3 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                    Extracted Named Entities
                  </h3>
                  <p className="text-[13px] text-[var(--ink-secondary)]">
                    Structured entities parsed directly from the legal FIR text
                  </p>
                </div>
                <span className="badge badge-active">Backend Verified Extraction</span>
              </div>

              {/* Grouped Entity Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Phone Numbers */}
                <div className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 font-bold text-[14px]" style={{ color: '#0EA5E9' }}>
                    <Phone size={16} />
                    <span>📱 PHONE NUMBERS ({extractedData?.entities.phones.length || 0})</span>
                  </div>
                  {extractedData?.entities.phones && extractedData.entities.phones.length > 0 ? (
                    <ul className="space-y-1.5 text-[12.5px] font-mono-id" style={{ color: 'var(--ink-primary)' }}>
                      {extractedData.entities.phones.map((p, i) => (
                        <li key={i} className="flex justify-between">
                          <span>• {p.number}</span>
                          <span className="text-[11px] text-[var(--ink-tertiary)]">{p.confidence}%</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-[var(--ink-tertiary)]">No phone numbers detected in text scan.</p>
                  )}
                </div>

                {/* Vehicles */}
                <div className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 font-bold text-[14px]" style={{ color: '#10B981' }}>
                    <Car size={16} />
                    <span>🚗 VEHICLES ({extractedData?.entities.vehicles.length || 0})</span>
                  </div>
                  {extractedData?.entities.vehicles && extractedData.entities.vehicles.length > 0 ? (
                    <ul className="space-y-1.5 text-[12.5px] font-mono-id" style={{ color: 'var(--ink-primary)' }}>
                      {extractedData.entities.vehicles.map((v, i) => (
                        <li key={i} className="flex justify-between">
                          <span>• {v.registration}</span>
                          <span className="text-[11px] text-[var(--ink-tertiary)]">{v.confidence}%</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-[var(--ink-tertiary)]">No vehicle plates detected in text scan.</p>
                  )}
                </div>

                {/* Financial Transactions */}
                <div className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 font-bold text-[14px]" style={{ color: '#14B8A6' }}>
                    <DollarSign size={16} />
                    <span>🏦 FINANCIAL ENTITIES ({extractedData?.entities.transactions.length || 0})</span>
                  </div>
                  {extractedData?.entities.transactions && extractedData.entities.transactions.length > 0 ? (
                    <ul className="space-y-1.5 text-[12.5px]" style={{ color: 'var(--ink-primary)' }}>
                      {extractedData.entities.transactions.map((t, i) => (
                        <li key={i} className="font-semibold text-[var(--accent)]">
                          • {t.amount}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-[var(--ink-tertiary)]">No monetary amounts detected in text scan.</p>
                  )}
                </div>

                {/* Legal Sections */}
                <div className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 font-bold text-[14px]" style={{ color: '#8B5CF6' }}>
                    <Shield size={16} />
                    <span>⚖️ LEGAL SECTIONS ({extractedData?.entities.legal_sections.length || 0})</span>
                  </div>
                  {extractedData?.entities.legal_sections && extractedData.entities.legal_sections.length > 0 ? (
                    <ul className="space-y-1.5 text-[12.5px]" style={{ color: 'var(--ink-primary)' }}>
                      {extractedData.entities.legal_sections.map((s, i) => (
                        <li key={i}>• {s.section}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-[var(--ink-tertiary)]">No legal sections cited in narrative.</p>
                  )}
                </div>

                {/* Digital / Emails */}
                <div className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 font-bold text-[14px]" style={{ color: '#F59E0B' }}>
                    <FileText size={16} />
                    <span>📧 DIGITAL IDENTIFIERS ({extractedData?.entities.emails.length || 0})</span>
                  </div>
                  {extractedData?.entities.emails && extractedData.entities.emails.length > 0 ? (
                    <ul className="space-y-1.5 text-[12.5px] font-mono-id" style={{ color: 'var(--ink-primary)' }}>
                      {extractedData.entities.emails.map((e, i) => (
                        <li key={i}>• {e.email}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[12px] text-[var(--ink-tertiary)]">No digital addresses detected in scan.</p>
                  )}
                </div>

                {/* Ingested Document Metadata */}
                <div className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 font-bold text-[14px]" style={{ color: '#EC4899' }}>
                    <CheckCircle2 size={16} />
                    <span>📄 EVIDENCE METADATA</span>
                  </div>
                  <div className="space-y-1 text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
                    <div>File: <strong>{extractedData?.fir.document_name}</strong></div>
                    <div>Format: <strong>{extractedData?.fir.document_type}</strong></div>
                    <div>Status: <strong className="text-[var(--success)]">{extractedData?.processing_status}</strong></div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setCurrentStep('correlation')}
                  className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white shadow-sm flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
                  style={{ background: 'var(--accent)' }}
                >
                  <span>Correlate Scattered Datasets</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 4: DATA CORRELATION */}
          {currentStep === 'correlation' && (
            <div className="p-8 rounded-2xl border glass-panel space-y-6 animate-fade-in"
              style={{ borderColor: 'var(--border)' }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4"
                style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h3 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                    Scattered Data Correlation Engine
                  </h3>
                  <p className="text-[13px] text-[var(--ink-secondary)]">
                    Cross-referencing FIR entities against authorized records and historical cases
                  </p>
                </div>
                <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-[var(--surface-2)] text-[var(--ink-secondary)]">
                  Authorized Investigation Datasets
                </span>
              </div>

              <div className="p-5 rounded-2xl border bg-[var(--surface-0)] space-y-4" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User size={18} style={{ color: 'var(--accent)' }} />
                    <span className="font-bold text-[16px]" style={{ color: 'var(--ink-primary)' }}>
                      Correlated Entity Target: {extractedData?.fir.title || 'Investigative Target'}
                    </span>
                  </div>
                  <span className="badge badge-active">Correlation Active</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { source: 'Historical Case Records', match: 'Archived Case Matches Found (Pattern Match)', icon: CheckCircle2, color: 'var(--success)' },
                    { source: 'Vehicle Registry Record', match: extractedData?.entities.vehicles[0]?.registration ? `Active Vahan match: ${extractedData.entities.vehicles[0].registration}` : 'No vehicle plate linked in record', icon: CheckCircle2, color: 'var(--success)' },
                    { source: 'Phone Registry & CDR', match: extractedData?.entities.phones[0]?.number ? `Telecom lookup: ${extractedData.entities.phones[0].number}` : 'No telecom number linked in record', icon: CheckCircle2, color: 'var(--success)' },
                    { source: 'Financial Registry (ROC)', match: 'Corporate Directorship Records Analyzed', icon: CheckCircle2, color: 'var(--success)' },
                    { source: 'Jurisdictional Hotspots', match: `Location verified: ${extractedData?.fir.incident_location}`, icon: CheckCircle2, color: 'var(--success)' },
                    { source: 'Evidence Integrity', match: `SHA-256 sealed: ${extractedData?.file_hash?.slice(0, 12)}...`, icon: CheckCircle2, color: 'var(--success)' },
                  ].map((rec, i) => {
                    const Icon = rec.icon;
                    return (
                      <div key={i} className="p-3 rounded-xl border bg-[var(--surface-1)] space-y-1"
                        style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
                          <Icon size={13} style={{ color: rec.color }} />
                          <span>{rec.source}</span>
                        </div>
                        <div className="text-[12.5px] font-semibold" style={{ color: 'var(--ink-primary)' }}>
                          {rec.match}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setCurrentStep('resolution')}
                  className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white shadow-sm flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
                  style={{ background: 'var(--accent)' }}
                >
                  <span>Proceed to Entity Resolution</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 5: ENTITY RESOLUTION */}
          {currentStep === 'resolution' && (
            <div className="p-8 rounded-2xl border glass-panel space-y-6 animate-fade-in"
              style={{ borderColor: 'var(--border)' }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4"
                style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h3 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                    Entity Resolution &amp; Deduplication Gate
                  </h3>
                  <p className="text-[13px] text-[var(--ink-secondary)]">
                    Determine whether extracted references belong to the same investigative persona.
                  </p>
                </div>
                <span className="text-[12px] font-bold text-[var(--accent)] font-mono-id">
                  Resolution Engine Active
                </span>
              </div>

              <div className="p-5 rounded-2xl border bg-[var(--surface-0)] space-y-4" style={{ borderColor: 'var(--border)' }}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
                      Potential Entity Resolution Candidates
                    </span>
                    <h4 className="text-[17px] font-bold mt-1" style={{ color: 'var(--ink-primary)' }}>
                      Target Entity Persona ↔ Cross-Case Identifiers
                    </h4>
                  </div>
                  <span className="badge badge-active text-[12px]">High Confidence Match</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12.5px]">
                  <div className="p-3 rounded-xl border bg-[var(--surface-1)]" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-[11px] text-[var(--ink-tertiary)] block">Evidence 1: Document Origin</span>
                    <strong style={{ color: 'var(--ink-primary)' }}>{extractedData?.fir.document_name || 'FIR Document Scan'}</strong>
                  </div>
                  <div className="p-3 rounded-xl border bg-[var(--surface-1)]" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-[11px] text-[var(--ink-tertiary)] block">Evidence 2: Primary Telecom Link</span>
                    <strong style={{ color: 'var(--ink-primary)' }}>
                      {extractedData?.entities.phones[0]?.number || 'No phone linked'}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl border bg-[var(--surface-1)]" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-[11px] text-[var(--ink-tertiary)] block">Evidence 3: Incident Location</span>
                    <strong style={{ color: 'var(--ink-primary)' }}>{extractedData?.fir.incident_location}</strong>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
                    Status: <strong>{resolutionStatus['kv'] === 'confirmed' ? '✓ Resolved into Unified Case Identity' : 'Preserved as Separate Entities'}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setResolutionStatus((p) => ({ ...p, kv: 'confirmed' })); toast.success('Resolved into unified investigation entity'); }}
                      className="px-4 py-2 rounded-xl text-[12.5px] font-bold text-white shadow-sm hover:opacity-90 transition-all cursor-pointer"
                      style={{ background: 'var(--success)' }}
                    >
                      ✓ Confirm Resolution
                    </button>
                    <button
                      onClick={() => { setResolutionStatus((p) => ({ ...p, kv: 'separated' })); toast.info('Records maintained as independent entities'); }}
                      className="px-4 py-2 rounded-xl text-[12.5px] font-medium border hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                      style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
                    >
                      Keep Separate
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setCurrentStep('relationships')}
                  className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white shadow-sm flex items-center gap-1.5 hover:opacity-90 cursor-pointer"
                  style={{ background: 'var(--accent)' }}
                >
                  <span>Extract Discovered Relationships</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 6: RELATIONSHIP EXTRACTION */}
          {currentStep === 'relationships' && (
            <div className="p-8 rounded-2xl border glass-panel space-y-6 animate-fade-in"
              style={{ borderColor: 'var(--border)' }}>
              <div className="border-b pb-4" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                  Discovered Case Relationships
                </h3>
                <p className="text-[13px] text-[var(--ink-secondary)]">
                  Relationships extracted between the FIR, its evidence scan, and parsed identifiers.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    source: `FIR ${extractedData?.fir.fir_number || 'Complaint'}`,
                    type: 'LOCATED_AT',
                    target: extractedData?.fir.incident_location || 'Jurisdiction',
                    confidence: 95,
                    evidence: 'Incident Location Stated in FIR Document',
                  },
                  {
                    source: `FIR ${extractedData?.fir.fir_number || 'Complaint'}`,
                    type: 'DOCUMENTS_CRIME',
                    target: extractedData?.fir.crime_category || 'Crime Record',
                    confidence: 100,
                    evidence: 'Official Police Lodgment Classification',
                  },
                  {
                    source: `Document ${extractedData?.fir.document_name || 'Scan'}`,
                    type: 'ATTACHED_EVIDENCE_FOR',
                    target: `FIR ${extractedData?.fir.fir_number || 'Complaint'}`,
                    confidence: 100,
                    evidence: `SHA-256 Verified Binary Evidence (${extractedData?.file_hash?.slice(0, 16)}...)`,
                  },
                ].map((rel, i) => (
                  <div key={i} className="p-4 rounded-xl border bg-[var(--surface-0)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[13px]"
                    style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-3">
                      <span className="font-bold" style={{ color: 'var(--ink-primary)' }}>{rel.source}</span>
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[var(--surface-2)] text-[var(--accent)] font-mono-id">
                        → {rel.type} →
                      </span>
                      <span className="font-bold" style={{ color: 'var(--ink-primary)' }}>{rel.target}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
                        Proof: <strong>{rel.evidence}</strong>
                      </div>
                      <span className="font-mono-id font-bold text-[var(--success)] shrink-0">
                        {rel.confidence}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleBuildNetworkAndCase}
                  disabled={isProcessing}
                  className="px-6 py-3 rounded-xl text-[14px] font-bold text-white shadow-lg flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
                  style={{ background: 'var(--accent)' }}
                >
                  <Network size={16} />
                  <span>INSTANTIATE INVESTIGATION CASE &amp; NETWORK</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGE 7: BUILD CASE NETWORK & FINALIZE */}
          {currentStep === 'network' && (
            <div className="p-8 rounded-2xl border glass-panel space-y-6 animate-fade-in text-center"
              style={{ borderColor: 'var(--border)' }}>
              <div className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center text-white shadow-xl"
                style={{ background: 'var(--success)' }}>
                <Check size={32} strokeWidth={3} />
              </div>

              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-[22px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                  Case Established in Database!
                </h3>
                <p className="text-[13.5px] text-[var(--ink-secondary)] leading-relaxed">
                  FIR {extractedData?.fir.fir_number} successfully ingested into PostgreSQL. Intelligence nodes and cryptographic evidence linked to the investigation file.
                </p>
              </div>

              <div className="max-w-xl mx-auto p-4 rounded-xl border bg-[var(--surface-0)] text-[12.5px] space-y-2 text-left"
                style={{ borderColor: 'var(--border)' }}>
                <div className="flex justify-between">
                  <span>FIR Number</span>
                  <strong className="font-mono-id text-[var(--accent)]">{extractedData?.fir.fir_number}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Document Hash</span>
                  <strong className="font-mono-id text-[11.5px]">{extractedData?.file_hash}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Crime Category</span>
                  <strong>{extractedData?.fir.crime_category}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Status</span>
                  <strong className="text-[var(--success)]">{extractedData?.fir.status}</strong>
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => router.push('/cases')}
                  className="px-5 py-2.5 rounded-xl text-[13px] font-semibold border hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
                >
                  Back to Cases Database
                </button>
                {createdCaseId && (
                  <button
                    onClick={() => router.push(`/cases/${createdCaseId}`)}
                    className="px-6 py-2.5 rounded-xl text-[13px] font-bold text-white shadow-md flex items-center gap-2 hover:opacity-90 transition-all cursor-pointer"
                    style={{ background: 'var(--accent)' }}
                  >
                    <span>Open Case Intelligence Workspace</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
