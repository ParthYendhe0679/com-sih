'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { toggleTheme, setCommandPaletteOpen, setRole } from '@/store/slices/uiSlice';
import type { UserRole } from '@/store/slices/uiSlice';
import { Search, Bell, Sun, Moon, LogOut, User, Settings, ChevronRight } from 'lucide-react';
import { notificationsApi } from '@/lib/api/notifications';
import { authApi } from '@/lib/api/auth';
import { useSession, roleColors } from '@/hooks/useSession';
import NotificationsDrawer from './NotificationsDrawer';

// Breadcrumb mapping
const routeLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/cases': 'Cases',
  '/cases/search': 'Case Search',
  '/fir': 'FIR Intake / Processing',
  '/intelligence/samanvaya': 'SAMANVAYA',
  '/historical': 'Historical Intelligence',
  '/evidence': 'Evidence Intelligence',
  '/forensics': 'Forensics',
  '/integrity': 'Evidence Integrity',
  '/analytics': 'Analytics',
  '/ai': 'KAVA AI',
  '/citizen': 'Citizen Portal',
  '/admin': 'Administration',
};

export default function Topbar() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();

  const theme = useAppSelector((s) => s.ui.theme);
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const currentRole = useAppSelector((s) => s.ui.currentRole);
  const effectiveRole: UserRole = pathname?.startsWith('/citizen')
    ? 'citizen'
    : pathname?.startsWith('/admin')
    ? 'admin'
    : currentRole;

  const session = useSession(effectiveRole);
  const avatarColor = roleColors[effectiveRole] || '#4F46E5';

  const [unreadAlerts, setUnreadAlerts] = useState(3);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    notificationsApi
      .list({ size: 50 })
      .then((items) => {
        if (!cancelled) setUnreadAlerts(items.filter((n) => !n.is_read).length || 3);
      })
      .catch(() => {
        if (!cancelled) setUnreadAlerts(3);
      });
    return () => { cancelled = true; };
  }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-profile-dropdown]')) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [profileOpen]);

  const handleSearch = useCallback(() => {
    dispatch(setCommandPaletteOpen(true));
  }, [dispatch]);

  const sidebarOffset = collapsed
    ? 'var(--sidebar-collapsed-width, 68px)'
    : 'var(--sidebar-width, 272px)';

  return (
    <>
      <header
        className="fixed top-0 right-0 z-30 flex items-center justify-between px-6 transition-all duration-200 bg-white/95 backdrop-blur-xs border-b border-slate-200/80"
        style={{
          left: sidebarOffset,
          height: 'var(--topbar-height, 64px)',
        }}
      >
        {/* Left / Center: Search Bar */}
        <div className="flex items-center gap-4 flex-1 max-w-xl">
          <button
            onClick={handleSearch}
            className="flex items-center gap-2.5 px-4 py-2 rounded-full text-[13.5px] transition-all hover:bg-slate-100/70 border border-slate-200/80 bg-slate-50/50 w-full max-w-md text-left cursor-pointer shadow-2xs group"
          >
            <Search size={15} strokeWidth={1.8} className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
            <span className="text-[13px] text-slate-400 flex-1 truncate">
              Search intelligence, cases, entities...
            </span>
            <span
              className="flex items-center gap-0.5 text-[11px] font-mono font-medium px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-400 shrink-0"
            >
              ⌘K
            </span>
          </button>
        </div>

        {/* Right: Notification, Theme, User Badge */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <button
            onClick={() => setNotificationsOpen(true)}
            className="relative flex items-center justify-center w-9 h-9 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell size={18} strokeWidth={1.8} />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => dispatch(toggleTheme())}
            className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Toggle theme"
          >
            {theme === 'light' ? <Moon size={18} strokeWidth={1.8} /> : <Sun size={18} strokeWidth={1.8} />}
          </button>

          {/* User Profile */}
          <div className="relative ml-2" data-profile-dropdown>
            <button
              onClick={() => setProfileOpen((prev) => !prev)}
              className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-100 transition-colors text-left cursor-pointer"
              title="Profile"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-[11.5px] font-bold text-white shadow-2xs shrink-0 bg-indigo-600"
              >
                {effectiveRole === 'police' ? 'POL' : session.initials}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-[13px] font-bold leading-tight text-slate-900">
                  {effectiveRole === 'police' ? 'DCP R. Sharma' : session.name}
                </span>
                <span className="text-[11px] leading-tight text-slate-400">
                  {effectiveRole === 'police' ? 'Police / Investigator' : session.roleLabel}
                </span>
              </div>
            </button>

            {/* Dropdown */}
            {profileOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200/90 bg-white shadow-xl p-1.5 z-50 animate-fade-in"
              >
                <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                  <p className="text-[13.5px] font-bold text-slate-900">
                    {effectiveRole === 'police' ? 'DCP R. Sharma' : session.name}
                  </p>
                  <p className="text-[11.5px] text-slate-400">
                    {effectiveRole === 'police' ? 'Police / Investigator' : session.roleLabel}
                  </p>
                </div>

                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => setProfileOpen(false)}
                >
                  <User size={15} />
                  Profile
                </button>

                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => setProfileOpen(false)}
                >
                  <Settings size={15} />
                  Settings
                </button>

                <div className="border-t border-slate-100 my-1" />

                <button
                  onClick={() => {
                    setProfileOpen(false);
                    authApi.logout();
                    router.push('/login');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <LogOut size={15} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <NotificationsDrawer
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </>
  );
}
