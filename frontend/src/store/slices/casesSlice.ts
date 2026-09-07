import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Case } from '@/types';

interface CasesState {
  cases: Case[];
  currentCaseId: string | null;
  filters: {
    crime: string;
    status: string;
    priority: string;
    city: string;
    search: string;
  };
  loading: boolean;
}

const initialState: CasesState = {
  cases: [],
  currentCaseId: null,
  filters: { crime: '', status: '', priority: '', city: '', search: '' },
  loading: false,
};

const casesSlice = createSlice({
  name: 'cases',
  initialState,
  reducers: {
    setCases(state, action: PayloadAction<Case[]>) { state.cases = action.payload; state.loading = false; },
    setCurrentCase(state, action: PayloadAction<string | null>) { state.currentCaseId = action.payload; },
    setFilter(state, action: PayloadAction<{ key: keyof CasesState['filters']; value: string }>) {
      state.filters[action.payload.key] = action.payload.value;
    },
    clearFilters(state) { state.filters = { crime: '', status: '', priority: '', city: '', search: '' }; },
    setLoading(state, action: PayloadAction<boolean>) { state.loading = action.payload; },
  },
});

export const { setCases, setCurrentCase, setFilter, clearFilters, setLoading } = casesSlice.actions;
export default casesSlice.reducer;
