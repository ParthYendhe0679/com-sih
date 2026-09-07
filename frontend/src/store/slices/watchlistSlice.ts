import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { WatchlistItem, WatchlistStatus, EntityType } from '@/types';

interface WatchlistState {
  items: WatchlistItem[];
}

const initialState: WatchlistState = { items: [] };

const watchlistSlice = createSlice({
  name: 'watchlist',
  initialState,
  reducers: {
    setWatchlist(state, action: PayloadAction<WatchlistItem[]>) { state.items = action.payload; },
    addToWatchlist(state, action: PayloadAction<{ entityId: string; entityType: EntityType; entityName: string; reason: string }>) {
      state.items.push({
        id: `WL-${Date.now()}`,
        entityId: action.payload.entityId,
        entityType: action.payload.entityType,
        entityName: action.payload.entityName,
        reason: action.payload.reason,
        createdBy: 'DCP R. Sharma',
        createdDate: new Date().toISOString().split('T')[0],
        status: 'Active',
      });
    },
    removeFromWatchlist(state, action: PayloadAction<string>) {
      state.items = state.items.filter(i => i.id !== action.payload);
    },
    updateWatchlistStatus(state, action: PayloadAction<{ id: string; status: WatchlistStatus }>) {
      const item = state.items.find(i => i.id === action.payload.id);
      if (item) item.status = action.payload.status;
    },
  },
});

export const { setWatchlist, addToWatchlist, removeFromWatchlist, updateWatchlistStatus } = watchlistSlice.actions;
export default watchlistSlice.reducer;
