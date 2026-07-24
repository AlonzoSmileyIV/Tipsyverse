// features/assignments/reviewSlice.js
import {
  createSlice,
  createAsyncThunk
} from "@reduxjs/toolkit";
import api from "../../services/api";

export const fetchMyReviews = createAsyncThunk(
  "assignments/fetchMyReviews",
  async (_, { rejectWithValue }) => {
    try {
      const r = await api.get("/reviews/me");
      return r.data?.data || r.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch assignments."
      );
    }
  }
);


// --- Initial State ---

const initialState = {
    myReviews: [],
    status: "idle",
    error: null,
};


const reviewSlice = createSlice({
  name: "reviews",
  initialState,
  reducers: {},
   extraReducers: (builder) => {
      builder
       // --- fetchMyReviews ---
        .addCase(fetchMyReviews.pending, (state) => {
          state.status = "loading";
        })
        .addCase(fetchMyReviews.fulfilled, (state, action) => {
          state.status = "succeeded";
          state.myReviews = action.payload;
        })
        .addCase(fetchMyReviews.rejected, (state, action) => {
          state.status = "failed";
          state.error = action.error.message;
        })
      
    },

});
export default reviewSlice.reducer;