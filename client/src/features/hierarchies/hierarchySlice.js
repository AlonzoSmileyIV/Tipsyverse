import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

export const fetchAllHierarchies = createAsyncThunk(
  "hierarchies/fetchAll",
  async () => {
    const res = await api.get("/hierarchies"); // Assumes this returns all hierarchies
    return res.data;
  }
);

const hierarchiesSlice = createSlice({
  name: "hierarchies",
  initialState: {
    allHierarchies: [],
    status: "idle",
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllHierarchies.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchAllHierarchies.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.allHierarchies = action.payload;
      })
      .addCase(fetchAllHierarchies.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      });
  },
});

export default hierarchiesSlice.reducer;
