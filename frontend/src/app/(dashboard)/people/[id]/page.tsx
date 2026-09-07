'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/hooks';
import { openInspector } from '@/store/slices/uiSlice';
import {
  people, cases, vehicles, phones, locations, organizations,
  evidence, alerts, timelineEvents, historicalCases, forensicRecords
} from '@/mock';
import {
  User, FolderOpen, Car, Phone as PhoneIcon, MapPin, Building2,
  Package, FlaskConical, Network, Clock, Bell, History, ArrowLeft,
  Shield, AlertTriangle, ExternalLink
} from 'lucide-react';
import Link from 'next/link';

export default function PersonHistoryProfilePage() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const personId = (params.id as string) || 'PERSON-014';
  const person = people.find((p) => p.id === personId) || people[0];

  // Correlated cross-module entities
  const linkedCases = cases.filter((c) => c.personIds.includes(person.id));
  const linkedVehicles = vehicles.filter((v) => v.ownerPersonId === person.id || v.caseIds.some((cid) => person.caseIds.includes(cid)));
  const linkedPhones = phones.filter((ph) => ph.ownerPersonId === person.id);
  const linkedLocations = locations.filter((l) => l.personIds.includes(person.id));
  const linkedOrgs = organizations.filter((o) => o.personIds.includes(person.id));
  const linkedEvidence = evidence.filter((e) => person.caseIds.includes(e.caseId));
  const linkedForensics = forensicRecords.filter((fr) => fr.candidatePersonId === person.id);
  const linkedAlerts = alerts.filter((a) => person.caseIds.includes(a.caseId));
  const linkedTimeline = timelineEvents.filter((t) => t.entityId === person.id);
  const linkedHistorical = historicalCases.filter((h) => h.sharedEntities.includes(person.id));

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Back button */}
      <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-tertiary)' }}>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 hover:text-[var(--ink-primary)] transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>
        <span>/</span>
        <span className="font-mono-id" style={{ color: 'var(--ink-secondary)' }}>{person.id}</span>
      </div>

      {/* Person Header Hero Card */}
      <div
        className="p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-6 glass-panel-elevated"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-white text-[18px] shadow-sm shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            {person.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono-id font-bold text-[14px] text-[var(--accent)]">
                {person.id}
              </span>
              <span className="badge badge-investigation">{person.role}</span>
              <span className="text-[12px] font-mono-id text-[var(--ink-tertiary)]">
                Phone: {person.phone}
              </span>
            </div>
            <h1 className="text-[22px] font-bold" style={{ color: 'var(--ink-primary)' }}>
              {person.name}
            </h1>
            <p className="text-[13px] text-[var(--ink-secondary)]">
              {person.occupation} • Age {person.age} • Residing at: {person.address}, {person.city}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-6" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => router.push('/network')}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white shadow-sm flex items-center gap-1.5 hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            <Network size={14} />
            <span>Trace in Network Graph</span>
          </button>
        </div>
      </div>

      {/* 2-Column Intelligence Dossier Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Cases, Historical, Organizations (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Linked Active Cases */}
          <div className="p-5 rounded-2xl border space-y-3 glass-panel" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-bold text-[14px] flex items-center gap-2" style={{ color: 'var(--ink-primary)' }}>
              <FolderOpen size={16} className="text-[var(--accent)]" />
              <span>Current Investigation Caseload ({linkedCases.length})</span>
            </h3>
            <div className="space-y-2">
              {linkedCases.map((c) => (
                <Link
                  key={c.id}
                  href={`/cases/${c.id}`}
                  className="p-3 rounded-xl border block hover:bg-[var(--accent-muted)] transition-colors bg-[var(--glass-1)]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono-id font-bold text-[13px] text-[var(--accent)]">{c.id}</span>
                    <span className="badge badge-active text-[10px]">{c.status}</span>
                  </div>
                  <h4 className="font-semibold text-[13px] mt-0.5" style={{ color: 'var(--ink-primary)' }}>{c.title}</h4>
                  <p className="text-[11px] text-[var(--ink-secondary)] mt-0.5">{c.crime} • Assigned to {c.assignedOfficer}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Historical Case Overlaps */}
          <div className="p-5 rounded-2xl border space-y-3 glass-panel" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-bold text-[14px] flex items-center gap-2" style={{ color: 'var(--ink-primary)' }}>
              <History size={16} className="text-[var(--info)]" />
              <span>Historical Cases &amp; Archival Mentions ({linkedHistorical.length})</span>
            </h3>
            <div className="space-y-2">
              {linkedHistorical.map((hc) => (
                <div key={hc.id} className="p-3 rounded-xl border bg-[var(--glass-1)] space-y-1" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono-id font-bold text-[13px] text-[var(--accent)]">{hc.id} ({hc.year})</span>
                    <span className="font-mono-id font-bold text-[13px] text-[var(--accent)]">{hc.similarity}% similarity</span>
                  </div>
                  <h4 className="font-semibold text-[13px]" style={{ color: 'var(--ink-primary)' }}>{hc.title}</h4>
                  <p className="text-[11px] text-[var(--ink-secondary)]">{hc.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Connected Organizations */}
          <div className="p-5 rounded-2xl border space-y-3 glass-panel" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-bold text-[14px] flex items-center gap-2" style={{ color: 'var(--ink-primary)' }}>
              <Building2 size={16} className="text-[#8B5CF6]" />
              <span>Corporate &amp; Shell Company Directorships ({linkedOrgs.length})</span>
            </h3>
            <div className="space-y-2">
              {linkedOrgs.map((org) => (
                <div key={org.id} className="p-3 rounded-xl border bg-[var(--glass-1)] flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <h4 className="font-semibold text-[13px]" style={{ color: 'var(--ink-primary)' }}>{org.name}</h4>
                    <div className="text-[11px] font-mono-id text-[var(--ink-tertiary)]">{org.id} • Reg: {org.registrationNumber}</div>
                  </div>
                  <span className="badge badge-review">{org.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Vehicles, Phones, Forensics, Timeline (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Registered Vehicles & Telephones */}
          <div className="p-5 rounded-2xl border space-y-3 glass-panel" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-bold text-[14px] flex items-center gap-2" style={{ color: 'var(--ink-primary)' }}>
              <Car size={16} className="text-[#10B981]" />
              <span>Registered Transport &amp; Telephony Assets</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {linkedVehicles.slice(0, 2).map((v) => (
                <div key={v.id} className="p-3 rounded-xl border bg-[var(--glass-1)]" style={{ borderColor: 'var(--border)' }}>
                  <div className="font-mono-id font-bold text-[13px] text-[var(--accent)]">{v.registrationNumber}</div>
                  <div className="text-[12px] font-medium mt-0.5">{v.make} {v.model} ({v.color})</div>
                  <div className="text-[10px] font-mono-id text-[var(--ink-tertiary)] mt-1">{v.type}</div>
                </div>
              ))}
              {linkedPhones.slice(0, 2).map((ph) => (
                <div key={ph.id} className="p-3 rounded-xl border bg-[var(--glass-1)]" style={{ borderColor: 'var(--border)' }}>
                  <div className="font-mono-id font-bold text-[13px] text-[var(--accent)]">{ph.number}</div>
                  <div className="text-[12px] font-medium mt-0.5">{ph.carrier} Carrier</div>
                  <div className="text-[10px] font-mono-id text-[var(--ink-tertiary)] mt-1">IMEI: {ph.imei.slice(0, 10)}...</div>
                </div>
              ))}
            </div>
          </div>

          {/* Forensic Laboratory Matches */}
          {linkedForensics.length > 0 && (
            <div className="p-5 rounded-2xl border space-y-3 glass-panel" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-bold text-[14px] flex items-center gap-2" style={{ color: 'var(--ink-primary)' }}>
                <FlaskConical size={16} className="text-[var(--error)]" />
                <span>Forensic Lab Correlation ({linkedForensics.length})</span>
              </h3>
              <div className="space-y-2">
                {linkedForensics.map((fr) => (
                  <div key={fr.id} className="p-3 rounded-xl border bg-[var(--glass-1)] space-y-1" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono-id font-bold text-[12px] text-[var(--accent)]">{fr.id} ({fr.category})</span>
                      <span className="font-mono-id font-bold text-[13px] text-[var(--accent)]">{fr.matchPercentage}% match</span>
                    </div>
                    <p className="text-[12px] text-[var(--ink-primary)]">{fr.details}</p>
                    <div className="text-[10px] font-semibold text-[var(--warning)]">{fr.status}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observed Timeline Milestones */}
          <div className="p-5 rounded-2xl border space-y-3 glass-panel" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-bold text-[14px] flex items-center gap-2" style={{ color: 'var(--ink-primary)' }}>
              <Clock size={16} className="text-[var(--accent)]" />
              <span>Surveillance Milestone Log</span>
            </h3>
            <div className="space-y-2 text-[12px]">
              {linkedTimeline.slice(0, 3).map((tl) => (
                <div key={tl.id} className="p-2.5 rounded-lg border bg-[var(--glass-1)] space-y-0.5" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex justify-between font-mono-id text-[11px] text-[var(--ink-tertiary)]">
                    <span>{tl.timestamp.replace('T', ' ')}</span>
                    <span className="text-[var(--accent)]">{tl.type}</span>
                  </div>
                  <h5 className="font-semibold" style={{ color: 'var(--ink-primary)' }}>{tl.title}</h5>
                  <p className="text-[11px] text-[var(--ink-secondary)]">{tl.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
