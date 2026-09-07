'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
        'fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-200 ease-out overflow-hidden bg-white border-r shadow-xs',
        collapsed ? 'w-[68px]' : 'w-[272px]'
      )}
      style={{
        background: 'var(--sidebar-bg, #FFFFFF)',
        borderColor: 'var(--sidebar-border, #E2E8F0)',
      }}
    >
      {/* ── Brand Header (At Top) ─────────────────────────────── */}
      <div
        className={cn(
          'h-16 shrink-0 flex items-center px-5 border-b transition-all',
          collapsed ? 'justify-center px-2' : 'justify-between'
        )}
        style={{ borderColor: 'var(--sidebar-border, #E2E8F0)' }}
      >
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0 group">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[15px] font-black text-white shadow-sm shrink-0 bg-gradient-to-tr from-indigo-600 to-indigo-500 group-hover:scale-105 transition-transform"
          >
            K
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[14.5px] font-bold tracking-tight leading-none text-slate-900">
                KRITAGAS
              </span>
              <span className="text-[9.5px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                Intelligence Platform
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* ── Navigation Items ──────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
        {sections.map((section) => {
          const isOpen = openSections[section.label] !== false;
          return (
            <div key={section.label} className="mb-2">
              {/* Section header */}
              {!collapsed && (
                <button
                  onClick={() => toggleSection(section.label)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <span>{section.label}</span>
                  <ChevronDown
                    size={13}
                    className={cn('transition-transform duration-150', !isOpen && '-rotate-90')}
                  />
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
                      'flex items-center gap-3 px-3 py-2 rounded-xl text-[13.5px] transition-all duration-100 relative group',
                      collapsed && 'justify-center px-0 h-10',
                      active
                        ? 'font-semibold text-indigo-600 bg-indigo-50/90 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    )}
                  >
                    <Icon
                      size={18}
                      strokeWidth={active ? 2.2 : 1.7}
                      className={cn(
                        'shrink-0 transition-colors',
                        active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-700'
                      )}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {item.pulse && !collapsed && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0 ml-1.5" />
                    )}
                    {item.badge && !collapsed && (
                      <span
                        className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-red-600 text-white shadow-2xs tracking-wide"
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
          );
        })}
      </nav>

      {/* ── Footer / Actions ───────────────────── */}
      <div
        className="p-3 border-t shrink-0 space-y-1"
        style={{ borderColor: 'var(--sidebar-border, #E2E8F0)' }}
      >
        {/* Collapse Toggle */}
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="flex items-center justify-center w-full py-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight size={16} />
          ) : (
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
              <ChevronLeft size={15} />
              Collapse
            </span>
          )}
        </button>

        {/* Switch Portal */}
        {!collapsed && (
          <button
            onClick={() => router.push('/login')}
            className="w-full text-center text-[12px] font-medium py-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            Switch Portal
          </button>
        )}
      </div>
    </aside>
  );
}
