import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface InvestigationState {
  currentCaseId: string | null;
  selectedEntityId: string | null;
  selectedEntityType: string | null;
  selectedLocationId: string | null;
  replayPlaying: boolean;
  replayIndex: number;
}

const initialState: InvestigationState = {
  currentCaseId: null,
  selectedEntityId: null,
  selectedEntityType: null,
  selectedLocationId: null,
  replayPlaying: false,
  replayIndex: 0,
};

const investigationSlice = createSlice({
  name: 'investigation',
  initialState,
  reducers: {
    setInvestigationCase(state, action: PayloadAction<string | null>) { state.currentCaseId = action.payload; },
    selectEntity(state, action: PayloadAction<{ id: string; type: string } | null>) {
      if (action.payload) {
        state.selectedEntityId = action.payload.id;
        state.selectedEntityType = action.payload.type;
      } else {
        state.selectedEntityId = null;
        state.selectedEntityType = null;
      }
    },
    setSelectedLocation(state, action: PayloadAction<string | null>) {
      state.selectedLocationId = action.payload;
    },
    setReplayPlaying(state, action: PayloadAction<boolean>) { state.replayPlaying = action.payload; },
    setReplayIndex(state, action: PayloadAction<number>) { state.replayIndex = action.payload; },
    incrementReplayIndex(state) { state.replayIndex += 1; },
  },
});

export const { setInvestigationCase, selectEntity, setSelectedLocation, setReplayPlaying, setReplayIndex, incrementReplayIndex } = investigationSlice.actions;
export default investigationSlice.reducer;
