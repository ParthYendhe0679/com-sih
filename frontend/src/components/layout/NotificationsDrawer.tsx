'use client';

import React from 'react';
import { X, Bell, History, Network, Activity, AlertTriangle, FileText, Bookmark, Camera, Check } from 'lucide-react';
import { useAppDispatch } from '@/store/hooks';
import { openInspector } from '@/store/slices/uiSlice';
import { useRouter } from 'next/navigation';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  time: string;
  unread: boolean;
  targetId?: string;
  targetType?: string;
  href?: string;
}

const initialNotifications: NotificationItem[] = [
  {
    id: 'notif-1',
    type: 'anomaly',
    title: 'Circadian Anomaly Spike',
    subtitle: 'PERSON-014 observed active at 03:14 AM in Bandra (Score: 0.87)',
    time: '2 mins ago',
    unread: true,
    targetId: 'PERSON-014',
    targetType: 'Person',
    href: '/anomaly',
  },
  {
    id: 'notif-2',
    type: 'network',
    title: 'New Association Path Established',
    subtitle: 'High-confidence link verified between PERSON-014 & PERSON-021',
    time: '8 mins ago',
    unread: true,
    targetId: 'CASE-102',
    targetType: 'Case',
    href: '/network',
  },
  {
    id: 'notif-3',
    type: 'historical',
    title: 'Archival Case Match',
    subtitle: '89% pattern similarity detected with CASE-087 (2023 Westside Ring)',
    time: '25 mins ago',
    unread: true,
    targetId: 'CASE-087',
    targetType: 'HistoricalCase',
    href: '/historical',
  },
  {
    id: 'notif-4',
    type: 'complaint',
    title: 'New Citizen Complaint Filed',
    subtitle: 'CMP-2026-0904 received for Online Investment Fraud in Andheri',
    time: '1 hour ago',
    unread: false,
    href: '/police',
  },
  {
    id: 'notif-5',
    type: 'contradiction',
    title: 'Evidence Contradiction Flagged',
    subtitle: 'Juhu CCTV timestamp conflicts with Khalapur Expressway ANPR log',
    time: '2 hours ago',
    unread: false,
    href: '/forensics',
  },
];

export default function NotificationsDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [notifications, setNotifications] = React.useState(initialNotifications);

  if (!isOpen) return null;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const handleClick = (n: NotificationItem) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === n.id ? { ...item, unread: false } : item))
    );
    if (n.targetId && n.targetType) {
      dispatch(openInspector({ id: n.targetId, type: n.targetType }));
    } else if (n.href) {
      router.push(n.href);
    }
    onClose();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'anomaly': return <Activity size={14} className="text-[var(--error)]" />;
      case 'network': return <Network size={14} className="text-[var(--accent)]" />;
      case 'historical': return <History size={14} className="text-[var(--info)]" />;
      case 'complaint': return <FileText size={14} className="text-[var(--warning)]" />;
      case 'contradiction': return <AlertTriangle size={14} className="text-[var(--error)]" />;
      default: return <Bell size={14} className="text-[var(--accent)]" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[380px] max-w-full h-full glass-panel-elevated flex flex-col border-l shadow-2xl animate-slide-in-right"
        style={{ borderColor: 'var(--border-strong)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-[var(--accent)]" />
            <h3 className="font-semibold text-[14px]" style={{ color: 'var(--ink-primary)' }}>
              Operational Notifications
            </h3>
            <span className="text-[10px] font-mono-id px-1.5 py-0.2 rounded-full bg-[var(--accent-muted)] text-[var(--accent)] font-bold">
              {notifications.filter((n) => n.unread).length} new
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={markAllAsRead}
              className="text-[11px] text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)] px-2 py-1 rounded"
              title="Mark all as read"
            >
              Mark read
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface-2)]">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleClick(n)}
              className="p-3.5 hover:bg-[var(--accent-muted)] cursor-pointer transition-colors space-y-1"
              style={{
                background: n.unread ? 'var(--glass-1)' : 'transparent',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {getIcon(n.type)}
                  <span className="font-semibold text-[12px]" style={{ color: 'var(--ink-primary)' }}>
                    {n.title}
                  </span>
                </div>
                <span className="text-[10px] font-mono-id" style={{ color: 'var(--ink-tertiary)' }}>
                  {n.time}
                </span>
              </div>
              <p className="text-[12px] leading-relaxed line-clamp-2" style={{ color: 'var(--ink-secondary)' }}>
                {n.subtitle}
              </p>
            </div>
          ))}
        </div>

        <div className="p-3 border-t text-center text-[11px] font-mono-id" style={{ borderColor: 'var(--border)', color: 'var(--ink-tertiary)' }}>
          Synthetic Automated Trigger Stream
        </div>
      </div>
    </div>
  );
}
