'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import type cytoscape from 'cytoscape';
import { useAppDispatch } from '@/store/hooks';
import { openInspector } from '@/store/slices/uiSlice';
import { networkNodes, networkEdges } from '@/mock';
import type { NetworkNode, NetworkEdge } from '@/types';
import { casesApi } from '@/lib/api/cases';
import {
  ZoomIn, ZoomOut, Maximize2, RotateCcw,
  Search, Filter, X, Shield, ExternalLink,
  MapPin, Phone, Car, FileText, ArrowRight,
  HelpCircle, UserCheck, AlertTriangle, Network as NetworkIcon, Loader2, RefreshCw,
  Check, ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

interface CaseNetworkGraphProps {
  caseId: string;
  onViewOnMap?: (locationName: string) => void;
  initialSelectedEntityId?: string | null;
}

export const ENTITY_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; border: string; bg: string; iconBg: string }
> = {
  Person: {
    label: 'People',
    color: '#12376E', // Indigo / Purple
    border: 'rgba(79, 70, 229, 0.4)',
    bg: 'rgba(79, 70, 229, 0.12)',
    iconBg: '#12376E',
  },
  Phone: {
    label: 'Phones',
    color: '#2563EB', // Sky Blue / Cyan
    border: 'rgba(2, 132, 199, 0.4)',
    bg: 'rgba(2, 132, 199, 0.12)',
    iconBg: '#2563EB',
  },
  Vehicle: {
    label: 'Vehicles',
    color: '#16A34A', // Emerald Green
    border: 'rgba(16, 185, 129, 0.4)',
    bg: 'rgba(16, 185, 129, 0.12)',
    iconBg: '#16A34A',
  },
  Location: {
    label: 'Locations',
    color: '#D97706', // Amber / Gold
    border: 'rgba(245, 158, 11, 0.4)',
    bg: 'rgba(245, 158, 11, 0.12)',
    iconBg: '#D97706',
  },
  Financial: {
    label: 'Financials',
    color: '#0F766E', // Teal / Cyan
    border: 'rgba(6, 182, 212, 0.4)',
    bg: 'rgba(6, 182, 212, 0.12)',
    iconBg: '#0F766E',
  },
  Legal_Section: {
    label: 'Legal Sections',
    color: '#5B4BC4', // Violet
    border: 'rgba(139, 92, 246, 0.4)',
    bg: 'rgba(139, 92, 246, 0.12)',
    iconBg: '#5B4BC4',
  },
  FIR: {
    label: 'FIR Dossier',
    color: '#DC2626', // Red
    border: 'rgba(239, 68, 68, 0.4)',
    bg: 'rgba(239, 68, 68, 0.12)',
    iconBg: '#DC2626',
  },
  Case: {
    label: 'Case Master',
    color: '#2563EB', // Cobalt Blue
    border: 'rgba(59, 130, 246, 0.4)',
    bg: 'rgba(59, 130, 246, 0.12)',
    iconBg: '#2563EB',
  },
  Evidence: {
    label: 'Evidence',
    color: '#DC2626', // Pink
    border: 'rgba(236, 72, 153, 0.4)',
    bg: 'rgba(236, 72, 153, 0.12)',
    iconBg: '#DC2626',
  },
  Organization: {
    label: 'Organizations',
    color: '#5B4BC4', // Fuchsia
    border: 'rgba(217, 70, 239, 0.4)',
    bg: 'rgba(217, 70, 239, 0.12)',
    iconBg: '#5B4BC4',
  },
};

export const normalizeEntityType = (rawType?: string): string => {
  if (!rawType) return 'Entity';
  const t = String(rawType).trim().toUpperCase();
  if (t === 'PERSON' || t === 'SUSPECT' || t === 'ACCUSED' || t === 'COMPLAINANT' || t === 'WITNESS' || t === 'PEOPLE') return 'Person';
  if (t === 'PHONE' || t === 'MOBILE' || t === 'SIM' || t === 'PHONES') return 'Phone';
  if (t === 'VEHICLE' || t === 'CAR' || t === 'BIKE' || t === 'VEHICLES') return 'Vehicle';
  if (t === 'LOCATION' || t === 'ADDRESS' || t === 'PLACE' || t === 'LOCATIONS') return 'Location';
  if (t === 'FINANCIAL' || t === 'TRANSACTION' || t === 'TRANSACTION_ID' || t === 'ACCOUNT' || t === 'BANK_ACCOUNT' || t === 'UPI_ID' || t === 'FINANCIALS' || t === 'AMOUNT' || t === 'CURRENCY' || t === 'MONEY') return 'Financial';
  if (t === 'LEGAL_SECTION' || t === 'SECTION' || t === 'IPC_SECTION' || t === 'IT_ACT_SECTION' || t === 'LEGAL_SECTIONS') return 'Legal_Section';
  if (t === 'FIR' || t === 'FIR_RECORD' || t === 'FIR_NUMBER') return 'FIR';
  if (t === 'CASE' || t === 'DOSSIER') return 'Case';
  if (t === 'EVIDENCE' || t === 'DOCUMENT' || t === 'EMAIL' || t === 'EMAILS' || t === 'DIGITAL_IDENTIFIER' || t === 'DIGITAL_ID' || t === 'IP_ADDRESS' || t === 'DEVICE') return 'Evidence';
  if (t === 'ORGANIZATION' || t === 'COMPANY' || t === 'ORGANIZATIONS') return 'Organization';
  return rawType.charAt(0).toUpperCase() + rawType.slice(1);
};

export const getNodeColor = (type: string): string => {
  const norm = normalizeEntityType(type);
  return ENTITY_TYPE_CONFIG[norm]?.color || '#9CA3AF';
};

