'use client';

// ============================================================
// The criminal network built by Agent 3 — distinct from the simple
// FIR entity graph. Nodes are laid out in concentric tiers around
// the case so structure reads at a glance; every edge carries its
// relationship label and its evidence basis.
// ============================================================

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Crosshair,
  Search,
  Share2,
  Info,
  Filter,
  Eye,
  Link2,
  FileCheck2,
} from 'lucide-react';
import type { SamanvayaGraphData, SamanvayaGraphEdge, SamanvayaGraphNode } from '@/lib/api/samanvaya';
import { Panel, Badge, EmptyState, ToolButton, ConfidenceBar, SectionHeading } from './primitives';
import { SEVERITY_COLORS, typeStyle, tint } from './theme';

const W = 1040;
const H = 700;
const R = 30;

/** Concentric tiers: case at the centre, people next, then things, then context. */
function layoutNodes(nodes: SamanvayaGraphNode[]) {
  const pos = new Map<string, { x: number; y: number; tier: number }>();
  const cx = W / 2;
  const cy = H / 2;

  const tiers: SamanvayaGraphNode[][] = [[], [], [], []];
  nodes.forEach((n) => {
    const c = (n.category || '').toUpperCase();
    if (c === 'CASE') tiers[0].push(n);
    else if (c === 'PERSON' || c === 'ORGANIZATION') tiers[1].push(n);
    else if (c === 'PHONE' || c === 'VEHICLE' || c === 'LOCATION') tiers[2].push(n);
    else tiers[3].push(n);
  });

  const radii = [0, 165, 290, 400];
  const offsets = [0, -Math.PI / 2, -Math.PI / 3, -Math.PI / 5];

  tiers.forEach((group, tier) => {
    if (tier === 0) {
      group.forEach((n, i) => {
        pos.set(n.id, { x: cx + (i - (group.length - 1) / 2) * 70, y: cy, tier });
      });
      return;
    }
    group.forEach((n, i) => {
      const angle = (i / Math.max(group.length, 1)) * 2 * Math.PI + offsets[tier];
      pos.set(n.id, {
        x: cx + radii[tier] * Math.cos(angle),
        y: cy + radii[tier] * Math.sin(angle) * 0.78,
        tier,
      });
    });
  });

  return pos;
}

