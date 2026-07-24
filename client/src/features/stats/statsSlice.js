// src/features/stats/statSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// GET /api/stats/app  -> { totalDrinks, totalUsers, totalComments, totalShares }
export const fetchAppStats = createAsyncThunk("stats/fetchApp", async () => {
  const res = await api.get("/stats");
  return res.data;
});

const statSlice = createSlice({
  name: "stats",
  initialState: {
    appStats: {
      totalDrinks: 0,
      totalUsers: 0,
      totalComments: 0,
      totalShares: 0,
    },
    status: "idle",
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAppStats.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchAppStats.fulfilled, (state, action) => {
        state.status = "succeeded";
        const {
          totalDrinks = 0,
          totalUsers = 0,
          totalComments = 0,
          totalShares = 0,
        } = action.payload || {};
        state.appStats = { totalDrinks, totalUsers, totalComments, totalShares };
      })
      .addCase(fetchAppStats.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error?.message || "Failed to fetch stats";
      });
  },
});

export default statSlice.reducer;
