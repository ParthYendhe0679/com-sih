'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { X, Bell, Network, Activity, AlertTriangle, FileText, FolderOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { notificationsApi, type BackendNotification } from '@/lib/api/notifications';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui';

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function iconFor(type?: string | null) {
  switch ((type || '').toLowerCase()) {
    case 'anomaly': return <Activity size={15} style={{ color: 'var(--error)' }} />;
    case 'network': return <Network size={15} style={{ color: 'var(--accent)' }} />;
    case 'case': return <FolderOpen size={15} style={{ color: 'var(--accent)' }} />;
    case 'fir': return <FileText size={15} style={{ color: 'var(--warning)' }} />;
    case 'contradiction': return <AlertTriangle size={15} style={{ color: 'var(--error)' }} />;
    default: return <Bell size={15} style={{ color: 'var(--accent)' }} />;
  }
}

export default function NotificationsDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<BackendNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await notificationsApi.list({ size: 50 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  if (!isOpen) return null;

  const unreadCount = items.filter((n) => !n.is_read).length;

  const markAllAsRead = async () => {
    const previous = items;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await notificationsApi.markAllRead();
    } catch {
      setItems(previous); // Roll back so the badge never lies.
    }
  };

  const handleClick = async (n: BackendNotification) => {
    if (!n.is_read) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, is_read: true } : i)));
      notificationsApi.markRead(n.id).catch(() => {});
    }
    if (n.related_case_id) {
      router.push(`/cases/${n.related_case_id}`);
      onClose();
    } else if (n.related_fir_id) {
      router.push('/fir');
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Notifications"
        className="w-[400px] max-w-full h-full flex flex-col border-l shadow-2xl animate-slide-in-right"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border-strong)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2.5">
            <Bell size={17} style={{ color: 'var(--accent)' }} />
            <h3 className="card-title">Notifications</h3>
            {unreadCount > 0 && (
              <span
                className="text-[11.5px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
              >
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="btn-ghost text-[13px] px-2.5 py-1.5">
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close notifications"
              className="p-1.5 rounded-lg hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--ink-secondary)' }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <LoadingState message="Loading notifications…" />
          ) : error ? (
            <ErrorState
              title="Unable to load notifications"
              message={error}
              onRetry={load}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No notifications"
              description="Case assignments, FIR reviews and intelligence alerts will appear here."
            />
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className="w-full text-left px-5 py-4 hover:bg-[var(--accent-muted)] transition-colors space-y-1.5"
                  style={{ background: n.is_read ? 'transparent' : 'var(--surface-2)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="mt-0.5 shrink-0">{iconFor(n.notification_type)}</span>
                      <span
                        className="text-[14px] font-semibold leading-snug"
                        style={{ color: 'var(--ink-primary)' }}
                      >
                        {n.title}
                      </span>
                    </div>
                    <span
                      className="text-[12px] shrink-0 tabular-nums"
                      style={{ color: 'var(--ink-tertiary)' }}
                    >
                      {relativeTime(n.created_at)}
                    </span>
                  </div>
                  <p
                    className="text-[13.5px] leading-relaxed pl-[23px]"
                    style={{ color: 'var(--ink-secondary)' }}
                  >
                    {n.message}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
