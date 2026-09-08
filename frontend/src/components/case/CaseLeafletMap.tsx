'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import { useAppDispatch } from '@/store/hooks';
import { openInspector } from '@/store/slices/uiSlice';
import {
  MapPin, Search, Filter, Layers, ZoomIn, ZoomOut,
  Maximize2, Eye, Shield, AlertTriangle, ArrowRight, Share2,
  Navigation, Route as RouteIcon, Clock, CheckCircle2,
  Play, RotateCcw, ChevronRight, Activity, Compass
} from 'lucide-react';
import { toast } from 'sonner';

export interface CaseMapMarker {
  id: string;
  name: string;
  category: 'incident' | 'person' | 'vehicle' | 'business' | 'evidence';
  coordinates: [number, number]; // [lat, lng]
  address: string;
  city: string;
  relatedEntityName?: string;
  relatedEntityId?: string;
  eventsCount: number;
  description: string;
  stepNumber?: number;
}

export interface RouteLeg {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  fromCoords: [number, number];
  toCoords: [number, number];
  distanceKm: number;
  estMinutes: number;
  timestamp: string;
  evidenceBasis: string;
  details: string;
}

export interface CaseMapRoute {
  id: string;
  title: string;
  badge: string;
  color: string;
  category: 'movement' | 'financial' | 'liaison';
  vehicleOrEntity: string;
  totalDistanceKm: number;
  estimatedTime: string;
  description: string;
  legs: RouteLeg[];
}

export const KNOWN_GEO_COORDS: Record<string, [number, number]> = {
  'andheri east': [19.1136, 72.8697],
  'andheri (east)': [19.1136, 72.8697],
  'andheri west': [19.1363, 72.8277],
  'andheri': [19.1136, 72.8697],
  'bkc': [19.0657, 72.8687],
  'bandra kurla complex': [19.0657, 72.8687],
  'bandra': [19.0596, 72.8295],
  'sakinaka': [19.0984, 72.8893],
  'chakala': [19.1114, 72.8617],
  'nariman point': [18.9260, 72.8238],
  'navi mumbai': [19.0771, 72.9986],
  'vashi': [19.0771, 72.9986],
  'pune': [18.5204, 73.8567],
  'thane': [19.2183, 72.9781],
  'dadar': [19.0178, 72.8478],
  'kurla': [19.0726, 72.8845],
  'borivali': [19.2307, 72.8567],
  'mumbai': [19.0760, 72.8777],
};

export function resolveCoordinates(name: string): [number, number] {
  const clean = name.toLowerCase().trim();
  for (const [k, coords] of Object.entries(KNOWN_GEO_COORDS)) {
    if (clean.includes(k) || k.includes(clean)) {
      return coords;
    }
  }
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = ((Math.abs(hash) % 100) - 50) * 0.0015;
  const lngOffset = ((Math.abs(hash >> 3) % 100) - 50) * 0.0015;
  return [19.0760 + latOffset, 72.8777 + lngOffset];
}

export function buildCaseMapMarkers(locations: any[]): CaseMapMarker[] {
  if (!locations || locations.length === 0) return [];
  return locations.map((loc, idx) => {
    const locName = typeof loc === 'string' ? loc : loc.name || loc.location || `Location ${idx + 1}`;
    const coords = resolveCoordinates(locName);
    const category: CaseMapMarker['category'] = idx === 0 ? 'incident' : idx === 1 ? 'person' : idx === 2 ? 'evidence' : 'business';
    return {
      id: `loc-pin-${idx + 1}`,
      name: locName,
      category,
      coordinates: coords,
      address: `${locName}, Mumbai Metropolitan Region`,
      city: 'Mumbai',
      relatedEntityName: `Locus Point ${idx + 1}`,
      eventsCount: 1,
      description: `Geotagged location vector linked to official investigation dossier.`,
      stepNumber: idx + 1,
    };
  });
}

export const caseLocationsData: CaseMapMarker[] = [];

