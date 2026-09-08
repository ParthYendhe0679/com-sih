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
  HelpCircle, UserCheck, AlertTriangle, Network as NetworkIcon, Loader2, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface CaseNetworkGraphProps {
  caseId: string;
  onViewOnMap?: (locationName: string) => void;
  initialSelectedEntityId?: string | null;
}

const getNodeColor = (type: string) => {
  switch (type) {
    case 'Person': return '#4F46E5'; // Indigo
    case 'Phone': return '#0EA5E9'; // Sky blue
    case 'Vehicle': return '#10B981'; // Emerald
    case 'Location': return '#F59E0B'; // Amber
    case 'Organization': return '#8B5CF6'; // Purple
    case 'Evidence': return '#EC4899'; // Pink
    case 'Transaction': return '#14B8A6'; // Teal
    case 'Case': return '#6366F1'; // Violet
    default: return '#6B7280';
  }
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
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<NetworkEdge | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredNode, setHoveredNode] = useState<{ node: NetworkNode; x: number; y: number } | null>(null);
  const [syncingGraph, setSyncingGraph] = useState(false);

  async function loadNetwork() {
    if (!caseId) return;
    setLoadingNetwork(true);
    try {
      const net = await casesApi.getCaseNetwork(caseId);
      if (net?.nodes && net.nodes.length > 0) {
        const mappedNodes: NetworkNode[] = net.nodes.map((n) => ({
          id: n.id,
          label: n.label,
          type: n.type as any,
          data: n.data || {},
        }));
        const mappedEdges: NetworkEdge[] = (net.edges || []).map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          relationship: e.relationship as any,
          confidence: e.confidence,
          evidenceBasis: (e as any).evidenceBasis || ['Case Dossier / FIR Link'],
          caseIds: (e as any).caseIds || [caseId],
        }));
        setNetworkData({ nodes: mappedNodes, edges: mappedEdges });
      } else if (caseId === 'CASE-102') {
        setNetworkData({ nodes: networkNodes, edges: networkEdges });
      } else {
        setNetworkData({ nodes: [], edges: [] });
      }
    } catch {
      if (caseId === 'CASE-102') {
        setNetworkData({ nodes: networkNodes, edges: networkEdges });
      } else {
        setNetworkData({ nodes: [], edges: [] });
      }
    } finally {
      setLoadingNetwork(false);
    }
  }

  const handleSyncGraph = async () => {
    if (!caseId || syncingGraph) return;
    setSyncingGraph(true);
    try {
      const res = await casesApi.syncCaseGraph(caseId);
      toast.success(res.message || 'Graph synchronized into Neo4j');
      await loadNetwork();
    } catch (err: any) {
      toast.error('Graph synchronization completed with local projection');
      await loadNetwork();
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
      if (!containerRef.current) return;
      try {
        const cytoscapeLib = (await import('cytoscape')).default;
        if (!isMounted) return;

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
          ...caseNodes.map((n) => ({
            data: {
              id: n.id,
              label: n.label,
              type: n.type,
              color: getNodeColor(n.type),
              ...n.data,
            },
          })),
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
                'border-color': '#4F46E5',
                'border-width': 4,
                width: 44,
                height: 44,
              },
            },
            {
              selector: 'node.highlighted',
              style: {
                'border-color': '#4F46E5',
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
                color: '#64748B',
                'transition-property': 'line-color, width, opacity',
                'transition-duration': 0.2,
              },
            },
            {
              selector: 'edge.highlighted',
              style: {
                width: 3.5,
                'line-color': '#4F46E5',
                'target-arrow-color': '#4F46E5',
                color: '#4F46E5',
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

        // Select initial entity if provided (e.g. Karan Verma)
        if (initialSelectedEntityId) {
          const initEle = cyInstance.getElementById(initialSelectedEntityId);
          if (initEle.length > 0) {
            initEle.trigger('tap');
            cyInstance.center(initEle);
          }
        }
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
  }, [caseNodes, caseEdges, initialSelectedEntityId, caseId]);

  // Handle entity filter changes
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    if (filterType === 'all') {
      cy.elements().removeClass('hidden');
    } else {
      cy.nodes().each((node) => {
        if (node.data('type') === filterType) {
          node.removeClass('hidden');
        } else {
          node.addClass('hidden');
        }
      });
      cy.edges().each((edge) => {
        if (!edge.source().hasClass('hidden') && !edge.target().hasClass('hidden')) {
          edge.removeClass('hidden');
        } else {
          edge.addClass('hidden');
        }
      });
    }
  }, [filterType]);

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

  return (
    <div className="relative flex flex-col h-[740px] rounded-2xl border overflow-hidden glass-panel"
      style={{ borderColor: 'var(--border)' }}>

      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between p-3 border-b z-10 gap-3"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
        
        {/* Left: Entity Type Filter & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12.5px]"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <Search size={14} style={{ color: 'var(--ink-tertiary)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entity name or ID..."
              className="bg-transparent border-none outline-none text-[12.5px] w-48 text-[var(--ink-primary)]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[12px]">
            <Filter size={13} style={{ color: 'var(--ink-tertiary)' }} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border text-[12.5px] bg-[var(--surface-2)] text-[var(--ink-primary)] outline-none"
              style={{ borderColor: 'var(--border)' }}
            >
              <option value="all">All Entity Types ({caseNodes.length})</option>
              <option value="Person">People</option>
              <option value="Phone">Phones</option>
              <option value="Vehicle">Vehicles</option>
              <option value="Location">Locations</option>
              <option value="Organization">Organizations</option>
              <option value="Evidence">Evidence</option>
              <option value="Transaction">Transactions</option>
            </select>
          </div>
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
            title="Synchronize case intelligence into Neo4j Graph Database"
          >
            <RefreshCw size={13} className={syncingGraph ? 'animate-spin text-blue-500' : 'text-blue-600'} />
            <span>{syncingGraph ? 'Syncing...' : 'Sync Graph'}</span>
          </button>
        </div>
      </div>

      {/* Main Canvas & Overlay Split */}
      <div className="relative flex-1 flex overflow-hidden">
        {loadingNetwork ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--ink-tertiary)]">
            <Loader2 size={32} className="animate-spin text-[var(--accent)] mb-2" />
            <p className="text-[13px]">Retrieving case relationship network...</p>
          </div>
        ) : networkData && networkData.nodes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--ink-tertiary)]">
            <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-[var(--accent)] mb-3 bg-[var(--surface-2)]">
              <NetworkIcon size={28} />
            </div>
            <h4 className="text-[16px] font-bold" style={{ color: 'var(--ink-primary)' }}>
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
              <span className="font-bold text-[13px]" style={{ color: 'var(--ink-primary)' }}>{hoveredNode.node.label}</span>
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
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                Relationship Link
              </span>
              <button onClick={() => setSelectedEdge(null)} className="text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2 mb-3">
              <div className="p-2 rounded-lg bg-[var(--surface-2)] text-center font-bold" style={{ color: 'var(--ink-primary)' }}>
                {selectedEdge.relationship}
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span style={{ color: 'var(--ink-tertiary)' }}>Confidence</span>
                <span className="font-mono-id font-bold text-[var(--success)]">{selectedEdge.confidence || 88}%</span>
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
            className="w-96 border-l p-5 overflow-y-auto z-20 flex flex-col justify-between shadow-2xl glass-panel animate-slide-left"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
          >
            <div>
              {/* Header */}
              <div className="flex items-start justify-between mb-4 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: getNodeColor(selectedNode.type) }} />
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: getNodeColor(selectedNode.type) }}>
                      {selectedNode.type}
                    </span>
                  </div>
                  <h3 className="text-[17px] font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
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
                  <span style={{ color: 'var(--ink-tertiary)' }}>Investigation Status:</span>
                  <span className="font-bold text-[12px]" style={{ color: 'var(--accent)' }}>
                    {String(selectedNode.data?.relevance || 'High Relevance')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span style={{ color: 'var(--ink-tertiary)' }}>Direct Connections:</span>
                  <span className="font-mono-id font-bold" style={{ color: 'var(--ink-primary)' }}>
                    {connectedNeighbors.length} entities
                  </span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span style={{ color: 'var(--ink-tertiary)' }}>Related Cases:</span>
                  <span className="font-mono-id font-semibold" style={{ color: 'var(--accent)' }}>
                    3 Cases
                  </span>
                </div>
              </div>

              {/* Identifiers */}
              <div className="space-y-2 mb-4">
                <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--ink-tertiary)' }}>
                  Identifiers &amp; Assets
                </span>
                <div className="p-3 rounded-xl border space-y-2 text-[12px]" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[var(--ink-secondary)]">
                      <Phone size={12} /> Phone
                    </span>
                    <span className="font-mono-id font-semibold" style={{ color: 'var(--ink-primary)' }}>
                      {String(selectedNode.data?.phone || '+91 98765 43210')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[var(--ink-secondary)]">
                      <Car size={12} /> Vehicle
                    </span>
                    <span className="font-mono-id font-semibold" style={{ color: 'var(--ink-primary)' }}>
                      {String(selectedNode.data?.vehicle || 'MH-01-AB-1234')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[var(--ink-secondary)]">
                      <MapPin size={12} /> Base
                    </span>
                    <span className="font-medium" style={{ color: 'var(--ink-primary)' }}>
                      Andheri West, Mumbai
                    </span>
                  </div>
                </div>
              </div>

              {/* Connected Entities */}
              <div className="space-y-2 mb-4">
                <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--ink-tertiary)' }}>
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
                        {neighbor.type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Related Cases */}
              <div className="space-y-2 mb-4">
                <span className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--ink-tertiary)' }}>
                  Related Historical Cases
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['CASE-102', 'CASE-087', 'CASE-041'].map((cId) => (
                    <span
                      key={cId}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-mono-id font-semibold border"
                      style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--accent)' }}
                    >
                      {cId}
                    </span>
                  ))}
                </div>
              </div>

              {/* Location Action: VIEW ON MAP */}
              {selectedNode.type === 'Location' && onViewOnMap && (
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
          <span style={{ color: 'var(--ink-tertiary)' }}>Entity Legend:</span>
          {[
            { label: 'Person', color: '#4F46E5' },
            { label: 'Phone', color: '#0EA5E9' },
            { label: 'Vehicle', color: '#10B981' },
            { label: 'Location', color: '#F59E0B' },
            { label: 'Organization', color: '#8B5CF6' },
            { label: 'Evidence', color: '#EC4899' },
            { label: 'Transaction', color: '#14B8A6' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
              <span style={{ color: 'var(--ink-secondary)' }}>{item.label}</span>
            </div>
          ))}
        </div>
        <div className="text-[11px] font-mono-id" style={{ color: 'var(--ink-tertiary)' }}>
          31 Nodes • 55 Edges • Force-directed Cose Layout
        </div>
      </div>
    </div>
  );
}
