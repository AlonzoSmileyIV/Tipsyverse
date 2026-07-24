import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

export const fetchAllDepartments = createAsyncThunk(
  "departments/fetchAll",
  async () => {
    const res = await api.get("/departments"); // Assumes this returns all hierarchies
    return res.data;
  }
);

const departmentsSlice = createSlice({
  name: "departments",
  initialState: {
    allDepartments: [],
    status: "idle",
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAllDepartments.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchAllDepartments.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.allDepartments = action.payload;
      })
      .addCase(fetchAllDepartments.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      });
  },
});

export default departmentsSlice.reducer;
