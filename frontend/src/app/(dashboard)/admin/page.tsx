'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { dashboardApi, type AdminDashboardStats } from '@/lib/api/dashboard';
import { auditLogs } from '@/mock';
import {
  CheckCircle2, Search, Shield, Eye, Edit2
} from 'lucide-react';
import { toast } from 'sonner';

type TabKey = 'dashboard' | 'users' | 'roles' | 'audit' | 'security';

const mockUsers = [
  { id: 'USR-001', name: 'DCP R. Sharma', role: 'Supervisory Officer', dept: 'Economic Offences Wing', status: 'Active', badge: 'DCP/MUM/0456', lastActive: '2 min ago' },
  { id: 'USR-002', name: 'ACP V. Patil', role: 'Lead Investigator', dept: 'Crime Branch Unit 3', status: 'Active', badge: 'ACP/MUM/0891', lastActive: '18 min ago' },
  { id: 'USR-003', name: 'SI M. Khan', role: 'Field Intelligence Officer', dept: 'Cyber & Technical Cell', status: 'Active', badge: 'SI/MUM/1423', lastActive: '1 hr ago' },
  { id: 'USR-004', name: 'DI P. Reddy', role: 'Forensic Analyst', dept: 'Digital Evidence Laboratory', status: 'Active', badge: 'DI/MUM/0912', lastActive: '3 hr ago' },
  { id: 'USR-005', name: 'CI A. Nair', role: 'Intelligence Officer', dept: 'Anti-Narcotics Cell', status: 'Inactive', badge: 'CI/MUM/0334', lastActive: '2 days ago' },
];

const mockRoles = [
  {
    name: 'Citizen',
    color: '#16A34A',
    users: 1240,
    permissions: ['File Complaint', 'View Own Complaint Status', 'Upload Supporting Documents', 'Receive Notifications'],
  },
  {
    name: 'Police Investigator',
    color: '#4F46E5',
    users: 87,
    permissions: ['Case Management', 'Network Graph', 'Evidence Hub', 'FIR Intelligence', 'Live Feed', 'Historical Intelligence'],
  },
  {
    name: 'Administrator',
    color: '#D97706',
    users: 4,
    permissions: ['All Police Permissions', 'User Management', 'Role Management', 'Audit Logs', 'Security Monitoring', 'System Health'],
  },
];

const securityEvents = [
  { time: '15:42:08', event: 'Successful login', user: 'DCP R. Sharma', ip: '192.168.1.45', severity: 'info' },
  { time: '15:36:22', event: 'Evidence accessed', user: 'DI P. Reddy', ip: '192.168.1.92', severity: 'info' },
  { time: '15:28:14', event: 'Failed login attempt', user: 'UNKNOWN', ip: '103.27.14.88', severity: 'warning' },
  { time: '15:21:07', event: 'Role permission change', user: 'ADMIN', ip: '192.168.1.10', severity: 'warning' },
  { time: '15:10:55', event: 'Case record exported', user: 'ACP V. Patil', ip: '192.168.1.72', severity: 'info' },
  { time: '14:58:30', event: 'Access from unknown device', user: 'SI M. Khan', ip: '45.151.82.4', severity: 'critical' },
];

function AdminContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey =
    tabParam && ['dashboard', 'users', 'roles', 'audit', 'security'].includes(tabParam)
      ? tabParam
      : 'dashboard';
  const [searchLog, setSearchLog] = useState('');
  const [adminStats, setAdminStats] = useState<AdminDashboardStats | null>(null);

  useEffect(() => {
    let active = true;
    dashboardApi
      .getAdminDashboard()
      .then((data) => {
        if (active && data) setAdminStats(data);
      })
      .catch((err) => {
        console.warn('Admin stats notice:', err);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredLogs = auditLogs.filter((log) => {
    if (!searchLog) return true;
    const q = searchLog.toLowerCase();
    return log.action.toLowerCase().includes(q) || log.userName.toLowerCase().includes(q) || log.target.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
            System Administration
          </h1>
          <span className="text-[12px] font-semibold px-3 py-1 rounded-full"
            style={{ background: 'rgba(217,119,6,0.1)', color: '#D97706' }}>
            Audited Environment
          </span>
        </div>
        <p className="text-[14px]" style={{ color: 'var(--ink-secondary)' }}>
          User management, role-based access control, audit logs, and security monitoring
        </p>
      </div>

      {/* ── Admin Dashboard ───────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-fade-in">
          {/* System metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                label: 'Total Users',
                value: adminStats ? String(adminStats.total_users) : '1,331',
                sub: adminStats ? `${adminStats.total_police_officers} officers` : '+12 this month',
                color: '#4F46E5',
                bg: 'rgba(79,70,229,0.08)'
              },
              {
                label: 'Active Investigators',
                value: adminStats ? String(adminStats.total_police_officers || adminStats.active_police_officers || 0) : '87',
                sub: 'Assigned officers',
                color: '#16A34A',
                bg: 'rgba(22,163,74,0.08)'
              },
              {
                label: 'Active Investigations',
                value: adminStats ? String(adminStats.total_cases) : '128',
                sub: adminStats ? `${adminStats.total_firs} FIRs filed` : '23 critical',
                color: '#D97706',
                bg: 'rgba(217,119,6,0.08)'
              },
              {
                label: 'System Uptime',
                value: '99.97%',
                sub: 'Operational & Audited',
                color: '#0891B2',
                bg: 'rgba(8,145,178,0.08)'
              },
            ].map((m) => (
              <div key={m.label} className="p-5 rounded-2xl border" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
                <div className="text-[30px] font-bold font-mono-id" style={{ color: m.color }}>{m.value}</div>
                <div className="text-[13.5px] font-semibold mt-1" style={{ color: 'var(--ink-primary)' }}>{m.label}</div>
                <div className="text-[12px] mt-0.5" style={{ color: 'var(--ink-tertiary)' }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Recent activity + system health */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl border" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
              <h3 className="text-[16px] font-bold mb-4" style={{ color: 'var(--ink-primary)' }}>Recent System Activity</h3>
              <div className="space-y-3">
                {securityEvents.slice(0, 5).map((ev, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: 'var(--surface-2)' }}>
                    <div>
                      <div className="text-[13px] font-medium" style={{ color: 'var(--ink-primary)' }}>{ev.event}</div>
                      <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--ink-tertiary)' }}>{ev.user} • {ev.ip}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-mono-id text-[11px]" style={{ color: 'var(--ink-tertiary)' }}>{ev.time}</span>
                      <span className={`badge ${ev.severity === 'critical' ? 'badge-critical' : ev.severity === 'warning' ? 'badge-review' : 'badge-low'}`}>
                        {ev.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 rounded-2xl border" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
              <h3 className="text-[16px] font-bold mb-4" style={{ color: 'var(--ink-primary)' }}>System Health</h3>
              <div className="space-y-4">
                {[
                  { label: 'Ingestion Pipeline', value: '42,190 rec/s', status: 'Healthy', color: '#16A34A' },
                  { label: 'Graph Engine', value: '1M nodes capacity', status: 'Healthy', color: '#16A34A' },
                  { label: 'Cryptographic Seals', value: '100% verified', status: 'Healthy', color: '#16A34A' },
                  { label: 'Blockchain Ledger', value: 'Block #892341', status: 'Synced', color: '#16A34A' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3.5 rounded-xl border"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                    <div>
                      <div className="text-[13px] font-medium" style={{ color: 'var(--ink-primary)' }}>{item.label}</div>
                      <div className="text-[12px] font-mono-id" style={{ color: 'var(--ink-tertiary)' }}>{item.value}</div>
                    </div>
                    <span className="badge badge-active">{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── User Management ───────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>
              Authorized Personnel ({mockUsers.length})
            </h2>
            <button
              onClick={() => toast.success('User management form would open here.')}
              className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-90"
              style={{ background: '#D97706' }}>
              + Add User
            </button>
          </div>
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
            <table className="w-full border-collapse table-dense text-left">
              <thead>
                <tr>
                  <th>Officer</th>
                  <th>Badge ID</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Last Active</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                          style={{ background: u.status === 'Active' ? 'var(--accent)' : 'var(--ink-tertiary)' }}>
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-[13.5px]" style={{ color: 'var(--ink-primary)' }}>{u.name}</div>
                          <div className="text-[11px]" style={{ color: 'var(--ink-tertiary)' }}>{u.id}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="font-mono-id text-[12px]" style={{ color: 'var(--ink-secondary)' }}>{u.badge}</span></td>
                    <td><span className="text-[12.5px] font-medium" style={{ color: 'var(--ink-primary)' }}>{u.role}</span></td>
                    <td><span className="text-[12.5px]" style={{ color: 'var(--ink-secondary)' }}>{u.dept}</span></td>
                    <td><span className="text-[12px] font-mono-id" style={{ color: 'var(--ink-tertiary)' }}>{u.lastActive}</span></td>
                    <td>
                      <span className={`badge ${u.status === 'Active' ? 'badge-active' : 'badge-closed'}`}>{u.status}</span>
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        <button onClick={() => toast.info(`Viewing ${u.name}`)} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors" style={{ color: 'var(--ink-secondary)' }}>
                          <Eye size={14} />
                        </button>
                        <button onClick={() => toast.info(`Editing ${u.name}`)} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors" style={{ color: 'var(--accent)' }}>
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Role Management ───────────────────────────────────── */}
      {activeTab === 'roles' && (
        <div className="space-y-5 animate-fade-in">
          <h2 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>Role-Based Access Control</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {mockRoles.map((role) => (
              <div key={role.name} className="p-6 rounded-2xl border"
                style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: `${role.color}14`, color: role.color }}>
                      <Shield size={18} />
                    </div>
                    <h3 className="text-[15px] font-bold" style={{ color: 'var(--ink-primary)' }}>{role.name}</h3>
                  </div>
                  <span className="font-mono-id text-[11px] px-2 py-1 rounded-lg"
                    style={{ background: `${role.color}12`, color: role.color }}>
                    {role.users.toLocaleString()} users
                  </span>
                </div>
                <div className="space-y-2">
                  {role.permissions.map((perm) => (
                    <div key={perm} className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--ink-secondary)' }}>
                      <CheckCircle2 size={13} style={{ color: role.color, flexShrink: 0 }} />
                      {perm}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Audit Logs ───────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>Immutable Audit Trail</h2>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-tertiary)' }} />
              <input
                type="text"
                value={searchLog}
                onChange={(e) => setSearchLog(e.target.value)}
                placeholder="Search by user, action, target..."
                className="h-9 pl-9 pr-4 w-72 rounded-xl border text-[13px] bg-[var(--surface-1)] outline-none"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}
              />
            </div>
          </div>
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
            <table className="w-full border-collapse table-dense text-left">
              <thead>
                <tr>
                  <th>Log ID</th>
                  <th>Action</th>
                  <th>Target Record</th>
                  <th>Officer</th>
                  <th>IP Address</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.slice(0, 20).map((log) => (
                  <tr key={log.id}>
                    <td><span className="font-mono-id font-semibold" style={{ color: 'var(--accent)' }}>{log.id}</span></td>
                    <td><span className="font-medium" style={{ color: 'var(--ink-primary)' }}>{log.action}</span></td>
                    <td><span className="font-mono-id text-[12px]" style={{ color: 'var(--ink-secondary)' }}>{log.target}</span></td>
                    <td><span className="font-medium" style={{ color: 'var(--ink-primary)' }}>{log.userName}</span></td>
                    <td><span className="font-mono-id text-[11.5px]" style={{ color: 'var(--ink-tertiary)' }}>{log.ipAddress}</span></td>
                    <td><span className="font-mono-id text-[11.5px]" style={{ color: 'var(--ink-secondary)' }}>{log.timestamp.replace('T', ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[12px]" style={{ color: 'var(--ink-tertiary)' }}>
            Showing {Math.min(filteredLogs.length, 20)} of {filteredLogs.length} immutable audit records
          </div>
        </div>
      )}

      {/* ── Security ─────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-[18px] font-bold" style={{ color: 'var(--ink-primary)' }}>Security & Threat Monitoring</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-6 rounded-2xl border" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
              <h3 className="text-[16px] font-bold mb-4" style={{ color: 'var(--ink-primary)' }}>Security Events (Today)</h3>
              <div className="space-y-2.5">
                {securityEvents.map((ev, i) => (
                  <div key={i} className="p-3.5 rounded-xl border"
                    style={{
                      background: 'var(--surface-2)',
                      borderColor: ev.severity === 'critical' ? 'rgba(220,38,38,0.3)' : 'var(--border)',
                    }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`badge ${ev.severity === 'critical' ? 'badge-critical' : ev.severity === 'warning' ? 'badge-review' : 'badge-low'}`}>
                        {ev.severity}
                      </span>
                      <span className="font-mono-id text-[11px]" style={{ color: 'var(--ink-tertiary)' }}>{ev.time}</span>
                    </div>
                    <div className="text-[13px] font-medium" style={{ color: 'var(--ink-primary)' }}>{ev.event}</div>
                    <div className="text-[11.5px] mt-0.5 font-mono-id" style={{ color: 'var(--ink-secondary)' }}>
                      {ev.user} • {ev.ip}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 rounded-2xl border" style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}>
              <h3 className="text-[16px] font-bold mb-4" style={{ color: 'var(--ink-primary)' }}>Security Summary</h3>
              <div className="space-y-4">
                {[
                  { label: 'Login Attempts (24h)', value: '127', safe: true },
                  { label: 'Failed Logins', value: '3', safe: false },
                  { label: 'Active Sessions', value: '14', safe: true },
                  { label: 'Access Violations', value: '1', safe: false },
                  { label: 'Evidence Views Logged', value: '89', safe: true },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between p-3.5 rounded-xl"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <span className="text-[13px]" style={{ color: 'var(--ink-secondary)' }}>{stat.label}</span>
                    <span className="font-mono-id font-bold text-[16px]" style={{ color: stat.safe ? 'var(--success)' : '#DC2626' }}>
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="h-32 flex items-center justify-center text-[var(--ink-tertiary)]">Loading...</div>}>
      <AdminContent />
    </Suspense>
  );
}
