'use client';

// ============================================================
// KRITAGAS — Authenticated Session Hook
// Single source of truth for the signed-in identity used by the
// sidebar, topbar and role-aware pages. Replaces hardcoded names.
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import { authApi, type LoginResponse } from '@/lib/api/auth';
import type { UserRole } from '@/store/slices/uiSlice';

export interface Session {
  /** Display name for the signed-in user. */
  name: string;
  /** Normalised portal role. */
  role: UserRole;
  /** 2–3 letter avatar initials. */
  initials: string;
  /** Human label for the role, e.g. "Police / Investigator". */
  roleLabel: string;
  /** Police badge number when the backend supplies one. */
  badgeNumber?: string | null;
  /** True while the identity is still being resolved. */
  loading: boolean;
  /** True when a real backend session (token) is present. */
  authenticated: boolean;
}

export const roleLabels: Record<UserRole, string> = {
  police: 'Police / Investigator',
  citizen: 'Citizen',
  admin: 'Administrator',
};

export const roleColors: Record<UserRole, string> = {
  police: '#4F46E5',
  citizen: '#16A34A',
  admin: '#D97706',
};

export function normaliseRole(role?: string | null): UserRole {
  const r = (role || '').toLowerCase();
  if (r === 'admin') return 'admin';
  if (r === 'citizen') return 'citizen';
  return 'police';
}

function initialsFrom(name: string, role: UserRole): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  if (words.length === 1 && words[0].length >= 2) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return role === 'admin' ? 'ADM' : role === 'citizen' ? 'CTZ' : 'POL';
}

const fallbackNames: Record<UserRole, string> = {
  police: 'Investigating Officer',
  citizen: 'Citizen User',
  admin: 'System Administrator',
};

function buildSession(
  stored: LoginResponse | null,
  fullName: string | null,
  roleOverride: UserRole | undefined,
  loading: boolean
): Session {
  const role = roleOverride ?? normaliseRole(stored?.role);
  const name = fullName || stored?.username || fallbackNames[role];
  return {
    name,
    role,
    initials: initialsFrom(name, role),
    roleLabel: roleLabels[role],
    badgeNumber: stored?.badge_number ?? null,
    loading,
    authenticated: Boolean(stored?.access_token),
  };
}

/**
 * Resolves the current user identity.
 *
 * Reads the cached login payload synchronously (so the shell never flashes a
 * placeholder), then refreshes from `GET /auth/me` for the canonical full name.
 * `roleOverride` lets route-scoped portals (e.g. /admin) pin the role.
 */
export function useSession(roleOverride?: UserRole): Session {
  const [session, setSession] = useState<Session>(() =>
    buildSession(null, null, roleOverride, true)
  );

  const refresh = useCallback(async () => {
    const stored = authApi.getStoredUser();
    // Show the cached identity immediately.
    setSession(buildSession(stored, null, roleOverride, Boolean(stored?.access_token)));

    if (!stored?.access_token) {
      setSession(buildSession(stored, null, roleOverride, false));
      return;
    }

    try {
      const me = await authApi.getMe();
      setSession(
        buildSession(
          stored,
          me.full_name || me.username,
          roleOverride ?? normaliseRole(me.role),
          false
        )
      );
    } catch {
      // Token expired or backend unreachable — keep the cached identity.
      setSession(buildSession(stored, null, roleOverride, false));
    }
  }, [roleOverride]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return session;
}
