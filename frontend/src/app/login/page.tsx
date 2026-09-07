'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setRole, toggleTheme } from '@/store/slices/uiSlice';
import type { UserRole } from '@/store/slices/uiSlice';
import { toast } from 'sonner';
import { ShieldCheck, UserCircle2, Settings2, ArrowRight, Sun, Moon } from 'lucide-react';
import { authApi } from '@/lib/api/auth';

interface RolePortal {
  role: UserRole;
  label: string;
  badge: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentColor: string;
  accentGlow: string;
  accentBg: string;
  borderHover: string;
  isPrimary?: boolean;
}

const portals: RolePortal[] = [
  {
    role: 'citizen',
    label: 'Citizen Portal',
    badge: 'Public Access',
    icon: UserCircle2,
    accentColor: '#10B981',
    accentGlow: 'rgba(16, 185, 129, 0.25)',
    accentBg: 'rgba(16, 185, 129, 0.1)',
    borderHover: 'rgba(16, 185, 129, 0.55)',
  },
  {
    role: 'police',
    label: 'Police / Investigator',
    badge: 'Intelligence Command',
    icon: ShieldCheck,
    accentColor: '#6366F1',
    accentGlow: 'rgba(99, 102, 241, 0.35)',
    accentBg: 'rgba(99, 102, 241, 0.14)',
    borderHover: 'rgba(99, 102, 241, 0.75)',
    isPrimary: true,
  },
  {
    role: 'admin',
    label: 'Administration',
    badge: 'System Governance',
    icon: Settings2,
    accentColor: '#F59E0B',
    accentGlow: 'rgba(245, 158, 11, 0.25)',
    accentBg: 'rgba(245, 158, 11, 0.1)',
    borderHover: 'rgba(245, 158, 11, 0.55)',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.ui.theme);
  const [loading, setLoading] = useState<UserRole | null>(null);

  const isDark = theme === 'dark';

  const handleSelect = async (role: UserRole) => {
    if (loading) return;
    setLoading(role);

    try {
      const credentials: Record<UserRole, { u: string; p: string }> = {
        police: { u: 'inspector.sharma@police.gov.in', p: 'Police@123456' },
        citizen: { u: 'citizen.rahul@gmail.com', p: 'Citizen@123456' },
        admin: { u: 'admin@kritagas.gov.in', p: 'Admin@123456' },
      };

      const cred = credentials[role];
      const res = await authApi.login(cred.u, cred.p);
      dispatch(setRole(role));
      toast.success(`Authenticated as ${res.username} (${res.role})`);

      if (role === 'citizen') router.push('/citizen');
      else if (role === 'admin') router.push('/admin');
      else router.push('/dashboard');
    } catch (err: any) {
      console.warn('Backend login notice:', err);
      dispatch(setRole(role));
      const portal = portals.find((p) => p.role === role);
      toast.info(`Session initialized for ${portal?.label ?? role}`);
      if (role === 'citizen') router.push('/citizen');
      else if (role === 'admin') router.push('/admin');
      else router.push('/dashboard');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div
      className={`relative min-h-screen flex flex-col justify-between items-center p-6 selection:bg-indigo-500/30 overflow-hidden transition-colors duration-300 ${
        isDark ? 'bg-[#07080D] text-[#F3F4F6]' : 'bg-[#F4F5F9] text-[#0F172A]'
      }`}
    >
      {/* Background Subtle Grid */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: isDark ? 0.25 : 0.45,
          backgroundImage: isDark
            ? `linear-gradient(to right, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
               linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 1px, transparent 1px)`
            : `linear-gradient(to right, rgba(15, 23, 42, 0.04) 1px, transparent 1px),
               linear-gradient(to bottom, rgba(15, 23, 42, 0.04) 1px, transparent 1px)`,
          backgroundSize: '44px 44px',
        }}
      />

      {/* Ambient Lighting */}
      <div
        className="fixed -top-32 left-1/2 -translate-x-1/2 w-[650px] h-[350px] rounded-full blur-[110px] pointer-events-none transition-colors duration-300"
        style={{
          background: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.10)',
        }}
      />

      {/* ── TOP RIGHT: Theme Toggle ────────────────────────────── */}
      <div className="absolute top-5 right-6 z-30">
        <button
          type="button"
          onClick={() => dispatch(toggleTheme())}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold backdrop-blur-md transition-all duration-200 cursor-pointer shadow-sm hover:scale-105 ${
            isDark
              ? 'bg-white/[0.07] border border-white/[0.12] text-gray-200 hover:bg-white/[0.12]'
              : 'bg-white/90 border border-black/[0.08] text-gray-700 hover:bg-white shadow-md'
          }`}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        >
          {isDark ? (
            <>
              <Sun size={15} className="text-amber-400" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon size={15} className="text-indigo-600" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {/* Top spacing */}
      <div className="h-4" />

      {/* ── Brand Header (Centered Logo & Name) ──────────────── */}
      <div className="relative z-10 text-center max-w-lg mx-auto my-auto pt-4 pb-6">
        {/* Centered Modern Vector Emblem */}
        <div className="inline-flex items-center justify-center relative mb-4 group cursor-pointer">
          <div
            className="absolute inset-0 rounded-2xl blur-xl transition-all duration-300 group-hover:blur-2xl"
            style={{
              background: isDark ? 'rgba(99, 102, 241, 0.35)' : 'rgba(99, 102, 241, 0.25)',
            }}
          />
          <div
            className={`relative w-16 h-16 rounded-2xl p-3 shadow-2xl flex items-center justify-center transition-all duration-300 ${
              isDark
                ? 'bg-gradient-to-b from-[#1C2033] to-[#0D0F1A] border border-white/15'
                : 'bg-gradient-to-b from-[#FFFFFF] to-[#EEF2FF] border border-indigo-100 shadow-indigo-100/50'
            }`}
          >
            <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
              <circle cx="24" cy="24" r="21" stroke="url(#emblem-grad)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
              <polygon points="24,6 40,15 40,33 24,42 8,33 8,15" stroke="url(#emblem-grad)" strokeWidth="1.75" fill={isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.05)'} />
              <path d="M24 14 L32 20 L32 28 L24 34 L16 28 L16 20 Z" fill="url(#core-grad)" opacity="0.95" />
              <circle cx="24" cy="24" r="3.5" fill={isDark ? '#FFFFFF' : '#4F46E5'} />
              <defs>
                <linearGradient id="emblem-grad" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#818CF8" />
                  <stop offset="0.5" stopColor="#6366F1" />
                  <stop offset="1" stopColor="#38BDF8" />
                </linearGradient>
                <linearGradient id="core-grad" x1="16" y1="14" x2="32" y2="34" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366F1" />
                  <stop offset="1" stopColor="#4F46E5" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Centered Name */}
        <h1
          className={`text-3xl sm:text-4xl font-extrabold tracking-tight transition-colors duration-300 ${
            isDark ? 'text-white' : 'text-[#0F172A]'
          }`}
        >
          KRITAGAS
        </h1>
        <p
          className={`text-xs sm:text-sm mt-2 font-medium tracking-wide transition-colors duration-300 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          Criminal Network Intelligence & Investigation Platform
        </p>
      </div>

      {/* ── 3 Centered Portal Cards (Pure & Minimalist) ────────── */}
      <div className="relative z-10 w-full max-w-[960px] mx-auto my-auto pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {portals.map((p) => {
            const Icon = p.icon;
            const isLoading = loading === p.role;
            const isOtherLoading = loading !== null && !isLoading;

            return (
              <div
                key={p.role}
                onClick={() => handleSelect(p.role)}
                className={`relative group rounded-2xl p-7 text-center transition-all duration-300 flex flex-col items-center justify-between cursor-pointer ${
                  p.isPrimary ? 'md:-translate-y-1.5' : ''
                } ${isOtherLoading ? 'opacity-30 pointer-events-none' : 'opacity-100 hover:-translate-y-2'}`}
                style={{
                  background: isDark
                    ? 'linear-gradient(180deg, rgba(21, 25, 40, 0.85) 0%, rgba(12, 14, 23, 0.95) 100%)'
                    : '#FFFFFF',
                  border: isDark
                    ? `1px solid ${p.isPrimary ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.09)'}`
                    : `1px solid ${p.isPrimary ? 'rgba(99, 102, 241, 0.3)' : 'rgba(15, 23, 42, 0.08)'}`,
                  boxShadow: isDark
                    ? p.isPrimary
                      ? `0 10px 35px -6px ${p.accentGlow}`
                      : '0 4px 20px rgba(0, 0, 0, 0.4)'
                    : p.isPrimary
                      ? `0 12px 30px -6px rgba(99, 102, 241, 0.18), 0 2px 8px rgba(0, 0, 0, 0.04)`
                      : '0 8px 24px -4px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0, 0, 0, 0.02)',
                }}
              >
                {/* Glow border on hover */}
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    boxShadow: `inset 0 0 0 1px ${p.borderHover}, 0 0 24px ${p.accentGlow}`,
                  }}
                />

                {/* Centered Icon with Glow */}
                <div className="relative mb-5 mt-1">
                  <div
                    className="absolute inset-0 rounded-2xl blur-md opacity-40 transition-opacity duration-300 group-hover:opacity-80"
                    style={{ background: p.accentColor }}
                  />
                  <div
                    className="relative w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-lg"
                    style={{
                      background: p.accentBg,
                      color: p.accentColor,
                      border: `1px solid ${p.accentColor}44`,
                    }}
                  >
                    <Icon size={30} />
                  </div>
                </div>

                {/* Centered Name / Title */}
                <div className="flex flex-col items-center mb-6">
                  <h2
                    className={`text-xl font-bold tracking-tight transition-colors ${
                      isDark ? 'text-white' : 'text-[#0F172A]'
                    }`}
                  >
                    {p.label}
                  </h2>
                  <span
                    className="inline-block mt-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                    style={{
                      background: p.accentBg,
                      color: p.accentColor,
                      border: `1px solid ${p.accentColor}33`,
                    }}
                  >
                    {p.badge}
                  </span>
                </div>

                {/* Centered Action Button (Full Width) */}
                <button
                  type="button"
                  disabled={loading !== null}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer disabled:cursor-not-allowed group-hover:brightness-105 shadow-md ${
                    p.isPrimary
                      ? 'text-white'
                      : isDark
                        ? 'bg-white/[0.08] text-white border border-white/10 hover:bg-white/[0.12]'
                        : 'bg-slate-50 text-slate-800 border border-slate-200 hover:bg-slate-100'
                  }`}
                  style={
                    p.isPrimary
                      ? {
                          background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                          border: '1px solid rgba(255, 255, 255, 0.25)',
                          boxShadow: '0 2px 14px rgba(79, 70, 229, 0.35)',
                        }
                      : undefined
                  }
                >
                  {isLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Opening...</span>
                    </>
                  ) : (
                    <>
                      <span>Enter Portal</span>
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Simple, Clean 1-Line Footer ─────────────────────────── */}
      <footer
        className={`relative z-10 text-center py-3 text-[11px] font-mono transition-colors duration-300 ${
          isDark ? 'text-gray-500' : 'text-gray-400'
        }`}
      >
        KRITAGAS • Smart India Hackathon • Synthetic Intelligence Demo
      </footer>
    </div>
  );
}
