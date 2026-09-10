// ============================================================
// TRINETRA — Redux Store Configuration
// ============================================================
import { configureStore } from '@reduxjs/toolkit';
import casesReducer from './slices/casesSlice';
import uiReducer from './slices/uiSlice';
import investigationReducer from './slices/investigationSlice';
import alertsReducer from './slices/alertsSlice';
import watchlistReducer from './slices/watchlistSlice';
import liveMonitoringReducer from './slices/liveMonitoringSlice';
import citizenPortalReducer from './slices/citizenPortalSlice';

export const store = configureStore({
  reducer: {
    cases: casesReducer,
    ui: uiReducer,
    investigation: investigationReducer,
    alerts: alertsReducer,
    watchlist: watchlistReducer,
    liveMonitoring: liveMonitoringReducer,
    citizenPortal: citizenPortalReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
