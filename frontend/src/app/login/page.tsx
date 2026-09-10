'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setRole, toggleTheme } from '@/store/slices/uiSlice';
import type { UserRole } from '@/store/slices/uiSlice';
import { toast } from 'sonner';
import { ArrowRight, Sun, Moon, Eye, EyeOff, ShieldCheck, UserCircle2, Settings2, Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api/auth';

const demoCredentials: Record<UserRole, { email: string; password: string; label: string }> = {
  admin: { email: 'admin@TRINETRA.gov.in', password: 'Admin@123456', label: 'Admin' },
  police: { email: 'inspector.sharma@police.gov.in', password: 'Police@123456', label: 'Police / Investigator' },
  citizen: { email: 'citizen.rahul@gmail.com', password: 'Citizen@123456', label: 'Citizen' },
};

const roleConfig: Record<UserRole, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; bg: string }> = {
  admin: { icon: Settings2, color: '#4B5563', bg: '#F3F4F6' },
  police: { icon: ShieldCheck, color: '#4B5563', bg: '#F3F4F6' },
  citizen: { icon: UserCircle2, color: '#4B5563', bg: '#F3F4F6' },
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
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await authApi.login(email.trim(), password);
      const role: UserRole =
        res.role === 'ADMIN' ? 'admin' :
        res.role === 'CITIZEN' ? 'citizen' : 'police';
      dispatch(setRole(role));
      toast.success(`Welcome back, ${res.username}`);
      navigateToPortal(role);
    } catch (err: any) {
      // Fallback: try to match demo credentials
      const matchedRole = (Object.keys(demoCredentials) as UserRole[]).find(
        (r) => demoCredentials[r].email.toLowerCase() === email.trim().toLowerCase() && demoCredentials[r].password === password
      );
      if (matchedRole) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('TRINETRA_token', `demo-token-${matchedRole}-${Date.now()}`);
          localStorage.setItem('TRINETRA_role', matchedRole);
          localStorage.setItem('TRINETRA_user', JSON.stringify({
            username: demoCredentials[matchedRole].label,
            role: matchedRole.toUpperCase(),
            email: demoCredentials[matchedRole].email,
          }));
        }
        dispatch(setRole(matchedRole));
        toast.success(`Session initialized for ${demoCredentials[matchedRole].label}`);
        navigateToPortal(matchedRole);
      } else {
        setError('Invalid credentials. Please check your email and password or click one of the Demo buttons below.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDemoRole = (role: UserRole) => {
    const cred = demoCredentials[role];
    setEmail(cred.email);
    setPassword(cred.password);
    setSelectedRole(role);
    setError('');
    toast.info(`Filled credentials for ${cred.label}`, {
      description: 'Click "Sign In" to access the portal.',
    });
  };

  const navigateToPortal = (role: UserRole) => {
    if (role === 'citizen') router.push('/citizen');
    else if (role === 'admin') router.push('/admin');
    else router.push('/dashboard');
  };

  return (
    <div className={`relative min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-300 ${isDark ? 'bg-[#07080D] text-[#F9FAFB]' : 'bg-white text-[#111827]'}`}>
      {/* One quiet layer only. The drifting node graph and the purple wash
          fought the sign-in card for attention and made the logo look grubby. */}
      <div className="fixed inset-0 login-grid pointer-events-none opacity-60" />

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

          <h1
            className="font-display text-[30px] font-semibold leading-tight mt-1"
            style={{ color: isDark ? '#F9FAFB' : 'var(--ink-primary)' }}
          >
            Sign in to TRINETRA
          </h1>
          <p className={`text-sm mt-2 font-medium tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Criminal Network Intelligence &amp; Investigation Platform
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
                disabled={loading}
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
                  disabled={loading}
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
              disabled={loading}
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
              const isSelected = selectedRole === role;

              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => handleSelectDemoRole(role)}
                  disabled={loading}
                  className={`flex flex-col items-center gap-2 py-3.5 px-3 rounded-xl border text-center transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/40 shadow-md'
                      : isDark
                        ? 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.15]'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-transform ${
                      isSelected ? 'scale-110 shadow-sm' : ''
                    }`}
                    style={{ background: config.bg, color: config.color }}
                  >
                    <Icon size={18} />
                  </div>
                  <span className={`text-[12.5px] font-semibold ${isSelected ? 'text-indigo-500 font-semibold' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {cred.label.split(' / ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <p className={`text-center text-xs mt-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          TRINETRA • Criminal Intelligence Platform • SIH 2026
        </p>
      </div>
    </div>
  );
}
