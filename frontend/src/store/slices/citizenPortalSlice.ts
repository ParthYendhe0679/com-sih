import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { CitizenComplaint, ComplaintStatus } from '@/types';
import { citizenComplaints } from '@/mock';

interface CitizenPortalState {
  complaints: CitizenComplaint[];
  selectedComplaintId: string | null;
}

const initialState: CitizenPortalState = {
  complaints: citizenComplaints,
  selectedComplaintId: 'CMP-2026-0102',
};

const citizenPortalSlice = createSlice({
  name: 'citizenPortal',
  initialState,
  reducers: {
    addComplaint(state, action: PayloadAction<Omit<CitizenComplaint, 'id' | 'status' | 'assignedStation' | 'investigatorNotes'>>) {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const newId = `CMP-2026-${randomNum}`;
      const newComplaint: CitizenComplaint = {
        ...action.payload,
        id: newId,
        status: 'Submitted',
        assignedStation: `${action.payload.city} Central Police Station`,
        investigatorNotes: [
          {
            date: new Date().toISOString().replace('T', ' ').slice(0, 16),
            officer: 'E-Intake Desk',
            note: 'Complaint electronically registered by citizen. Assigned to desk queue for verification.',
          },
        ],
      };
      state.complaints.unshift(newComplaint);
      state.selectedComplaintId = newId;
    },
    updateComplaintStatus(
      state,
      action: PayloadAction<{
        id: string;
        status: ComplaintStatus;
        officer: string;
        note: string;
        convertedFirId?: string;
        convertedCaseId?: string;
      }>
    ) {
      const comp = state.complaints.find((c) => c.id === action.payload.id);
      if (comp) {
        comp.status = action.payload.status;
        if (action.payload.convertedFirId) comp.convertedFirId = action.payload.convertedFirId;
        if (action.payload.convertedCaseId) comp.convertedCaseId = action.payload.convertedCaseId;
        comp.investigatorNotes.push({
          date: new Date().toISOString().replace('T', ' ').slice(0, 16),
          officer: action.payload.officer,
          note: action.payload.note,
        });
      }
    },
    setSelectedComplaint(state, action: PayloadAction<string | null>) {
      state.selectedComplaintId = action.payload;
    },
  },
});

export const { addComplaint, updateComplaintStatus, setSelectedComplaint } = citizenPortalSlice.actions;
export default citizenPortalSlice.reducer;
