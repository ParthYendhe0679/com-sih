'use client';

// ============================================================
// Small shared building blocks for the SAMANVAYA workspace.
// Everything is theme-token driven so panels stay legible in
// both the light and dark app themes.
// ============================================================

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { tint } from './theme';

// ── Panel ────────────────────────────────────────────────────
export function Panel({
  children,
  className = '',
  accent,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border ${padded ? 'p-5' : ''} ${className}`}
      style={{
        background: 'var(--surface-1)',
        borderColor: accent ? tint(accent, 0.28) : 'var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {children}
    </div>
  );
}

// ── Section heading ──────────────────────────────────────────
export function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  accent = '#4F46E5',
  right,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  accent?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <span
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: tint(accent, 0.12), color: accent }}
          >
            <Icon size={18} />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold tracking-tight text-[var(--ink-primary)]">{title}</h3>
          {subtitle && (
            <p className="text-[12px] text-[var(--ink-secondary)] mt-0.5 leading-snug">{subtitle}</p>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

// ── Metric tile ──────────────────────────────────────────────
export function MetricTile({
  label,
  value,
  unit,
  hint,
  color = '#4F46E5',
  animate = false,
}: {
  label: string;
  value: number | string;
  unit?: string | null;
  hint?: string | null;
  color?: string;
  animate?: boolean;
}) {
  const numeric = typeof value === 'number' ? value : null;
  const shown = useCountUp(numeric, animate);
  return (
    <div
      className="rounded-xl border px-3.5 py-3 min-w-0"
      style={{ background: tint(color, 0.06), borderColor: tint(color, 0.24) }}
      title={hint || undefined}
    >
      <div className="flex items-baseline gap-1">
        <span
          className="text-[22px] leading-none font-bold tabular-nums tracking-tight"
          style={{ color }}
        >
          {numeric !== null ? shown.toLocaleString('en-IN') : value}
        </span>
        {unit && <span className="text-[12px] font-semibold" style={{ color }}>{unit}</span>}
      </div>
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--ink-secondary)] mt-1.5 leading-tight">
        {label}
      </div>
      {hint && <div className="text-[10px] text-[var(--ink-tertiary)] mt-1 leading-snug">{hint}</div>}
    </div>
  );
}

/** Count a number up from zero once, so a metric reads as freshly computed. */
function useCountUp(target: number | null, enabled: boolean) {
  // `progress` drives the animation; the displayed value is derived from it, so
  // the final value never needs a synchronous setState to settle.
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (target === null || !enabled) return;
    // The first tick writes 1/steps, which is the reset — no synchronous
    // setState needed when the target changes.
    let frame = 0;
    const steps = 24;
    const id = window.setInterval(() => {
      frame += 1;
      setProgress(Math.min(1, frame / steps));
      if (frame >= steps) window.clearInterval(id);
    }, 22);
    return () => window.clearInterval(id);
  }, [target, enabled]);

  if (target === null) return 0;
  if (!enabled) return target;
  const eased = 1 - Math.pow(1 - progress, 3);
  return progress >= 1 ? target : Math.round(target * eased);
}

// ── Badge ────────────────────────────────────────────────────
export function Badge({
  children,
  color = '#4F46E5',
  solid = false,
  className = '',
}: {
  children: React.ReactNode;
  color?: string;
  solid?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${className}`}
      style={
        solid
          ? { background: color, color: '#FFFFFF' }
          : { background: tint(color, 0.12), color, border: `1px solid ${tint(color, 0.3)}` }
      }
    >
      {children}
    </span>
  );
}

