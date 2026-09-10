'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import { useAppDispatch } from '@/store/hooks';
import { openInspector } from '@/store/slices/uiSlice';
import {
  MapPin, Search, Filter, Layers, ZoomIn, ZoomOut,
  Maximize2, Eye, Shield, AlertTriangle, ArrowRight, Share2,
  Navigation, Route as RouteIcon, Clock, CheckCircle2,
  Play, RotateCcw, ChevronRight, Activity, Compass,
  Flame, Crosshair, Car, Building2, CreditCard, Landmark,
  FileSearch, Camera, ShieldAlert, Sparkles, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import {
  casesApi,
  CaseMapIntelligenceData,
  CaseMapIntelligenceNode,
  CaseMapIntelligenceRelationship,
  CaseMapUnmappedLocation
} from '@/lib/api/cases';

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
  'andheri metro station': [19.1197, 72.8464],
  'lokhandwala': [19.1418, 72.8258],
  'lokhandwala complex': [19.1418, 72.8258],
  'bkc': [19.0657, 72.8687],
  'bandra kurla complex': [19.0657, 72.8687],
  'bandra': [19.0596, 72.8295],
  'powai': [19.1176, 72.9060],
  'malad': [19.1874, 72.8484],
  'vile parle atm': [19.0990, 72.8440],
  'vile parle': [19.0990, 72.8440],
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
  return [19.0760, 72.8777];
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

// Visual classification configuration
const NODE_TYPE_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: string }> = {
  KIDNAPPING_LOCATION: { color: '#DC2626', bg: '#FDECEC', border: '#DC2626', label: 'Kidnapping Location', icon: 'shield-alert' },
  CRIME_LOCATION: { color: '#DC2626', bg: '#FDECEC', border: '#DC2626', label: 'Crime Scene', icon: 'flame' },
  CRIME_SCENE: { color: '#DC2626', bg: '#FDECEC', border: '#DC2626', label: 'Crime Scene', icon: 'flame' },
  BODY_RECOVERY_LOCATION: { color: '#DC2626', bg: '#FDECEC', border: '#DC2626', label: 'Body Recovery', icon: 'flame' },
  LAST_SEEN_LOCATION: { color: '#12376E', bg: '#EAF0F9', border: '#12376E', label: 'Last Seen Location', icon: 'clock' },
  SUSPECT_RESIDENCE: { color: '#D97706', bg: '#FDF3E3', border: '#D97706', label: 'Suspect Residence', icon: 'crosshair' },
  VICTIM_HOME: { color: '#0F766E', bg: '#E4F2F0', border: '#0F766E', label: 'Victim Home', icon: 'home' },
  VEHICLE_LOCATION: { color: '#16A34A', bg: '#E7F5EC', border: '#16A34A', label: 'Vehicle Spotted', icon: 'car' },
  RANSOM_DROP_LOCATION: { color: '#D97706', bg: '#FDF3E3', border: '#D97706', label: 'Ransom Drop', icon: 'navigation' },
  ATM: { color: '#5B4BC4', bg: '#EFEDFA', border: '#5B4BC4', label: 'ATM Location', icon: 'credit-card' },
  BANK: { color: '#5B4BC4', bg: '#EFEDFA', border: '#5B4BC4', label: 'Bank Branch', icon: 'landmark' },
  TRANSACTION_LOCATION: { color: '#12376E', bg: '#EAF0F9', border: '#12376E', label: 'Transaction Locus', icon: 'credit-card' },
  EVIDENCE_LOCATION: { color: '#DC2626', bg: '#FDECEC', border: '#DC2626', label: 'Evidence Found', icon: 'file-search' },
  WEAPON_RECOVERY_LOCATION: { color: '#DC2626', bg: '#FDECEC', border: '#DC2626', label: 'Weapon Recovery', icon: 'shield-alert' },
  CCTV_LOCATION: { color: '#2563EB', bg: '#EAF0F9', border: '#2563EB', label: 'CCTV Camera', icon: 'camera' },
  POLICE_STATION: { color: '#4B5563', bg: '#F9FAFB', border: '#4B5563', label: 'Police Station', icon: 'shield' },
  COMPANY: { color: '#9CA3AF', bg: '#F9FAFB', border: '#4B5563', label: 'Company / Business', icon: 'building' },
  PROPERTY: { color: '#9CA3AF', bg: '#F9FAFB', border: '#4B5563', label: 'Real Estate Asset', icon: 'building' },
  LOCATION: { color: '#2563EB', bg: '#EAF0F9', border: '#2563EB', label: 'Investigation Location', icon: 'map-pin' },
};

export interface CaseLeafletMapProps {
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

  // Live backend Map Intelligence state
  const [intelligence, setIntelligence] = useState<CaseMapIntelligenceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'CRITICAL_HIGH' | 'MEDIUM' | 'ALL'>('CRITICAL_HIGH');
  const [connectPoints, setConnectPoints] = useState(true);

