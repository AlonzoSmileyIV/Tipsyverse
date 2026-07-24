import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

export const fetchAllGlasses = createAsyncThunk(
  "glasses/fetchAll",
  async () => {
    const res = await api.get("/glasses"); // Assumes this returns all mixers
    return res.data;
  }
);

const glassesSlice = createSlice({
  name: "glasses",
  initialState: {
    allGlasses: [],
    status: "idle",
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllGlasses.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchAllGlasses.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.allGlasses = action.payload;
      })
      .addCase(fetchAllGlasses.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      });
  },
});

export default glassesSlice.reducer;
