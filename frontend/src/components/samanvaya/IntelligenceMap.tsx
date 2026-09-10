'use client';

// ============================================================
// Geographic intelligence — only the loci SAMANVAYA actually
// resolved to verified coordinates are plotted. Connections use
// dark, high-contrast strokes so they stay readable over tiles.
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { MapPin, Crosshair, Layers, Navigation, AlertTriangle } from 'lucide-react';
import type { GeoIntelLink, GeoIntelPoint } from '@/lib/api/samanvaya';
import { Panel, SectionHeading, Badge, EmptyState, ToolButton } from './primitives';
import { tint } from './theme';

const POINT_STYLE: Record<string, { color: string; label: string }> = {
  CRIME_SCENE: { color: '#DC2626', label: 'Crime scene' },
  LAST_SEEN: { color: '#D97706', label: 'Last seen' },
  SUSPECT_RESIDENCE: { color: '#5B4BC4', label: 'Suspect residence' },
  VEHICLE_SIGHTING: { color: '#16A34A', label: 'Vehicle sighting' },
  EVIDENCE_RECOVERY: { color: '#DC2626', label: 'Evidence recovery' },
  FINANCIAL_NODE: { color: '#D97706', label: 'Financial node' },
  POSSIBLE_HIDEOUT: { color: '#0F766E', label: 'Possible hideout' },
  LOCATION: { color: '#2563EB', label: 'Location' },
};

const LINK_STYLE: Record<string, { dash: string | undefined; label: string }> = {
  CONFIRMED: { dash: undefined, label: 'Confirmed link' },
  MOVEMENT: { dash: undefined, label: 'Movement' },
  POTENTIAL: { dash: '10 8', label: 'Potential link' },
  HISTORICAL: { dash: '2 8', label: 'Historical link' },
};

const styleFor = (t: string) => POINT_STYLE[t] || POINT_STYLE.LOCATION;

