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

// The platform is designed light-first: it is used in daylit offices and its
// output is printed into case files. A viewer who has explicitly chosen dark
// still gets dark; the OS preference alone no longer flips it.
const getStoredTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('TRINETRA_theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'light';
};

const getStoredRole = (): UserRole => {
  if (typeof window === 'undefined') return 'police';
  const stored = localStorage.getItem('TRINETRA_role');
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
    setTheme(state, action: PayloadAction<'light' | 'dark'>) {
      state.theme = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('TRINETRA_theme', action.payload);
        if (action.payload === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    },
    toggleTheme(state) {
      const next = state.theme === 'light' ? 'dark' : 'light';
      state.theme = next;
      if (typeof window !== 'undefined') {
        localStorage.setItem('TRINETRA_theme', next);
        if (next === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    },
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
        localStorage.setItem('TRINETRA_role', action.payload);
      }
    },
  },
});

export const { toggleSidebar, setTheme, toggleTheme, setCommandPaletteOpen, openInspector, closeInspector, setActiveTab, setRole } = uiSlice.actions;
export { getStoredRole, getStoredTheme };
export default uiSlice.reducer;
