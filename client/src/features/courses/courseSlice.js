import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

/* -------------------------------- Thunks -------------------------------- */

// NOTE: API returns { success, data, pagination? }
export const fetchCourses = createAsyncThunk(
  "courses/fetchAll",
  async (params = {}, { rejectWithValue }) => {
    try {
      // pass through filters like fields, q, status, restrictedTo, sort, page, limit
      const res = await api.get("/courses", { params });
      return res.data?.data || []; // unwrap
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch courses.");
    }
  }
);

export const fetchCourseById = createAsyncThunk(
  "courses/fetchById",
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.get(`/courses/${id}`);
      return res.data?.data; // unwrap
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch course.");
    }
  }
);

export const fetchCourseBySlug = createAsyncThunk(
  "courses/fetchBySlug",
  async (slug, { rejectWithValue }) => {
    try {
      const res = await api.get(`/courses/slug/${slug}`);
      return res.data?.data; // unwrap
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to fetch course.");
    }
  }
);

/* ------------------------------- Initial -------------------------------- */

const initialState = {
  allCourses: [],
  currentCourse: null,
  currentCourseModule: null, // optional pointer to selected module
  status: "idle",
  error: null,
  saveStatus: "idle",
  saveError: null,
};

/* --------------------------------- Slice -------------------------------- */

const courseSlice = createSlice({
  name: "courses",
  initialState,
  reducers: {
    clearCurrentCourse: (state) => {
      state.currentCourse = null;
      state.currentCourseModule = null;
    },
    setCurrentCourseModule: (state, action) => {
      state.currentCourseModule = action.payload ?? null; // could be module id/index/object
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchCourses
      .addCase(fetchCourses.pending, (s) => {
        s.status = "loading";
      })
      .addCase(fetchCourses.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.allCourses = Array.isArray(a.payload) ? a.payload : [];
      })
      .addCase(fetchCourses.rejected, (s, a) => {
        s.status = "failed";
        s.error = a.payload || a.error.message;
      })

      // fetchCourseById
      .addCase(fetchCourseById.pending, (s) => {
        s.status = "loading";
        s.currentCourse = null;
      })
      .addCase(fetchCourseById.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.currentCourse = a.payload || null;
      })
      .addCase(fetchCourseById.rejected, (s, a) => {
        s.status = "failed";
        s.error = a.payload || a.error.message;
      })

      // fetchCourseBySlug
      .addCase(fetchCourseBySlug.pending, (s) => {
        s.status = "loading";
        s.currentCourse = null;
      })
      .addCase(fetchCourseBySlug.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.currentCourse = a.payload || null;
      })
      .addCase(fetchCourseBySlug.rejected, (s, a) => {
        s.status = "failed";
        s.error = a.payload || a.error.message;
      });
  },
});

export const { clearCurrentCourse, setCurrentCourseModule } = courseSlice.actions;
export default courseSlice.reducer;