export default function InvestigationNetwork({ data }: { data: SamanvayaGraphData | null }) {
  const [zoom, setZoom] = useState(0.82);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0 });
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [relType, setRelType] = useState('ALL');
  const [selectedNode, setSelectedNode] = useState<SamanvayaGraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<SamanvayaGraphEdge | null>(null);
  const [focusMode, setFocusMode] = useState(false);

  // Memoised so the derived filters below do not recompute on every render.
  const nodes = useMemo(() => data?.nodes || [], [data]);
  const edges = useMemo(() => data?.edges || [], [data]);

  const positions = useMemo(() => layoutNodes(nodes), [nodes]);

  const categories = useMemo(
    () => Array.from(new Set(nodes.map((n) => (n.category || '').toUpperCase()))).sort(),
    [nodes]
  );
  const relationships = useMemo(
    () => Array.from(new Set(edges.map((e) => (e.relationshipType || '').toUpperCase()))).sort(),
    [edges]
  );

  // Neighbours of the selected node, used by focus mode.
  const neighbourIds = useMemo(() => {
    if (!selectedNode) return null;
    const set = new Set<string>([selectedNode.id]);
    edges.forEach((e) => {
      if (e.source === selectedNode.id) set.add(e.target);
      if (e.target === selectedNode.id) set.add(e.source);
    });
    return set;
  }, [selectedNode, edges]);

  const visibleNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nodes.filter((n) => {
      if (category !== 'ALL' && (n.category || '').toUpperCase() !== category) return false;
      if (focusMode && neighbourIds && !neighbourIds.has(n.id)) return false;
      if (q && ![n.name, n.label, n.category].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [nodes, category, query, focusMode, neighbourIds]);

  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(
    () =>
      edges.filter((e) => {
        if (relType !== 'ALL' && (e.relationshipType || '').toUpperCase() !== relType) return false;
        return visibleIds.has(e.source) && visibleIds.has(e.target);
      }),
    [edges, relType, visibleIds]
  );

  const reset = useCallback(() => {
    setZoom(0.82);
    setPan({ x: 0, y: 0 });
    setQuery('');
    setCategory('ALL');
    setRelType('ALL');
    setFocusMode(false);
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  if (!data || nodes.length === 0) {
    return (
      <Panel>
        <EmptyState
          icon={Share2}
          accent="#4F46E5"
          title="No investigation network yet"
          message="Agent 3 builds the criminal network from resolved entities, stored relationships and any uploaded call records. Run the SAMANVAYA analysis to generate it."
        />
      </Panel>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      <div className="xl:col-span-8">
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
        >
          {/* Controls */}
          <div className="px-4 py-3 border-b space-y-2.5" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[170px]">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-tertiary)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search nodes…"
                  aria-label="Search network nodes"
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg text-[12px] border outline-none transition-colors focus:border-[var(--accent)]"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--border-strong)', color: 'var(--ink-primary)' }}
                />
              </div>
              <ToolButton
                icon={Eye}
                label={focusMode ? 'Show all' : 'Focus selection'}
                onClick={() => setFocusMode((v) => !v)}
                active={focusMode}
                disabled={!selectedNode}
                title={selectedNode ? 'Show only the selected node and its direct links' : 'Select a node first'}
              />
              <ToolButton icon={ZoomOut} onClick={() => setZoom((z) => Math.max(0.35, z - 0.12))} title="Zoom out" />
              <span className="text-[11px] font-mono tabular-nums w-[42px] text-center text-[var(--ink-tertiary)]">
                {Math.round(zoom * 100)}%
              </span>
              <ToolButton icon={ZoomIn} onClick={() => setZoom((z) => Math.min(2.2, z + 0.12))} title="Zoom in" />
              <ToolButton icon={Crosshair} onClick={reset} title="Reset view" />
            </div>

            {/* Category filters */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Filter size={12} className="text-[var(--ink-tertiary)]" />
              <FilterChip
                label={`All nodes (${nodes.length})`}
                color="#4F46E5"
                active={category === 'ALL'}
                onClick={() => setCategory('ALL')}
              />
              {categories.map((c) => {
                const s = typeStyle(c);
                const n = nodes.filter((x) => (x.category || '').toUpperCase() === c).length;
                return (
                  <FilterChip
                    key={c}
                    label={`${s.label} (${n})`}
                    color={s.color}
                    active={category === c}
                    onClick={() => setCategory(category === c ? 'ALL' : c)}
                  />
                );
              })}
            </div>

            {/* Relationship filters */}
            {relationships.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Link2 size={12} className="text-[var(--ink-tertiary)]" />
                <FilterChip
                  label={`All links (${edges.length})`}
                  color="#0891B2"
                  active={relType === 'ALL'}
                  onClick={() => setRelType('ALL')}
                />
                {relationships.map((r) => {
                  const n = edges.filter((e) => (e.relationshipType || '').toUpperCase() === r).length;
                  return (
                    <FilterChip
                      key={r}
                      label={`${r.replace(/_/g, ' ')} (${n})`}
                      color="#0891B2"
                      active={relType === r}
                      onClick={() => setRelType(relType === r ? 'ALL' : r)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Canvas */}
          <div
            onMouseDown={(e) => {
              if ((e.target as SVGElement).dataset?.nodeHit) return;
              setDragging(true);
              dragOrigin.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
            }}
            onMouseMove={(e) => dragging && setPan({ x: e.clientX - dragOrigin.current.x, y: e.clientY - dragOrigin.current.y })}
            onMouseUp={() => setDragging(false)}
            onMouseLeave={() => setDragging(false)}
            onWheel={(e) => {
              if (!e.ctrlKey && !e.metaKey) return;
              e.preventDefault();
              setZoom((z) => Math.min(2.2, Math.max(0.35, z - e.deltaY * 0.0013)));
            }}
            className="relative overflow-hidden select-none"
            style={{
              height: 640,
              cursor: dragging ? 'grabbing' : 'grab',
              background:
                'radial-gradient(circle at 1px 1px, var(--border-strong) 1px, transparent 0) 0 0 / 28px 28px, var(--surface-2)',
            }}
          >
            <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
              <defs>
                <marker id="net-arrow" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill="var(--ink-tertiary)" />
                </marker>
              </defs>

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom}) translate(${(W * (1 - zoom)) / (2 * zoom)}, ${(H * (1 - zoom)) / (2 * zoom)})`}>
                {/* Edges */}
                {visibleEdges.map((e) => {
                  const a = positions.get(e.source);
                  const b = positions.get(e.target);
                  if (!a || !b) return null;
                  const active = selectedEdge?.id === e.id;
                  const touched =
                    selectedNode && (e.source === selectedNode.id || e.target === selectedNode.id);
                  const stroke = active || touched ? SEVERITY_COLORS[e.importance] || '#4F46E5' : 'var(--ink-tertiary)';
                  const mx = (a.x + b.x) / 2;
                  const my = (a.y + b.y) / 2;

                  return (
                    <g key={e.id}>
                      <line
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={stroke}
                        strokeWidth={active || touched ? 3 : 1.8}
                        strokeOpacity={selectedNode && !touched ? 0.22 : 0.72}
                        markerEnd="url(#net-arrow)"
                        className="cursor-pointer"
                        data-node-hit="1"
                        onClick={() => {
                          setSelectedEdge(e);
                          setSelectedNode(null);
                        }}
                      />
                      {(active || touched || visibleEdges.length <= 26) && (
                        <text
                          x={mx}
                          y={my - 5}
                          textAnchor="middle"
                          className="pointer-events-none"
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            fill: stroke,
                            paintOrder: 'stroke',
                            stroke: 'var(--surface-2)',
                            strokeWidth: 3,
                            strokeLinejoin: 'round',
                          }}
                        >
                          {e.label || e.relationshipType.replace(/_/g, ' ')}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Nodes */}
                {visibleNodes.map((n) => {
                  const p = positions.get(n.id);
                  if (!p) return null;
                  const s = typeStyle(n.category);
                  const isCase = (n.category || '').toUpperCase() === 'CASE';
                  const r = isCase ? R + 12 : n.importance === 'CRITICAL' ? R + 5 : R;
                  const active = selectedNode?.id === n.id;
                  const dim = selectedNode && neighbourIds && !neighbourIds.has(n.id);

                  return (
                    <g
                      key={n.id}
                      transform={`translate(${p.x}, ${p.y})`}
                      className="cursor-pointer"
                      opacity={dim ? 0.28 : 1}
                      onClick={() => {
                        setSelectedNode(n);
                        setSelectedEdge(null);
                      }}
                      data-node-hit="1"
                    >
                      {active && <circle r={r + 8} fill="none" stroke={s.color} strokeWidth={2} strokeOpacity={0.5} />}
                      <circle
                        r={r}
                        fill={s.color}
                        stroke="var(--surface-1)"
                        strokeWidth={3}
                        data-node-hit="1"
                      />
                      <text
                        y={4}
                        textAnchor="middle"
                        style={{ fontSize: isCase ? 12 : 10, fontWeight: 800, fill: '#FFFFFF', pointerEvents: 'none' }}
                      >
                        {initials(n.name)}
                      </text>
                      <text
                        y={r + 15}
                        textAnchor="middle"
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          fill: 'var(--ink-primary)',
                          paintOrder: 'stroke',
                          stroke: 'var(--surface-2)',
                          strokeWidth: 3.5,
                          strokeLinejoin: 'round',
                          pointerEvents: 'none',
                        }}
                      >
                        {truncate(n.name, 22)}
                      </text>
                      <text
                        y={r + 27}
                        textAnchor="middle"
                        style={{
                          fontSize: 8.5,
                          fontWeight: 700,
                          fill: s.color,
                          letterSpacing: 0.4,
                          paintOrder: 'stroke',
                          stroke: 'var(--surface-2)',
                          strokeWidth: 3,
                          strokeLinejoin: 'round',
                          pointerEvents: 'none',
                        }}
                      >
                        {(n.label || s.label).toUpperCase().slice(0, 24)}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          <div
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t text-[11px] text-[var(--ink-tertiary)]"
            style={{ borderColor: 'var(--border)' }}
          >
            <span>
              {visibleNodes.length}/{nodes.length} nodes · {visibleEdges.length}/{edges.length} relationships
            </span>
            <span>Drag to pan · Ctrl + scroll to zoom · click a node or link to inspect</span>
          </div>
        </div>
      </div>

      {/* Inspector */}
      <div className="xl:col-span-4">
        <NetworkInspector
          node={selectedNode}
          edge={selectedEdge}
          edges={edges}
          nodes={nodes}
          onSelectNode={(n) => {
            setSelectedNode(n);
            setSelectedEdge(null);
          }}
        />
      </div>
    </div>
  );
}

function FilterChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border cursor-pointer transition-colors whitespace-nowrap"
      style={{
        background: active ? tint(color, 0.14) : 'transparent',
        borderColor: active ? color : 'var(--border-strong)',
        color: active ? color : 'var(--ink-tertiary)',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </button>
  );
}

function NetworkInspector({
  node,
  edge,
  edges,
  nodes,
  onSelectNode,
}: {
  node: SamanvayaGraphNode | null;
  edge: SamanvayaGraphEdge | null;
  edges: SamanvayaGraphEdge[];
  nodes: SamanvayaGraphNode[];
  onSelectNode: (n: SamanvayaGraphNode) => void;
}) {
  if (edge) {
    const c = SEVERITY_COLORS[edge.importance] || '#4F46E5';
    const src = nodes.find((n) => n.id === edge.source);
    const tgt = nodes.find((n) => n.id === edge.target);
    return (
      <Panel accent={c} className="sticky top-5">
        <SectionHeading icon={Link2} title="Relationship" subtitle={edge.relationshipType.replace(/_/g, ' ')} accent={c} />
        <div className="mt-4 space-y-2">
          {[src, tgt].map((n, i) =>
            n ? (
              <button
                key={n.id}
                onClick={() => onSelectNode(n)}
                className="w-full text-left rounded-lg px-3 py-2 cursor-pointer transition-colors hover:bg-[var(--surface-3)]"
                style={{ background: 'var(--surface-2)' }}
              >
                <div className="text-[9.5px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)]">
                  {i === 0 ? 'From' : 'To'}
                </div>
                <div className="text-[12.5px] font-semibold text-[var(--ink-primary)] truncate">{n.name}</div>
              </button>
            ) : null
          )}
        </div>
        <div className="mt-4">
          <ConfidenceBar value={edge.confidence} color={c} label="Relationship confidence" />
        </div>
        <div className="mt-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)] flex items-center gap-1.5 mb-2">
            <FileCheck2 size={11} /> Evidence basis
          </div>
          <div className="flex flex-wrap gap-1.5">
            {edge.evidence.map((e, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md text-[10.5px] font-mono border"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      </Panel>
    );
  }

  if (!node) {
    return (
      <Panel className="sticky top-5">
        <EmptyState
          icon={Info}
          title="Select a node or relationship"
          message="Click any node to see its connections, confidence and metadata, or click a link to inspect the evidence behind it."
        />
      </Panel>
    );
  }

  const s = typeStyle(node.category);
  const Icon = s.icon;
  const connections = edges.filter((e) => e.source === node.id || e.target === node.id);

  return (
    <Panel accent={s.color} className="sticky top-5">
      <div className="flex items-start gap-3">
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white"
          style={{ background: s.color }}
        >
          <Icon size={19} />
        </span>
        <div className="min-w-0">
          <h4 className="text-[15px] font-bold text-[var(--ink-primary)] leading-snug break-words">{node.name}</h4>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <Badge color={s.color}>{node.label || s.label}</Badge>
            <Badge color={SEVERITY_COLORS[node.importance] || '#64748B'}>{node.importance}</Badge>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <ConfidenceBar value={node.confidence} color={s.color} label="Entity confidence" />
      </div>

      {node.metadata && Object.keys(node.metadata).length > 0 && (
        <dl className="mt-4 space-y-1.5">
          {Object.entries(node.metadata)
            .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
            .slice(0, 8)
            .map(([k, v]) => (
              <div
                key={k}
                className="flex items-start justify-between gap-3 rounded-lg px-3 py-1.5"
                style={{ background: 'var(--surface-2)' }}
              >
                <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--ink-tertiary)] shrink-0">
                  {k.replace(/_/g, ' ')}
                </dt>
                <dd className="text-[11.5px] font-semibold text-[var(--ink-primary)] text-right break-words min-w-0">
                  {String(v)}
                </dd>
              </div>
            ))}
        </dl>
      )}

      <div className="mt-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)] mb-2">
          Connections ({connections.length})
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
          {connections.map((e) => {
            const otherId = e.source === node.id ? e.target : e.source;
            const other = nodes.find((n) => n.id === otherId);
            const os = typeStyle(other?.category);
            return (
              <button
                key={e.id}
                onClick={() => other && onSelectNode(other)}
                className="w-full text-left rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: os.color }} />
                  <span className="text-[11.5px] font-semibold text-[var(--ink-primary)] truncate flex-1">
                    {other?.name || otherId}
                  </span>
                </div>
                <div className="text-[9.5px] font-bold uppercase tracking-wide pl-3.5" style={{ color: '#0891B2' }}>
                  {e.source === node.id ? '→' : '←'} {e.relationshipType.replace(/_/g, ' ')}
                </div>
              </button>
            );
          })}
          {connections.length === 0 && (
            <p className="text-[11.5px] text-[var(--ink-tertiary)]">No relationships recorded for this node.</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

const initials = (name: string) =>
  (name || '?')
    .split(/[\s\-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';

const truncate = (s: string, n: number) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');