// ── Confidence bar ───────────────────────────────────────────
export function ConfidenceBar({
  value,
  color = '#4F46E5',
  label = 'Confidence',
  compact = false,
}: {
  value: number;
  color?: string;
  label?: string;
  compact?: boolean;
}) {
  const p = Math.max(0, Math.min(100, Math.round((value || 0) * 100)));
  return (
    <div className="w-full">
      {!compact && (
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-tertiary)] mb-1">
          <span>{label}</span>
          <span style={{ color }}>{p}%</span>
        </div>
      )}
      <div
        className="h-1.5 w-full rounded-full overflow-hidden"
        style={{ background: 'var(--surface-3)' }}
        role="img"
        aria-label={`${label} ${p} percent`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${p}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  accent = '#4F46E5',
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      className="rounded-2xl border border-dashed px-6 py-12 text-center"
      style={{ borderColor: tint(accent, 0.32), background: tint(accent, 0.035) }}
    >
      <span
        className="w-12 h-12 rounded-2xl inline-flex items-center justify-center mb-3"
        style={{ background: tint(accent, 0.12), color: accent }}
      >
        <Icon size={24} />
      </span>
      <h4 className="text-[14px] font-bold text-[var(--ink-primary)]">{title}</h4>
      <p className="text-[12.5px] text-[var(--ink-secondary)] mt-1.5 max-w-md mx-auto leading-relaxed">
        {message}
      </p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

// ── Error state ──────────────────────────────────────────────
export function ErrorState({
  title,
  message,
  onRetry,
  details,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
  details?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div
      className="rounded-2xl border px-5 py-4"
      style={{ borderColor: 'rgba(220, 38, 38, 0.35)', background: 'rgba(220, 38, 38, 0.06)' }}
    >
      <h4 className="text-[13px] font-bold text-[#DC2626] uppercase tracking-wide">{title}</h4>
      <p className="text-[12.5px] text-[var(--ink-secondary)] mt-1.5 leading-relaxed">{message}</p>
      <div className="flex items-center gap-2 mt-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
            style={{ background: '#DC2626' }}
          >
            Retry
          </button>
        )}
        {details && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer border transition-colors hover:bg-[var(--surface-2)]"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--ink-secondary)' }}
          >
            {open ? 'Hide details' : 'View details'}
          </button>
        )}
      </div>
      {open && details && (
        <pre className="mt-3 p-3 rounded-lg text-[11px] font-mono whitespace-pre-wrap break-words text-[var(--ink-secondary)] overflow-x-auto"
          style={{ background: 'var(--surface-2)' }}>
          {details}
        </pre>
      )}
    </div>
  );
}

// ── Bar row (horizontal comparison) ─────────────────────────
export function BarRow({
  label,
  sublabel,
  value,
  max,
  color = '#4F46E5',
  suffix,
  highlight = false,
}: {
  label: string;
  sublabel?: string;
  value: number;
  max: number;
  color?: string;
  suffix?: string;
  highlight?: boolean;
}) {
  const width = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-[132px] shrink-0 min-w-0">
        <div className="text-[12px] font-semibold font-mono text-[var(--ink-primary)] truncate">{label}</div>
        {sublabel && <div className="text-[10px] text-[var(--ink-tertiary)] truncate">{sublabel}</div>}
      </div>
      <div className="flex-1 h-6 rounded-md overflow-hidden relative" style={{ background: 'var(--surface-3)' }}>
        <div
          className="h-full rounded-md transition-[width] duration-700 ease-out"
          style={{
            width: `${width}%`,
            background: highlight ? color : tint(color, 0.55),
            boxShadow: highlight ? `0 0 0 1px ${color} inset` : undefined,
          }}
        />
      </div>
      <div className="w-[70px] shrink-0 text-right text-[12px] font-bold tabular-nums" style={{ color }}>
        {value.toLocaleString('en-IN')}
        {suffix && <span className="text-[10px] font-medium text-[var(--ink-tertiary)] ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
}

// ── Toolbar button ───────────────────────────────────────────
export function ToolButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  disabled = false,
  title,
}: {
  icon?: LucideIcon;
  label?: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      aria-label={title || label}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        borderColor: active ? 'var(--accent)' : 'var(--border-strong)',
        background: active ? 'var(--accent-muted)' : 'var(--surface-1)',
        color: active ? 'var(--accent)' : 'var(--ink-secondary)',
      }}
    >
      {Icon && <Icon size={13} />}
      {label && <span>{label}</span>}
    </button>
  );
}
