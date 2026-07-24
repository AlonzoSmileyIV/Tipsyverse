import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// --- Thunks (match usersSlice style) ---
// get or create by courseId
export const fetchOrCreateProgress = createAsyncThunk(
  "courseProgress/fetchOrCreate",
  async ({ courseId, create = true }) => {
    const res = await api.get(`/course-progresses/${courseId}?create=${create ? 1 : 0}`);
    return res.data.data; // progress doc
  }
);

// get progress by slug (controller returns { course, progress })
export const fetchProgressBySlug = createAsyncThunk(
  "courseProgress/fetchBySlug",
  async ({ slug, create = true, light = false }) => {
    const res = await api.get(
      `/course-progresses/slug/${slug}?create=${create ? 1 : 0}&light=${light ? 1 : 0}`
    );
    return res.data.data; // { course, progress }
  }
);

// list my progress
export const fetchMyProgressList = createAsyncThunk(
  "courseProgress/fetchMine",
  async ({ status } = {}) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await api.get(`/course-progresses/my${qs}`);
    return res.data?.data || [];
  }
);

// --- Initial State ---
const initialState = {
  current: null, // progress doc for focused course
  currentCourseMeta: null, // optional { _id, title, slug } when fetched by slug

  myProgress: [],
  status: "idle",
  error: null
};

// --- Slice ---
const courseProgressSlice = createSlice({
  name: "courseProgress",
  initialState,
  reducers: {
    clearCourseProgress(state) {
      state.current = null;
      state.currentCourseMeta = null;
      state.status = "idle";
      state.error = null;
      state.submitStatus = "idle";
      state.submitError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetch/create
      .addCase(fetchOrCreateProgress.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchOrCreateProgress.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.current = action.payload;
      })
      .addCase(fetchOrCreateProgress.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      })

      // by slug
      .addCase(fetchProgressBySlug.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchProgressBySlug.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.currentCourseMeta = action.payload?.course || null;
        state.current = action.payload?.progress || null;
      })
      .addCase(fetchProgressBySlug.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      })

      // list mine
      .addCase(fetchMyProgressList.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchMyProgressList.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.myProgress = action.payload;
      })
      .addCase(fetchMyProgressList.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      })

      
  },
});

export const { clearCourseProgress } = courseProgressSlice.actions;
export default courseProgressSlice.reducer;
