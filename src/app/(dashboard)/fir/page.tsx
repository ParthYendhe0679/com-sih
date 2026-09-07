'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { openInspector } from '@/store/slices/uiSlice';
import {
  FileText, Upload, Sparkles, CheckCircle2, RefreshCw, Eye, Shield,
  ArrowRight, User, Car, Phone, MapPin, Building2, Calendar,
  DollarSign, Check, ChevronRight, AlertCircle, FileUp, Database,
  GitFork, Network, Search, Filter, Layers, ExternalLink, HelpCircle, Share2
} from 'lucide-react';
import { toast } from 'sonner';

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

  // Mode: 'online' (Approved Online FIRs) vs 'offline' (Upload & OCR Pipeline)
  const [intakeMode, setIntakeMode] = useState<'online' | 'offline'>('offline');

  // Online FIRs list
  const onlineFIRs = [
    {
      id: 'FIR-2026-1042',
      complaintType: 'Financial Fraud & Embezzlement',
      complainant: 'Sunil Malhotra (Citizen)',
      location: 'Andheri West, Mumbai',
      date: '2026-09-04',
      status: 'Approved for Investigation',
      preview: 'Digital complaint forwarded from Citizen Portal alleging unauthorized diversion of property escrow funds.',
    },
    {
      id: 'FIR-2026-0891',
      complaintType: 'Commercial Extortion & Blackmail',
      complainant: 'Rajesh K. (Merchant Association)',
      location: 'Bandra, Mumbai',
      date: '2026-09-03',
      status: 'Approved for Investigation',
      preview: 'Multiple demands for protection payments received via anonymous VoIP and encrypted messaging numbers.',
    },
    {
      id: 'FIR-2026-0744',
      complaintType: 'Corporate Identity Theft & Forgery',
      complainant: 'Apex Advisory Pvt Ltd',
      location: 'Nariman Point, Mumbai',
      date: '2026-09-02',
      status: 'Approved for Investigation',
      preview: 'Counterfeit board resolution papers filed with Registrar of Companies to alter bank signatories.',
    },
  ];

  // Pipeline simulation state
  const [currentStep, setCurrentStep] = useState<PipelineStep>('intake');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>('FIR-2026-0102_ScannedCopy.pdf');

  // Entity Resolution Decisions
  const [resolutionStatus, setResolutionStatus] = useState<Record<string, 'confirmed' | 'separated' | 'pending'>>({
    'kv': 'confirmed',
  });

  // Start the full automated pipeline
  const runCompletePipeline = () => {
    setIsProcessing(true);
    setCurrentStep('ocr');
    setOcrProgress(15);

    setTimeout(() => setOcrProgress(45), 400);
    setTimeout(() => setOcrProgress(80), 800);
    setTimeout(() => {
      setOcrProgress(100);
      setCurrentStep('entities');
      toast.success('OCR Complete: 14 people, 22 phones, 6 vehicles, 18 locations extracted');
    }, 1200);

    setTimeout(() => {
      setCurrentStep('correlation');
      toast.info('Correlating with authorized mock datasets (ROC, Telecom, Historical cases)');
    }, 2200);

    setTimeout(() => {
      setCurrentStep('resolution');
      setIsProcessing(false);
    }, 3200);
  };

  const handleBuildNetwork = () => {
    setIsProcessing(true);
    setCurrentStep('relationships');

    setTimeout(() => {
      setCurrentStep('network');
      setIsProcessing(false);
      toast.success('Case Network synthesized! 31 nodes and 55 edges ready.');
    }, 1200);
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
        </div>

        {/* Option Switcher: Online Approved vs Offline Upload (Section 6) */}
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

      {/* ── OPTION 1: APPROVED ONLINE FIRs (Section 6) ───────────── */}
      {intakeMode === 'online' && (
        <div className="p-6 rounded-2xl border glass-panel space-y-5 animate-fade-in"
          style={{ borderColor: 'var(--border)' }}>
          <div className="border-b pb-4">
            <h3 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>
              Approved Online Citizen FIRs Ready for Investigation
            </h3>
            <p className="text-[13px] text-[var(--ink-secondary)]">
              Online citizen complaints triaged and certified by the Station Duty Officer. Select to attach directly to a case dossier.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {onlineFIRs.map((fir) => (
              <div key={fir.id} className="p-5 rounded-2xl border bg-[var(--surface-0)] space-y-3 flex flex-col justify-between"
                style={{ borderColor: 'var(--border)' }}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-id font-bold text-[13px] text-[var(--accent)]">{fir.id}</span>
                    <span className="badge badge-active text-[11px]">{fir.status}</span>
                  </div>
                  <h4 className="font-bold text-[15px]" style={{ color: 'var(--ink-primary)' }}>
                    {fir.complaintType}
                  </h4>
                  <div className="text-[12px] space-y-1" style={{ color: 'var(--ink-secondary)' }}>
                    <div>Submitted by: <strong style={{ color: 'var(--ink-primary)' }}>{fir.complainant}</strong></div>
                    <div>Location: <strong>{fir.location}</strong></div>
                    <div>Date: <span className="font-mono-id">{fir.date}</span></div>
                  </div>
                  <p className="text-[12.5px] text-[var(--ink-secondary)] leading-relaxed pt-2 border-t"
                    style={{ borderColor: 'var(--border)' }}>
                    {fir.preview}
                  </p>
                </div>

                <button
                  onClick={() => {
                    toast.success(`${fir.id} assigned to new case workspace!`);
                    router.push('/cases/CASE-102');
                  }}
                  className="w-full py-2.5 rounded-xl text-[13px] font-bold text-white shadow-sm flex items-center justify-center gap-1.5 hover:opacity-90 transition-all mt-3"
                  style={{ background: 'var(--accent)' }}
                >
                  <span>Select for Investigation</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── OPTION 2: OFFLINE FIR & CONNECTED PIPELINE (Section 7-12) ── */}
      {intakeMode === 'offline' && (
        <div className="space-y-6">
          {/* Connected Professional Pipeline Tracker (Section 7) */}
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
                      onClick={() => setCurrentStep(step.key as PipelineStep)}
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

          {/* STAGE 1: INTAKE & DRAG-AND-DROP PDF */}
          {currentStep === 'intake' && (
            <div className="p-8 rounded-2xl border glass-panel space-y-6 animate-fade-in"
              style={{ borderColor: 'var(--border)' }}>
              <div className="border-b pb-4">
                <h3 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                  Upload Offline Physical FIR Document
                </h3>
                <p className="text-[13px] text-[var(--ink-secondary)]">
                  Ingest scanned police First Information Report copy (PDF/TIFF) for neural character parsing
                </p>
              </div>

              {/* Upload Box */}
              <div className="p-10 rounded-2xl border-2 border-dashed text-center space-y-3 cursor-pointer hover:border-[var(--accent)] transition-all"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-0)' }}>
                <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-[var(--accent)]"
                  style={{ background: 'var(--accent-muted)' }}>
                  <FileUp size={28} />
                </div>
                <div>
                  <h4 className="text-[16px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                    Drag and Drop FIR Document PDF
                  </h4>
                  <p className="text-[12.5px] text-[var(--ink-secondary)] mt-1">
                    Supports high-resolution legal scans up to 25MB (FIR-2026-0102.pdf pre-selected)
                  </p>
                </div>
                <div className="pt-2 flex justify-center gap-3">
                  <span className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold border bg-[var(--surface-1)] font-mono-id"
                    style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}>
                    📄 {fileName}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={runCompletePipeline}
                  disabled={isProcessing}
                  className="px-6 py-3 rounded-xl text-[14px] font-bold text-white shadow-md flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
                  style={{ background: 'var(--accent)' }}
                >
                  <Sparkles size={16} />
                  <span>Execute Neural OCR &amp; Entity Pipeline</span>
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
                    Optical Character Recognition &amp; Vectorization
                  </h3>
                  <p className="text-[13px] text-[var(--ink-secondary)]">
                    Deep neural OCR scanning clauses, timestamps, and witness statements from {fileName}
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
                  <span>Document scanned</span>
                  <span>Text vectors extracted</span>
                  <span>Ready for NER</span>
                </div>
              </div>

              {/* Extracted Text Snippet */}
              <div className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-2" style={{ borderColor: 'var(--border)' }}>
                <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--accent)' }}>
                  Raw Legal Text Ingestion Buffer:
                </span>
                <p className="text-[12.5px] leading-relaxed font-mono-id" style={{ color: 'var(--ink-secondary)' }}>
                  "FIR No. 2026/0102 dated 01-Sep-2026 under IPC 420, 406, 120B. Complainant Manoj Tiwari alleges that suspect Karan Verma, Managing Director of Nexus Trading Corp, in criminal conspiracy with Rahul Thakur and Nisha Kapoor, induced transfer of Rs. 1.26 Crore for commercial property acquisition at Andheri West, subsequently diverted across offshore shell accounts..."
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setCurrentStep('entities')}
                  className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white shadow-sm flex items-center gap-1.5 hover:opacity-90"
                  style={{ background: 'var(--accent)' }}
                >
                  <span>Proceed to Entity Extraction</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: ENTITY EXTRACTION (Section 8) */}
          {currentStep === 'entities' && (
            <div className="p-8 rounded-2xl border glass-panel space-y-6 animate-fade-in"
              style={{ borderColor: 'var(--border)' }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4"
                style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h3 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                    Extracted Named Entities (Grouped by Type)
                  </h3>
                  <p className="text-[13px] text-[var(--ink-secondary)]">
                    Identified structured entities parsed directly from the legal FIR text
                  </p>
                </div>
                <span className="badge badge-active">NER 94% Confidence</span>
              </div>

              {/* Grouped Entity Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* People */}
                <div className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 font-bold text-[14px]" style={{ color: '#4F46E5' }}>
                    <User size={16} />
                    <span>👤 PEOPLE (14 Detected)</span>
                  </div>
                  <ul className="space-y-1.5 text-[12.5px]" style={{ color: 'var(--ink-primary)' }}>
                    <li className="font-semibold text-[var(--accent)]">• Karan Verma (Managing Director)</li>
                    <li>• Rahul Thakur (Associate)</li>
                    <li>• Nisha Kapoor (Real Estate Partner)</li>
                    <li>• Aarav Mehta (Consultant)</li>
                    <li>• Manoj Tiwari (Complainant)</li>
                  </ul>
                </div>

                {/* Phone Numbers */}
                <div className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 font-bold text-[14px]" style={{ color: '#0EA5E9' }}>
                    <Phone size={16} />
                    <span>📱 PHONE NUMBERS (22 Detected)</span>
                  </div>
                  <ul className="space-y-1.5 text-[12.5px] font-mono-id" style={{ color: 'var(--ink-primary)' }}>
                    <li>• +91 98765 XXXXX (Karan Verma)</li>
                    <li>• +91 99887 XXXXX (Rahul Thakur)</li>
                    <li>• +91 98201 01522 (Nisha Kapoor)</li>
                    <li>• +91 98201 01421 (Aarav Mehta)</li>
                  </ul>
                </div>

                {/* Vehicles */}
                <div className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 font-bold text-[14px]" style={{ color: '#10B981' }}>
                    <Car size={16} />
                    <span>🚗 VEHICLES (6 Detected)</span>
                  </div>
                  <ul className="space-y-1.5 text-[12.5px] font-mono-id" style={{ color: 'var(--ink-primary)' }}>
                    <li className="font-semibold text-[var(--success)]">• MH-01-AB-1234 (Black Mercedes E-Class)</li>
                    <li>• MH-02-CD-4567 (White Toyota Innova)</li>
                    <li>• MH-12-RT-2000 (Commercial Blue Truck)</li>
                  </ul>
                </div>

                {/* Locations */}
                <div className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 font-bold text-[14px]" style={{ color: '#F59E0B' }}>
                    <MapPin size={16} />
                    <span>📍 LOCATIONS (18 Detected)</span>
                  </div>
                  <ul className="space-y-1.5 text-[12.5px]" style={{ color: 'var(--ink-primary)' }}>
                    <li>• Andheri West (Incident locus)</li>
                    <li>• Bandra Carter Road (Residence base)</li>
                    <li>• Juhu Tara Road (Nexus Office HQ)</li>
                    <li>• Pune Deccan Gymkhana (Branch)</li>
                  </ul>
                </div>

                {/* Financial Records */}
                <div className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 font-bold text-[14px]" style={{ color: '#14B8A6' }}>
                    <DollarSign size={16} />
                    <span>🏦 FINANCIAL ENTITIES (12 Detected)</span>
                  </div>
                  <ul className="space-y-1.5 text-[12.5px]" style={{ color: 'var(--ink-primary)' }}>
                    <li>• Nexus Trading Corp (Shell Co)</li>
                    <li>• Account Ref: A/C 9812-4410-9281</li>
                    <li>• Transaction Ref: TXN-001 (₹25,00,000)</li>
                    <li>• Transaction Ref: TXN-006 (₹45,00,000)</li>
                  </ul>
                </div>

                {/* Evidence */}
                <div className="p-4 rounded-xl border bg-[var(--surface-0)] space-y-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 font-bold text-[14px]" style={{ color: '#EC4899' }}>
                    <FileText size={16} />
                    <span>📄 EVIDENCE ITEMS (9 Detected)</span>
                  </div>
                  <ul className="space-y-1.5 text-[12.5px]" style={{ color: 'var(--ink-primary)' }}>
                    <li>• Original FIR Document Scan</li>
                    <li>• Corporate Articles of Incorporation</li>
                    <li>• CCTV Snapshot at Toll Plaza</li>
                    <li>• Bank Wire Transfer Slips</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setCurrentStep('correlation')}
                  className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white shadow-sm flex items-center gap-1.5 hover:opacity-90"
                  style={{ background: 'var(--accent)' }}
                >
                  <span>Correlate Scattered Datasets</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 4: DATA CORRELATION / SCATTERED DATA (Section 9) */}
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
                    Correlating extracted FIR entities with authorized mock investigative datasets
                  </p>
                </div>
                <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-[var(--surface-2)] text-[var(--ink-secondary)]">
                  Mock / Simulated Investigation Dataset
                </span>
              </div>

              <div className="p-5 rounded-2xl border bg-[var(--surface-0)] space-y-4" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User size={18} style={{ color: 'var(--accent)' }} />
                    <span className="font-bold text-[16px]" style={{ color: 'var(--ink-primary)' }}>
                      Target Entity Under Correlation: Karan Verma
                    </span>
                  </div>
                  <span className="badge badge-critical">High Investigation Relevance</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { source: 'Previous Case Records', match: 'CASE-087 (Westside Fraud Ring, 2023)', icon: CheckCircle2, color: 'var(--success)' },
                    { source: 'Vehicle Registry Record', match: 'Registered owner of MH-01-AB-1234', icon: CheckCircle2, color: 'var(--success)' },
                    { source: 'Phone Registry & CDR Record', match: 'Subscriber of +91 98765 XXXXX (Airtel)', icon: CheckCircle2, color: 'var(--success)' },
                    { source: 'Financial Registry (ROC)', match: 'Designated Director: Nexus Trading Corp', icon: CheckCircle2, color: 'var(--success)' },
                    { source: 'Historical Investigation', match: 'Linked to CASE-041 foreign accounts', icon: CheckCircle2, color: 'var(--success)' },
                    { source: 'Intelligence Surveillance', match: 'CCTV Observation at Khalapur Toll Plaza', icon: CheckCircle2, color: 'var(--success)' },
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
                  className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white shadow-sm flex items-center gap-1.5 hover:opacity-90"
                  style={{ background: 'var(--accent)' }}
                >
                  <span>Proceed to Entity Resolution</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 5: ENTITY RESOLUTION (Section 10) */}
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
                    Identify potential duplicate records referring to the same real-world entity. Investigator remains in control.
                  </p>
                </div>
                <span className="text-[12px] font-bold text-[var(--accent)] font-mono-id">
                  Match Confidence: 92%
                </span>
              </div>

              {/* Resolution Card Example (Section 10) */}
              <div className="p-5 rounded-2xl border bg-[var(--surface-0)] space-y-4" style={{ borderColor: 'var(--border)' }}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)]">
                      Potential Entity Discrepancy Match
                    </span>
                    <h4 className="text-[17px] font-bold mt-1" style={{ color: 'var(--ink-primary)' }}>
                      "Karan Verma" ↔ "K. Verma" ↔ "Karan V."
                    </h4>
                  </div>
                  <span className="badge badge-active text-[12px]">92% Match Probability</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12.5px]">
                  <div className="p-3 rounded-xl border bg-[var(--surface-1)]" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-[11px] text-[var(--ink-tertiary)] block">Evidence 1: Name Lexical Distance</span>
                    <strong style={{ color: 'var(--ink-primary)' }}>Phonetic &amp; Jaro-Winkler match: 0.94</strong>
                  </div>
                  <div className="p-3 rounded-xl border bg-[var(--surface-1)]" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-[11px] text-[var(--ink-tertiary)] block">Evidence 2: Shared Phone Reference</span>
                    <strong style={{ color: 'var(--ink-primary)' }}>Both point to +91 98765 XXXXX</strong>
                  </div>
                  <div className="p-3 rounded-xl border bg-[var(--surface-1)]" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-[11px] text-[var(--ink-tertiary)] block">Evidence 3: Shared Address Reference</span>
                    <strong style={{ color: 'var(--ink-primary)' }}>Sea Green Apts, Andheri West</strong>
                  </div>
                </div>

                {/* Investigator Action Gate */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
                    Decision: <strong>{resolutionStatus['kv'] === 'confirmed' ? '✓ Resolved as Same Entity (PERSON-019)' : 'Separated as Distinct Records'}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setResolutionStatus((p) => ({ ...p, kv: 'confirmed' })); toast.success('Entities merged into unified persona PERSON-019'); }}
                      className="px-4 py-2 rounded-xl text-[12.5px] font-bold text-white shadow-sm hover:opacity-90 transition-all"
                      style={{ background: 'var(--success)' }}
                    >
                      ✓ Confirm Resolution (Merge)
                    </button>
                    <button
                      onClick={() => { setResolutionStatus((p) => ({ ...p, kv: 'separated' })); toast.info('Records preserved as independent entities'); }}
                      className="px-4 py-2 rounded-xl text-[12.5px] font-medium border hover:bg-[var(--surface-2)] transition-colors"
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
                  className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white shadow-sm flex items-center gap-1.5 hover:opacity-90"
                  style={{ background: 'var(--accent)' }}
                >
                  <span>Extract Discovered Relationships</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 6: RELATIONSHIP EXTRACTION (Section 11) */}
          {currentStep === 'relationships' && (
            <div className="p-8 rounded-2xl border glass-panel space-y-6 animate-fade-in"
              style={{ borderColor: 'var(--border)' }}>
              <div className="border-b pb-4">
                <h3 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                  Discovered Cross-Entity Relationships
                </h3>
                <p className="text-[13px] text-[var(--ink-secondary)]">
                  Discovered multi-hop relationships with confidence scores and verified evidentiary proof
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    source: 'Karan Verma',
                    type: 'ASSOCIATED_WITH',
                    target: 'Rahul Thakur',
                    confidence: 87,
                    evidence: '18 Phone CDR Calls + Shared Attendance in CASE-087',
                  },
                  {
                    source: 'Karan Verma',
                    type: 'SUBSCRIBES_TO',
                    target: 'Phone +91 98765 XXXXX',
                    confidence: 98,
                    evidence: 'Aadhaar e-KYC Telco Verification File',
                  },
                  {
                    source: 'Vehicle MH-01-AB-1234',
                    type: 'OPERATED_BY',
                    target: 'Karan Verma',
                    confidence: 94,
                    evidence: 'Toll Plaza ANPR Camera Snapshots at Khalapur Km 38',
                  },
                  {
                    source: 'Transaction ₹25L (TXN-001)',
                    type: 'TRANSFERRED_TO',
                    target: 'Nexus Trading Corp',
                    confidence: 98,
                    evidence: 'Bank wire audit slip signed by designated director',
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
                  onClick={handleBuildNetwork}
                  disabled={isProcessing}
                  className="px-6 py-3 rounded-xl text-[14px] font-bold text-white shadow-lg flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
                  style={{ background: 'var(--accent)' }}
                >
                  <Network size={16} />
                  <span>BUILD CASE NETWORK</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGE 7: BUILD CASE NETWORK & FINALIZE (Section 12 & 23) */}
          {currentStep === 'network' && (
            <div className="p-8 rounded-2xl border glass-panel space-y-6 animate-fade-in text-center"
              style={{ borderColor: 'var(--border)' }}>
              <div className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center text-white shadow-xl"
                style={{ background: 'var(--success)' }}>
                <Check size={32} strokeWidth={3} />
              </div>

              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-[22px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                  Case Network Generated Successfully!
                </h3>
                <p className="text-[13.5px] text-[var(--ink-secondary)] leading-relaxed">
                  FIR-2026-0102 processed. 31 nodes, 55 relationship edges, and 4 crime sub-communities indexed into CASE-102.
                </p>
              </div>

              <div className="max-w-xl mx-auto p-4 rounded-xl border bg-[var(--surface-0)] text-[12.5px] space-y-2"
                style={{ borderColor: 'var(--border)' }}>
                <div className="flex justify-between"><span>Case ID Created / Synchronized</span><strong className="font-mono-id text-[var(--accent)]">CASE-102</strong></div>
                <div className="flex justify-between"><span>Primary POI Identified</span><strong>Karan Verma (High Relevance)</strong></div>
                <div className="flex justify-between"><span>Centralized Storage</span><strong>Case Database Index</strong></div>
              </div>

              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => router.push('/cases')}
                  className="px-5 py-2.5 rounded-xl text-[13px] font-semibold border hover:bg-[var(--surface-2)] transition-colors"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
                >
                  Back to Cases Database
                </button>
                <button
                  onClick={() => router.push('/cases/CASE-102')}
                  className="px-6 py-2.5 rounded-xl text-[13px] font-bold text-white shadow-md flex items-center gap-2 hover:opacity-90 transition-all"
                  style={{ background: 'var(--accent)' }}
                >
                  <span>Open Case Intelligence Workspace</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
