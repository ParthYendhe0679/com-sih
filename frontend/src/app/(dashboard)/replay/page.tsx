'use client';

import React, { useState, useEffect } from 'react';
import { timelineEvents, networkNodes, locations, evidence } from '@/mock';
import {
  Play, Pause, SkipBack, SkipForward, RotateCcw, Clock,
  Network, MapPin, Package
} from 'lucide-react';
import { toast } from 'sonner';

export default function InvestigationReplayPage() {
  const caseEvents = timelineEvents.filter((t) => t.caseId === 'CASE-102');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x

  const currentEvent = caseEvents[currentIndex] || caseEvents[0] || null;

  // Linked elements for current step
  const matchedNode = networkNodes.find((n) => currentEvent && n.id === currentEvent.entityId) || networkNodes[0];
  const matchedLocation = locations.find((l) => (currentEvent && l.id === currentEvent.entityId) || l.id === 'LOC-087') || locations[0];
  const matchedEvidence = evidence.find((e) => (currentEvent && e.id === currentEvent.entityId) || e.id === 'EVIDENCE-044') || evidence[0];

  // Playback timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev < caseEvents.length - 1) {
            return prev + 1;
          } else {
            setIsPlaying(false);
            toast.info('Investigation Replay completed');
            return prev;
          }
        });
      }, 2400 / playbackSpeed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, caseEvents.length]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(caseEvents.length - 1, prev + 1));
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header & Controls Bar */}
      <div
        className="p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
              Investigation Replay Engine
            </h1>
            <span
              className="text-[11px] font-mono-id px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
            >
              Synchronized 4-Stream Replay
            </span>
          </div>
          <p className="text-[12px] text-[var(--ink-secondary)] mt-0.5">
            Step {currentIndex + 1} of {caseEvents.length} • Temporal playback synchronized across Timeline, Graph, Map, and Evidence
          </p>
        </div>

        {/* Master Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="p-2 rounded-lg border hover:bg-[var(--surface-2)] text-[var(--ink-secondary)]"
            title="Reset to beginning"
          >
            <RotateCcw size={15} />
          </button>
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="p-2 rounded-lg border hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:pointer-events-none text-[var(--ink-primary)]"
            title="Previous step"
          >
            <SkipBack size={15} />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-4 py-2 rounded-lg font-medium text-white shadow-sm flex items-center gap-1.5 transition-all hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            <span>{isPlaying ? 'Pause' : 'Play Replay'}</span>
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === caseEvents.length - 1}
            className="p-2 rounded-lg border hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:pointer-events-none text-[var(--ink-primary)]"
            title="Next step"
          >
            <SkipForward size={15} />
          </button>
          <button
            onClick={() => setPlaybackSpeed(playbackSpeed === 1 ? 2 : 1)}
            className="px-2.5 py-1.5 rounded-lg border text-[11px] font-mono-id font-bold hover:bg-[var(--surface-2)] text-[var(--accent)]"
            style={{ borderColor: 'var(--border)' }}
          >
            {playbackSpeed}x Speed
          </button>
        </div>
      </div>

      {/* Synchronized Slider Scrub Track */}
      <div
        className="p-3.5 rounded-xl border space-y-2"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-between text-[11px] font-mono-id">
          <span style={{ color: 'var(--ink-tertiary)' }}>15-AUG 09:32 (Complaint)</span>
          <span className="font-bold text-[var(--accent)] text-[12px]">
            {currentEvent ? currentEvent.timestamp.replace('T', ' ') : '—'} IST
          </span>
          <span style={{ color: 'var(--ink-tertiary)' }}>03-SEP 12:00 (Checkpoint)</span>
        </div>
        <input
          type="range"
          min={0}
          max={caseEvents.length - 1}
          value={currentIndex}
          onChange={(e) => {
            setIsPlaying(false);
            setCurrentIndex(Number(e.target.value));
          }}
          className="w-full accent-[var(--accent)] h-1.5 bg-[var(--surface-2)] rounded-lg cursor-pointer"
        />
      </div>

      {/* 4 Synchronized Streams Cockpit Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* STREAM 1: TIMELINE EVENT HIGHLIGHT */}
        <div
          className="p-4 rounded-xl border flex flex-col justify-between h-[280px]"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
            <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 text-[var(--accent)]">
              <Clock size={13} /> 1. Timeline Stream
            </span>
            <span className="font-mono-id text-[11px] text-[var(--ink-tertiary)]">
              Event #{currentIndex + 1}
            </span>
          </div>

          <div className="space-y-2">
            <span className="text-[12px] font-mono-id font-bold text-[var(--accent)]">
              {currentEvent.timestamp.replace('T', ' ')} IST
            </span>
            <h3 className="text-[17px] font-bold" style={{ color: 'var(--ink-primary)' }}>
              {currentEvent.title}
            </h3>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-secondary)' }}>
              {currentEvent.description}
            </p>
          </div>

          <div className="text-[11px] font-mono-id pt-2 border-t flex justify-between" style={{ borderColor: 'var(--border)', color: 'var(--ink-tertiary)' }}>
            <span>Category: {currentEvent.type}</span>
            <span>Target: {currentEvent.entityId || 'CASE-102'}</span>
          </div>
        </div>

        {/* STREAM 2: NETWORK GRAPH NODE HIGHLIGHT */}
        <div
          className="p-4 rounded-xl border flex flex-col justify-between h-[280px]"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
            <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 text-[#3B82F6]">
              <Network size={13} /> 2. Network Node Highlight
            </span>
            <span className="font-mono-id text-[11px] text-[var(--ink-tertiary)]">
              Graph Entity
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono-id font-bold text-[13px] text-[var(--accent)]">
                {matchedNode.id}
              </span>
              <span className="badge badge-medium">{matchedNode.type}</span>
            </div>
            <h3 className="text-[17px] font-bold" style={{ color: 'var(--ink-primary)' }}>
              {matchedNode.label}
            </h3>
            <div className="p-2.5 rounded-lg border text-[12px] bg-[var(--surface-2)]" style={{ borderColor: 'var(--border)' }}>
              Entity active at milestone {currentEvent.id}. Connected into CASE-102 central cluster with verified association edges.
            </div>
          </div>

          <div className="text-[11px] font-mono-id pt-2 border-t text-[var(--ink-tertiary)]" style={{ borderColor: 'var(--border)' }}>
            Node Status: Selected &amp; Focused in Graph
          </div>
        </div>

        {/* STREAM 3: MAP LOCATION HIGHLIGHT */}
        <div
          className="p-4 rounded-xl border flex flex-col justify-between h-[280px]"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
            <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 text-[#F59E0B]">
              <MapPin size={13} /> 3. Geolocated Hotspot Focus
            </span>
            <span className="font-mono-id text-[11px] text-[var(--ink-tertiary)]">
              {matchedLocation.city}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono-id font-bold text-[13px] text-[var(--accent)]">
                {matchedLocation.id}
              </span>
              <span className="badge badge-low">{matchedLocation.type}</span>
            </div>
            <h3 className="text-[17px] font-bold" style={{ color: 'var(--ink-primary)' }}>
              {matchedLocation.name}
            </h3>
            <p className="text-[12px]" style={{ color: 'var(--ink-secondary)' }}>
              {matchedLocation.address}, {matchedLocation.city}
            </p>
            <div className="text-[11px] font-mono-id text-[var(--ink-tertiary)]">
              Coordinates: [{matchedLocation.coordinates.join(', ')}]
            </div>
          </div>

          <div className="text-[11px] font-mono-id pt-2 border-t text-[var(--ink-tertiary)]" style={{ borderColor: 'var(--border)' }}>
            GPS Status: Synchronized Ping Active
          </div>
        </div>

        {/* STREAM 4: EVIDENCE REVEAL */}
        <div
          className="p-4 rounded-xl border flex flex-col justify-between h-[280px]"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
            <span className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 text-[#10B981]">
              <Package size={13} /> 4. Evidentiary Ingestion Reveal
            </span>
            <span className="font-mono-id text-[11px] text-[var(--ink-tertiary)]">
              Chain of Custody
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-mono-id font-bold text-[13px] text-[var(--accent)]">
                {matchedEvidence.id}
              </span>
              <span className="badge badge-active">{matchedEvidence.status}</span>
            </div>
            <h3 className="text-[16px] font-bold truncate" style={{ color: 'var(--ink-primary)' }}>
              {matchedEvidence.title}
            </h3>
            <p className="text-[12px] line-clamp-2" style={{ color: 'var(--ink-secondary)' }}>
              {matchedEvidence.description}
            </p>
            <div className="text-[11px] font-mono-id text-[var(--ink-tertiary)]">
              Hash: {matchedEvidence.integrity.hash.slice(0, 24)}...
            </div>
          </div>

          <div className="text-[11px] font-mono-id pt-2 border-t text-[var(--success)] font-medium" style={{ borderColor: 'var(--border)' }}>
            ✓ Sealed &amp; Cryptographically Anchored
          </div>
        </div>
      </div>
    </div>
  );
}