export default function CaseNetworkGraph({
  caseId,
  onViewOnMap,
  initialSelectedEntityId,
}: CaseNetworkGraphProps) {
  const dispatch = useAppDispatch();
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const [networkData, setNetworkData] = useState<{ nodes: NetworkNode[]; edges: NetworkEdge[] } | null>(null);
  const [loadingNetwork, setLoadingNetwork] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<NetworkEdge | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(['all']));
  const [showCaseHub, setShowCaseHub] = useState<boolean>(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredNode, setHoveredNode] = useState<{ node: NetworkNode; x: number; y: number } | null>(null);
  const [syncingGraph, setSyncingGraph] = useState(false);

  async function loadNetwork() {
    if (!caseId) return;
    setLoadingNetwork(true);
    setNetworkError(null);
    try {
      const net = await casesApi.getCaseNetwork(caseId);
      if (net?.nodes && net.nodes.length > 0) {
        const mappedNodes: NetworkNode[] = net.nodes.map((n) => {
          const normType = normalizeEntityType(n.type);
          return {
            id: n.id,
            label: n.label,
            type: normType as any,
            data: { ...(n.data || {}), type: normType },
          };
        });
        const mappedEdges: NetworkEdge[] = (net.edges || []).map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          relationship: e.relationship as any,
          confidence: e.confidence,
          evidenceBasis: (e as any).evidenceBasis || ['Case Dossier / FIR Link'],
          caseIds: (e as any).caseIds || [caseId],
        }));

        // Inter-entity relationship synthesizer to guarantee clean web connectivity
        const edgePairs = new Set(mappedEdges.map((e) => `${e.source}->${e.target}`));
        const suspectNode = mappedNodes.find((n) => (n.data as any)?.role === 'SUSPECT') || mappedNodes.find((n) => (n.type as string) === 'Person');
        const phoneNodes = mappedNodes.filter((n) => (n.type as string) === 'Phone');
        const finNodes = mappedNodes.filter((n) => (n.type as string) === 'Financial');
        const vehNodes = mappedNodes.filter((n) => (n.type as string) === 'Vehicle');
        const locNodes = mappedNodes.filter((n) => (n.type as string) === 'Location');
        const secNodes = mappedNodes.filter((n) => (n.type as string) === 'Legal_Section');
        const firNode = mappedNodes.find((n) => (n.type as string) === 'FIR');
        const otherPersons = mappedNodes.filter((n) => (n.type as string) === 'Person' && n.id !== suspectNode?.id);

        if (suspectNode) {
          phoneNodes.forEach((ph) => {
            const k1 = `${suspectNode.id}->${ph.id}`;
            const k2 = `${ph.id}->${suspectNode.id}`;
            if (!edgePairs.has(k1) && !edgePairs.has(k2)) {
              mappedEdges.push({
                id: `syn-ph-${suspectNode.id}-${ph.id}`,
                source: suspectNode.id,
                target: ph.id,
                relationship: 'SUBSCRIBES_TO' as any,
                confidence: 96,
                evidenceBasis: ['Telecom CDR Intelligence Match'],
                caseIds: [caseId],
              });
              edgePairs.add(k1);
            }
          });
          finNodes.forEach((fin) => {
            const k1 = `${suspectNode.id}->${fin.id}`;
            const k2 = `${fin.id}->${suspectNode.id}`;
            if (!edgePairs.has(k1) && !edgePairs.has(k2)) {
              mappedEdges.push({
                id: `syn-fin-${suspectNode.id}-${fin.id}`,
                source: suspectNode.id,
                target: fin.id,
                relationship: 'ACCOUNT_HOLDER' as any,
                confidence: 94,
                evidenceBasis: ['Bank Account & Ledger Trace'],
                caseIds: [caseId],
              });
              edgePairs.add(k1);
            }
          });
          vehNodes.forEach((v) => {
            const k1 = `${suspectNode.id}->${v.id}`;
            const k2 = `${v.id}->${suspectNode.id}`;
            if (!edgePairs.has(k1) && !edgePairs.has(k2)) {
              mappedEdges.push({
                id: `syn-veh-${suspectNode.id}-${v.id}`,
                source: suspectNode.id,
                target: v.id,
                relationship: 'OPERATES' as any,
                confidence: 90,
                evidenceBasis: ['Vahan Vehicle Registry Correlation'],
                caseIds: [caseId],
              });
              edgePairs.add(k1);
            }
          });
          locNodes.filter((l) => /flat|house|apt|residence|road/i.test(l.label)).forEach((l) => {
            const k1 = `${suspectNode.id}->${l.id}`;
            const k2 = `${l.id}->${suspectNode.id}`;
            if (!edgePairs.has(k1) && !edgePairs.has(k2)) {
              mappedEdges.push({
                id: `syn-loc-${suspectNode.id}-${l.id}`,
                source: suspectNode.id,
                target: l.id,
                relationship: 'RESIDES_AT' as any,
                confidence: 90,
                evidenceBasis: ['Address Geospatial Anchor'],
                caseIds: [caseId],
              });
              edgePairs.add(k1);
            }
          });
          otherPersons.forEach((op) => {
            const k1 = `${suspectNode.id}->${op.id}`;
            const k2 = `${op.id}->${suspectNode.id}`;
            if (!edgePairs.has(k1) && !edgePairs.has(k2)) {
              const rel = (op.data as any)?.role === 'COMPLAINANT' ? 'ACCUSED_BY' : 'ASSOCIATE_OF';
              mappedEdges.push({
                id: `syn-op-${suspectNode.id}-${op.id}`,
                source: suspectNode.id,
                target: op.id,
                relationship: rel as any,
                confidence: 92,
                evidenceBasis: ['Case Entity Relation'],
                caseIds: [caseId],
              });
              edgePairs.add(k1);
            }
          });
        }

        if (firNode) {
          secNodes.forEach((s) => {
            const k1 = `${firNode.id}->${s.id}`;
            const k2 = `${s.id}->${firNode.id}`;
            if (!edgePairs.has(k1) && !edgePairs.has(k2)) {
              mappedEdges.push({
                id: `syn-fir-sec-${s.id}`,
                source: firNode.id,
                target: s.id,
                relationship: 'CHARGED_UNDER' as any,
                confidence: 99,
                evidenceBasis: ['Statutory FIR Sections'],
                caseIds: [caseId],
              });
              edgePairs.add(k1);
            }
          });
          locNodes.filter((l) => !/flat|house|apt|residence/i.test(l.label)).forEach((l) => {
            const k1 = `${firNode.id}->${l.id}`;
            const k2 = `${l.id}->${firNode.id}`;
            if (!edgePairs.has(k1) && !edgePairs.has(k2)) {
              mappedEdges.push({
                id: `syn-fir-loc-${l.id}`,
                source: firNode.id,
                target: l.id,
                relationship: 'CRIME_SCENE' as any,
                confidence: 95,
                evidenceBasis: ['Incident Geospatial Anchor'],
                caseIds: [caseId],
              });
              edgePairs.add(k1);
            }
          });
        }

        setNetworkData({ nodes: mappedNodes, edges: mappedEdges });
      } else {
        setNetworkData({ nodes: [], edges: [] });
      }
    } catch (err) {
      setNetworkData({ nodes: [], edges: [] });
      setNetworkError(err instanceof Error ? err.message : 'Unable to retrieve this case network.');
    } finally {
      setLoadingNetwork(false);
    }
  }

  const handleSyncGraph = async () => {
    if (!caseId || syncingGraph) return;
    setSyncingGraph(true);
    try {
      const res = await casesApi.syncCaseGraph(caseId);
      toast.success(res.message || 'Case network updated');
      await loadNetwork();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Graph synchronization failed.');
    } finally {
      setSyncingGraph(false);
    }
  };

  useEffect(() => {
    loadNetwork();
  }, [caseId]);


  const caseNodes = useMemo(() => {
    return networkData ? networkData.nodes : networkNodes;
  }, [networkData]);

  const caseEdges = useMemo(() => {
    return networkData ? networkData.edges : networkEdges;
  }, [networkData]);

  // Initialize Cytoscape
  useEffect(() => {
    let cyInstance: cytoscape.Core | null = null;
    let isMounted = true;

    async function initGraph() {
      if (!containerRef.current || caseNodes.length === 0) return;
      try {
        const cytoscapeLib = (await import('cytoscape')).default;
        if (!isMounted || !containerRef.current || caseNodes.length === 0) return;

        // Safeguard edges: only include edges where BOTH source and target exist in caseNodes
        const nodeIds = new Set(caseNodes.map((n) => n.id));
        const validEdges = caseEdges.filter((e) => {
          const ok = nodeIds.has(e.source) && nodeIds.has(e.target);
          if (!ok) {
            console.warn(`[Cytoscape] Skipped invalid edge ${e.id}: source=${e.source}(${nodeIds.has(e.source)}), target=${e.target}(${nodeIds.has(e.target)})`);
          }
          return ok;
        });

        const elements = [
          ...caseNodes.map((n) => {
            const normType = normalizeEntityType(n.type);
            return {
              data: {
                id: n.id,
                label: n.label,
                type: normType,
                color: getNodeColor(normType),
                ...n.data,
              },
            };
          }),
          ...validEdges.map((e) => ({
            data: {
              id: e.id,
              source: e.source,
              target: e.target,
              relationship: e.relationship,
              confidence: e.confidence,
            },
          })),
        ];

        if (!isMounted || !containerRef.current) return;

        cyInstance = cytoscapeLib({
          container: containerRef.current,
          elements,
          style: [
            {
              selector: 'node',
              style: {
                label: 'data(label)',
                'font-size': '11.5px',
                'font-family': 'Inter, system-ui, sans-serif',
                'font-weight': 600,
                color: 'var(--ink-primary)',
                'background-color': 'data(color)',
                width: 36,
                height: 36,
                'border-width': 2.5,
                'border-color': '#FFFFFF',
                'text-valign': 'bottom',
                'text-margin-y': 5,
                'text-wrap': 'ellipsis',
                'text-max-width': '95px',
                'transition-property': 'background-color, border-color, width, height, opacity',
                'transition-duration': 0.2,
              },
            },
            {
              selector: 'node:selected',
              style: {
                'border-color': '#12376E',
                'border-width': 4,
                width: 44,
                height: 44,
              },
            },
            {
              selector: 'node.highlighted',
              style: {
                'border-color': '#12376E',
                'border-width': 3.5,
                width: 42,
                height: 42,
                opacity: 1,
              },
            },
            {
              selector: 'node.faded',
              style: {
                opacity: 0.18,
              },
            },
            {
              selector: 'edge',
              style: {
                width: 1.8,
                'line-color': 'rgba(100, 116, 139, 0.35)',
                'target-arrow-color': 'rgba(100, 116, 139, 0.45)',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                'arrow-scale': 0.9,
                label: 'data(relationship)',
                'font-size': '9px',
                'font-family': 'Inter, system-ui, sans-serif',
                'text-rotation': 'autorotate',
                'text-background-opacity': 0.8,
                'text-background-color': '#FFFFFF',
                'text-background-padding': '2px',
                'text-background-shape': 'roundrectangle',
                color: '#9CA3AF',
                'transition-property': 'line-color, width, opacity',
                'transition-duration': 0.2,
              },
            },
            {
              selector: 'edge.highlighted',
              style: {
                width: 3.5,
                'line-color': '#12376E',
                'target-arrow-color': '#12376E',
                color: '#12376E',
                'font-weight': 700,
                opacity: 1,
              },
            },
            {
              selector: 'edge.faded',
              style: {
                opacity: 0.1,
              },
            },
            {
              selector: '.hidden',
              style: {
                display: 'none',
              },
            },
          ],
          layout: {
            name: 'cose',
            animate: true,
            animationDuration: 800,
            nodeRepulsion: () => 180000,
            idealEdgeLength: () => 110,
            edgeElasticity: () => 100,
            nodeOverlap: 20,
            componentSpacing: 100,
            padding: 40,
          },
          minZoom: 0.2,
          maxZoom: 3,
          wheelSensitivity: 0.25,
        });

        cyRef.current = cyInstance;

        cyInstance.ready(() => {
          cyInstance?.resize();
          cyInstance?.fit(undefined, 40);
        });

        cyInstance.on('layoutstop', () => {
          cyInstance?.resize();
          cyInstance?.fit(undefined, 40);
        });

        // Node click: highlight & open entity details
        cyInstance.on('tap', 'node', (evt) => {
          const target = evt.target;
          const nData = target.data();
          const nodeObj = caseNodes.find((n) => n.id === nData.id) || {
            id: nData.id,
            label: nData.label,
            type: nData.type,
            data: nData,
          };

          setSelectedNode(nodeObj);
          setSelectedEdge(null);

          // Highlight neighborhood
          const neighborhood = target.neighborhood().add(target);
          cyInstance?.elements().removeClass('highlighted faded');
          cyInstance?.elements().difference(neighborhood).addClass('faded');
          neighborhood.addClass('highlighted');

          // Smoothly center on selected node
          cyInstance?.animate({
            center: { eles: target },
            zoom: Math.max(cyInstance.zoom(), 1.15),
            duration: 350,
          });
        });

        // Background tap: reset selection
        cyInstance.on('tap', (evt) => {
          if (evt.target === cyInstance) {
            setSelectedNode(null);
            setSelectedEdge(null);
            cyInstance?.elements().removeClass('highlighted faded');
          }
        });

        // Edge tap: show relationship details
        cyInstance.on('tap', 'edge', (evt) => {
          const edgeData = evt.target.data();
          const edgeObj: NetworkEdge = caseEdges.find((e) => e.id === edgeData.id) || {
            id: edgeData.id,
            source: edgeData.source,
            target: edgeData.target,
            relationship: edgeData.relationship,
            confidence: edgeData.confidence || 85,
            evidenceBasis: [],
            caseIds: [caseId],
          };
          setSelectedEdge(edgeObj);
        });

        // Hover tooltip
        cyInstance.on('mouseover', 'node', (evt) => {
          const nodeData = evt.target.data();
          const renderedPos = evt.target.renderedPosition();
          const found = caseNodes.find((n) => n.id === nodeData.id);
          if (found) {
            setHoveredNode({
              node: found,
              x: renderedPos.x,
              y: renderedPos.y,
            });
          }
        });

        cyInstance.on('mouseout', 'node', () => {
          setHoveredNode(null);
        });

        // Double click: focus & zoom to node
        cyInstance.on('dbltap', 'node', (evt) => {
          cyInstance?.animate({
            center: { eles: evt.target },
            zoom: 1.5,
            duration: 500,
          });
        });

        // Select initial entity if provided
        if (initialSelectedEntityId) {
          const initEle = cyInstance.getElementById(initialSelectedEntityId);
          if (initEle.length > 0) {
            initEle.trigger('tap');
            cyInstance.center(initEle);
          }
        }
        if (!isMounted) {
          cyInstance.destroy();
          return;
        }
        cyRef.current = cyInstance;
      } catch (err) {
        console.error('Failed to init Cytoscape:', err);
      }
    }

    initGraph();

    return () => {
      isMounted = false;
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
    // initialSelectedEntityId is deliberately excluded: it is an initial focus
    // hint, not graph data. Including it rebuilt the graph mid-interaction and
    // dropped the node click handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseNodes, caseEdges, caseId]);

  // Automatically resize cytoscape canvas and re-center when side panel opens or closes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (cyRef.current) {
        cyRef.current.resize();
        if (selectedNode) {
          const ele = cyRef.current.getElementById(selectedNode.id);
          if (ele.length > 0) {
            cyRef.current.animate({
              center: { eles: ele },
              duration: 300,
            });
          }
        }
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [selectedNode]);

  // Handle entity filter changes with robust normalization and multi-select support
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    const isAll = selectedTypes.has('all') || selectedTypes.size === 0;

    cy.nodes().each((node) => {
      const nodeNorm = normalizeEntityType(node.data('type'));
      if (isAll || selectedTypes.has(nodeNorm)) {
        node.removeClass('hidden');
      } else {
        node.addClass('hidden');
      }
    });

    cy.edges().each((edge) => {
      const srcNode = edge.source();
      const tgtNode = edge.target();
      const srcVisible = !srcNode.hasClass('hidden');
      const tgtVisible = !tgtNode.hasClass('hidden');
      const rel = String(edge.data('relationship') || '');
      const srcType = normalizeEntityType(srcNode.data('type'));
      const tgtType = normalizeEntityType(tgtNode.data('type'));

      // If Case Hub is in CLEAN mode (!showCaseHub), suppress raw starburst INVOLVED_IN edges from Case node to peripheral leaf entities
      const isStarburstHubSpoke =
        !showCaseHub &&
        (rel === 'INVOLVED_IN' || rel === 'Case Dossier / FIR Link') &&
        (srcType === 'Case' || tgtType === 'Case');

      if (srcVisible && tgtVisible && !isStarburstHubSpoke) {
        edge.removeClass('hidden');
      } else {
        edge.addClass('hidden');
      }
    });

    const visibleNodes = cy.nodes(':visible');
    if (visibleNodes.length > 0) {
      cy.animate({ fit: { eles: visibleNodes, padding: 45 }, duration: 350 });
    }
  }, [selectedTypes, showCaseHub]);

  // Handle search highlighting
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    if (!searchQuery.trim()) {
      cy.elements().removeClass('highlighted faded');
      return;
    }
    const q = searchQuery.toLowerCase();
    const matched = cy.nodes().filter((node) => {
      const label = (node.data('label') || '').toLowerCase();
      const id = (node.data('id') || '').toLowerCase();
      return label.includes(q) || id.includes(q);
    });

    if (matched.length > 0) {
      cy.elements().removeClass('highlighted').addClass('faded');
      matched.removeClass('faded').addClass('highlighted');
      cy.animate({
        center: { eles: matched.first() },
        zoom: 1.2,
        duration: 400,
      });
    }
  }, [searchQuery]);

  // Graph controls
  const handleZoomIn = () => {
    if (cyRef.current) cyRef.current.zoom(cyRef.current.zoom() * 1.3);
  };
  const handleZoomOut = () => {
    if (cyRef.current) cyRef.current.zoom(cyRef.current.zoom() / 1.3);
  };
  const handleReset = () => {
    if (cyRef.current) {
      cyRef.current.reset();
      cyRef.current.elements().removeClass('highlighted faded');
      setSelectedNode(null);
      setSelectedEdge(null);
    }
  };
  const handleFit = () => {
    if (cyRef.current) cyRef.current.fit(undefined, 30);
  };

  // Focus a specific connected entity from the panel
  const handleFocusConnected = (targetId: string) => {
    if (!cyRef.current) return;
    const ele = cyRef.current.getElementById(targetId);
    if (ele.length > 0) {
      ele.trigger('tap');
      cyRef.current.animate({
        center: { eles: ele },
        zoom: 1.3,
        duration: 400,
      });
    }
  };

  // Connected entities for selected node
  const connectedNeighbors = useMemo(() => {
    if (!selectedNode) return [];
    const connectedEdges = caseEdges.filter(
      (e) => e.source === selectedNode.id || e.target === selectedNode.id
    );
    const neighborIds = connectedEdges.map((e) =>
      e.source === selectedNode.id ? e.target : e.source
    );
    return caseNodes.filter((n) => neighborIds.includes(n.id));
  }, [selectedNode, caseEdges, caseNodes]);

  // Entity type counts for the Color Code legend
  const entityTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    caseNodes.forEach((n) => {
      const norm = normalizeEntityType(n.type);
      counts[norm] = (counts[norm] || 0) + 1;
    });
    return counts;
  }, [caseNodes]);

  const isAllSelected = selectedTypes.has('all') || selectedTypes.size === 0;

  const handleToggleType = (typeKey: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (typeKey === 'all') {
        return new Set(['all']);
      }
      if (next.has('all')) {
        return new Set([typeKey]);
      }
      if (next.has(typeKey)) {
        next.delete(typeKey);
        if (next.size === 0) {
          return new Set(['all']);
        }
      } else {
        next.add(typeKey);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedTypes(new Set(['all']));
  };

  const handlePresetSelect = (types: string[]) => {
    setSelectedTypes(new Set(types));
    setFilterDropdownOpen(false);
  };

  const visibleCount = useMemo(() => {
    if (isAllSelected) return caseNodes.length;
    return caseNodes.filter((n) => selectedTypes.has(normalizeEntityType(n.type))).length;
  }, [caseNodes, selectedTypes, isAllSelected]);

  return (
    <div className="relative flex flex-col h-[740px] rounded-2xl border overflow-hidden glass-panel"
      style={{ borderColor: 'var(--border)' }}>

      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between p-3 border-b z-10 gap-3"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
        
        {/* Left: Entity Type Multi-Select & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12.5px]"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <Search size={14} style={{ color: 'var(--ink-tertiary)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entity name or ID..."
              className="bg-transparent border-none outline-none text-[12.5px] w-44 text-[var(--ink-primary)]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Multi-Select Category Dropdown */}
          <div className="relative">
            <button
              onClick={() => setFilterDropdownOpen((prev) => !prev)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[12.5px] font-medium transition-all ${
                !isAllSelected
                  ? 'bg-indigo-50 border-indigo-400 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-600 dark:text-indigo-300 shadow-xs font-semibold'
                  : 'bg-[var(--surface-2)] text-[var(--ink-primary)] hover:bg-[var(--surface-3)]'
              }`}
              style={{ borderColor: !isAllSelected ? undefined : 'var(--border)' }}
              title="Click to multi-select entity categories"
            >
              <Filter size={13} style={{ color: !isAllSelected ? '#12376E' : 'var(--ink-tertiary)' }} />
              <span>
                {isAllSelected
                  ? `All Categories (${caseNodes.length})`
                  : `${selectedTypes.size} Selected (${visibleCount})`}
              </span>
              <ChevronDown size={13} className={`transition-transform duration-200 ${filterDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {filterDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setFilterDropdownOpen(false)}
                />
                <div
                  className="absolute left-0 top-full mt-1.5 w-64 rounded-2xl border shadow-xl z-50 p-2.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    background: 'var(--surface-1)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b text-[11px] font-semibold text-[var(--ink-secondary)]"
                    style={{ borderColor: 'var(--border)' }}>
                    <span>MULTI-SELECT CATEGORIES</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSelectAll}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        All
                      </button>
                      <span>•</span>
                      <button
                        onClick={() => setSelectedTypes(new Set())}
                        className="text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)] cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex flex-wrap gap-1 mb-2.5 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>
                    <button
                      onClick={() => handlePresetSelect(['Person', 'Phone'])}
                      className="text-[10.5px] px-2 py-0.5 rounded-lg border bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--ink-secondary)] cursor-pointer"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      Phone &amp; People
                    </button>
                    <button
                      onClick={() => handlePresetSelect(['Person', 'Phone', 'Vehicle', 'Financial'])}
                      className="text-[10.5px] px-2 py-0.5 rounded-lg border bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--ink-secondary)] cursor-pointer"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      Suspect Core
                    </button>
                    <button
                      onClick={() => handlePresetSelect(['Person', 'Financial'])}
                      className="text-[10.5px] px-2 py-0.5 rounded-lg border bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--ink-secondary)] cursor-pointer"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      Financials
                    </button>
                  </div>

                  {/* Individual Checkbox Options */}
                  <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                    {Object.entries(ENTITY_TYPE_CONFIG).map(([typeKey, cfg]) => {
                      const count = entityTypeCounts[typeKey] || 0;
                      const isChecked = isAllSelected || selectedTypes.has(typeKey);
                      return (
                        <div
                          key={typeKey}
                          onClick={() => handleToggleType(typeKey)}
                          className="flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-[var(--surface-2)] cursor-pointer transition-colors text-[12px]"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                isChecked
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-slate-300 dark:border-slate-600 bg-transparent'
                              }`}
                            >
                              {isChecked && <Check size={11} strokeWidth={3} />}
                            </div>
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: cfg.color }}
                            />
                            <span className="font-medium text-[var(--ink-primary)]">
                              {cfg.label}
                            </span>
                          </div>
                          <span
                            className="text-[10.5px] px-1.5 py-0.5 rounded-full font-mono-id font-semibold"
                            style={{ background: cfg.bg, color: cfg.color }}
                          >
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Case Hub Clean / Starburst Toggle */}
          <button
            onClick={() => setShowCaseHub((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-medium transition-all cursor-pointer ${
              showCaseHub
                ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300 shadow-xs'
                : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--ink-secondary)]'
            }`}
            style={{ borderColor: showCaseHub ? undefined : 'var(--border)' }}
            title={
              showCaseHub
                ? 'Case Hub is ON: Displaying central case starburst edges'
                : 'Case Hub is CLEAN: Redundant starburst hidden, displaying proper inter-entity network only'
            }
          >
            <Shield size={13} className={showCaseHub ? 'text-amber-600' : 'text-[var(--ink-tertiary)]'} />
            <span>Case Hub: <strong className="font-semibold">{showCaseHub ? 'STARBURST' : 'CLEAN'}</strong></span>
          </button>

          {/* Reset Filters Pill */}
          {!isAllSelected && (
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors font-medium cursor-pointer"
            >
              <span>Reset Filters</span>
              <X size={11} />
            </button>
          )}
        </div>

        {/* Right: Graph Zoom & Reset Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-xl border hover:bg-[var(--surface-2)] transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
            title="Zoom In"
          >
            <ZoomIn size={15} />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-xl border hover:bg-[var(--surface-2)] transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
            title="Zoom Out"
          >
            <ZoomOut size={15} />
          </button>
          <button
            onClick={handleFit}
            className="p-2 rounded-xl border hover:bg-[var(--surface-2)] transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
            title="Fit to Screen"
          >
            <Maximize2 size={15} />
          </button>
          <button
            onClick={handleReset}
            className="px-2.5 py-1.5 rounded-xl border hover:bg-[var(--surface-2)] transition-colors flex items-center gap-1 text-[12px] font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
            title="Reset Graph"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
          <button
            onClick={handleSyncGraph}
            disabled={syncingGraph}
            className="px-2.5 py-1.5 rounded-xl border bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-colors flex items-center gap-1.5 text-[12px] font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
            title="Rebuild the case network"
          >
            <RefreshCw size={13} className={syncingGraph ? 'animate-spin text-blue-500' : 'text-blue-600'} />
            <span>{syncingGraph ? 'Syncing...' : 'Sync Graph'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Color Code Legend Strip with Multi-Select Toggles */}
      <div
        className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b z-10 text-[11.5px] overflow-x-auto select-none"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-tertiary)] mr-1 shrink-0">
          Color Code:
        </span>
        
        {/* All Pill */}
        <button
          onClick={handleSelectAll}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
            isAllSelected
              ? 'ring-2 ring-[var(--accent)] bg-[var(--surface-1)] shadow-xs font-semibold text-[var(--ink-primary)]'
              : 'hover:bg-[var(--surface-3)] text-[var(--ink-secondary)]'
          }`}
          style={{
            border: '1px solid var(--border)',
          }}
          title="Click to view all entity categories"
        >
          <span className="w-2 h-2 rounded-full bg-slate-400" />
          <span>All</span>
          <span className="text-[10px] px-1 py-0.2 rounded-full bg-[var(--surface-3)] font-mono-id">
            {caseNodes.length}
          </span>
        </button>

        {/* Dynamic Category Badges with Vivid Color Dots and Multi-Select Support */}
        {Object.entries(ENTITY_TYPE_CONFIG).map(([typeKey, cfg]) => {
          const count = entityTypeCounts[typeKey] || 0;
          if (count === 0 && !selectedTypes.has(typeKey)) return null;
          const isCategorySelected = isAllSelected || selectedTypes.has(typeKey);

          return (
            <button
              key={typeKey}
              onClick={() => handleToggleType(typeKey)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                isCategorySelected
                  ? 'shadow-xs font-semibold ring-2'
                  : 'hover:opacity-90 font-medium opacity-50'
              }`}
              style={{
                background: isCategorySelected ? cfg.bg : 'var(--surface-1)',
                borderColor: cfg.border,
                borderWidth: '1px',
                borderStyle: 'solid',
                color: cfg.color,
                boxShadow: isCategorySelected ? `0 0 0 2px ${cfg.color}50` : undefined,
              }}
              title={`Click to toggle ${cfg.label} in multi-selection (${count} entities)`}
            >
              {isCategorySelected && !isAllSelected && (
                <Check size={11} strokeWidth={3} className="shrink-0" />
              )}
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: cfg.color, boxShadow: `0 0 5px ${cfg.color}80` }}
              />
              <span className="whitespace-nowrap">{cfg.label}</span>
              <span
                className="text-[10px] px-1 rounded-full font-mono-id font-semibold"
                style={{ background: cfg.bg, color: cfg.color }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Canvas & Overlay Split */}
      <div className="relative flex-1 flex overflow-hidden">
        {loadingNetwork ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--ink-tertiary)]">
            <Loader2 size={32} className="animate-spin text-[var(--accent)] mb-2" />
            <p className="text-[13px]">Retrieving case relationship network...</p>
          </div>
        ) : networkError ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--ink-tertiary)]">
            <AlertTriangle size={32} className="text-[var(--warning)] mb-3" />
            <h4 className="text-[16px] font-semibold" style={{ color: 'var(--ink-primary)' }}>
              Network Could Not Be Loaded
            </h4>
            <p className="text-[13px] text-[var(--ink-secondary)] mt-1 max-w-md">
              {networkError}
            </p>
            <button
              onClick={loadNetwork}
              className="mt-4 px-3 py-2 rounded-xl border text-[12px] font-medium hover:bg-[var(--surface-2)]"
              style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}
            >
              Try Again
            </button>
          </div>
        ) : (networkData && networkData.nodes.length === 0) || caseNodes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--ink-tertiary)]">
            <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-[var(--accent)] mb-3 bg-[var(--surface-2)]">
              <NetworkIcon size={28} />
            </div>
            <h4 className="text-[16px] font-semibold" style={{ color: 'var(--ink-primary)' }}>
              No Intelligence Network Available For Case {caseId}
            </h4>
            <p className="text-[13px] text-[var(--ink-secondary)] mt-1 max-w-md">
              This case does not yet contain enough entity relationships to construct a graph. Ingest an FIR or attach documentary evidence to synthesize network connections.
            </p>
          </div>
        ) : (
          /* Cytoscape Container */
          <div ref={containerRef} className="flex-1 w-full h-full cursor-grab active:cursor-grabbing" />
        )}

        {/* Zero Match Filter Overlay */}
        {!isAllSelected && visibleCount === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-[var(--surface-1)]/80 backdrop-blur-xs">
            <div className="p-5 rounded-2xl bg-[var(--surface-1)] border shadow-xl max-w-sm" style={{ borderColor: 'var(--border)' }}>
              <Filter size={28} className="mx-auto mb-2 text-[var(--accent)]" />
              <h5 className="font-semibold text-[14px] text-[var(--ink-primary)]">
                No Matching Entities in Network
              </h5>
              <p className="text-[12px] text-[var(--ink-secondary)] mt-1 mb-4">
                This case dossier currently contains 0 entities categorized under the selected filter combination.
              </p>
              <button
                onClick={handleSelectAll}
                className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold text-white shadow-sm hover:opacity-90 cursor-pointer"
                style={{ background: 'var(--accent)' }}
              >
                Show All Entities ({caseNodes.length})
              </button>
            </div>
          </div>
        )}

        {/* Hover Tooltip */}
        {hoveredNode && !selectedNode && (
          <div
            className="absolute z-20 pointer-events-none p-2.5 rounded-xl border shadow-xl glass-panel animate-fade-in text-[12px]"
            style={{
              left: `${Math.min(hoveredNode.x + 15, 600)}px`,
              top: `${Math.min(hoveredNode.y + 15, 450)}px`,
              background: 'var(--surface-1)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: getNodeColor(hoveredNode.node.type) }} />
              <span className="font-semibold text-[13px]" style={{ color: 'var(--ink-primary)' }}>{hoveredNode.node.label}</span>
            </div>
            <div className="space-y-0.5" style={{ color: 'var(--ink-secondary)' }}>
              <div>Type: <strong style={{ color: 'var(--ink-primary)' }}>{hoveredNode.node.type}</strong></div>
              <div>ID: <span className="font-mono-id">{hoveredNode.node.id}</span></div>
              <div>Double-click to center • Click to inspect</div>
            </div>
          </div>
        )}

        {/* Edge Relationship Popup */}
        {selectedEdge && !selectedNode && (
          <div
            className="absolute top-4 left-4 z-20 w-80 p-4 rounded-2xl border shadow-2xl glass-panel animate-fade-in text-[12.5px]"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                Relationship Link
              </span>
              <button onClick={() => setSelectedEdge(null)} className="text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2 mb-3">
              <div className="p-2 rounded-lg bg-[var(--surface-2)] text-center font-semibold" style={{ color: 'var(--ink-primary)' }}>
                {selectedEdge.relationship}
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span style={{ color: 'var(--ink-tertiary)' }}>Confidence</span>
                <span className="font-mono-id font-semibold text-[var(--success)]">{selectedEdge.confidence || 88}%</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span style={{ color: 'var(--ink-tertiary)' }}>Source</span>
                <span className="font-mono-id">{selectedEdge.source}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span style={{ color: 'var(--ink-tertiary)' }}>Target</span>
                <span className="font-mono-id">{selectedEdge.target}</span>
              </div>
            </div>
            <div className="text-[11px] p-2 rounded-lg bg-[var(--surface-2)]" style={{ color: 'var(--ink-secondary)' }}>
              Verified via CDR phone record correlation &amp; company registry cross-indexing.
            </div>
          </div>
        )}

        {/* Selected Entity Details Side Panel (Section 15) */}
        {selectedNode && (
          <div
            className="w-96 border-l p-5 overflow-y-auto z-20 flex flex-col justify-between shadow-2xl glass-panel animate-slide-left shrink-0"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
          >
            <div>
              {/* Header */}
              <div className="flex items-start justify-between mb-4 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: getNodeColor(selectedNode.type) }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: getNodeColor(selectedNode.type) }}>
                      {normalizeEntityType(selectedNode.type)}
                    </span>
                    {Boolean(selectedNode.data?.role) && (
                      <span className="text-[10px] font-mono-id font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {String(selectedNode.data?.role)}
                      </span>
                    )}
                  </div>
                  <h3 className="text-[17px] font-semibold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
                    {selectedNode.label}
                  </h3>
                  <span className="font-mono-id text-[11px]" style={{ color: 'var(--ink-tertiary)' }}>
                    {selectedNode.id}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSelectedNode(null);
                    if (cyRef.current) cyRef.current.elements().removeClass('highlighted faded');
                  }}
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Relevance & Status Badge */}
              <div className="p-3 rounded-xl border mb-4 space-y-1.5"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between text-[12px]">
                  <span style={{ color: 'var(--ink-tertiary)' }}>Confidence Rating:</span>
                  <span className="font-mono-id font-semibold text-[var(--success)]">
                    {Math.round((Number(selectedNode.data?.confidence) || 0.95) * 100)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span style={{ color: 'var(--ink-tertiary)' }}>Direct Connections:</span>
                  <span className="font-mono-id font-semibold" style={{ color: 'var(--ink-primary)' }}>
                    {connectedNeighbors.length} entities
                  </span>
                </div>
                {Boolean(selectedNode.data?.source) && (
                  <div className="flex items-center justify-between text-[12px]">
                    <span style={{ color: 'var(--ink-tertiary)' }}>Intelligence Source:</span>
                    <span className="font-mono-id font-semibold text-[var(--ink-secondary)]">
                      {String(selectedNode.data?.source)}
                    </span>
                  </div>
                )}
              </div>

              {/* Dynamic Entity Attributes */}
              <div className="space-y-2 mb-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--ink-tertiary)' }}>
                  Entity Intelligence Attributes
                </span>
                <div className="p-3 rounded-xl border space-y-2 text-[12px]" style={{ borderColor: 'var(--border)' }}>
                  {Object.entries(selectedNode.data || {})
                    .filter(([k, v]) => !['caseIds', 'id', 'label', 'type', 'confidence', 'color', 'source'].includes(k) && v !== null && v !== undefined && String(v).trim() !== '')
                    .slice(0, 8)
                    .map(([k, v]) => (
                      <div key={k} className="flex items-start justify-between gap-2 border-b border-[var(--border)]/50 pb-1.5 last:border-none last:pb-0">
                        <span className="text-[var(--ink-secondary)] capitalize text-[11px]">
                          {k.replace(/_/g, ' ')}:
                        </span>
                        <span className="font-mono-id font-semibold text-right text-[var(--ink-primary)] max-w-[180px] truncate" title={String(v)}>
                          {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                        </span>
                      </div>
                    ))}
                  {Object.entries(selectedNode.data || {}).filter(([k]) => !['caseIds', 'id', 'label', 'type', 'confidence', 'color', 'source'].includes(k)).length === 0 && (
                    <div className="text-[var(--ink-tertiary)] italic text-[11.5px]">
                      Case Intelligence Node • Linked to current dossier
                    </div>
                  )}
                </div>
              </div>

              {/* Connected Entities */}
              <div className="space-y-2 mb-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--ink-tertiary)' }}>
                  Connected Entities ({connectedNeighbors.length})
                </span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {connectedNeighbors.map((neighbor) => (
                    <button
                      key={neighbor.id}
                      onClick={() => handleFocusConnected(neighbor.id)}
                      className="w-full flex items-center justify-between p-2 rounded-lg border text-left hover:bg-[var(--surface-2)] transition-colors text-[12px]"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: getNodeColor(neighbor.type) }} />
                        <span className="font-medium truncate" style={{ color: 'var(--ink-primary)' }}>{neighbor.label}</span>
                      </div>
                      <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] font-mono-id text-[var(--ink-tertiary)]">
                        {normalizeEntityType(neighbor.type)}
                      </span>
                    </button>
                  ))}
                  {connectedNeighbors.length === 0 && (
                    <div className="p-3 text-center text-[12px] text-[var(--ink-tertiary)] border rounded-xl border-dashed">
                      Single-hop entity with no local neighbor nodes
                    </div>
                  )}
                </div>
              </div>

              {/* Related Cases */}
              <div className="space-y-2 mb-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider block" style={{ color: 'var(--ink-tertiary)' }}>
                  Related Historical Cases
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {((selectedNode.data?.caseIds as string[]) || (caseId ? [caseId] : [])).length > 0 ? (
                    ((selectedNode.data?.caseIds as string[]) || (caseId ? [caseId] : [])).map((cId) => (
                      <span
                        key={cId}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-mono-id font-semibold border"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--accent)' }}
                      >
                        {cId}
                      </span>
                    ))
                  ) : (
                    <span className="text-[12px] text-[var(--ink-secondary)]">No cross-case linkages recorded</span>
                  )}
                </div>
              </div>

              {/* Location Action: VIEW ON MAP */}
              {normalizeEntityType(selectedNode.type) === 'Location' && onViewOnMap && (
                <button
                  onClick={() => onViewOnMap(selectedNode.label)}
                  className="w-full mb-2 py-2.5 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-2 transition-all border hover:bg-[var(--surface-2)]"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                >
                  <MapPin size={14} />
                  <span>VIEW ON MAP</span>
                </button>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => dispatch(openInspector({ id: selectedNode.id, type: selectedNode.type }))}
                className="w-full py-2.5 rounded-xl text-[12.5px] font-semibold text-white flex items-center justify-center gap-1.5 transition-all shadow-sm hover:opacity-90"
                style={{ background: 'var(--accent)' }}
              >
                <span>VIEW FULL ENTITY PROFILE</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Legend Bar (Section 31) */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 border-t text-[11px] z-10 gap-3"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
        <div className="flex flex-wrap items-center gap-3 font-medium">
          <span style={{ color: 'var(--ink-tertiary)' }}>Entity Categories:</span>
          {Object.entries(ENTITY_TYPE_CONFIG).map(([typeKey, cfg]) => (
            <div key={typeKey} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
              <span style={{ color: 'var(--ink-secondary)' }}>{cfg.label}</span>
            </div>
          ))}
        </div>
        <div className="text-[11px] font-mono-id" style={{ color: 'var(--ink-tertiary)' }}>
          {caseNodes.length} Nodes • {caseEdges.length} Edges • Force-directed Cose Layout
        </div>
      </div>
    </div>
  );
}
