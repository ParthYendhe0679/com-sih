'use client';

import React, { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { Shield, AlertCircle, ZoomIn, ZoomOut, Maximize2, MapPin } from 'lucide-react';

export interface HotspotItem {
  id: string;
  area: string;
  city: string;
  state: string;
  coordinates: [number, number];
  crimeCount: number;
  primaryCrime: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  trend: 'Increasing' | 'Stable' | 'Decreasing';
  recentFIRs: number;
}

interface AnalyticsHotspotMapProps {
  hotspots: HotspotItem[];
  selectedHotspot: HotspotItem | null;
  onSelectHotspot: (hs: HotspotItem) => void;
  selectedState: string;
  selectedCity: string;
}

const severityConfig: Record<string, { color: string; label: string; bg: string }> = {
  Critical: { color: '#DC2626', label: 'High Crime Density', bg: 'rgba(220, 38, 38, 0.15)' },
  High: { color: '#EF4444', label: 'High Crime Density', bg: 'rgba(239, 68, 68, 0.15)' },
  Medium: { color: '#F59E0B', label: 'Medium Crime Density', bg: 'rgba(245, 158, 11, 0.15)' },
  Low: { color: '#10B981', label: 'Low Crime Density', bg: 'rgba(16, 185, 129, 0.15)' },
};

export default function AnalyticsHotspotMap({
  hotspots,
  selectedHotspot,
  onSelectHotspot,
  selectedState,
  selectedCity,
}: AnalyticsHotspotMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // Initialize Leaflet map
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;

      try {
        const L = (await import('leaflet')).default;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        // Center on Mumbai default
        const map = L.map(mapContainerRef.current, {
          center: [19.0760, 72.8777],
          zoom: 11,
          zoomControl: false,
          attributionControl: false,
        });

        // Free standard OpenStreetMap tile layer (zero API key needed, zero watermark)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        mapInstanceRef.current = map;
        if (isMounted) setMapReady(true);
      } catch (err) {
        console.error('Failed to initialize Leaflet Hotspot map:', err);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when hotspots or selection changes
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;

    let isMounted = true;

    async function renderMarkers() {
      try {
        const L = (await import('leaflet')).default;
        const map = mapInstanceRef.current;
        if (!map) return;

        // Clear existing markers
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        if (hotspots.length === 0) return;

        const bounds: [number, number][] = [];

        hotspots.forEach((hs) => {
          const conf = severityConfig[hs.severity] || severityConfig.Medium;
          const isSelected = selectedHotspot?.id === hs.id;
          const markerSize = isSelected ? 34 : 28;

          const customIcon = L.divIcon({
            className: 'custom-hotspot-marker',
            html: `
              <div style="position: relative; width: ${markerSize}px; height: ${markerSize}px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                <div style="
                  position: absolute;
                  width: ${markerSize + 12}px;
                  height: ${markerSize + 12}px;
                  border-radius: 50%;
                  background: ${conf.color};
                  opacity: ${isSelected ? '0.45' : '0.22'};
                  transform: translate(-50%, -50%);
                  top: 50%;
                  left: 50%;
                "></div>
                <div style="
                  position: relative;
                  width: ${markerSize}px;
                  height: ${markerSize}px;
                  border-radius: 50%;
                  background: ${conf.color};
                  border: 2.5px solid #FFFFFF;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.35);
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  color: #FFFFFF;
                  font-weight: 800;
                  font-size: ${isSelected ? '12px' : '10.5px'};
                  font-family: Inter, sans-serif;
                ">
                  ${hs.crimeCount}
                </div>
              </div>
            `,
            iconSize: [markerSize, markerSize],
            iconAnchor: [markerSize / 2, markerSize / 2],
            popupAnchor: [0, -markerSize / 2],
          });

          const marker = L.marker(hs.coordinates, { icon: customIcon }).addTo(map);

          marker.on('click', () => {
            onSelectHotspot(hs);
          });

          // Bind sleek popup
          marker.bindPopup(`
            <div style="font-family: Inter, sans-serif; min-width: 170px; padding: 4px;">
              <div style="font-size: 13.5px; font-weight: 700; color: #111827;">${hs.area}</div>
              <div style="font-size: 11.5px; color: #6B7280; margin-bottom: 6px;">${hs.city}, ${hs.state}</div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 11px; color: #4B5563;">Primary Crime:</span>
                <span style="font-size: 11.5px; font-weight: 600; color: #111827;">${hs.primaryCrime}</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <span style="font-size: 11px; color: #4B5563;">FIR Count:</span>
                <span style="font-size: 12px; font-weight: 800; color: ${conf.color};">${hs.crimeCount} incidents</span>
              </div>
              <div style="font-size: 10.5px; color: #9CA3AF; text-align: right; border-top: 1px solid #E5E7EB; padding-top: 4px; margin-top: 4px;">
                Click to inspect area details
              </div>
            </div>
          `);

          if (isSelected) {
            marker.openPopup();
          }

          bounds.push(hs.coordinates);
          markersRef.current.push(marker);
        });

        // Fit map bounds smoothly
        if (bounds.length > 0 && isMounted) {
          if (selectedHotspot) {
            map.flyTo(selectedHotspot.coordinates, 13, { duration: 0.8 });
          } else if (bounds.length === 1) {
            map.setView(bounds[0], 12);
          } else {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
          }
        }
      } catch (e) {
        console.error('Error rendering markers on hotspot map:', e);
      }
    }

    renderMarkers();

    return () => {
      isMounted = false;
    };
  }, [hotspots, selectedHotspot, mapReady]);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleReset = () => {
    if (mapInstanceRef.current && hotspots.length > 0) {
      const bounds = hotspots.map((h) => h.coordinates);
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  };

  return (
    <div className="relative w-full h-[460px] sm:h-[520px] rounded-2xl overflow-hidden border"
      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Left Indicator */}
      <div className="absolute top-4 left-4 z-[500] pointer-events-none flex flex-col gap-1.5">
        <div className="px-3.5 py-1.5 rounded-xl border backdrop-blur-md shadow-sm flex items-center gap-2"
          style={{ background: 'rgba(255,255,255,0.92)', borderColor: 'var(--border)', color: '#111827' }}>
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[12.5px] font-bold">
            Live Hotspot Spatial Density
          </span>
          <span className="text-[11px] font-medium text-gray-500">
            ({hotspots.length} active zones)
          </span>
        </div>
      </div>

      {/* Floating Map Controls */}
      <div className="absolute top-4 right-4 z-[500] flex flex-col gap-1.5">
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="w-8 h-8 rounded-lg border flex items-center justify-center shadow-sm transition-all hover:scale-105 active:scale-95"
          style={{ background: 'var(--surface-0)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
        >
          <ZoomIn size={15} />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="w-8 h-8 rounded-lg border flex items-center justify-center shadow-sm transition-all hover:scale-105 active:scale-95"
          style={{ background: 'var(--surface-0)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
        >
          <ZoomOut size={15} />
        </button>
        <button
          onClick={handleReset}
          title="Reset View"
          className="w-8 h-8 rounded-lg border flex items-center justify-center shadow-sm transition-all hover:scale-105 active:scale-95"
          style={{ background: 'var(--surface-0)', borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Bottom Floating Legend */}
      <div className="absolute bottom-4 left-4 right-4 sm:right-auto z-[500] flex flex-wrap items-center gap-2.5 px-4 py-2.5 rounded-xl border backdrop-blur-md shadow-md"
        style={{ background: 'rgba(255,255,255,0.94)', borderColor: 'var(--border)' }}>
        <span className="text-[12px] font-bold text-gray-800 mr-1">Density Scale:</span>
        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-gray-700">
          <span className="w-3 h-3 rounded-full bg-red-600 shadow-sm" />
          <span>🔴 High Density (&gt;80 FIRs)</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-gray-700">
          <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" />
          <span>🟠 Medium Density (50–80 FIRs)</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-gray-700">
          <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
          <span>🟢 Low Density (&lt;50 FIRs)</span>
        </div>
      </div>
    </div>
  );
}
