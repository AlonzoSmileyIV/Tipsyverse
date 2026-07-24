import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";


export const fetchCommentsByDrink = createAsyncThunk(
  "comments/fetchById",
  async (drinkId) => {
    const res = await api.get(`/comments/${drinkId}`);
    return res.data;
  }
);

export const fetchReportedComments = createAsyncThunk(
  "comments/fetchReportedComments",
  async () => {
    const res = await api.get(`/comments/reported`);
    return res.data;
  }
);

const commentsSlice = createSlice({
  name: "comments",
  initialState: {
    drinkComments: [],
    reported: [],
    status: "idle",
    error: null,
  },
  reducers: {},
    extraReducers: (builder) => {
      builder
        //  fetchAllCommentsByDrinkId
        .addCase(fetchCommentsByDrink.pending, (state) => {
          state.status = "loading";
        })
        .addCase(fetchCommentsByDrink.fulfilled, (state, action) => {
          state.status = "succeeded";
          state.drinkComments = action.payload;
        })
        .addCase(fetchCommentsByDrink.rejected, (state, action) => {
          state.status = "failed";
          state.error = action.error.message;
        })

        //  fetchAllCommentsByDrinkId
        .addCase(fetchReportedComments.pending, (state) => {
          state.status = "loading";
        })
        .addCase(fetchReportedComments.fulfilled, (state, action) => {
          state.status = "succeeded";
          state.reported = action.payload;
        })
        .addCase(fetchReportedComments.rejected, (state, action) => {
          state.status = "failed";
          state.error = action.error.message;
        })
    }
});

export default commentsSlice.reducer;
