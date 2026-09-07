import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Alert } from '@/types';

interface AlertsState {
  alerts: Alert[];
  unreadCount: number;
}

const initialState: AlertsState = { alerts: [], unreadCount: 0 };

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    setAlerts(state, action: PayloadAction<Alert[]>) {
      state.alerts = action.payload;
      state.unreadCount = action.payload.filter(a => !a.read).length;
    },
    markRead(state, action: PayloadAction<string>) {
      const alert = state.alerts.find(a => a.id === action.payload);
      if (alert) { alert.read = true; state.unreadCount = state.alerts.filter(a => !a.read).length; }
    },
    resolveAlert(state, action: PayloadAction<string>) {
      const alert = state.alerts.find(a => a.id === action.payload);
      if (alert) { alert.resolved = true; }
    },
  },
});

export const { setAlerts, markRead, resolveAlert } = alertsSlice.actions;
export default alertsSlice.reducer;
