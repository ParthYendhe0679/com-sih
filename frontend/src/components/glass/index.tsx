'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: 0 | 1 | 2 | 3;
  elevated?: boolean;
}

export function GlassPanel({
  children,
  className,
  level = 1,
  elevated = false,
  ...props
}: GlassPanelProps) {
  const levelClass = elevated
    ? 'glass-panel-elevated'
    : 'glass-panel';

  return (
    <div
      className={cn(
        'rounded-xl transition-all duration-150',
        levelClass,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassCard({
  children,
  className,
  hover = true,
  onClick,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-panel p-4 rounded-xl transition-all duration-150',
        hover && 'hover:border-[var(--accent)] hover:shadow-md cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassToolbar({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'glass-toolbar p-2 rounded-lg flex items-center gap-2',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassMetric({
  label,
  value,
  change,
  icon: Icon,
  color,
  onClick,
  className,
}: {
  label: string;
  value: string | number;
  change?: string;
  icon?: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  color?: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-panel p-3.5 rounded-xl border transition-all duration-150',
        onClick && 'hover:border-[var(--accent)] cursor-pointer hover:shadow-sm',
        className
      )}
    >
      <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--ink-tertiary)' }}>
        <span className="truncate">{label}</span>
        {Icon && <Icon size={14} style={{ color: color || 'var(--ink-secondary)' }} />}
      </div>
      <div
        className="text-[22px] font-semibold tracking-tight font-mono-id mt-1"
        style={{ color: color || 'var(--ink-primary)' }}
      >
        {value}
      </div>
      {change && (
        <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--ink-secondary)' }}>
          {change}
        </div>
      )}
    </div>
  );
}

export function GlassStatusBadge({
  status,
  pulse = false,
}: {
  status: string;
  pulse?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider font-mono-id glass-panel">
      {pulse && <span className="w-2 h-2 rounded-full bg-[var(--success)] live-pulse-dot" />}
      <span>{status}</span>
    </span>
  );
}
