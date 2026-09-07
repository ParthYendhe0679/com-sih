'use client';

import React, { useEffect, Suspense } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import CommandPalette from './CommandPalette';
import EntityInspector from '@/components/shared/EntityInspector';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { setRole, getStoredRole } from '@/store/slices/uiSlice';
import { usePathname } from 'next/navigation';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const theme = useAppSelector((s) => s.ui.theme);
  const pathname = usePathname();
  const dispatch = useAppDispatch();

  const isAuthPage = pathname === '/login' || pathname === '/auth' || pathname === '/';

  // Apply dark class to html element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Hydrate role on client based on route or storage
  useEffect(() => {
    if (pathname?.startsWith('/citizen')) {
      dispatch(setRole('citizen'));
    } else if (pathname?.startsWith('/admin')) {
      dispatch(setRole('admin'));
    } else {
      const stored = getStoredRole();
      dispatch(setRole(stored));
    }
  }, [dispatch, pathname]);

  if (isAuthPage) {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-0)] text-[var(--ink-primary)]">
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <Topbar />
      <CommandPalette />
      <EntityInspector />

      {/* Main content area */}
      <main
        className="flex-1 transition-all duration-200 ease-out"
        style={{
          marginLeft: collapsed ? 'var(--sidebar-collapsed-width, 68px)' : 'var(--sidebar-width, 272px)',
          paddingTop: 'var(--topbar-height, 64px)',
        }}
      >
        <div className="min-h-full px-8 py-8 max-w-[1680px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
