'use client';

import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setWatchlist, addToWatchlist, removeFromWatchlist, updateWatchlistStatus
} from '@/store/slices/watchlistSlice';
import { openInspector } from '@/store/slices/uiSlice';
import { mockWatchlistService } from '@/services/mockServices';
import type { EntityType, WatchlistStatus, WatchlistItem } from '@/types';
import {
  BookmarkCheck, Plus, Trash2, Pause, Play, Eye,
  User, Car, Phone, MapPin, Building2, FolderOpen, Shield
} from 'lucide-react';
import { toast } from 'sonner';

export default function WatchlistPage() {
  const dispatch = useAppDispatch();
  const watchlistItems = useAppSelector((s) => s.watchlist.items);

  const [modalOpen, setModalOpen] = useState(false);
  const [newEntityId, setNewEntityId] = useState('');
  const [newEntityType, setNewEntityType] = useState<EntityType>('Person');
  const [newEntityName, setNewEntityName] = useState('');
  const [newReason, setNewReason] = useState('');

  useEffect(() => {
    if (watchlistItems.length === 0) {
      mockWatchlistService.getWatchlist().then((items) => {
        dispatch(setWatchlist(items));
      });
    }
  }, [dispatch, watchlistItems.length]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntityId || !newEntityName) {
      toast.error('Please specify entity ID and name');
      return;
    }
    dispatch(
      addToWatchlist({
        entityId: newEntityId,
        entityType: newEntityType,
        entityName: newEntityName,
        reason: newReason || 'Investigative surveillance requirement',
      })
    );
    toast.success(`Added ${newEntityName} (${newEntityId}) to Surveillance Watchlist`);
    setModalOpen(false);
    setNewEntityId('');
    setNewEntityName('');
    setNewReason('');
  };

  const handleToggleStatus = (item: WatchlistItem) => {
    const nextStatus: WatchlistStatus = item.status === 'Active' ? 'Paused' : 'Active';
    dispatch(updateWatchlistStatus({ id: item.id, status: nextStatus }));
    toast.info(`Updated status of ${item.entityName} to ${nextStatus}`);
  };

  const handleRemove = (id: string, name: string) => {
    dispatch(removeFromWatchlist(id));
    toast.info(`Removed ${name} from Surveillance Watchlist`);
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'Person': return <User size={15} className="text-[#2563EB]" />;
      case 'Vehicle': return <Car size={15} className="text-[#16A34A]" />;
      case 'Phone': return <Phone size={15} className="text-[#D97706]" />;
      case 'Location': return <MapPin size={15} className="text-[#DC2626]" />;
      case 'Organization': return <Building2 size={15} className="text-[#5B4BC4]" />;
      case 'Case': return <FolderOpen size={15} className="text-[#12376E]" />;
      default: return <BookmarkCheck size={15} />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: 'var(--ink-primary)' }}>
              Target Surveillance Watchlist
            </h1>
            <span
              className="text-[11px] font-mono-id px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
            >
              {watchlistItems.length} active targets
            </span>
          </div>
          <p className="text-[13px] text-[var(--ink-secondary)]">
            Continuous automated monitoring registry for high-priority persons, vehicles, communications, and locations
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 rounded-lg text-[13px] font-medium text-white shadow-sm flex items-center gap-1.5 transition-all hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={14} />
          <span>Add Target to Watchlist</span>
        </button>
      </div>

      {/* Watchlist Grid */}
      {watchlistItems.length === 0 ? (
        <div
          className="p-12 text-center border rounded-2xl space-y-4"
          style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
        >
          <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center bg-[var(--surface-2)] text-[var(--ink-secondary)]">
            <Shield size={24} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-[16px] font-semibold" style={{ color: 'var(--ink-primary)' }}>
              No Surveillance Targets Registered
            </h3>
            <p className="text-[13px] text-[var(--ink-secondary)]">
              Continuous monitoring tracks high-risk individuals, suspicious vehicles, or IMEI numbers across cases. Add your first target to begin automated surveillance.
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-white shadow-sm inline-flex items-center gap-1.5"
            style={{ background: 'var(--accent)' }}
          >
            <Plus size={14} />
            <span>Add Surveillance Target</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchlistItems.map((item) => {
            const isActive = item.status === 'Active';
            return (
              <div
                key={item.id}
                className="p-5 rounded-xl border flex flex-col justify-between hover:border-[var(--accent)] transition-all"
                style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
              >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {getEntityIcon(item.entityType)}
                    <span className="text-[11px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
                      {item.entityType}
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded uppercase font-mono-id"
                    style={{
                      background: isActive ? 'var(--success-muted)' : 'var(--surface-2)',
                      color: isActive ? '#16A34A' : 'var(--ink-tertiary)',
                    }}
                  >
                    {item.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-[16px] font-semibold" style={{ color: 'var(--ink-primary)' }}>
                    {item.entityName}
                  </h3>
                  <div className="text-[11px] font-mono-id font-semibold text-[var(--accent)] mt-0.5">
                    {item.entityId}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg border text-[12px] leading-relaxed bg-[var(--surface-2)]" style={{ borderColor: 'var(--border)', color: 'var(--ink-primary)' }}>
                  {item.reason}
                </div>

                <div className="text-[11px] font-mono-id space-y-0.5" style={{ color: 'var(--ink-tertiary)' }}>
                  <div>Logged by: {item.createdBy}</div>
                  <div>Added: {item.createdDate}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                <button
                  onClick={() => dispatch(openInspector({ id: item.entityId, type: item.entityType }))}
                  className="text-[12px] font-medium text-[var(--accent)] hover:underline flex items-center gap-1"
                >
                  <Eye size={13} />
                  <span>Inspect</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleStatus(item)}
                    className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--ink-secondary)]"
                    title={isActive ? 'Pause surveillance' : 'Resume surveillance'}
                  >
                    {isActive ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button
                    onClick={() => handleRemove(item.id, item.entityName)}
                    className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--error)]"
                    title="Remove from watchlist"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Add to Watchlist Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
          onClick={() => setModalOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[460px] max-w-full rounded-xl border shadow-2xl p-5 space-y-4 animate-slide-in-up"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--border-strong)' }}
          >
            <h3 className="text-[16px] font-semibold" style={{ color: 'var(--ink-primary)' }}>
              Add Target to Surveillance Watchlist
            </h3>

            <form onSubmit={handleAdd} className="space-y-3 text-[13px]">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-tertiary)] mb-1">
                  Target Entity Type
                </label>
                <select
                  value={newEntityType}
                  onChange={(e) => setNewEntityType(e.target.value as EntityType)}
                  className="w-full h-9 px-3 rounded-lg border bg-[var(--surface-2)] text-[var(--ink-primary)] outline-none"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <option value="Person">Person</option>
                  <option value="Vehicle">Vehicle</option>
                  <option value="Phone">Phone Number</option>
                  <option value="Location">Location</option>
                  <option value="Organization">Organization</option>
                  <option value="Case">Case</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-tertiary)] mb-1">
                  Target Identifier (ID / Registration / Number)
                </label>
                <input
                  type="text"
                  value={newEntityId}
                  onChange={(e) => setNewEntityId(e.target.value)}
                  placeholder="e.g. PERSON-025 or MH-01-AB-1234"
                  className="w-full h-9 px-3 rounded-lg border bg-[var(--surface-0)] text-[var(--ink-primary)] outline-none font-mono-id"
                  style={{ borderColor: 'var(--border)' }}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-tertiary)] mb-1">
                  Entity Name / Title
                </label>
                <input
                  type="text"
                  value={newEntityName}
                  onChange={(e) => setNewEntityName(e.target.value)}
                  placeholder="e.g. Target Name or Vehicle Model"
                  className="w-full h-9 px-3 rounded-lg border bg-[var(--surface-0)] text-[var(--ink-primary)] outline-none"
                  style={{ borderColor: 'var(--border)' }}
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-tertiary)] mb-1">
                  Investigative Surveillance Justification
                </label>
                <textarea
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="State operational reason for surveillance priority..."
                  rows={3}
                  className="w-full p-3 rounded-lg border bg-[var(--surface-0)] text-[var(--ink-primary)] outline-none"
                  style={{ borderColor: 'var(--border)' }}
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-[13px] border hover:bg-[var(--surface-2)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-white shadow-sm hover:opacity-90"
                  style={{ background: 'var(--accent)' }}
                >
                  Confirm Watchlist Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
