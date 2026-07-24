// features/assignments/assignmentSlice.js
import {
  createSlice,
  createAsyncThunk
} from "@reduxjs/toolkit";
import api from "../../services/api";

export const fetchMyAssignments = createAsyncThunk(
  "assignments/fetchMyAssignments",
  async (_, { rejectWithValue }) => {
    try {
      const r = await api.get("/assignments/me");
      return r.data?.data || r.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch assignments."
      );
    }
  }
);

export const fetchAssignmentsByUserId = createAsyncThunk(
  "assignments/fetchAssignmentsByUserId",
  async (id) => {
    const r = await api.get(`/assignments/user/${id}`);
    return r.data?.data || r.data;
  }
);

export const fetchAssignmentsByEventId = createAsyncThunk(
  "assignments/fetchAssignmentsByEventId",
  async (arg) => {
    const id = typeof arg === "object" ? arg.id : arg;
    const includeRemoved =
      typeof arg === "object" ? arg.includeRemoved : undefined;
    const r = await api.get(`/assignments/event/${id}`, {
      params:
        includeRemoved === undefined
          ? undefined
          : { includeRemoved: String(includeRemoved) },
    });
    return r.data?.data || r.data;
  }
);


// --- Initial State ---

const initialState = {
    myAssignments: [],
    currentUserAssignments: [],
    currentEventAssignments: [],
    status: "idle",
    error: null,
};


const assignmentSlice = createSlice({
  name: "assignments",
  initialState,
  reducers: {},
   extraReducers: (builder) => {
      builder
       // --- fetchMyAssignments ---
        .addCase(fetchMyAssignments.pending, (state) => {
          state.status = "loading";
        })
        .addCase(fetchMyAssignments.fulfilled, (state, action) => {
          state.status = "succeeded";
          state.myAssignments = action.payload;
        })
        .addCase(fetchMyAssignments.rejected, (state, action) => {
          state.status = "failed";
          state.error = action.error.message;
        })


         // --- fetchAssignmentsByEventId ---
        .addCase(fetchAssignmentsByEventId.pending, (state) => {
          state.status = "loading";
        })
        .addCase(fetchAssignmentsByEventId.fulfilled, (state, action) => {
          state.status = "succeeded";
          state.currentEventAssignments = action.payload;
        })
        .addCase(fetchAssignmentsByEventId.rejected, (state, action) => {
          state.status = "failed";
          state.error = action.error.message;
        })

        // --- fetchAssignmentsByUserId ---
        .addCase(fetchAssignmentsByUserId.pending, (state) => {
          state.status = "loading";
        })
        .addCase(fetchAssignmentsByUserId.fulfilled, (state, action) => {
          state.status = "succeeded";
          state.currentUserAssignments = action.payload;
        })
        .addCase(fetchAssignmentsByUserId.rejected, (state, action) => {
          state.status = "failed";
          state.error = action.error.message;
        })
        ;
    },

});
export default assignmentSlice.reducer;
