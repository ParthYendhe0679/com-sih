'use client';

// ============================================================
// The investigation tree, drawn as an actual tree.
//
// Nodes are HTML cards on an absolutely-positioned layer so they can
// carry icons, badges and confidence bars; the connectors beneath them
// are SVG curves on a shared transform, so pan and zoom move both
// layers together. Layout is a tidy top-down algorithm: leaves are laid
// out left to right, every parent is centred over its own children.
// ============================================================

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Crosshair,
  Search,
  Layers,
  ChevronRight,
  Link2,
  FileCheck2,
  Bot,
} from 'lucide-react';
import type { InvestigationTreeData, InvestigationTreeNode } from '@/lib/api/samanvaya';
import { Panel, Badge, EmptyState, ToolButton, ConfidenceBar } from './primitives';
import { SEVERITY_COLORS, typeStyle, tint } from './theme';

const NODE_W = 198;
const NODE_H = 76;
const H_GAP = 22;
const V_GAP = 96;

interface Positioned {
  node: InvestigationTreeNode;
  x: number;
  y: number;
  depth: number;
  parentId: string | null;
  hasChildren: boolean;
  childCount: number;
}

/** Tidy top-down layout: leaves are packed left to right, parents centred above. */
function layout(
  root: InvestigationTreeNode,
  collapsed: Set<string>,
  matches: Set<string> | null
): { nodes: Positioned[]; width: number; height: number } {
  const out: Positioned[] = [];
  let cursor = 0;
  let maxDepth = 0;

  const visibleChildren = (n: InvestigationTreeNode): InvestigationTreeNode[] => {
    if (collapsed.has(n.id)) return [];
    const kids = n.children || [];
    if (!matches) return kids;
    return kids.filter((k) => subtreeMatches(k, matches));
  };

  const subtreeMatches = (n: InvestigationTreeNode, m: Set<string>): boolean => {
    if (m.has(n.id)) return true;
    return (n.children || []).some((c) => subtreeMatches(c, m));
  };

  const walk = (n: InvestigationTreeNode, depth: number, parentId: string | null): number => {
    maxDepth = Math.max(maxDepth, depth);
    const kids = visibleChildren(n);
    let x: number;

    if (kids.length === 0) {
      x = cursor;
      cursor += NODE_W + H_GAP;
    } else {
      const centres = kids.map((k) => walk(k, depth + 1, n.id));
      x = (centres[0] + centres[centres.length - 1]) / 2;
    }

    out.push({
      node: n,
      x,
      y: depth * (NODE_H + V_GAP),
      depth,
      parentId,
      hasChildren: (n.children || []).length > 0,
      childCount: (n.children || []).length,
    });
    return x;
  };

  walk(root, 0, null);

  const width = Math.max(cursor, NODE_W) + H_GAP;
  const height = (maxDepth + 1) * (NODE_H + V_GAP);
  return { nodes: out, width, height };
}

function collectIds(n: InvestigationTreeNode, acc: string[] = []): string[] {
  acc.push(n.id);
  (n.children || []).forEach((c) => collectIds(c, acc));
  return acc;
}

function collectBranchIds(n: InvestigationTreeNode, acc: string[] = []): string[] {
  if ((n.children || []).length > 0) acc.push(n.id);
  (n.children || []).forEach((c) => collectBranchIds(c, acc));
  return acc;
}

