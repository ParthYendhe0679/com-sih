import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type UserRole = 'police' | 'citizen' | 'admin';

interface UIState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  commandPaletteOpen: boolean;
  inspectorOpen: boolean;
  inspectorEntity: { id: string; type: string } | null;
  activeTab: string;
  currentRole: UserRole;
}

const getStoredRole = (): UserRole => {
  if (typeof window === 'undefined') return 'police';
  const stored = localStorage.getItem('kritagas_role');
  if (stored === 'citizen' || stored === 'admin' || stored === 'police') return stored;
  return 'police';
};

const initialState: UIState = {
  sidebarCollapsed: false,
  theme: 'light',
  commandPaletteOpen: false,
  inspectorOpen: false,
  inspectorEntity: null,
  activeTab: 'overview',
  currentRole: 'police',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) { state.sidebarCollapsed = !state.sidebarCollapsed; },
    setTheme(state, action: PayloadAction<'light' | 'dark'>) { state.theme = action.payload; },
    toggleTheme(state) { state.theme = state.theme === 'light' ? 'dark' : 'light'; },
    setCommandPaletteOpen(state, action: PayloadAction<boolean>) { state.commandPaletteOpen = action.payload; },
    openInspector(state, action: PayloadAction<{ id: string; type: string }>) {
      state.inspectorOpen = true;
      state.inspectorEntity = action.payload;
    },
    closeInspector(state) { state.inspectorOpen = false; state.inspectorEntity = null; },
    setActiveTab(state, action: PayloadAction<string>) { state.activeTab = action.payload; },
    setRole(state, action: PayloadAction<UserRole>) {
      state.currentRole = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('kritagas_role', action.payload);
      }
    },
  },
});

export const { toggleSidebar, setTheme, toggleTheme, setCommandPaletteOpen, openInspector, closeInspector, setActiveTab, setRole } = uiSlice.actions;
export { getStoredRole };
export default uiSlice.reducer;
