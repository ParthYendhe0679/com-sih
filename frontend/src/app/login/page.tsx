'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setRole, toggleTheme } from '@/store/slices/uiSlice';
import type { UserRole } from '@/store/slices/uiSlice';
import { toast } from 'sonner';
import { ArrowRight, Sun, Moon, Eye, EyeOff, ShieldCheck, UserCircle2, Settings2, Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api/auth';
import NetworkBackdrop from '@/components/auth/NetworkBackdrop';

const demoCredentials: Record<UserRole, { email: string; password: string; label: string }> = {
  admin: { email: 'admin@kritagas.gov.in', password: 'Admin@123456', label: 'Admin' },
  police: { email: 'inspector.sharma@police.gov.in', password: 'Police@123456', label: 'Police / Investigator' },
  citizen: { email: 'citizen.rahul@gmail.com', password: 'Citizen@123456', label: 'Citizen' },
};

const roleConfig: Record<UserRole, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; bg: string }> = {
  admin: { icon: Settings2, color: '#D97706', bg: 'rgba(217, 119, 6, 0.1)' },
  police: { icon: ShieldCheck, color: '#4F46E5', bg: 'rgba(79, 70, 229, 0.1)' },
  citizen: { icon: UserCircle2, color: '#16A34A', bg: 'rgba(22, 163, 74, 0.1)' },
};

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.ui.theme);
  const isDark = theme === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [demoLoading, setDemoLoading] = useState<UserRole | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await authApi.login(email, password);
      const role: UserRole =
        res.role === 'ADMIN' ? 'admin' :
        res.role === 'CITIZEN' ? 'citizen' : 'police';
      dispatch(setRole(role));
      toast.success(`Welcome back, ${res.username}`);
      navigateToPortal(role);
    } catch (err: any) {
      // Fallback: try to match demo credentials
      const matchedRole = (Object.keys(demoCredentials) as UserRole[]).find(
        (r) => demoCredentials[r].email === email && demoCredentials[r].password === password
      );
      if (matchedRole) {
        dispatch(setRole(matchedRole));
        toast.success(`Session initialized for ${demoCredentials[matchedRole].label}`);
        navigateToPortal(matchedRole);
      } else {
        setError('Invalid credentials. Please check your email and password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async (role: UserRole) => {
    if (demoLoading || loading) return;
    setDemoLoading(role);
    setError('');

    const cred = demoCredentials[role];
    try {
      const res = await authApi.login(cred.email, cred.password);
      dispatch(setRole(role));
      toast.success(`Authenticated as ${res.username} (${res.role})`);
    } catch {
      dispatch(setRole(role));
      toast.info(`Demo session initialized for ${cred.label}`);
    }
    navigateToPortal(role);
    setDemoLoading(null);
  };

  const navigateToPortal = (role: UserRole) => {
    if (role === 'citizen') router.push('/citizen');
    else if (role === 'admin') router.push('/admin');
    else router.push('/dashboard');
  };

  return (
    <div className={`relative min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-300 ${isDark ? 'bg-[#07080D] text-[#F3F4F6]' : 'bg-[#F4F5F9] text-[#0F172A]'}`}>
      {/* Background: static wash + grid, then the drifting network graph */}
      <div className="fixed inset-0 login-bg-pattern pointer-events-none" />
      <div className="fixed inset-0 login-grid pointer-events-none" />
      <NetworkBackdrop isDark={isDark} />

      {/* Theme Toggle */}
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
            <><Sun size={15} className="text-amber-400" /><span>Light Mode</span></>
          ) : (
            <><Moon size={15} className="text-indigo-600" /><span>Dark Mode</span></>
          )}
        </button>
      </div>

      {/* Main Login Card */}
      <div className="relative z-10 w-full max-w-[440px] mx-auto">

        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-5">
            <div className={`relative w-16 h-16 rounded-2xl p-3 shadow-2xl flex items-center justify-center ${
              isDark
                ? 'bg-gradient-to-b from-[#1C2033] to-[#0D0F1A] border border-white/15'
                : 'bg-gradient-to-b from-[#FFFFFF] to-[#EEF2FF] border border-indigo-100 shadow-indigo-100/50'
            }`}>
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

          <h1 className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
            KRITAGAS
          </h1>
          <p className={`text-sm mt-2 font-medium tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Secure Intelligence & Investigation Platform
          </p>
        </div>

        {/* Login Form Card */}
        <div className={`rounded-2xl p-8 ${
          isDark
            ? 'bg-[#13141E]/90 border border-white/[0.08] shadow-2xl'
            : 'bg-white border border-gray-200/60 shadow-xl shadow-gray-200/30'
        }`}>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="login-email" className="form-label">
                Work Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.gov.in"
                className={`form-input ${isDark ? 'bg-[#1A1B28] border-white/10 text-white placeholder:text-gray-500 focus:border-indigo-400' : ''}`}
                autoComplete="email"
                disabled={loading || !!demoLoading}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="login-password" className="form-label">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`form-input pr-12 ${isDark ? 'bg-[#1A1B28] border-white/10 text-white placeholder:text-gray-500 focus:border-indigo-400' : ''}`}
                  autoComplete="current-password"
                  disabled={loading || !!demoLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${
                    isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'
                  }`}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className={`text-sm font-medium px-4 py-3 rounded-lg ${
                isDark ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-600 border border-red-100'
              }`}>
                {error}
              </div>
            )}

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading || !!demoLoading}
              className="btn-primary w-full py-3.5 text-[15px]"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin-slow" /> Signing in...</>
              ) : (
                <><ArrowRight size={18} /> Sign In</>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className={`flex-1 h-px ${isDark ? 'bg-white/[0.08]' : 'bg-gray-200'}`} />
            <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Quick Demo Sign-In
            </span>
            <div className={`flex-1 h-px ${isDark ? 'bg-white/[0.08]' : 'bg-gray-200'}`} />
          </div>

          {/* Demo Role Buttons */}
          <div className="grid grid-cols-3 gap-3">
            {(['admin', 'police', 'citizen'] as UserRole[]).map((role) => {
              const config = roleConfig[role];
              const cred = demoCredentials[role];
              const Icon = config.icon;
              const isLoading = demoLoading === role;

              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleDemoSignIn(role)}
                  disabled={loading || !!demoLoading}
                  className={`flex flex-col items-center gap-2 py-3.5 px-3 rounded-xl border text-center transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                    isDark
                      ? 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.15]'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                  }`}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: config.bg, color: config.color }}
                  >
                    {isLoading ? (
                      <Loader2 size={18} className="animate-spin-slow" />
                    ) : (
                      <Icon size={18} />
                    )}
                  </div>
                  <span className={`text-[12.5px] font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {cred.label.split(' / ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <p className={`text-center text-xs mt-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          KRITAGAS • Criminal Intelligence Platform • SIH 2026
        </p>
      </div>
    </div>
  );
}