export default function InvestigationTreeCanvas({ data }: { data: InvestigationTreeData | null }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0 });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<InvestigationTreeNode | null>(null);
  const [query, setQuery] = useState('');

  const root = data?.root || null;

  // Reset the view when a different tree arrives. Adjusting state during render
  // (React's documented pattern for deriving from a changed prop) avoids the
  // extra commit an effect would cause on every tree swap.
  const [seenRootId, setSeenRootId] = useState<string | null>(null);
  if (root && root.id !== seenRootId) {
    // Start with the third level collapsed so the shape of the case reads first.
    const initial = new Set<string>();
    (root.children || []).forEach((branch) => {
      (branch.children || []).forEach((leaf) => {
        if ((leaf.children || []).length) initial.add(leaf.id);
      });
    });
    setSeenRootId(root.id);
    setCollapsed(initial);
    setSelected(root);
    setPan({ x: 0, y: 0 });
    setZoom(0.85);
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !root) return null;
    const found = new Set<string>();
    const walk = (n: InvestigationTreeNode) => {
      const hay = [n.name, n.subtitle, n.details, n.badge, n.type].filter(Boolean).join(' ').toLowerCase();
      if (hay.includes(q)) found.add(n.id);
      (n.children || []).forEach(walk);
    };
    walk(root);
    return found;
  }, [query, root]);

  const { nodes, width, height } = useMemo(() => {
    if (!root) return { nodes: [] as Positioned[], width: 0, height: 0 };
    return layout(root, collapsed, matches);
  }, [root, collapsed, matches]);

  const positionById = useMemo(() => {
    const m = new Map<string, Positioned>();
    nodes.forEach((p) => m.set(p.node.id, p));
    return m;
  }, [nodes]);

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsed(new Set()), []);
  const collapseAll = useCallback(() => {
    if (!root) return;
    const branches = collectBranchIds(root).filter((id) => id !== root.id);
    setCollapsed(new Set(branches));
  }, [root]);

  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(0.85);
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom((z) => Math.min(1.8, Math.max(0.3, z - e.deltaY * 0.0015)));
  }, []);

  if (!root) {
    return (
      <Panel>
        <EmptyState
          icon={Layers}
          title="No investigation tree yet"
          message="The hierarchical tree is built from the agents' output. Run the SAMANVAYA analysis to decompose this case into suspects, locations, communications, evidence and leads."
        />
      </Panel>
    );
  }

  const totalNodes = collectIds(root).length;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* ── Canvas ────────────────────────────────────── */}
      <div className="xl:col-span-8">
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-card)' }}
        >
          {/* Toolbar */}
          <div
            className="flex flex-wrap items-center gap-2 px-4 py-3 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-tertiary)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the tree…"
                aria-label="Search investigation tree"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-[12px] border outline-none transition-colors focus:border-[var(--accent)]"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--ink-primary)',
                }}
              />
            </div>
            <ToolButton icon={Maximize2} label="Expand all" onClick={expandAll} />
            <ToolButton icon={Minimize2} label="Collapse" onClick={collapseAll} />
            <ToolButton icon={ZoomOut} onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))} title="Zoom out" />
            <span className="text-[11px] font-mono tabular-nums w-[42px] text-center text-[var(--ink-tertiary)]">
              {Math.round(zoom * 100)}%
            </span>
            <ToolButton icon={ZoomIn} onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))} title="Zoom in" />
            <ToolButton icon={Crosshair} onClick={resetView} title="Reset view" />
          </div>

          {/* Viewport */}
          <div
            ref={viewportRef}
            onWheel={onWheel}
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).closest('[data-tree-node]')) return;
              setDragging(true);
              dragOrigin.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
            }}
            onMouseMove={(e) => {
              if (!dragging) return;
              setPan({ x: e.clientX - dragOrigin.current.x, y: e.clientY - dragOrigin.current.y });
            }}
            onMouseUp={() => setDragging(false)}
            onMouseLeave={() => setDragging(false)}
            className="relative overflow-hidden select-none"
            style={{
              height: 620,
              cursor: dragging ? 'grabbing' : 'grab',
              background:
                'radial-gradient(circle at 1px 1px, var(--border-strong) 1px, transparent 0) 0 0 / 26px 26px, var(--surface-2)',
            }}
          >
            <div
              className="absolute origin-top-left"
              style={{
                transform: `translate(${pan.x + 40}px, ${pan.y + 32}px) scale(${zoom})`,
                width,
                height,
                transition: dragging ? 'none' : 'transform 180ms ease-out',
              }}
            >
              {/* Connectors */}
              <svg
                width={width}
                height={height}
                className="absolute inset-0 pointer-events-none overflow-visible"
                aria-hidden
              >
                {nodes.map((p) => {
                  if (!p.parentId) return null;
                  const parent = positionById.get(p.parentId);
                  if (!parent) return null;
                  const style = typeStyle(p.node.type === 'branch' ? p.node.type : p.node.type);
                  const x1 = parent.x + NODE_W / 2;
                  const y1 = parent.y + NODE_H;
                  const x2 = p.x + NODE_W / 2;
                  const y2 = p.y;
                  const mid = y1 + (y2 - y1) / 2;
                  const dimmed = matches ? !matches.has(p.node.id) : false;
                  return (
                    <path
                      key={`edge-${p.node.id}`}
                      d={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}
                      fill="none"
                      stroke={style.color}
                      strokeWidth={p.depth <= 1 ? 2.6 : 2}
                      strokeOpacity={dimmed ? 0.2 : 0.62}
                      strokeLinecap="round"
                    />
                  );
                })}
              </svg>

              {/* Node cards */}
              {nodes.map((p) => (
                <TreeNodeCard
                  key={p.node.id}
                  pos={p}
                  selected={selected?.id === p.node.id}
                  dimmed={matches ? !matches.has(p.node.id) : false}
                  collapsed={collapsed.has(p.node.id)}
                  onSelect={() => setSelected(p.node)}
                  onToggle={() => toggle(p.node.id)}
                />
              ))}
            </div>

            {/* Legend */}
            <div
              className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border max-w-[calc(100%-24px)]"
              style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
            >
              {['case', 'suspect', 'phone', 'location', 'vehicle', 'financial', 'evidence', 'historical', 'lead'].map(
                (t) => {
                  const s = typeStyle(t);
                  return (
                    <span key={t} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--ink-secondary)]">
                      <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: s.color }} />
                      {s.label}
                    </span>
                  );
                }
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t text-[11px] text-[var(--ink-tertiary)]"
            style={{ borderColor: 'var(--border)' }}
          >
            <span>
              {nodes.length} of {totalNodes} nodes shown
              {matches ? ` · ${matches.size} match “${query}”` : ''}
            </span>
            <span>Drag to pan · Ctrl + scroll to zoom · click a node to inspect</span>
          </div>
        </div>
      </div>

      {/* ── Node inspector ────────────────────────────── */}
      <div className="xl:col-span-4">
        <NodeInspector node={selected} onNavigate={setSelected} />
      </div>
    </div>
  );
}