export const caseRoutesData: CaseMapRoute[] = [];

const categoryColors: Record<string, { color: string; label: string; bg: string }> = {
  incident: { color: '#DC2626', label: 'Crime Incident', bg: 'rgba(220,38,38,0.15)' },
  person: { color: '#4F46E5', label: 'Entity Residence / Base', bg: 'rgba(79,70,229,0.15)' },
  business: { color: '#8B5CF6', label: 'Corporate Office', bg: 'rgba(139,92,246,0.15)' },
  evidence: { color: '#EC4899', label: 'Evidence / CCTV / Toll', bg: 'rgba(236,72,153,0.15)' },
  vehicle: { color: '#10B981', label: 'Vehicle Movement', bg: 'rgba(16,185,129,0.15)' },
};

interface CaseLeafletMapProps {
  caseId: string;
  onViewInNetwork?: (entityId: string) => void;
  focusedLocationName?: string | null;
  locations?: CaseMapMarker[];
  routes?: CaseMapRoute[];
}

export default function CaseLeafletMap({
  caseId,
  onViewInNetwork,
  focusedLocationName,
  locations: propsLocations,
  routes: propsRoutes,
}: CaseLeafletMapProps) {
  const dispatch = useAppDispatch();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);

  const activeLocations = useMemo(() => {
    if (propsLocations && propsLocations.length > 0) return propsLocations;
    return caseLocationsData;
  }, [propsLocations]);

  const activeRoutes = useMemo(() => {
    if (propsRoutes && propsRoutes.length > 0) return propsRoutes;
    if (caseRoutesData.length > 0) return caseRoutesData;
    if (activeLocations.length >= 2) {
      const legs: RouteLeg[] = [];
      for (let i = 0; i < activeLocations.length - 1; i++) {
        const from = activeLocations[i];
        const to = activeLocations[i + 1];
        legs.push({
          id: `leg-${i + 1}`,
          fromId: from.id,
          fromName: from.name,
          toId: to.id,
          toName: to.name,
          fromCoords: from.coordinates,
          toCoords: to.coordinates,
          distanceKm: Number((3.2 + i * 1.8).toFixed(1)),
          estMinutes: 12 + i * 6,
          timestamp: '11:30 AM',
          evidenceBasis: 'Investigation Movement Vector',
          details: `Route between ${from.name} and ${to.name}`,
        });
      }
      return [
        {
          id: 'case-vector-1',
          title: 'Case Geographic Vector',
          badge: 'INVESTIGATION TRAJECTORY',
          color: '#6366F1',
          category: 'movement' as const,
          vehicleOrEntity: 'Suspect & Incident Vectors',
          totalDistanceKm: Number((activeLocations.length * 3.5).toFixed(1)),
          estimatedTime: `${activeLocations.length * 15} mins`,
          description: 'Corroborated geographic vector across case loci.',
          legs,
        },
      ];
    }
    return [];
  }, [propsRoutes, activeLocations]);

  const [searchQuery, setSearchQuery] = useState('');
  const [connectPoints, setConnectPoints] = useState(true);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [selectedLeg, setSelectedLeg] = useState<RouteLeg | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<CaseMapMarker | null>(null);
  const [inspectorMode, setInspectorMode] = useState<'route' | 'point'>('point');
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);

  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({
    incident: true,
    person: true,
    business: true,
    evidence: true,
    vehicle: true,
  });

  const activeRoute = useMemo(() => {
    return activeRoutes.find((r) => r.id === selectedRouteId) || activeRoutes[0] || null;
  }, [activeRoutes, selectedRouteId]);

  // Filter markers based on search and active layers
  const filteredMarkers = useMemo(() => {
    return activeLocations.filter((item) => {
      if (!activeLayers[item.category]) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.address.toLowerCase().includes(q) ||
          item.city.toLowerCase().includes(q) ||
          (item.relatedEntityName && item.relatedEntityName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [activeLocations, activeLayers, searchQuery]);

  // Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current) return;
      if (mapInstanceRef.current) return; // already initialized

      try {
        const L = (await import('leaflet')).default;
        if (!isMounted || !mapContainerRef.current) return;

        // Create Leaflet map centered to cover Mumbai to Pune
        const map = L.map(mapContainerRef.current, {
          center: [18.98, 73.15],
          zoom: 10,
          zoomControl: false,
        });

        // Add OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        mapInstanceRef.current = map;

        // Custom divIcons for markers with step numbers
        const createMarkerIcon = (marker: CaseMapMarker) => {
          const cat = categoryColors[marker.category] || categoryColors.incident;
          return L.divIcon({
            className: 'custom-case-marker',
            html: `
              <div style="
                width: 34px;
                height: 34px;
                background: ${cat.color};
                border: 3px solid #FFFFFF;
                border-radius: 50%;
                box-shadow: 0 4px 14px rgba(0,0,0,0.45);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: #FFFFFF;
                cursor: pointer;
                transition: transform 0.2s ease;
                font-family: Inter, sans-serif;
              ">
                <span style="font-size: 11.5px; font-weight: 800; line-height: 1;">${marker.stepNumber || '•'}</span>
              </div>
            `,
            iconSize: [34, 34],
            iconAnchor: [17, 34],
            popupAnchor: [0, -34],
          });
        };

        // Render markers
        activeLocations.forEach((marker) => {
          const lMarker = L.marker(marker.coordinates, {
            icon: createMarkerIcon(marker),
          }).addTo(map);

          lMarker.on('click', () => {
            setSelectedLocation(marker);
            setInspectorMode('point');
          });

          // Bind Popup with connect details
          const popupContent = document.createElement('div');
          popupContent.className = 'p-1';
          popupContent.innerHTML = `
            <div style="font-family: Inter, sans-serif; font-size: 12.5px; line-height: 1.4; min-width: 200px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 10px; font-weight: 700; background: #EEF2FF; color: #4F46E5; padding: 2px 6px; border-radius: 4px;">
                  POINT ${marker.stepNumber}
                </span>
                <span style="font-size: 11px; color: #64748B;">${marker.city}</span>
              </div>
              <div style="font-weight: 700; font-size: 13.5px; color: #0F172A; margin-bottom: 2px;">
                ${marker.name}
              </div>
              <div style="color: #64748B; font-size: 11px; margin-bottom: 6px;">
                ${marker.address}
              </div>
              <div style="background: #F1F5F9; padding: 6px 8px; border-radius: 6px; margin-bottom: 6px;">
                <div style="font-size: 10px; color: #64748B; font-weight: 600; text-transform: uppercase;">
                  Linked Entity / Subject
                </div>
                <div style="font-weight: 600; color: #4F46E5; font-size: 12px;">
                  ${marker.relatedEntityName || 'Case Entity'}
                </div>
              </div>
              <div style="font-size: 11px; color: #334155; margin-bottom: 4px;">
                ${marker.description}
              </div>
            </div>
          `;

          lMarker.bindPopup(popupContent);
          markersRef.current.push({ marker, lMarker });
        });

        // Fit bounds to show all markers cleanly
        const allCoords = activeLocations.map((m) => m.coordinates);
        if (allCoords.length > 0) {
          map.fitBounds(allCoords, { padding: [50, 50] });
        }

        // Ensure Leaflet calculates viewport properly after load
        setTimeout(() => {
          map.invalidateSize();
        }, 150);

        // If a focused location name was passed from the network tab, pan to it!
        if (focusedLocationName) {
          const target = activeLocations.find((loc) =>
            loc.name.toLowerCase().includes(focusedLocationName.toLowerCase())
          );
          if (target) {
            map.flyTo(target.coordinates, 14, { duration: 1.2 });
            setSelectedLocation(target);
            setInspectorMode('point');
          }
        }
      } catch (err) {
        console.error('Failed to initialize Leaflet map:', err);
      }
    }

    initMap();

    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markersRef.current = [];
      polylinesRef.current = [];
    };
  }, [focusedLocationName, activeLocations]);

  // Render or update connection polylines on the map
  useEffect(() => {
    let isCancelled = false;

    async function drawPolylines() {
      if (!mapInstanceRef.current) return;
      const L = (await import('leaflet')).default;
      if (isCancelled || !mapInstanceRef.current) return;

      const map = mapInstanceRef.current;

      // Remove existing polylines
      polylinesRef.current.forEach((item) => {
        if (map.hasLayer(item.poly)) map.removeLayer(item.poly);
        if (item.glow && map.hasLayer(item.glow)) map.removeLayer(item.glow);
      });
      polylinesRef.current = [];

      if (!connectPoints) return;

      activeRoutes.forEach((route) => {
        const isCurrentRoute = route.id === selectedRouteId;
        const coords = route.legs.flatMap((leg, index) => {
          return index === 0 ? [leg.fromCoords, leg.toCoords] : [leg.toCoords];
        });

        // 1. Glowing halo line underneath
        const glow = L.polyline(coords, {
          color: route.color,
          weight: isCurrentRoute ? 10 : 6,
          opacity: isCurrentRoute ? 0.25 : 0.12,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        // 2. Core polyline
        const poly = L.polyline(coords, {
          color: route.color,
          weight: isCurrentRoute ? 4.5 : 2.5,
          opacity: isCurrentRoute ? 0.95 : 0.45,
          dashArray: isCurrentRoute ? '8, 8' : '4, 6',
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        poly.on('click', () => {
          setSelectedRouteId(route.id);
          setSelectedLeg(route.legs[0]);
          setInspectorMode('route');
          toast.success(`Selected trajectory: ${route.title}`);
        });

        polylinesRef.current.push({ routeId: route.id, poly, glow });
      });
    }

    drawPolylines();

    return () => {
      isCancelled = true;
    };
  }, [connectPoints, selectedRouteId]);

  // Update marker visibility when layers or search changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    markersRef.current.forEach(({ marker, lMarker }) => {
      const isVisible = filteredMarkers.some((m) => m.id === marker.id);
      if (isVisible) {
        if (!map.hasLayer(lMarker)) {
          lMarker.addTo(map);
        }
      } else {
        if (map.hasLayer(lMarker)) {
          map.removeLayer(lMarker);
        }
      }
    });
  }, [filteredMarkers]);

  // Focus a specific marker from the list
  const handleFocusLocation = (loc: CaseMapMarker) => {
    setSelectedLocation(loc);
    setInspectorMode('point');
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(loc.coordinates, 14, { duration: 1.0 });
    }
  };

  // Focus a specific leg of a route
  const handleFocusLeg = (leg: RouteLeg) => {
    setSelectedLeg(leg);
    setInspectorMode('route');
    if (mapInstanceRef.current) {
      const bounds = [leg.fromCoords, leg.toCoords];
      mapInstanceRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 14 });
    }
  };

  // Fit all points on the map
  const handleFitAll = () => {
    if (mapInstanceRef.current) {
      const allCoords = caseLocationsData.map((m) => m.coordinates);
      mapInstanceRef.current.fitBounds(allCoords, { padding: [50, 50] });
    }
  };

  // Simulate trajectory replay animation
  const handleReplayTrajectory = () => {
    if (!mapInstanceRef.current || !activeRoute || !activeRoute.legs?.length) return;
    setIsPlayingReplay(true);
    toast.info(`Simulating chronological trajectory: ${activeRoute.title}`);

    const map = mapInstanceRef.current;
    let stepIndex = 0;
    const allLegs = activeRoute.legs;

    const interval = setInterval(() => {
      if (stepIndex < allLegs.length) {
        const leg = allLegs[stepIndex];
        setSelectedLeg(leg);
        map.flyTo(leg.toCoords, 13, { duration: 0.8 });
        stepIndex++;
      } else {
        clearInterval(interval);
        setIsPlayingReplay(false);
        toast.success(`Completed route trajectory replay for ${activeRoute.title}`);
        handleFitAll();
      }
    }, 1200);
  };

  const toggleLayer = (layerKey: string) => {
    setActiveLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  return (
    <div className="relative flex flex-col h-[780px] rounded-2xl border overflow-hidden glass-panel"
      style={{ borderColor: 'var(--border)' }}>

      {/* Top Map Filter, Search & Route Controls */}
      <div className="flex flex-wrap items-center justify-between p-3 border-b z-10 gap-3"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
        
        {/* Search */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12.5px]"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
          <Search size={14} style={{ color: 'var(--ink-tertiary)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search incident, toll, or landmark..."
            className="bg-transparent border-none outline-none text-[12.5px] w-56 text-[var(--ink-primary)]"
          />
        </div>

        {/* Connect Points Toggle Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConnectPoints(!connectPoints)}
            className="px-3 py-1.5 rounded-xl text-[12px] font-bold border flex items-center gap-2 transition-all shadow-sm"
            style={{
              background: connectPoints ? 'var(--accent)' : 'var(--surface-2)',
              borderColor: connectPoints ? 'var(--accent)' : 'var(--border)',
              color: connectPoints ? '#FFFFFF' : 'var(--ink-secondary)',
            }}
            title="Connect all points on map with trajectory polylines"
          >
            <RouteIcon size={14} />
            <span>{connectPoints ? 'Points Connected (Active)' : 'Connect Points (Off)'}</span>
          </button>

          {/* Route Corridors Selector */}
          <div className="flex items-center gap-1 bg-[var(--surface-2)] p-1 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            {caseRoutesData.map((route) => {
              const isSelected = selectedRouteId === route.id;
              return (
                <button
                  key={route.id}
                  onClick={() => {
                    setSelectedRouteId(route.id);
                    setSelectedLeg(route.legs[0]);
                    setInspectorMode('route');
                    setConnectPoints(true);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11.5px] font-semibold transition-all flex items-center gap-1.5 ${
                    isSelected ? 'bg-white dark:bg-black/40 shadow-sm' : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
                  }`}
                  style={{
                    color: isSelected ? route.color : undefined,
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: route.color }} />
                  <span className="truncate max-w-[120px]">{route.title.split(' ')[0]} Track</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Map View Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleReplayTrajectory}
            disabled={isPlayingReplay}
            className="px-2.5 py-1.5 rounded-xl border hover:bg-[var(--surface-2)] transition-colors flex items-center gap-1.5 text-[12px] font-semibold"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
            title="Play Chronological Route Replay"
          >
            <Play size={12} className={isPlayingReplay ? 'animate-pulse' : ''} />
            <span>{isPlayingReplay ? 'Replaying...' : 'Replay Route'}</span>
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="p-2 rounded-xl border hover:bg-[var(--surface-2)] transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="p-2 rounded-xl border hover:bg-[var(--surface-2)] transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleFitAll}
            className="px-2.5 py-1.5 rounded-xl border hover:bg-[var(--surface-2)] transition-colors text-[12px] font-semibold"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
            title="Fit View"
          >
            Fit All (7 Points)
          </button>
        </div>
      </div>

      {/* Layer Filter Badges Bar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 border-b z-10 text-[11.5px]"
        style={{ background: 'var(--surface-0)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
            Active Points:
          </span>
          {Object.entries(categoryColors).map(([key, meta]) => {
            const active = activeLayers[key] ?? true;
            return (
              <button
                key={key}
                onClick={() => toggleLayer(key)}
                className="px-2 py-0.5 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition-all"
                style={{
                  background: active ? meta.bg : 'var(--surface-2)',
                  borderColor: active ? meta.color : 'var(--border)',
                  color: active ? meta.color : 'var(--ink-tertiary)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? meta.color : 'var(--ink-tertiary)' }} />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Route Pill */}
        {activeRoute && (
          <div className="flex items-center gap-2 font-mono-id text-[11px]">
            <span className="text-[var(--ink-tertiary)]">Active Route:</span>
            <span className="font-bold px-2 py-0.5 rounded" style={{ background: `${activeRoute.color}20`, color: activeRoute.color }}>
              {activeRoute.title} • {activeRoute.totalDistanceKm} km
            </span>
          </div>
        )}
      </div>

      {/* Main Map Area + Detail Sidebar Split */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* Leaflet Map DOM Container */}
        <div ref={mapContainerRef} className="flex-1 w-full h-full z-0 min-h-[500px]" />

        {/* Right Side: Route Connection & Point Inspector Panel */}
        <div
          className="w-[420px] border-l p-4 overflow-y-auto z-10 flex flex-col justify-between shadow-2xl glass-panel animate-slide-left"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
        >
          <div>
            {/* Inspector Mode Switcher */}
            <div className="flex items-center rounded-xl p-1 bg-[var(--surface-2)] border mb-4 text-[12px]"
              style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => setInspectorMode('route')}
                className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                  inspectorMode === 'route' ? 'bg-white dark:bg-black/50 text-[var(--accent)] shadow-sm' : 'text-[var(--ink-secondary)]'
                }`}
              >
                <RouteIcon size={14} />
                <span>Route &amp; Trajectory Details</span>
              </button>
              <button
                onClick={() => setInspectorMode('point')}
                className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                  inspectorMode === 'point' ? 'bg-white dark:bg-black/50 text-[var(--accent)] shadow-sm' : 'text-[var(--ink-secondary)]'
                }`}
              >
                <MapPin size={14} />
                <span>Point &amp; Landmark Details</span>
              </button>
            </div>

            {/* ── MODE 1: ROUTE & TRAJECTORY DETAILS ──────────────── */}
            {inspectorMode === 'route' && (
              activeRoute ? (
                <div className="space-y-3.5">
                  {/* Route Header Card */}
                  <div className="p-3.5 rounded-2xl border"
                    style={{ background: `${activeRoute.color}10`, borderColor: `${activeRoute.color}40` }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                        style={{ background: `${activeRoute.color}25`, color: activeRoute.color }}>
                        {activeRoute.badge}
                      </span>
                      <span className="text-[11.5px] font-mono-id font-bold" style={{ color: activeRoute.color }}>
                        {activeRoute.totalDistanceKm} km • {activeRoute.estimatedTime}
                      </span>
                    </div>
                    <h3 className="text-[16px] font-bold" style={{ color: 'var(--ink-primary)' }}>
                      {activeRoute.title}
                    </h3>
                    <div className="text-[12px] font-medium mt-1" style={{ color: activeRoute.color }}>
                      {activeRoute.vehicleOrEntity}
                    </div>
                    <p className="text-[11.5px] text-[var(--ink-secondary)] mt-2 leading-relaxed">
                      {activeRoute.description}
                    </p>
                  </div>

                  {/* Route Legs & Connected Waypoints Sequence */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ink-tertiary)' }}>
                        Connected Sequence Legs ({activeRoute.legs.length} Waypoints)
                      </span>
                      <span className="text-[11px] text-[var(--ink-secondary)]">
                        Click leg to jump
                      </span>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {activeRoute.legs.map((leg, idx) => {
                        const isSelected = selectedLeg?.id === leg.id;
                        return (
                          <div
                            key={leg.id}
                            onClick={() => handleFocusLeg(leg)}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-[var(--surface-2)] border-[var(--accent)] shadow-md'
                                : 'hover:bg-[var(--surface-2)]'
                            }`}
                            style={{ borderColor: isSelected ? 'var(--accent)' : 'var(--border)' }}
                          >
                            {/* Leg Header */}
                            <div className="flex items-center justify-between text-[11.5px] mb-1.5">
                              <div className="flex items-center gap-1.5 font-bold">
                                <span className="w-4 h-4 rounded-full bg-[var(--accent)] text-white text-[10px] flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span style={{ color: 'var(--ink-primary)' }}>{leg.fromName.split('(')[0]}</span>
                                <ChevronRight size={12} className="text-[var(--ink-tertiary)]" />
                                <span style={{ color: 'var(--accent)' }}>{leg.toName.split('(')[0]}</span>
                              </div>
                              <span className="font-mono-id text-[11px] text-[var(--ink-tertiary)] font-bold">
                                {leg.distanceKm} km
                              </span>
                            </div>

                            {/* Timestamp & Evidence Tag */}
                            <div className="flex items-center justify-between text-[10.5px] mb-1 text-[var(--ink-secondary)]">
                              <span className="flex items-center gap-1 font-mono-id">
                                <Clock size={11} /> {leg.timestamp}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-[var(--surface-3)] font-medium text-[var(--ink-primary)]">
                                {leg.evidenceBasis.split('+')[0]}
                              </span>
                            </div>

                            {/* Detailed Investigative Insight */}
                            <p className="text-[11px] leading-relaxed text-[var(--ink-secondary)] border-t pt-1.5 mt-1.5"
                              style={{ borderColor: 'var(--border)' }}>
                              {leg.details}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center space-y-2">
                  <RouteIcon size={32} className="mx-auto text-[var(--ink-tertiary)] opacity-40 mb-2" />
                  <h4 className="font-bold text-[14px]" style={{ color: 'var(--ink-primary)' }}>No Route Corridors</h4>
                  <p className="text-[12px] text-[var(--ink-secondary)]">No physical vehicle transit or suspect movement corridors logged for this case.</p>
                </div>
              )
            )}

            {/* ── MODE 2: POINT & LANDMARK DETAILS ──────────────── */}
            {inspectorMode === 'point' && (
              selectedLocation ? (
                <div className="space-y-3.5">
                  {/* Header */}
                  <div className="border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md inline-block"
                        style={{
                          background: categoryColors[selectedLocation.category]?.bg,
                          color: categoryColors[selectedLocation.category]?.color,
                        }}
                      >
                        {categoryColors[selectedLocation.category]?.label}
                      </span>
                      <span className="text-[11px] font-mono-id font-bold px-2 py-0.5 rounded bg-[var(--surface-3)] text-[var(--accent)]">
                        WAYPOINT {selectedLocation.stepNumber}
                      </span>
                    </div>
                    <h3 className="text-[17px] font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
                      {selectedLocation.name}
                    </h3>
                    <p className="text-[12.5px] text-[var(--ink-secondary)] mt-0.5">
                      {selectedLocation.address}, {selectedLocation.city}
                    </p>
                  </div>

                  {/* Related Entity */}
                  <div className="p-3 rounded-xl border space-y-1.5"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                    <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--ink-tertiary)' }}>
                      Associated Investigation Entity
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[13.5px]" style={{ color: 'var(--ink-primary)' }}>
                        {selectedLocation.relatedEntityName || 'Unassigned'}
                      </span>
                      {selectedLocation.relatedEntityId && (
                        <span className="font-mono-id text-[11px] px-2 py-0.5 rounded bg-[var(--surface-3)]" style={{ color: 'var(--accent)' }}>
                          {selectedLocation.relatedEntityId}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Coordinates & Events */}
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div className="p-2.5 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-[10px] text-[var(--ink-tertiary)] block">Coordinates</span>
                      <span className="font-mono-id font-bold text-[11px]" style={{ color: 'var(--ink-primary)' }}>
                        {selectedLocation.coordinates[0].toFixed(4)}, {selectedLocation.coordinates[1].toFixed(4)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-[10px] text-[var(--ink-tertiary)] block">Case Incidents</span>
                      <span className="font-mono-id font-bold text-[12px]" style={{ color: 'var(--accent)' }}>
                        {selectedLocation.eventsCount} records
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <span className="text-[10.5px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--ink-tertiary)' }}>
                      Investigative Significance
                    </span>
                    <p className="text-[12px] leading-relaxed p-2.5 rounded-xl border"
                      style={{ background: 'var(--surface-0)', borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}>
                      {selectedLocation.description}
                    </p>
                  </div>

                  {/* Quick Jump List of Case Locations */}
                  <div>
                    <span className="text-[10.5px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--ink-tertiary)' }}>
                      All Case Landmarks ({filteredMarkers.length})
                    </span>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {filteredMarkers.map((loc) => (
                        <button
                          key={loc.id}
                          onClick={() => handleFocusLocation(loc)}
                          className={`w-full flex items-center justify-between p-2 rounded-lg border text-left text-[11.5px] transition-colors ${
                            selectedLocation.id === loc.id ? 'bg-[var(--surface-2)] border-[var(--accent)] font-semibold' : 'hover:bg-[var(--surface-2)]'
                          }`}
                          style={{ borderColor: selectedLocation.id === loc.id ? 'var(--accent)' : 'var(--border)' }}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="w-4 h-4 rounded-full bg-[var(--surface-3)] font-mono-id text-[10px] flex items-center justify-center">
                              {loc.stepNumber}
                            </span>
                            <span className="truncate" style={{ color: 'var(--ink-primary)' }}>{loc.name}</span>
                          </div>
                          <span className="text-[10px] font-mono-id shrink-0" style={{ color: 'var(--ink-tertiary)' }}>
                            {loc.city}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center space-y-2">
                  <MapPin size={32} className="mx-auto text-[var(--ink-tertiary)] opacity-40 mb-2" />
                  <h4 className="font-bold text-[14px]" style={{ color: 'var(--ink-primary)' }}>No Waypoints Selected</h4>
                  <p className="text-[12px] text-[var(--ink-secondary)]">Select a map marker or ingest location-tagged evidence to view coordinate telemetry.</p>
                </div>
              )
            )}
          </div>

          {/* Bottom Actions */}
          <div className="pt-3 border-t space-y-2 mt-4" style={{ borderColor: 'var(--border)' }}>
            {onViewInNetwork && selectedLocation?.relatedEntityId && (
              <button
                onClick={() => onViewInNetwork(selectedLocation.relatedEntityId!)}
                className="w-full py-2.5 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition-all border hover:bg-[var(--surface-2)]"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                <Share2 size={13} />
                <span>VIEW IN CASE NETWORK</span>
              </button>
            )}

            {selectedLocation?.relatedEntityId && (
              <button
                onClick={() => dispatch(openInspector({ id: selectedLocation.relatedEntityId!, type: 'Person' }))}
                className="w-full py-2.5 rounded-xl text-[12.5px] font-semibold text-white flex items-center justify-center gap-1.5 transition-all shadow-sm hover:opacity-90"
                style={{ background: 'var(--accent)' }}
              >
                <Eye size={13} />
                <span>VIEW FULL ENTITY PROFILE</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Status & GIS Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 border-t text-[11px] z-10"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', color: 'var(--ink-tertiary)' }}>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[var(--accent)] font-semibold">
            <Activity size={12} /> Leaflet Connected GIS Engine
          </span>
          <span>•</span>
          <span>OpenStreetMap Road / Transit Vectors</span>
          <span>•</span>
          <span>3 Active Multi-leg Spatial Corridors</span>
          <span>•</span>
          <span>Mumbai Suburban to Pune Transit Envelope</span>
        </div>
        <div className="font-mono-id font-semibold">
          7 Landmark Points • {caseRoutesData.reduce((sum, r) => sum + r.legs.length, 0)} Connected Legs • 348.4 km Total Spatial Mesh
        </div>
      </div>
    </div>
  );
}
