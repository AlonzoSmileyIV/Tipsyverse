import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

export const fetchAllPositions = createAsyncThunk(
  "positions/fetchAll",
  async () => {
    const res = await api.get("/positions"); // Assumes this returns all positions
    return res.data;
  }
);

const positionsSlice = createSlice({
  name: "positions",
  initialState: {
    allPositions: [],
    status: "idle",
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllPositions.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchAllPositions.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.allPositions = action.payload;
      })
      .addCase(fetchAllPositions.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      });
  },
});

export default positionsSlice.reducer;