// ── Node card ───────────────────────────────────────────────
function TreeNodeCard({
  pos,
  selected,
  dimmed,
  collapsed,
  onSelect,
  onToggle,
}: {
  pos: Positioned;
  selected: boolean;
  dimmed: boolean;
  collapsed: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const { node } = pos;
  const style = typeStyle(node.type);
  const severity = node.severity ? SEVERITY_COLORS[node.severity] : null;
  const accent = severity || style.color;
  const Icon = style.icon;

  return (
    <div
      data-tree-node
      className="absolute rounded-xl border transition-all"
      style={{
        left: pos.x,
        top: pos.y,
        width: NODE_W,
        minHeight: NODE_H,
        background: 'var(--surface-1)',
        borderColor: selected ? accent : tint(accent, 0.42),
        borderLeft: `4px solid ${accent}`,
        boxShadow: selected ? `0 0 0 2px ${tint(accent, 0.4)}, var(--shadow-card-hover)` : 'var(--shadow-card)',
        opacity: dimmed ? 0.32 : 1,
      }}
    >
      <button
        onClick={onSelect}
        className="w-full text-left px-2.5 py-2 cursor-pointer"
        aria-pressed={selected}
      >
        <div className="flex items-start gap-2">
          <span
            className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: tint(accent, 0.14), color: accent }}
          >
            <Icon size={13} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold text-[var(--ink-primary)] leading-tight line-clamp-2">
              {node.name}
            </div>
            {node.subtitle && (
              <div className="text-[10px] font-semibold uppercase tracking-wide mt-0.5 truncate" style={{ color: accent }}>
                {node.subtitle}
              </div>
            )}
          </div>
          {node.badge && (
            <span
              className="shrink-0 px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase"
              style={{ background: tint(accent, 0.14), color: accent }}
            >
              {node.badge.length > 10 ? node.badge.slice(0, 10) : node.badge}
            </span>
          )}
        </div>

        {typeof node.confidence === 'number' && (
          <div className="mt-1.5">
            <ConfidenceBar value={node.confidence} color={accent} compact />
          </div>
        )}
      </button>

      {pos.hasChildren && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-label={collapsed ? `Expand ${node.name}` : `Collapse ${node.name}`}
          className="absolute left-1/2 -translate-x-1/2 -bottom-3 w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold cursor-pointer transition-transform hover:scale-110"
          style={{
            background: collapsed ? accent : 'var(--surface-1)',
            borderColor: accent,
            color: collapsed ? '#FFFFFF' : accent,
          }}
        >
          {collapsed ? pos.childCount : '−'}
        </button>
      )}
    </div>
  );
}

