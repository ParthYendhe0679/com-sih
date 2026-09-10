'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { toggleSidebar, setRole } from '@/store/slices/uiSlice';
import type { UserRole } from '@/store/slices/uiSlice';
import {
  LayoutDashboard, FolderOpen, FileText, History,
  Search, Package, BrainCircuit, BarChart3,
  ChevronLeft, ChevronRight, ChevronDown,
  UserCircle2, ShieldAlert, Settings2,
  Users, Lock, FileSearch, Bell, LogOut,
  Bot
} from 'lucide-react';
import { useSession, roleColors } from '@/hooks/useSession';
import { authApi } from '@/lib/api/auth';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  pulse?: boolean;
  badge?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

// ── Police/Investigator Navigation ─────────────────────────
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
      { href: '/fir', label: 'FIR Intake', icon: FileText },
    ],
  },
  {
    label: 'Intelligence',
    defaultOpen: true,
    items: [
      { href: '/intelligence/samanvaya', label: 'Case Analysis', icon: BrainCircuit, badge: 'AI', pulse: true },
      { href: '/historical', label: 'Past Cases', icon: History },
      { href: '/ai', label: 'NETRA AI', icon: Bot },
    ],
  },
  {
    label: 'Evidence',
    defaultOpen: false,
    items: [
      { href: '/evidence', label: 'Evidence Vault', icon: Package },
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

// ── Citizen Navigation ─────────────────────────────────────
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

// ── Admin Navigation ───────────────────────────────────────
const adminNav: NavSection[] = [
  {
    label: 'Overview',
    defaultOpen: true,
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Administration',
    defaultOpen: true,
    items: [
      { href: '/admin?tab=users', label: 'Users', icon: Users },
      { href: '/admin?tab=roles', label: 'Roles & Permissions', icon: Lock },
    ],
  },
  {
    label: 'System',
    defaultOpen: false,
    items: [
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

const roleMeta: Record<UserRole, { label: string; fallbackShort: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  police: { label: 'Police / Investigator', fallbackShort: 'POL', icon: ShieldAlert },
  citizen: { label: 'Citizen Portal', fallbackShort: 'CTZ', icon: UserCircle2 },
  admin: { label: 'Administrator', fallbackShort: 'ADM', icon: Settings2 },
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

  useEffect(() => {
    if (effectiveRole !== currentRole) {
      dispatch(setRole(effectiveRole));
    }
  }, [effectiveRole, currentRole, dispatch]);

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
  const session = useSession(effectiveRole);
  const avatarColor = roleColors[effectiveRole] || roleColors.police;
  const initials = session.loading ? meta.fallbackShort : session.initials;

  const handleSignOut = () => {
    authApi.logout();
    router.push('/login');
  };

  // Only ever one row is active. A plain prefix test lights up both /cases and
  // /cases/search at once, so the winner is the LONGEST href that matches the
  // current path — the most specific item wins and its parent stays quiet.
  const activeHref = React.useMemo(() => {
    const candidates = sections.flatMap((sec) => sec.items.map((i) => i.href));
    let best: string | null = null;

    for (const href of candidates) {
      const [path, query] = href.split('?');
      if (pathname !== path) {
        // Prefix match, but only on a path-segment boundary.
        const prefixOk =
          path !== '/dashboard' &&
          path !== '/citizen' &&
          path !== '/admin' &&
          Boolean(pathname?.startsWith(path + '/'));
        if (!prefixOk) continue;
      } else if (query) {
        const itemParams = new URLSearchParams(query);
        let ok = true;
        for (const [k, v] of itemParams.entries()) {
          if (searchParams.get(k) !== v) { ok = false; break; }
        }
        if (!ok) continue;
      } else {
        // Exact path with no query: a tabbed root only wins on its default tab.
        if (path === '/admin') {
          const tab = searchParams.get('tab');
          if (tab && tab !== 'dashboard') continue;
        }
        if (path === '/citizen') {
          const tab = searchParams.get('tab');
          if (tab && tab !== 'overview') continue;
        }
      }
      if (best === null || href.length > best.length) best = href;
    }
    return best;
  }, [sections, pathname, searchParams]);

  const isActive = (href: string) => href === activeHref;

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-200 ease-out overflow-hidden bg-white',
        collapsed ? 'w-[68px]' : 'w-[272px]'
      )}
      style={{
        background: 'var(--sidebar-bg, #FFFFFF)',
        borderColor: 'var(--sidebar-border, #E1E5EA)',
      }}
    >
      {/* ── Brand Header (At Top) ─────────────────────────────── */}
      <div
        className={cn(
          'h-[72px] shrink-0 flex items-center px-5 transition-all',
          collapsed ? 'justify-center px-2' : 'justify-between'
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0 group">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
          >
            <Image src="/trinetra-logo.png" alt="TRINETRA" width={40} height={40} className="object-contain" style={{ width: 'auto', height: 'auto' }} />
          </div>
          {!collapsed && (
            <span
              className="text-[19px] font-semibold tracking-[-0.02em] leading-none truncate"
              style={{ color: 'var(--ink-primary)' }}
            >
              TRINETRA
            </span>
          )}
        </Link>
      </div>

      {/* ── Navigation Items ──────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
        {sections.map((section) => {
          const isOpen = openSections[section.label] !== false;
          return (
            <div key={section.label} className="mb-3">
              {/* Section header */}
              {!collapsed && (
                <button
                  onClick={() => toggleSection(section.label)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <span>{section.label}</span>
                  <ChevronDown
                    size={13}
                    className={cn('transition-transform duration-150', !isOpen && '-rotate-90')}
                  />
                </button>
              )}

              {/* Nav items. space-y keeps a gap between rows — without it an
                  active pill and a hovered pill butt together into one block. */}
              <div className="space-y-1 mt-0.5">
              {(isOpen || collapsed) && section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-3.5 px-3 py-2.5 rounded-lg text-[13.5px] transition-colors relative group',
                      collapsed && 'justify-center px-0 h-10',
                      active
                        ? 'font-semibold text-[var(--ink-primary)] bg-[var(--sidebar-bg-active)]'
                        : 'font-medium text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] hover:bg-[var(--sidebar-bg-hover)]'
                    )}
                  >
                    <Icon
                      size={19}
                      strokeWidth={1.75}
                      className={cn(
                        'shrink-0 transition-colors',
                        active
                          ? 'text-[var(--ink-primary)]'
                          : 'text-[var(--ink-secondary)] group-hover:text-[var(--ink-primary)]'
                      )}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {item.badge && !collapsed && (
                      <span
                        className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 leading-none"
                        style={{ background: 'var(--accent)', color: '#FFFFFF' }}
                      >
                        {item.badge}
                      </span>
                    )}
                    {/* Tooltip for collapsed */}
                    {collapsed && (
                      <div
                        className="absolute left-full ml-3 px-3 py-1.5 rounded-lg text-[12.5px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 bg-slate-900 text-white shadow-lg"
                      >
                        {item.label}
                      </div>
                    )}
                  </Link>
                );
              })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── Footer / Actions ───────────────────── */}
      <div
        className="p-3 shrink-0 space-y-1"
        style={{ borderColor: 'var(--sidebar-border, #E1E5EA)' }}
      >
        {/* Collapse Toggle */}
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="flex items-center justify-center w-full py-2 rounded-xl text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight size={16} />
          ) : (
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500 dark:text-slate-400">
              <ChevronLeft size={15} />
              Collapse
            </span>
          )}
        </button>

        {/* Switch Portal */}
        {!collapsed && (
          <button
            onClick={() => router.push('/login')}
            className="w-full text-center text-[12px] font-medium py-1.5 text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            Switch Portal
          </button>
        )}
      </div>
    </aside>
  );
}