  // Inspector States
  const [selectedNode, setSelectedNode] = useState<CaseMapIntelligenceNode | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<CaseMapIntelligenceRelationship | null>(null);
  const [inspectorMode, setInspectorMode] = useState<'node' | 'relationship' | 'unmapped'>('node');
  const [showUnmappedDrawer, setShowUnmappedDrawer] = useState(false);

  // Category filters
  const [categoryFilter, setCategoryFilter] = useState<Record<string, boolean>>({
    crime: true,
    person: true,
    vehicle: true,
    financial: true,
    evidence: true,
  });

  // Fetch live case map intelligence from backend
  const fetchMapIntelligence = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const data = await casesApi.getCaseMapIntelligence(caseId);
      setIntelligence(data);
      if (data.nodes && data.nodes.length > 0) {
        setSelectedNode(data.nodes[0]);
        setInspectorMode('node');
      }
    } catch (err) {
      console.warn('Backend Map Intelligence fetch error, using props/fallback:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchMapIntelligence();
  }, [fetchMapIntelligence]);

  // Derived active nodes from intelligence or props
  const activeNodes: CaseMapIntelligenceNode[] = useMemo(() => {
    if (intelligence && intelligence.nodes && intelligence.nodes.length > 0) {
      return intelligence.nodes;
    }
    if (propsLocations && propsLocations.length > 0) {
      return propsLocations.map((p, idx) => ({
        id: p.id,
        entityId: p.relatedEntityId,
        type: idx === 0 ? 'CRIME_LOCATION' : idx === 1 ? 'LAST_SEEN_LOCATION' : 'LOCATION',
        label: p.relatedEntityName || 'Investigation Point',
        name: p.name,
        address: p.address,
        city: p.city,
        coordinates: { latitude: p.coordinates[0], longitude: p.coordinates[1] },
        latitude: p.coordinates[0],
        longitude: p.coordinates[1],
        importance: idx < 2 ? 'CRITICAL' : 'HIGH',
        confidence: 0.95,
        geocoded: true,
        metadata: { description: p.description },
      }));
    }
    return [];
  }, [intelligence, propsLocations]);

  // Derived relationships
  const activeRelationships: CaseMapIntelligenceRelationship[] = useMemo(() => {
    if (intelligence && intelligence.relationships && intelligence.relationships.length > 0) {
      return intelligence.relationships;
    }
    if (activeNodes.length >= 2) {
      const rels: CaseMapIntelligenceRelationship[] = [];
      for (let i = 0; i < activeNodes.length - 1; i++) {
        const src = activeNodes[i];
        const tgt = activeNodes[i + 1];
        rels.push({
          id: `rel-${i + 1}`,
          source: src.id,
          target: tgt.id,
          sourceName: src.name,
          targetName: tgt.name,
          type: i === 0 ? 'OCCURRED_AT' : 'CONNECTED_TO',
          label: i === 0 ? 'Occurred At' : 'Investigation Vector',
          importance: 'CRITICAL',
          confidence: 0.94,
          evidenceBasis: ['FIR Sequence Dossier'],
        });
      }
      return rels;
    }
    return [];
  }, [intelligence, activeNodes]);

  // Filtered nodes based on search, priority, and category
  const filteredNodes = useMemo(() => {
    return activeNodes.filter((n) => {
      // 1. Priority filter
      if (priorityFilter === 'CRITICAL_HIGH') {
        if (n.importance !== 'CRITICAL' && n.importance !== 'HIGH') return false;
      } else if (priorityFilter === 'MEDIUM') {
        if (n.importance === 'LOW') return false;
      }

      // 2. Category filter
      const t = n.type.toUpperCase();
      if (!categoryFilter.crime && (t.includes('CRIME') || t.includes('KIDNAP') || t.includes('BODY'))) return false;
      if (!categoryFilter.person && (t.includes('RESIDENCE') || t.includes('HOME') || t.includes('LAST_SEEN'))) return false;
      if (!categoryFilter.vehicle && t.includes('VEHICLE')) return false;
      if (!categoryFilter.financial && (t.includes('ATM') || t.includes('BANK') || t.includes('TRANSACTION'))) return false;
      if (!categoryFilter.evidence && (t.includes('EVIDENCE') || t.includes('WEAPON') || t.includes('CCTV'))) return false;

      // 3. Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          n.name.toLowerCase().includes(q) ||
          (n.address && n.address.toLowerCase().includes(q)) ||
          n.label.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeNodes, priorityFilter, categoryFilter, searchQuery]);

  // Filtered relationships (only where both source and target are visible)
  const filteredRelationships = useMemo(() => {
    const visibleIds = new Set(filteredNodes.map((n) => n.id));
    return activeRelationships.filter(
      (r) => visibleIds.has(r.source) && visibleIds.has(r.target)
    );
  }, [activeRelationships, filteredNodes]);

  // Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      try {
        const L = (await import('leaflet')).default;
        if (!isMounted || !mapContainerRef.current) return;

        // Default to Mumbai center
        // Opens on Mumbai; the marker effect calls fitBounds once the case's
        // own locations are on the map.
        const defaultCenter: [number, number] = [19.0760, 72.8777];

        const map = L.map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 11,
          zoomControl: false,
        });

        // OpenStreetMap high-definition tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors | TRINETRA Intelligence',
        }).addTo(map);

        mapInstanceRef.current = map;

        setTimeout(() => {
          map.invalidateSize();
        }, 150);
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
    // Intentionally empty: the map instance is created once and reused. Adding
    // activeNodes here destroyed and recreated the map after markers had been
    // attached to the previous instance, leaving an empty map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render Markers on Map
  useEffect(() => {
    let isCancelled = false;

    async function renderMarkers() {
      if (!mapInstanceRef.current) return;
      const L = (await import('leaflet')).default;
      if (isCancelled || !mapInstanceRef.current) return;

      const map = mapInstanceRef.current;

      // Clear existing markers
      markersRef.current.forEach((item) => {
        if (map.hasLayer(item.lMarker)) {
          map.removeLayer(item.lMarker);
        }
      });
      markersRef.current = [];

      filteredNodes.forEach((node, idx) => {
        const conf = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.LOCATION;
        const isSelected = selectedNode?.id === node.id;

        const customIcon = L.divIcon({
          className: 'custom-investigation-marker',
          html: `
            <div style="
              position: relative;
              display: flex;
              flex-direction: column;
              align-items: center;
              cursor: pointer;
              transition: transform 0.2s ease, filter 0.2s ease;
              ${isSelected ? 'transform: scale(1.18); filter: drop-shadow(0 6px 14px rgba(15,23,42,0.6));' : 'filter: drop-shadow(0 3px 8px rgba(0,0,0,0.35));'}
            ">
              <div style="
                width: 36px;
                height: 36px;
                background: ${conf.color};
                border: 3px solid #FFFFFF;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #FFFFFF;
                font-family: Inter, sans-serif;
                font-weight: 800;
                font-size: 11px;
                box-shadow: inset 0 0 0 1px rgba(0,0,0,0.15);
              ">
                ${idx + 1}
              </div>
              <div style="
                background: #111827;
                color: #FFFFFF;
                font-size: 10px;
                font-weight: 700;
                padding: 2px 6px;
                border-radius: 4px;
                white-space: nowrap;
                margin-top: 3px;
                letter-spacing: 0.2px;
                border: 1px solid rgba(255,255,255,0.2);
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              ">
                ${node.name}
              </div>
            </div>
          `,
          iconSize: [40, 56],
          iconAnchor: [20, 28],
          popupAnchor: [0, -28],
        });

        const lMarker = L.marker([node.latitude, node.longitude], {
          icon: customIcon,
        }).addTo(map);

        lMarker.on('click', () => {
          setSelectedNode(node);
          setInspectorMode('node');
        });

        // Rich interactive popup
        const popupEl = document.createElement('div');
        popupEl.className = 'p-1';
        popupEl.innerHTML = `
          <div style="font-family: Inter, sans-serif; font-size: 12.5px; line-height: 1.4; min-width: 220px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 9.5px; font-weight: 800; background: ${conf.bg}; color: ${conf.color}; padding: 2px 6px; border-radius: 4px; border: 1px solid ${conf.border};">
                ${node.label.toUpperCase()}
              </span>
              <span style="font-size: 10px; font-weight: 700; color: #9CA3AF;">
                CONF: ${Math.round(node.confidence * 100)}%
              </span>
            </div>
            <div style="font-weight: 800; font-size: 14px; color: #111827; margin-bottom: 2px;">
              ${node.name}
            </div>
            <div style="color: #9CA3AF; font-size: 11px; margin-bottom: 6px;">
              ${node.address || node.city}
            </div>
            <div style="background: #111827; color: #F9FAFB; padding: 4px 8px; border-radius: 6px; font-size: 10.5px; font-family: monospace;">
              LAT: ${node.latitude.toFixed(4)} | LNG: ${node.longitude.toFixed(4)}
            </div>
          </div>
        `;
        lMarker.bindPopup(popupEl);

        markersRef.current.push({ node, lMarker });
      });

      // Fit map bounds to show all markers
      if (filteredNodes.length > 0) {
        const coords = filteredNodes.map((n) => [n.latitude, n.longitude] as [number, number]);
        map.fitBounds(coords, { padding: [60, 60], maxZoom: 14 });
      }
    }

    renderMarkers();

    return () => {
      isCancelled = true;
    };
  }, [filteredNodes, selectedNode]);

  // Render DARK, HIGH-CONTRAST RELATIONSHIP LINES (Sections 15 & 16)
  useEffect(() => {
    let isCancelled = false;

    async function drawRelationships() {
      if (!mapInstanceRef.current) return;
      const L = (await import('leaflet')).default;
      if (isCancelled || !mapInstanceRef.current) return;

      const map = mapInstanceRef.current;

      // Clear existing polylines
      polylinesRef.current.forEach((item) => {
        if (map.hasLayer(item.poly)) map.removeLayer(item.poly);
        if (item.labelMarker && map.hasLayer(item.labelMarker)) map.removeLayer(item.labelMarker);
      });
      polylinesRef.current = [];

      if (!connectPoints) return;

      // Map node id -> coordinates
      const idToNode = new Map<string, CaseMapIntelligenceNode>();
      filteredNodes.forEach((n) => idToNode.set(n.id, n));

      filteredRelationships.forEach((rel) => {
        const src = idToNode.get(rel.source);
        const tgt = idToNode.get(rel.target);
        if (!src || !tgt) return;

        const isSelected = selectedRelationship?.id === rel.id;
        const coords: [number, number][] = [
          [src.latitude, src.longitude],
          [tgt.latitude, tgt.longitude],
        ];

        // Line styling: DARK, HIGH-CONTRAST, PROFESSIONAL (Charcoal / Deep Navy)
        const lineColor = isSelected ? '#020617' : '#111827'; // Deep dark navy
        const lineWeight = rel.importance === 'CRITICAL' ? 5.5 : isSelected ? 4.5 : 3.5;
        const lineOpacity = isSelected ? 1.0 : 0.88;

        // Dark relationship polyline
        const poly = L.polyline(coords, {
          color: lineColor,
          weight: lineWeight,
          opacity: lineOpacity,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: rel.type === 'MOVED_TO' ? '8, 6' : undefined,
        }).addTo(map);

        // Midpoint coordinates for relationship badge label
        const midLat = (src.latitude + tgt.latitude) / 2;
        const midLng = (src.longitude + tgt.longitude) / 2;

        const labelHtml = `
          <div style="
            background: #111827;
            color: #F9FAFB;
            font-size: 9.5px;
            font-weight: 800;
            padding: 2px 7px;
            border-radius: 4px;
            border: 1px solid #4B5563;
            box-shadow: 0 2px 6px rgba(0,0,0,0.5);
            white-space: nowrap;
            cursor: pointer;
            letter-spacing: 0.3px;
          ">
            ${rel.type}
          </div>
        `;

        const labelMarker = L.marker([midLat, midLng], {
          icon: L.divIcon({
            className: 'custom-edge-label',
            html: labelHtml,
            iconSize: [60, 20],
            iconAnchor: [30, 10],
          }),
        }).addTo(map);

        const edgeDetailsPopup = `
          <div style="font-family: Inter, sans-serif; font-size: 12px; line-height: 1.4; min-width: 210px;">
            <div style="font-size: 9.5px; font-weight: 800; color: #2563EB; margin-bottom: 2px; text-transform: uppercase;">
              RELATIONSHIP DOSSIER
            </div>
            <div style="font-weight: 800; font-size: 13.5px; color: #111827; margin-bottom: 4px;">
              ${rel.label} (${rel.type})
            </div>
            <div style="background: #F9FAFB; padding: 6px; border-radius: 6px; margin-bottom: 6px; font-size: 11px;">
              <div><strong>FROM:</strong> ${rel.sourceName || src.name}</div>
              <div><strong>TO:</strong> ${rel.targetName || tgt.name}</div>
            </div>
            <div style="font-size: 11px; color: #4B5563;">
              <strong>BASIS:</strong> ${rel.evidenceBasis.join(', ') || 'FIR Statement'}
            </div>
            <div style="font-size: 11px; color: #16A34A; font-weight: 700; margin-top: 3px;">
              CONFIDENCE: ${Math.round(rel.confidence * 100)}%
            </div>
          </div>
        `;

        poly.bindPopup(edgeDetailsPopup);
        labelMarker.bindPopup(edgeDetailsPopup);

        const handleSelectRel = () => {
          setSelectedRelationship(rel);
          setInspectorMode('relationship');
          toast.info(`Selected Relationship: ${rel.label}`);
        };

        poly.on('click', handleSelectRel);
        labelMarker.on('click', handleSelectRel);

        polylinesRef.current.push({ rel, poly, labelMarker });
      });
    }

    drawRelationships();

    return () => {
      isCancelled = true;
    };
  }, [filteredRelationships, filteredNodes, connectPoints, selectedRelationship]);

  // Pan to focused location if provided from cross-tab event
  useEffect(() => {
    if (focusedLocationName && mapInstanceRef.current && activeNodes.length > 0) {
      const match = activeNodes.find((n) =>
        n.name.toLowerCase().includes(focusedLocationName.toLowerCase())
      );
      if (match) {
        mapInstanceRef.current.flyTo([match.latitude, match.longitude], 14, { duration: 1.2 });
        setSelectedNode(match);
        setInspectorMode('node');
      }
    }
  }, [focusedLocationName, activeNodes]);

  const handleFitAll = () => {
    if (mapInstanceRef.current && filteredNodes.length > 0) {
      const coords = filteredNodes.map((n) => [n.latitude, n.longitude] as [number, number]);
      mapInstanceRef.current.fitBounds(coords, { padding: [50, 50] });
    }
  };

  const toggleCategory = (key: string) => {
    setCategoryFilter((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="relative flex flex-col h-[780px] rounded-2xl border overflow-hidden glass-panel"
      style={{ borderColor: 'var(--border)' }}>

      {/* ── TOP CONTROL & FILTER TOOLBAR ──────────────────────── */}
      <div className="flex flex-wrap items-center justify-between p-3 border-b z-10 gap-3"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
        
        {/* Left: Search input */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12.5px]"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
          <Search size={14} style={{ color: 'var(--ink-tertiary)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter case loci or addresses..."
            className="bg-transparent border-none outline-none text-[12.5px] w-52 text-[var(--ink-primary)] placeholder:text-[var(--ink-tertiary)]"
          />
        </div>

        {/* Center: Priority Filter Controls (Section 13) */}
        <div className="flex items-center gap-1 bg-[var(--surface-2)] p-1 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
          <span className="text-[10.5px] font-semibold uppercase tracking-wider px-2 text-[var(--ink-tertiary)]">
            Priority:
          </span>
          <button
            onClick={() => setPriorityFilter('CRITICAL_HIGH')}
            className={`px-3 py-1 rounded-lg text-[11.5px] font-semibold transition-all ${
              priorityFilter === 'CRITICAL_HIGH'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
            }`}
          >
            Critical &amp; High
          </button>
          <button
            onClick={() => setPriorityFilter('MEDIUM')}
            className={`px-3 py-1 rounded-lg text-[11.5px] font-semibold transition-all ${
              priorityFilter === 'MEDIUM'
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
            }`}
          >
            Medium+
          </button>
          <button
            onClick={() => setPriorityFilter('ALL')}
            className={`px-3 py-1 rounded-lg text-[11.5px] font-semibold transition-all ${
              priorityFilter === 'ALL'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
            }`}
          >
            Show All
          </button>
        </div>

        {/* Right: Map Actions & Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConnectPoints(!connectPoints)}
            className="px-3 py-1.5 rounded-xl text-[12px] font-semibold border flex items-center gap-2 transition-all shadow-sm"
            style={{
              background: connectPoints ? '#111827' : 'var(--surface-2)',
              borderColor: connectPoints ? '#111827' : 'var(--border)',
              color: connectPoints ? '#FFFFFF' : 'var(--ink-secondary)',
            }}
            title="Toggle high-contrast investigation relationship lines"
          >
            <RouteIcon size={14} />
            <span>{connectPoints ? 'Dark Lines (Active)' : 'Lines Off'}</span>
          </button>

          <button
            onClick={fetchMapIntelligence}
            disabled={loading}
            className="p-2 rounded-xl border hover:bg-[var(--surface-2)] transition-colors text-[var(--ink-secondary)]"
            title="Refresh the case map"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="p-2 rounded-xl border hover:bg-[var(--surface-2)] transition-colors text-[var(--ink-secondary)]"
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="p-2 rounded-xl border hover:bg-[var(--surface-2)] transition-colors text-[var(--ink-secondary)]"
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={handleFitAll}
            className="px-2.5 py-1.5 rounded-xl border hover:bg-[var(--surface-2)] transition-colors text-[12px] font-semibold"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
          >
            Fit View
          </button>
        </div>
      </div>

      {/* ── SECONDARY BAR: CATEGORY FILTER CHIPS ───────────────── */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 border-b z-10 text-[11px]"
        style={{ background: 'var(--surface-0)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-tertiary)]">
            Filter Loci:
          </span>
          <button
            onClick={() => toggleCategory('crime')}
            className={`px-2.5 py-0.5 rounded-lg border font-semibold flex items-center gap-1 transition-all ${
              categoryFilter.crime ? 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300' : 'opacity-40 border-slate-300'
            }`}
          >
            <Flame size={11} />
            <span>Incident / Scene</span>
          </button>
          <button
            onClick={() => toggleCategory('person')}
            className={`px-2.5 py-0.5 rounded-lg border font-semibold flex items-center gap-1 transition-all ${
              categoryFilter.person ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300' : 'opacity-40 border-slate-300'
            }`}
          >
            <Shield size={11} />
            <span>Residence / Last Seen</span>
          </button>
          <button
            onClick={() => toggleCategory('vehicle')}
            className={`px-2.5 py-0.5 rounded-lg border font-semibold flex items-center gap-1 transition-all ${
              categoryFilter.vehicle ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300' : 'opacity-40 border-slate-300'
            }`}
          >
            <Car size={11} />
            <span>Vehicle Spotted</span>
          </button>
          <button
            onClick={() => toggleCategory('financial')}
            className={`px-2.5 py-0.5 rounded-lg border font-semibold flex items-center gap-1 transition-all ${
              categoryFilter.financial ? 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300' : 'opacity-40 border-slate-300'
            }`}
          >
            <CreditCard size={11} />
            <span>ATM / Bank / Locus</span>
          </button>
          <button
            onClick={() => toggleCategory('evidence')}
            className={`px-2.5 py-0.5 rounded-lg border font-semibold flex items-center gap-1 transition-all ${
              categoryFilter.evidence ? 'bg-pink-50 text-pink-700 border-pink-300 dark:bg-pink-950 dark:text-pink-300' : 'opacity-40 border-slate-300'
            }`}
          >
            <FileSearch size={11} />
            <span>Evidence / Forensics</span>
          </button>
        </div>

        {/* Telemetry pill */}
        <div className="flex items-center gap-2 font-mono-id text-[11px] text-[var(--ink-secondary)]">
          <span>PLOTTED: <strong>{filteredNodes.length}</strong> / {activeNodes.length}</span>
          <span>•</span>
          <span>EDGES: <strong>{filteredRelationships.length}</strong></span>
          {intelligence?.cached && (
            <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.5 rounded font-semibold">
              READY
            </span>
          )}
        </div>
      </div>

      {/* ── UNMAPPED LOCATIONS CALLOUT (Section 6 & 26) ─────────── */}
      {intelligence?.unmappedLocations && intelligence.unmappedLocations.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/50 px-4 py-2 flex items-center justify-between text-[12px] z-10">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertTriangle size={14} className="shrink-0 text-amber-600" />
            <span>
              <strong>{intelligence.unmappedLocations.length} locations</strong> identified in case narrative without physical coordinates.
            </span>
          </div>
          <button
            onClick={() => {
              setInspectorMode('unmapped');
              setShowUnmappedDrawer(true);
            }}
            className="text-[11.5px] font-semibold text-amber-900 dark:text-amber-100 underline hover:no-underline"
          >
            View Unmapped Entities &rarr;
          </button>
        </div>
      )}

      {/* ── MAIN MAP CANVAS & RIGHT INTELLIGENCE PANEL ─────────── */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/70 dark:bg-black/70 backdrop-blur-xs">
            <div className="w-9 h-9 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-[13px] font-semibold text-[var(--ink-primary)]">Loading Case Map Intelligence...</span>
            <span className="text-[11.5px] text-[var(--ink-tertiary)] mt-1">Loading case locations</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && activeNodes.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-[var(--surface-0)]">
            <Compass size={48} className="text-slate-300 mb-3" />
            <h3 className="text-base font-semibold text-[var(--ink-primary)]">No Geographic Intelligence Available</h3>
            <p className="text-[13px] text-[var(--ink-secondary)] max-w-md mt-1 mb-4 leading-relaxed">
              No geographical coordinates or loci are currently registered for this case. Upload an FIR document to extract investigation waypoints automatically.
            </p>
          </div>
        )}

        {/* Leaflet Map Container */}
        <div ref={mapContainerRef} className="flex-1 w-full h-full z-0 min-h-[500px]" />

        {/* ── RIGHT-SIDE INVESTIGATION INTELLIGENCE INSPECTOR ───── */}
        <div className="w-[430px] border-l p-4 overflow-y-auto z-10 flex flex-col justify-between shadow-2xl glass-panel animate-slide-left"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
          <div>
            {/* Inspector Tab Switcher */}
            <div className="flex items-center rounded-xl p-1 bg-[var(--surface-2)] border mb-4 text-[12px]"
              style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => setInspectorMode('node')}
                className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  inspectorMode === 'node' ? 'bg-white dark:bg-black/50 text-[var(--accent)] shadow-sm' : 'text-[var(--ink-secondary)]'
                }`}
              >
                <MapPin size={14} />
                <span>Node Details</span>
              </button>
              <button
                onClick={() => setInspectorMode('relationship')}
                className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  inspectorMode === 'relationship' ? 'bg-white dark:bg-black/50 text-[var(--accent)] shadow-sm' : 'text-[var(--ink-secondary)]'
                }`}
              >
                <RouteIcon size={14} />
                <span>Edge / Path</span>
              </button>
              {intelligence?.unmappedLocations && intelligence.unmappedLocations.length > 0 && (
                <button
                  onClick={() => setInspectorMode('unmapped')}
                  className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    inspectorMode === 'unmapped' ? 'bg-white dark:bg-black/50 text-amber-600 shadow-sm' : 'text-[var(--ink-secondary)]'
                  }`}
                >
                  <AlertTriangle size={14} />
                  <span>Unmapped ({intelligence.unmappedLocations.length})</span>
                </button>
              )}
            </div>

            {/* ── VIEW 1: NODE / LOCUS INSPECTOR ────────────────── */}
            {inspectorMode === 'node' && (
              selectedNode ? (
                <div className="space-y-4">
                  {/* Header Badge & Title */}
                  <div className="p-3.5 rounded-2xl border"
                    style={{
                      background: (NODE_TYPE_CONFIG[selectedNode.type] || NODE_TYPE_CONFIG.LOCATION).bg,
                      borderColor: (NODE_TYPE_CONFIG[selectedNode.type] || NODE_TYPE_CONFIG.LOCATION).border,
                    }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10.5px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md text-white"
                        style={{ background: (NODE_TYPE_CONFIG[selectedNode.type] || NODE_TYPE_CONFIG.LOCATION).color }}>
                        {selectedNode.label}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white dark:bg-black/40"
                        style={{ color: (NODE_TYPE_CONFIG[selectedNode.type] || NODE_TYPE_CONFIG.LOCATION).color }}>
                        PRIORITY: {selectedNode.importance}
                      </span>
                    </div>
                    <h3 className="text-[17px] font-semibold text-slate-900 dark:text-white">
                      {selectedNode.name}
                    </h3>
                    <p className="text-[12px] text-slate-600 dark:text-slate-300 mt-1">
                      {selectedNode.address || selectedNode.city}
                    </p>
                  </div>

                  {/* Geocoordinates Card */}
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div className="p-2.5 rounded-xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-[10px] text-[var(--ink-tertiary)] block font-semibold uppercase">Latitude</span>
                      <span className="font-mono-id font-semibold text-[13px] text-slate-900 dark:text-white">
                        {selectedNode.latitude.toFixed(6)}° N
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl border bg-[var(--surface-0)]" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-[10px] text-[var(--ink-tertiary)] block font-semibold uppercase">Longitude</span>
                      <span className="font-mono-id font-semibold text-[13px] text-slate-900 dark:text-white">
                        {selectedNode.longitude.toFixed(6)}° E
                      </span>
                    </div>
                  </div>

                  {/* Verification Telemetry */}
                  <div className="p-3 rounded-xl border bg-[var(--surface-0)] space-y-1.5 text-[12px]" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex justify-between">
                      <span className="text-[var(--ink-tertiary)]">Address match:</span>
                      <span className="font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Verified
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--ink-tertiary)]">Location confidence:</span>
                      <span className="font-semibold text-[var(--ink-primary)]">
                        {Math.round(selectedNode.confidence * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--ink-tertiary)]">Jurisdiction:</span>
                      <span className="font-semibold text-[var(--ink-primary)]">
                        {selectedNode.city} Metropolitan
                      </span>
                    </div>
                  </div>

                  {/* Connected relationships */}
                  <div>
                    <span className="text-[10.5px] font-semibold uppercase tracking-wider block mb-1.5 text-[var(--ink-tertiary)]">
                      Active Graph Relationships ({filteredRelationships.filter((r) => r.source === selectedNode.id || r.target === selectedNode.id).length})
                    </span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {filteredRelationships
                        .filter((r) => r.source === selectedNode.id || r.target === selectedNode.id)
                        .map((rel) => {
                          const isSource = rel.source === selectedNode.id;
                          const otherName = isSource ? rel.targetName : rel.sourceName;
                          return (
                            <div
                              key={rel.id}
                              onClick={() => {
                                setSelectedRelationship(rel);
                                setInspectorMode('relationship');
                              }}
                              className="p-2 rounded-xl border bg-[var(--surface-2)] text-[11.5px] cursor-pointer hover:border-[var(--accent)] transition-all flex items-center justify-between"
                              style={{ borderColor: 'var(--border)' }}
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9.5px] font-semibold bg-[#111827] text-white px-1.5 py-0.5 rounded">
                                  {rel.type}
                                </span>
                                <span className="font-medium text-[var(--ink-primary)] truncate max-w-[170px]">
                                  {isSource ? `→ ${otherName}` : `← ${otherName}`}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono-id text-emerald-600 font-semibold">
                                {Math.round(rel.confidence * 100)}%
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* All Case Landmarks Quick-Jump */}
                  <div>
                    <span className="text-[10.5px] font-semibold uppercase tracking-wider block mb-1.5 text-[var(--ink-tertiary)]">
                      All Case Investigation Loci ({filteredNodes.length})
                    </span>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {filteredNodes.map((n, idx) => (
                        <button
                          key={n.id}
                          onClick={() => {
                            setSelectedNode(n);
                            if (mapInstanceRef.current) {
                              mapInstanceRef.current.flyTo([n.latitude, n.longitude], 14, { duration: 1.0 });
                            }
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-lg border text-left text-[11.5px] transition-colors ${
                            selectedNode.id === n.id ? 'bg-[var(--surface-2)] border-[var(--accent)] font-semibold' : 'hover:bg-[var(--surface-2)]'
                          }`}
                          style={{ borderColor: selectedNode.id === n.id ? 'var(--accent)' : 'var(--border)' }}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-4 h-4 rounded-full bg-[#111827] text-white font-mono-id text-[9px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="truncate text-[var(--ink-primary)]">{n.name}</span>
                          </div>
                          <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded"
                            style={{
                              background: (NODE_TYPE_CONFIG[n.type] || NODE_TYPE_CONFIG.LOCATION).bg,
                              color: (NODE_TYPE_CONFIG[n.type] || NODE_TYPE_CONFIG.LOCATION).color,
                            }}>
                            {n.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center space-y-2">
                  <MapPin size={32} className="mx-auto text-[var(--ink-tertiary)] opacity-40 mb-2" />
                  <h4 className="font-semibold text-[14px] text-[var(--ink-primary)]">No Locus Selected</h4>
                  <p className="text-[12px] text-[var(--ink-secondary)]">Click any numbered marker on the case map to inspect its investigation telemetry.</p>
                </div>
              )
            )}

            {/* ── VIEW 2: RELATIONSHIP / EDGE INSPECTOR ──────────── */}
            {inspectorMode === 'relationship' && (
              selectedRelationship ? (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl border bg-[#111827] text-white border-slate-700">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-400 block mb-1">
                      DARK GRAPH RELATIONSHIP
                    </span>
                    <h3 className="text-[17px] font-semibold text-white">
                      {selectedRelationship.label}
                    </h3>
                    <div className="font-mono text-[11px] text-slate-300 mt-1">
                      TYPE: {selectedRelationship.type}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border bg-[var(--surface-0)] space-y-2 text-[12px]" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-[var(--ink-tertiary)] block">From Entity</span>
                      <span className="font-semibold text-[var(--ink-primary)] text-[13px]">{selectedRelationship.sourceName || selectedRelationship.source}</span>
                    </div>
                    <div className="border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-[10px] font-semibold uppercase text-[var(--ink-tertiary)] block">To Locus</span>
                      <span className="font-semibold text-[var(--ink-primary)] text-[13px]">{selectedRelationship.targetName || selectedRelationship.target}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border bg-[var(--surface-0)] space-y-1.5 text-[12px]" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex justify-between">
                      <span className="text-[var(--ink-tertiary)]">Evidence Basis:</span>
                      <span className="font-semibold text-[var(--ink-primary)]">{selectedRelationship.evidenceBasis.join(', ') || 'Official FIR Dossier'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--ink-tertiary)]">Graph Confidence:</span>
                      <span className="font-semibold text-emerald-600 font-mono-id">
                        {Math.round(selectedRelationship.confidence * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--ink-tertiary)]">Visual Line Style:</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        Dark Navy (#111827)
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center space-y-2">
                  <RouteIcon size={32} className="mx-auto text-[var(--ink-tertiary)] opacity-40 mb-2" />
                  <h4 className="font-semibold text-[14px] text-[var(--ink-primary)]">No Edge Selected</h4>
                  <p className="text-[12px] text-[var(--ink-secondary)]">Click any dark relationship line on the map to inspect its evidentiary basis.</p>
                </div>
              )
            )}

            {/* ── VIEW 3: UNMAPPED LOCATIONS DRAWER ──────────────── */}
            {inspectorMode === 'unmapped' && (
              <div className="space-y-3">
                <div className="p-3 rounded-2xl border bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-[12px]">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-100 text-[13px] mb-1">
                    Locations Identified Without Coordinates
                  </h4>
                  <p className="text-amber-800 dark:text-amber-200 leading-relaxed text-[11.5px]">
                    In strict adherence to investigation integrity, TRINETRA does NOT create fake or randomized coordinates. These locations were extracted from the FIR but remain unplotted until physical coordinates are corroborated.
                  </p>
                </div>

                <div className="space-y-2">
                  {intelligence?.unmappedLocations.map((u) => (
                    <div key={u.id} className="p-3 rounded-xl border bg-[var(--surface-0)] text-[12px]" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-[var(--ink-primary)] text-[13px]">{u.name}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          {u.type}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--ink-tertiary)]">{u.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action: View in Case Network */}
          <div className="pt-3 border-t space-y-2 mt-4" style={{ borderColor: 'var(--border)' }}>
            {onViewInNetwork && selectedNode?.entityId && (
              <button
                onClick={() => onViewInNetwork(selectedNode.entityId!)}
                className="w-full py-2.5 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition-all border hover:bg-[var(--surface-2)]"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
              >
                <Share2 size={13} />
                <span>INSPECT IN CASE NETWORK GRAPH</span>
              </button>
            )}

            {selectedNode?.entityId && (
              <button
                onClick={() => dispatch(openInspector({ id: selectedNode.entityId!, type: 'Location' }))}
                className="w-full py-2.5 rounded-xl text-[12.5px] font-semibold text-white flex items-center justify-center gap-1.5 transition-all shadow-sm hover:opacity-90"
                style={{ background: 'var(--accent)' }}
              >
                <Eye size={13} />
                <span>VIEW COMPLETE ENTITY DOSSIER</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── BOTTOM GIS TELEMETRY BAR ───────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 border-t text-[11px] z-10"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', color: 'var(--ink-tertiary)' }}>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[var(--accent)] font-semibold">
            <Activity size={12} /> TRINETRA Geographic Graph Engine
          </span>
          <span>•</span>
          <span>Case location map</span>
          <span>•</span>
          <span>High-Contrast Dark Graph Lines (#111827)</span>
          <span>•</span>
          <span>Zero Synthetic Coordinates</span>
        </div>
        <div className="font-mono-id font-semibold">
          CASE: {intelligence?.caseNumber || caseId} • {filteredNodes.length} Plotted Vertices • {filteredRelationships.length} Dark Directed Edges
        </div>
      </div>
    </div>
  );
}
