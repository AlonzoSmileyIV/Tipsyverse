// features/bids/bidSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// --- Async Thunks ---
export const fetchMyBids = createAsyncThunk(
  "bids/fetchMe",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/bids/me");
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch bids."
      );
    }
  }
);

export const fetchBidsByUserId = createAsyncThunk(
  "bids/fetchBidsByUserId",
  async (id) => {
    const res = await api.get(`/bids/user/${id}`);
    return res.data;
  }
);

export const fetchInterestedBidsByEventId = createAsyncThunk(
  "bids/fetchInterestedBidsByEventId",
  async (id) => {
    const res = await api.get(`/bids/event/${id}/interested`);
    return res.data;
  }
);


export const fetchBidsByEventId = createAsyncThunk(
  "bids/fetchBidsByEventId",
  async (id) => {
    const res = await api.get(`/bids/event/${id}`);
    return res.data;
  }
);




// --- Initial State ---

const initialState = {
    myBids: [],
    currentEventBids: [],
    interestedBids: [],
    currentUserBids: [],
    status: "idle",
    error: null,
};


// --- Slice ---
const bidSlice = createSlice({
  name: "bids",
  initialState,
  reducers: {},
   extraReducers: (builder) => {
      builder
       // --- fetchMyBids ---
        .addCase(fetchMyBids.pending, (state) => {
          state.status = "loading";
        })
        .addCase(fetchMyBids.fulfilled, (state, action) => {
          state.status = "succeeded";
          state.myBids = action.payload;
        })
        .addCase(fetchMyBids.rejected, (state, action) => {
          state.status = "failed";
          state.error = action.error.message;
        })

        // --- fetchBidsByEventId ---
        .addCase(fetchBidsByEventId.pending, (state) => {
          state.status = "loading";
        })
        .addCase(fetchBidsByEventId.fulfilled, (state, action) => {
          state.status = "succeeded";
          state.currentEventBids = action.payload;
        })
        .addCase(fetchBidsByEventId.rejected, (state, action) => {
          state.status = "failed";
          state.error = action.error.message;
        })

        // --- fetchInterestedBidsByEventId ---
        .addCase(fetchInterestedBidsByEventId.pending, (state) => {
          state.status = "loading";
        })
        .addCase(fetchInterestedBidsByEventId.fulfilled, (state, action) => {
          state.status = "succeeded";
          state.interestedBids = action.payload;
        })
        .addCase(fetchInterestedBidsByEventId.rejected, (state, action) => {
          state.status = "failed";
          state.error = action.error.message;
        })
        

        // --- fetchBidsByUserId ---
        .addCase(fetchBidsByUserId.pending, (state) => {
          state.status = "loading";
        })
        .addCase(fetchBidsByUserId.fulfilled, (state, action) => {
          state.status = "succeeded";
          state.currentUserBids = action.payload;
        })
        .addCase(fetchBidsByUserId.rejected, (state, action) => {
          state.status = "failed";
          state.error = action.error.message;
        });
        ;
    },

});

export default bidSlice.reducer;