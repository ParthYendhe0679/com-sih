'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { toggleSidebar, setRole } from '@/store/slices/uiSlice';
import type { UserRole } from '@/store/slices/uiSlice';
import {
  LayoutDashboard, FolderOpen, FileText, Network, Map, History,
  Search, Radio, Eye, ActivitySquare, Bell, Package,
  GitCompare, AlertOctagon, ShieldCheck, BrainCircuit,
  TrendingUp, BookmarkCheck, Clock, Play,
  Bot, Settings, ChevronLeft, ChevronRight, ChevronDown,
  UserCircle2, ShieldAlert, Settings2, BarChart3, UserCheck,
  AlertTriangle, FileSearch, Database, Users, Lock
} from 'lucide-react';
import { toast } from 'sonner';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  pulse?: boolean;
  badge?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

// ── Police/Investigator Navigation (Part 32) ───────────────
const policeNav: NavSection[] = [
  {
    label: 'Overview',
    defaultOpen: true,
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Investigation',
    defaultOpen: true,
    items: [
      { href: '/cases', label: 'Cases', icon: FolderOpen },
      { href: '/cases/search', label: 'Case Search', icon: Search },
      { href: '/fir', label: 'FIR Intake / Processing', icon: FileText },
    ],
  },
  {
    label: 'Intelligence',
    defaultOpen: true,
    items: [
      { href: '/intelligence/samanvaya', label: 'Investigation Agents', icon: BrainCircuit, badge: 'SAMANVAYA', pulse: true },
      { href: '/historical', label: 'Historical Intelligence', icon: History },
      { href: '/ai', label: 'KAVA AI', icon: Bot },
    ],
  },
  {
    label: 'Evidence',
    defaultOpen: false,
    items: [
      { href: '/evidence', label: 'Evidence Intelligence', icon: Package },
    ],
  },
  {
    label: 'Analytics',
    defaultOpen: false,
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
];

// ── Citizen Navigation ───────────────────────────────────────
const citizenNav: NavSection[] = [
  {
    label: 'My Portal',
    defaultOpen: true,
    items: [
      { href: '/citizen', label: 'Overview', icon: LayoutDashboard },
      { href: '/citizen?tab=file', label: 'File a Complaint', icon: FileText },
      { href: '/citizen?tab=complaints', label: 'My Complaints', icon: FolderOpen },
      { href: '/citizen?tab=notifications', label: 'Notifications', icon: Bell },
    ],
  },
];

// ── Admin Navigation ─────────────────────────────────────────
const adminNav: NavSection[] = [
  {
    label: 'Administration',
    defaultOpen: true,
    items: [
      { href: '/admin', label: 'Admin Dashboard', icon: LayoutDashboard },
      { href: '/admin?tab=users', label: 'User Management', icon: Users },
      { href: '/admin?tab=roles', label: 'Role Management', icon: Lock },
      { href: '/admin?tab=audit', label: 'Audit Logs', icon: FileSearch },
      { href: '/admin?tab=security', label: 'Security', icon: ShieldAlert },
    ],
  },
];

const navByRole: Record<UserRole, NavSection[]> = {
  police: policeNav,
  citizen: citizenNav,
  admin: adminNav,
};

const roleMeta: Record<UserRole, { label: string; color: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  police: { label: 'Police / Investigator', color: 'var(--accent)', icon: ShieldAlert },
  citizen: { label: 'Citizen Portal', color: '#16A34A', icon: UserCircle2 },
  admin: { label: 'Administrator', color: '#D97706', icon: Settings2 },
};

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const currentRole = useAppSelector((s) => s.ui.currentRole);
  const effectiveRole: UserRole = pathname?.startsWith('/citizen')
    ? 'citizen'
    : pathname?.startsWith('/admin')
    ? 'admin'
    : currentRole;

  // Sync effective role to Redux when it differs
  useEffect(() => {
    if (effectiveRole !== currentRole) {
      dispatch(setRole(effectiveRole));
    }
  }, [effectiveRole, currentRole, dispatch]);

  // Collapsible section state — initialize all sections to their defaultOpen state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    const allSections = [...policeNav, ...citizenNav, ...adminNav];
    allSections.forEach((s) => { initial[s.label] = s.defaultOpen ?? true; });
    return initial;
  });

  const toggleSection = (label: string) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const sections = navByRole[effectiveRole] || policeNav;
  const meta = roleMeta[effectiveRole] || roleMeta.police;
  const RoleIcon = meta.icon;

  const handleRoleSwitch = (role: UserRole) => {
    dispatch(setRole(role));
    toast.success(`Switched to ${roleMeta[role].label}`);
    if (role === 'citizen') router.push('/citizen');
    else if (role === 'admin') router.push('/admin');
    else router.push('/dashboard');
  };

  const isActive = (href: string) => {
    const [path, query] = href.split('?');
    if (path === '/cases/search') return pathname === '/cases/search';

    if (query) {
      if (pathname !== path) return false;
      const itemParams = new URLSearchParams(query);
      for (const [key, value] of itemParams.entries()) {
        if (searchParams.get(key) !== value) return false;
      }
      return true;
    }

    if (pathname === href) {
      if (href === '/admin') {
        const tab = searchParams.get('tab');
        return !tab || tab === 'dashboard';
      }
      if (href === '/citizen') {
        const tab = searchParams.get('tab');
        return !tab || tab === 'overview';
      }
      return true;
    }

    return (
      href !== '/dashboard' &&
      href !== '/citizen' &&
      href !== '/admin' &&
      Boolean(pathname?.startsWith(href))
    );
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 flex flex-col border-r transition-all duration-200 ease-out glass-panel overflow-hidden',
        collapsed ? 'w-[68px]' : 'w-[272px]'
      )}
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Brand Header */}
      <div
        className="flex items-center h-[60px] px-4 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        {!collapsed ? (
          <Link href="/dashboard" className="flex items-center gap-3 w-full">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[14px] font-bold text-white shadow-md shrink-0"
              style={{ background: 'var(--accent)' }}
            >
              K
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[15px] font-bold tracking-tight leading-tight" style={{ color: 'var(--ink-primary)' }}>
                KRITAGAS
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-tertiary)' }}>
                Intelligence Platform
              </span>
            </div>
          </Link>
        ) : (
          <Link href="/dashboard" className="flex items-center justify-center w-full">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[14px] font-bold text-white shadow-md"
              style={{ background: 'var(--accent)' }}
            >
              K
            </div>
          </Link>
        )}
      </div>


      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {sections.map((section) => {
          const isOpen = openSections[section.label] !== false;
          return (
            <div key={section.label} className="mb-1">
              {/* Section header */}
              {!collapsed && (
                <button
                  onClick={() => toggleSection(section.label)}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wider rounded-md transition-colors hover:bg-[var(--surface-2)]"
                  style={{ color: 'var(--ink-tertiary)' }}
                >
                  {section.label}
                  <ChevronDown size={11} className={cn('transition-transform', !isOpen && '-rotate-90')} />
                </button>
              )}

              {/* Nav items */}
              {(isOpen || collapsed) && section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all duration-100 relative',
                      collapsed && 'justify-center px-0',
                      active
                        ? 'font-semibold'
                        : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] hover:bg-[var(--glass-1)]'
                    )}
                    style={
                      active
                        ? {
                            color: 'var(--accent)',
                            background: 'var(--accent-muted)',
                            border: '1px solid var(--accent-subtle)',
                          }
                        : {}
                    }
                  >
                    <Icon size={16} strokeWidth={active ? 2.2 : 1.7} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {item.pulse && !collapsed && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-[var(--success)] live-pulse-dot shrink-0" />
                    )}
                    {item.badge && !collapsed && (
                      <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--error)] text-white shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-2 space-y-1 shrink-0" style={{ borderColor: 'var(--border)' }}>
        {/* Collapse Toggle */}
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="flex items-center justify-center w-full py-2 rounded-lg text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)] hover:bg-[var(--surface-2)] transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : (
            <span className="flex items-center gap-2 text-[12px] font-medium">
              <ChevronLeft size={16} />
              Collapse
            </span>
          )}
        </button>

        {/* Switch to Login */}
        {!collapsed && (
          <button
            onClick={() => router.push('/login')}
            className="w-full text-[12px] text-center py-1.5 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--ink-tertiary)' }}
          >
            Switch Portal
          </button>
        )}
      </div>
    </aside>
  );
}
