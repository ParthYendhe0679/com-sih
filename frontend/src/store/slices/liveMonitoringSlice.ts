import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { LiveEvent, LiveSubject } from '@/types';
import { liveEventsSeed, liveSubjectSeed } from '@/mock';

interface LiveMonitoringState {
  events: LiveEvent[];
  isLive: boolean;
  speed: 1 | 2 | 4;
  currentSubject: LiveSubject;
  selectedEventId: string | null;
  filterSeverity: string;
  filterType: string;
}

const initialState: LiveMonitoringState = {
  events: liveEventsSeed,
  isLive: true,
  speed: 1,
  currentSubject: liveSubjectSeed,
  selectedEventId: null,
  filterSeverity: 'all',
  filterType: 'all',
};

const liveMonitoringSlice = createSlice({
  name: 'liveMonitoring',
  initialState,
  reducers: {
    toggleLive(state) {
      state.isLive = !state.isLive;
    },
    setLive(state, action: PayloadAction<boolean>) {
      state.isLive = action.payload;
    },
    setSpeed(state, action: PayloadAction<1 | 2 | 4>) {
      state.speed = action.payload;
    },
    addLiveEvent(state, action: PayloadAction<LiveEvent>) {
      state.events.unshift(action.payload);
      if (state.events.length > 50) {
        state.events.pop();
      }
    },
    clearEvents(state) {
      state.events = [];
    },
    setSelectedEvent(state, action: PayloadAction<string | null>) {
      state.selectedEventId = action.payload;
    },
    setFilterSeverity(state, action: PayloadAction<string>) {
      state.filterSeverity = action.payload;
    },
    setFilterType(state, action: PayloadAction<string>) {
      state.filterType = action.payload;
    },
    updateSubjectLocation(state, action: PayloadAction<{ location: string; time: string; anomalyScore?: number }>) {
      state.currentSubject.currentLocation = action.payload.location;
      state.currentSubject.lastObservationTime = action.payload.time;
      if (action.payload.anomalyScore !== undefined) {
        state.currentSubject.anomalyScore = action.payload.anomalyScore;
      }
    },
  },
});

export const {
  toggleLive,
  setLive,
  setSpeed,
  addLiveEvent,
  clearEvents,
  setSelectedEvent,
  setFilterSeverity,
  setFilterType,
  updateSubjectLocation,
} = liveMonitoringSlice.actions;

export default liveMonitoringSlice.reducer;