export default function IntelligenceMap({
  points,
  links,
  unmappedCount = 0,
}: {
  points: GeoIntelPoint[];
  links: GeoIntelLink[];
  unmappedCount?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [selected, setSelected] = useState<GeoIntelPoint | null>(null);
  const [showLinks, setShowLinks] = useState(true);

  const bounds = useMemo(
    () => points.map((p) => [p.latitude, p.longitude] as [number, number]),
    [points]
  );

  // Leaflet is browser-only and the container unmounts on the empty state, so
  // re-check the ref after the dynamic import resolves.
  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current || points.length === 0) return;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          zoomControl: false,
          scrollWheelZoom: true,
          attributionControl: true,
        });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap &copy; CARTO',
          maxZoom: 19,
        }).addTo(mapRef.current);
        L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
      }

      const map = mapRef.current;
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
      const group = L.layerGroup().addTo(map);
      layerRef.current = group;

      const byId = new Map(points.map((p) => [p.id, p]));

      if (showLinks) {
        links.forEach((link) => {
          const a = byId.get(link.sourceId);
          const b = byId.get(link.targetId);
          if (!a || !b) return;
          const ls = LINK_STYLE[link.kind] || LINK_STYLE.POTENTIAL;
          // Casing stroke first, then the coloured line: readable over any tile.
          L.polyline(
            [
              [a.latitude, a.longitude],
              [b.latitude, b.longitude],
            ],
            { color: '#111827', weight: 6, opacity: 0.85, dashArray: ls.dash }
          ).addTo(group);
          L.polyline(
            [
              [a.latitude, a.longitude],
              [b.latitude, b.longitude],
            ],
            { color: '#2563EB', weight: 2.5, opacity: 0.95, dashArray: ls.dash }
          )
            .bindTooltip(`${link.label} — ${ls.label}`, { sticky: true })
            .addTo(group);
        });
      }

      points.forEach((p) => {
        const s = styleFor(p.pointType);
        const icon = L.divIcon({
          className: '',
          html: `<div style="
              width:30px;height:30px;border-radius:50% 50% 50% 4px;
              transform:rotate(-45deg);
              background:${s.color};
              border:2.5px solid #FFFFFF;
              box-shadow:0 3px 10px rgba(15,23,42,0.45);
              display:flex;align-items:center;justify-content:center;
              font:700 12px/1 system-ui;color:#fff;">
              <span style="transform:rotate(45deg)">${p.sequence ?? ''}</span>
            </div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 28],
        });
        L.marker([p.latitude, p.longitude], { icon })
          .bindTooltip(`<strong>${p.name}</strong><br/>${s.label}`, { direction: 'top', offset: [0, -24] })
          .on('click', () => setSelected(p))
          .addTo(group);
      });

      if (bounds.length === 1) {
        map.setView(bounds[0], 14);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds as any, { padding: [56, 56], maxZoom: 15 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [points, links, showLinks, bounds]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  const recentre = () => {
    if (!mapRef.current || bounds.length === 0) return;
    if (bounds.length === 1) mapRef.current.setView(bounds[0], 14);
    else mapRef.current.fitBounds(bounds as any, { padding: [56, 56], maxZoom: 15 });
  };

  if (points.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={MapPin}
          accent="#D97706"
          title="No verified coordinates for this case"
          message={
            unmappedCount > 0
              ? `${unmappedCount} location${unmappedCount === 1 ? ' was' : 's were'} named in the case narrative but could not be resolved to verified coordinates. Unverified places are deliberately not plotted — a wrong pin is worse than no pin.`
              : 'Geographic intelligence appears once the agents extract locations that can be resolved to verified coordinates.'
          }
        />
      </Panel>
    );
  }

  const usedTypes = Array.from(new Set(points.map((p) => p.pointType)));
  const usedLinkKinds = Array.from(new Set(links.map((l) => l.kind)));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      <div className="xl:col-span-8">
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <SectionHeading
              icon={MapPin}
              title="Geographic intelligence"
              subtitle={`${points.length} verified location${points.length === 1 ? '' : 's'}${unmappedCount ? ` · ${unmappedCount} unmapped` : ''}`}
              accent="#D97706"
            />
            <div className="flex items-center gap-2">
              <ToolButton
                icon={Navigation}
                label={showLinks ? 'Hide links' : 'Show links'}
                onClick={() => setShowLinks((v) => !v)}
                active={showLinks}
              />
              <ToolButton icon={Crosshair} onClick={recentre} title="Fit to all points" />
            </div>
          </div>

          <div ref={containerRef} style={{ height: 560, background: 'var(--surface-2)' }} />

          {/* Legend */}
          <div
            className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            {usedTypes.map((t) => {
              const s = styleFor(t);
              return (
                <span key={t} className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--ink-secondary)]">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
              );
            })}
            {usedLinkKinds.map((k) => {
              const ls = LINK_STYLE[k] || LINK_STYLE.POTENTIAL;
              return (
                <span key={k} className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--ink-secondary)]">
                  <svg width="22" height="6" aria-hidden>
                    <line x1="0" y1="3" x2="22" y2="3" stroke="#111827" strokeWidth="3" strokeDasharray={ls.dash} />
                  </svg>
                  {ls.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Waypoint list / detail */}
      <div className="xl:col-span-4 space-y-4">
        <Panel>
          <SectionHeading icon={Layers} title="Waypoints" subtitle="Click to inspect" accent="#D97706" />
          <div className="mt-3 space-y-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
            {points.map((p) => {
              const s = styleFor(p.pointType);
              const active = selected?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelected(p);
                    mapRef.current?.setView([p.latitude, p.longitude], 15);
                  }}
                  className="w-full text-left rounded-xl border px-3 py-2.5 transition-all cursor-pointer"
                  style={{
                    background: active ? tint(s.color, 0.08) : 'var(--surface-2)',
                    borderColor: active ? s.color : 'var(--border)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-semibold text-[var(--ink-primary)] truncate">{p.name}</span>
                    <Badge color={s.color}>{p.sequence ?? '·'}</Badge>
                  </div>
                  <div className="text-[11px] font-semibold mt-0.5" style={{ color: s.color }}>
                    {s.label}
                  </div>
                  <div className="text-[10.5px] font-mono text-[var(--ink-tertiary)] mt-1">
                    {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>

        {selected && (
          <Panel accent={styleFor(selected.pointType).color}>
            <h4 className="text-[14px] font-semibold text-[var(--ink-primary)]">{selected.name}</h4>
            <Badge color={styleFor(selected.pointType).color} className="mt-1.5">
              {styleFor(selected.pointType).label}
            </Badge>
            <p className="text-[12.5px] text-[var(--ink-secondary)] mt-2.5 leading-relaxed">{selected.role}</p>
            {selected.address && (
              <p className="text-[11.5px] text-[var(--ink-tertiary)] mt-1.5">{selected.address}</p>
            )}
            {selected.relatedEntities.filter(Boolean).length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-tertiary)] mb-1.5">
                  Connected entities
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.relatedEntities.filter(Boolean).map((e, i) => (
                    <Badge key={i} color="#2563EB">
                      {e}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {selected.evidence.length > 0 && (
              <div className="mt-3 text-[11px] text-[var(--ink-tertiary)] flex items-start gap-1.5">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                Source: {selected.evidence.join(', ')}
              </div>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}