// ── Inspector ───────────────────────────────────────────────
function NodeInspector({
  node,
  onNavigate,
}: {
  node: InvestigationTreeNode | null;
  onNavigate: (n: InvestigationTreeNode) => void;
}) {
  if (!node) {
    return (
      <Panel>
        <EmptyState
          icon={Layers}
          title="Select a node"
          message="Click any node in the tree to inspect its intelligence profile, evidence and relationships."
        />
      </Panel>
    );
  }

  const style = typeStyle(node.type);
  const accent = node.severity ? SEVERITY_COLORS[node.severity] : style.color;
  const Icon = style.icon;

  return (
    <Panel accent={accent} className="sticky top-5">
      <div className="flex items-start gap-3">
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: tint(accent, 0.14), color: accent }}
        >
          <Icon size={19} />
        </span>
        <div className="min-w-0">
          <h4 className="text-[15px] font-bold text-[var(--ink-primary)] leading-snug">{node.name}</h4>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <Badge color={accent}>{node.subtitle || style.label}</Badge>
            {node.severity && <Badge color={SEVERITY_COLORS[node.severity]}>{node.severity}</Badge>}
          </div>
        </div>
      </div>

      {typeof node.confidence === 'number' && (
        <div className="mt-4">
          <ConfidenceBar value={node.confidence} color={accent} label="Data confidence" />
          <p className="text-[10.5px] text-[var(--ink-tertiary)] mt-1.5 leading-snug">
            Confidence in this data relationship — not a probability of guilt.
          </p>
        </div>
      )}

      {node.details && (
        <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--ink-secondary)]">{node.details}</p>
      )}

      {node.facts.length > 0 && (
        <dl className="mt-4 space-y-1.5">
          {node.facts.map((f, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-3 rounded-lg px-3 py-2"
              style={{ background: 'var(--surface-2)' }}
            >
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-tertiary)] shrink-0">
                {f.label}
              </dt>
              <dd className="text-[12px] font-semibold text-[var(--ink-primary)] text-right break-words min-w-0">
                {String(f.value)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {node.relations.length > 0 && (
        <div className="mt-4">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)] flex items-center gap-1.5 mb-2">
            <Link2 size={11} /> Relationships
          </div>
          <ul className="space-y-1.5">
            {node.relations.map((r, i) => (
              <li
                key={i}
                className="rounded-lg px-3 py-2 text-[11.5px]"
                style={{ background: tint(accent, 0.06), border: `1px solid ${tint(accent, 0.2)}` }}
              >
                <span className="font-bold uppercase tracking-wide text-[10px]" style={{ color: accent }}>
                  {r.label}
                </span>
                <span className="block text-[var(--ink-secondary)] mt-0.5 break-words">{r.target}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {node.evidence.length > 0 && (
        <div className="mt-4">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)] flex items-center gap-1.5 mb-2">
            <FileCheck2 size={11} /> Evidence basis
          </div>
          <div className="flex flex-wrap gap-1.5">
            {node.evidence.map((e, i) => (
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
      )}

      {node.children.length > 0 && (
        <div className="mt-4">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--ink-tertiary)] mb-2">
            Contains ({node.children.length})
          </div>
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
            {node.children.map((c) => {
              const cs = typeStyle(c.type);
              return (
                <button
                  key={c.id}
                  onClick={() => onNavigate(c)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cs.color }} />
                  <span className="text-[11.5px] text-[var(--ink-primary)] truncate flex-1">{c.name}</span>
                  <ChevronRight size={12} className="shrink-0 text-[var(--ink-tertiary)]" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {node.agentSource && (
        <div className="mt-4 pt-3 border-t flex items-center gap-1.5 text-[11px] text-[var(--ink-tertiary)]"
          style={{ borderColor: 'var(--border)' }}>
          <Bot size={12} />
          Identified by {node.agentSource}
        </div>
      )}
    </Panel>
  );
}
