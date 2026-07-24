// uiSlice.js (Redux) — super small
import { createSlice } from "@reduxjs/toolkit";

const uiSlice = createSlice({
  name: "ui",
  initialState: { blockingModal: null }, // 'birthday' | null
  reducers: {
    setBlockingModal(state, action) {
      state.blockingModal = action.payload; // 'birthday' or null
    },
  },
});

export const { setBlockingModal } = uiSlice.actions;
export default uiSlice.reducer;