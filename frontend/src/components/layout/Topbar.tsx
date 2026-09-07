'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { toggleTheme, setCommandPaletteOpen, setRole } from '@/store/slices/uiSlice';
import type { UserRole } from '@/store/slices/uiSlice';
import { Search, Bell, Sun, Moon, Command } from 'lucide-react';
import { mockAlertService } from '@/services/mockServices';
import NotificationsDrawer from './NotificationsDrawer';

const roleMeta: Record<UserRole, { label: string; short: string; color: string }> = {
  police: { label: 'Police / Investigator', short: 'POL', color: '#4F46E5' },
  citizen: { label: 'Citizen', short: 'CTZ', color: '#16A34A' },
  admin: { label: 'Administrator', short: 'ADM', color: '#D97706' },
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

  const [unreadAlerts, setUnreadAlerts] = useState(3);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  useEffect(() => {
    mockAlertService.getUnreadCount().then((cnt) => setUnreadAlerts(cnt > 0 ? cnt : 3));
  }, []);

  const handleSearch = useCallback(() => {
    dispatch(setCommandPaletteOpen(true));
  }, [dispatch]);

  const meta = roleMeta[effectiveRole] ?? roleMeta.police;

  const sidebarOffset = collapsed
    ? 'var(--sidebar-collapsed-width, 68px)'
    : 'var(--sidebar-width, 272px)';

  return (
    <>
      <header
        className="fixed top-0 right-0 z-30 flex items-center justify-between px-5 border-b transition-all duration-200 glass-panel"
        style={{
          left: sidebarOffset,
          height: 'var(--topbar-height, 60px)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Left: Search & Context */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSearch}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-[13.5px] transition-all hover:bg-[var(--glass-2)] border"
            style={{ color: 'var(--ink-secondary)', borderColor: 'var(--border)' }}
          >
            <Search size={15} strokeWidth={1.7} />
            <span className="hidden sm:inline text-[13px]">Search intelligence, cases, entities...</span>
            <span className="sm:hidden text-[13px]">Search...</span>
            <span
              className="flex items-center gap-0.5 ml-1 text-[11px] font-mono-id px-1.5 py-0.5 rounded-md bg-[var(--surface-2)]"
              style={{ color: 'var(--ink-tertiary)' }}
            >
              <Command size={10} />K
            </span>
          </button>

        </div>

        {/* Right: Bells, theme, user */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <button
            onClick={() => setNotificationsOpen(true)}
            className="relative flex items-center justify-center w-9 h-9 rounded-xl hover:bg-[var(--glass-2)] transition-colors"
            style={{ color: 'var(--ink-secondary)' }}
            title="Notifications"
          >
            <Bell size={17} strokeWidth={1.8} />
            {unreadAlerts > 0 && (
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ background: 'var(--error)' }}
              />
            )}
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => dispatch(toggleTheme())}
            className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-[var(--glass-2)] transition-colors"
            style={{ color: 'var(--ink-secondary)' }}
            title="Toggle theme"
          >
            {theme === 'light' ? <Moon size={17} strokeWidth={1.8} /> : <Sun size={17} strokeWidth={1.8} />}
          </button>

          {/* User / Role badge with dropdown */}
          <div className="relative ml-1 pl-3 border-l" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setRoleDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-[var(--glass-2)] transition-colors text-left"
              title="Switch role / Profile"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-sm shrink-0"
                style={{ background: meta.color }}
              >
                {meta.short}
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--ink-primary)' }}>
                  {effectiveRole === 'police' ? 'DCP R. Sharma' : effectiveRole === 'admin' ? 'Admin' : 'Citizen User'}
                </span>
                <span className="text-[11px] leading-tight" style={{ color: 'var(--ink-tertiary)' }}>
                  {meta.label}
                </span>
              </div>
            </button>

            {/* Dropdown Menu */}
            {roleDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-2xl border shadow-2xl p-2 z-50 animate-fade-in glass-panel"
                style={{
                  background: 'var(--surface-1)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="px-3 py-2 border-b mb-1" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-[11px] uppercase tracking-wider font-bold" style={{ color: 'var(--ink-tertiary)' }}>
                    Switch Active Role
                  </p>
                  <p className="text-[12.5px] font-medium" style={{ color: 'var(--ink-primary)' }}>
                    Current: <strong style={{ color: meta.color }}>{meta.label}</strong>
                  </p>
                </div>

                <div className="space-y-1">
                  {(['police', 'citizen', 'admin'] as UserRole[]).map((r) => {
                    const isCurrent = r === effectiveRole;
                    const rMeta = roleMeta[r];
                    return (
                      <button
                        key={r}
                        onClick={() => {
                          dispatch(setRole(r));
                          setRoleDropdownOpen(false);
                          if (r === 'citizen') router.push('/citizen');
                          else if (r === 'admin') router.push('/admin');
                          else router.push('/dashboard');
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] font-medium transition-all ${
                          isCurrent
                            ? 'bg-[var(--surface-2)] shadow-sm'
                            : 'hover:bg-[var(--glass-2)]'
                        }`}
                        style={{ color: isCurrent ? rMeta.color : 'var(--ink-primary)' }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: rMeta.color }}
                          />
                          <span>{rMeta.label}</span>
                        </div>
                        {isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-3)] font-mono-id">
                            Active
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <button
                    onClick={() => {
                      setRoleDropdownOpen(false);
                      router.push('/login');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-[12px] font-medium hover:bg-[var(--surface-2)] transition-colors"
                    style={{ color: 'var(--ink-secondary)' }}
                  >
                    ← Back to Role Login Screen
                  </button>
                </div>
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
