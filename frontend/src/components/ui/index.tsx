'use client';

// ============================================================
// KRITAGAS — Shared UI Primitives
// One implementation of the patterns that were previously
// copy-pasted across pages: page headers, cards, metrics,
// badges, tabs, and the loading / error / empty triad.
// ============================================================

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  AlertCircle, RefreshCw, Inbox, Loader2, ChevronRight,
} from 'lucide-react';

// ── Page header ────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
}

// ── Card ───────────────────────────────────────────────────

export function Card({
  className,
  compact,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { compact?: boolean }) {
  return (
    <div
      className={cn(compact ? 'kritagas-card-compact' : 'kritagas-card', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex items-start gap-2.5 min-w-0">
        {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h3 className="card-title">{title}</h3>
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** "View all →" style link used in card headers. */
export function CardLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-[13.5px] font-semibold flex items-center gap-1 transition-opacity hover:opacity-80"
      style={{ color: 'var(--accent)' }}
    >
      {label} <ChevronRight size={14} />
    </Link>
  );
}

// ── Metric card ────────────────────────────────────────────

export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  color = 'var(--accent)',
  bg = 'var(--accent-muted)',
  href,
  onClick,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ComponentType<{ size?: number }>;
  color?: string;
  bg?: string;
  href?: string;
  onClick?: () => void;
  loading?: boolean;
}) {
  const body = (
    <>
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
        style={{ background: bg, color }}
      >
        <Icon size={20} />
      </div>
      {loading ? (
        <div className="skeleton h-8 w-16 mb-2" />
      ) : (
        <div
          className="text-[28px] font-bold leading-none mb-1.5 tabular-nums"
          style={{ color }}
        >
          {value}
        </div>
      )}
      <div className="text-[14px] font-semibold" style={{ color: 'var(--ink-primary)' }}>
        {label}
      </div>
      {sub && (
        <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--ink-tertiary)' }}>
          {sub}
        </div>
      )}
    </>
  );

  const className = 'metric-card text-left stagger-item w-full';

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(className, 'cursor-pointer')}>
        {body}
      </button>
    );
  }
  return <div className={cn(className, 'cursor-default')}>{body}</div>;
}

// ── Badge ──────────────────────────────────────────────────

export type BadgeTone =
  | 'active' | 'investigation' | 'review' | 'closed'
  | 'critical' | 'high' | 'medium' | 'low'
  | 'verified' | 'submitted' | 'pending';

export function Badge({
  tone = 'low',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn('badge', `badge-${tone}`, className)}>{children}</span>;
}

/** Maps backend priority/status enums onto badge tones. */
export function toneForPriority(priority?: string | null): BadgeTone {
  switch ((priority || '').toUpperCase()) {
    case 'CRITICAL': return 'critical';
    case 'HIGH': return 'high';
    case 'MEDIUM': return 'medium';
    default: return 'low';
  }
}

export function toneForStatus(status?: string | null): BadgeTone {
  switch ((status || '').toUpperCase()) {
    case 'OPEN':
    case 'ACCEPTED': return 'active';
    case 'UNDER_INVESTIGATION':
    case 'UNDER_REVIEW': return 'investigation';
    case 'PENDING_FORENSICS':
    case 'MORE_INFORMATION_REQUIRED': return 'review';
    case 'SUBMITTED': return 'submitted';
    case 'REJECTED': return 'critical';
    case 'CLOSED':
    case 'ARCHIVED': return 'closed';
    default: return 'low';
  }
}

/** Turns SCREAMING_SNAKE backend enums into readable labels. */
export function humanise(value?: string | null): string {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Tabs ───────────────────────────────────────────────────

export interface TabDef {
  id: string;
  label: string;
  icon?: React.ComponentType<{ size?: number }>;
  badge?: string | number;
}

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('tab-list', className)} role="tablist">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn('tab-item', isActive && 'active')}
          >
            {Icon && <Icon size={15} />}
            {t.label}
            {t.badge !== undefined && <span className="tab-badge">{t.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Loading ────────────────────────────────────────────────

export function LoadingState({
  message = 'Loading…',
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center py-20 gap-3', className)}
      role="status"
      aria-live="polite"
    >
      <Loader2 size={28} className="animate-spin-slow" style={{ color: 'var(--accent)' }} />
      <p className="text-[14px]" style={{ color: 'var(--ink-secondary)' }}>
        {message}
      </p>
    </div>
  );
}

/** Repeated skeleton blocks for list/table placeholders. */
export function SkeletonList({ rows = 3, height = 80 }: { rows?: number; height?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton rounded-xl" style={{ height }} />
      ))}
    </div>
  );
}

// ── Error ──────────────────────────────────────────────────

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Retry',
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('empty-state', className)} role="alert">
      <div
        className="empty-state-icon"
        style={{ background: 'var(--error-muted)', color: 'var(--error)' }}
      >
        <AlertCircle size={26} />
      </div>
      <p className="empty-state-title">{title}</p>
      {message && <p className="empty-state-description">{message}</p>}
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary">
          <RefreshCw size={15} />
          {retryLabel}
        </button>
      )}
    </div>
  );
}

// ── Empty ──────────────────────────────────────────────────

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ size?: number }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('empty-state', className)}>
      <div className="empty-state-icon">
        <Icon size={26} />
      </div>
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-description">{description}</p>}
      {action}
    </div>
  );
}

// ── Synthetic-data disclosure ──────────────────────────────

/**
 * Marks a panel whose contents are illustrative rather than sourced from the
 * live backend. Required by the design rules: never present synthetic
 * intelligence as real.
 */
export function SyntheticDataNotice({ label = 'Synthetic data', className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md',
        className
      )}
      style={{ background: 'var(--warning-muted)', color: 'var(--warning)' }}
      title="Illustrative content — not sourced from the live case database."
    >
      {label}
    </span>
  );
}
