// features/events/eventSlice.js
import {
  createSlice,
  createAsyncThunk
} from "@reduxjs/toolkit";
import api from "../../services/api";

/** ---------- Thunks ---------- */

// features/events/eventSlice.js
export const fetchAllEvents = createAsyncThunk(
  "events/fetchAllEvents",
  async () => {
    const r = await api.get("/events");
    const payload = r.data?.data ?? r.data ?? [];
    const items = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
      ? payload
      : [];
    return items; // ← always an array
  }
);

// My, Available, Assigned (simple arrays)
export const fetchMyEvents = createAsyncThunk(
  "events/fetchMyEvents",
  async () => {
    const r = await api.get("/events/mine");
    const payload = r.data?.data ?? r.data ?? [];
    const items = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
      ? payload
      : [];
    return items; // ← always an array
  }
);

export const fetchAvailableEvents = createAsyncThunk(
  "events/fetchAvailableEvents",
  async () => {
    const r = await api.get("/events/available");
    const payload = r.data?.data ?? r.data ?? [];
    const items = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
      ? payload
      : [];
    return items; // ← always an array
    
  }
);

export const fetchAssignedEvents = createAsyncThunk(
  "events/fetchAssignedEvents",
  async () => {
    const r = await api.get("/events/assigned");
    const payload = r.data?.data ?? r.data ?? [];
    const items = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
      ? payload
      : [];
    return items; // ← always an array
  }
);

// Counts for pills
export const fetchEventCounts = createAsyncThunk(
  "events/fetchEventCounts",
  async () => {
    const r = await api.get("/events/counts");
    return (
      r.data?.data ||
      r.data || { public: 0, my: 0, available: 0, assigned: 0, upcoming: 0 }
    );
  }
);

// Single event (for drawer)
export const fetchEventById = createAsyncThunk(
  "events/fetchEventById",
  async (id) => {
    const r = await api.get(`/events/${id}`);
    return r.data?.data || r.data;
  }
);

// Cancel event
export const cancelEvent = createAsyncThunk(
  "events/cancelEvent",
  async (id) => {
    const r = await api.post(`/events/${id}/cancel`);
    return r.data?.data || { _id: id };
  }
);



/** ---------- Slice ---------- */

const initialState = {
  // UI / query state
  tab: "public",
  filters: { city: "", state: "", country: "", startAt: "", endAt: "" },
  publicPage: 1,
  publicPageSize: 20,
  selectedEventId: null,

  // All events list
  allEvents: [],
  allLoading: false,

  // Other scopes
  myEvents: [],
  myLoading: false,

  availableEvents: [],
  availableLoading: false,

  assignedEvents: [],
  assignedLoading: false,

  // Counts
  counts: { public: 0, my: 0, available: 0, assigned: 0, upcoming: 0 },
  countsLoading: false,

  // Drawer
  eventById: null,
  eventByIdLoading: false,
  error: null,
};

const eventsSlice = createSlice({
  name: "events",
  initialState,
  reducers: {
    setTab(state, action) {
      state.tab = action.payload;
    },
    setFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetFilters(state) {
      state.filters = {
        city: "",
        state: "",
        country: "",
        startAt: "",
        endAt: "",
      };
    },
    setPublicPage(state, action) {
      state.publicPage = action.payload || 1;
    },
    setSelectedEvent(state, action) {
      state.selectedEventId = action.payload || null;
    },
  },
  extraReducers: (builder) => {
    // All
    builder.addCase(fetchAllEvents.pending, (s) => {
      s.allLoading = true;
      s.error = null;
    });
    builder.addCase(fetchAllEvents.fulfilled, (s, a) => {
      s.allLoading = false;
      s.allEvents = a.payload; // ← array
    });
    builder.addCase(fetchAllEvents.rejected, (s, a) => {
      s.allLoading = false;
      s.error = a.error?.message;
    });

    // My
    builder.addCase(fetchMyEvents.pending, (s) => {
      s.myLoading = true;
      s.error = null;
    });
    builder.addCase(fetchMyEvents.fulfilled, (s, a) => {
      s.myLoading = false;
      s.myEvents = a.payload;
    });
    builder.addCase(fetchMyEvents.rejected, (s, a) => {
      s.myLoading = false;
      s.error = a.error?.message;
    });

    // Available
    builder.addCase(fetchAvailableEvents.pending, (s) => {
      s.availableLoading = true;
      s.error = null;
    });
    builder.addCase(fetchAvailableEvents.fulfilled, (s, a) => {
      s.availableLoading = false;
      s.availableEvents = a.payload;
    });
    builder.addCase(fetchAvailableEvents.rejected, (s, a) => {
      s.availableLoading = false;
      s.error = a.error?.message;
    });

    // Assigned
    builder.addCase(fetchAssignedEvents.pending, (s) => {
      s.assignedLoading = true;
      s.error = null;
    });
    builder.addCase(fetchAssignedEvents.fulfilled, (s, a) => {
      s.assignedLoading = false;
      s.assignedEvents = a.payload;
    });
    builder.addCase(fetchAssignedEvents.rejected, (s, a) => {
      s.assignedLoading = false;
      s.error = a.error?.message;
    });

    // Counts
    builder.addCase(fetchEventCounts.pending, (s) => {
      s.countsLoading = true;
    });
    builder.addCase(fetchEventCounts.fulfilled, (s, a) => {
      s.countsLoading = false;
      s.counts = a.payload;
    });
    builder.addCase(fetchEventCounts.rejected, (s) => {
      s.countsLoading = false;
    });

    // Single event (drawer)
    builder.addCase(fetchEventById.pending, (s) => {
      s.eventByIdLoading = true;
      s.eventById = null;
    });
    builder.addCase(fetchEventById.fulfilled, (s, a) => {
      s.eventByIdLoading = false;
      s.eventById = a.payload;
    });
    builder.addCase(fetchEventById.rejected, (s, a) => {
      s.eventByIdLoading = false;
      s.error = a.error?.message;
    });

    // Cancel
    builder.addCase(cancelEvent.fulfilled, (s, a) => {
      const id = a.payload?._id;
      if (!id) return;
      s.publicEvents = s.publicEvents.filter((e) => e._id !== id);
      s.myEvents = s.myEvents.filter((e) => e._id !== id);
      s.availableEvents = s.availableEvents.filter((e) => e._id !== id);
      s.assignedEvents = s.assignedEvents.filter((e) => e._id !== id);
    });
  },
});

/** ---------- Selectors (define BEFORE createSelector uses them!) ---------- */
export const selectEventsState = (state) => state.events;

export const selectAllEvents = (state) => state.events.allEvents;
export const selectPublicEvents = (state) => state.events.publicEvents;
export const selectMyEvents = (state) => state.events.myEvents;
export const selectAvailableEvents = (state) => state.events.availableEvents;
export const selectAssignedEvents = (state) => state.events.assignedEvents;

export const selectPublicLoading = (state) => state.events.publicLoading;
export const selectPublicTotal = (state) => state.events.publicTotal;
export const selectPublicPage = (state) => state.events.publicPage;
export const selectPublicPageSize = (state) => state.events.publicPageSize;

export const selectCounts = (state) => state.events.counts;

export const selectSelectedEventId = (state) => state.events.selectedEventId;
export const selectEventById = (state) => state.events.eventById;
export const selectEventByIdLoading = (state) => state.events.eventByIdLoading;

// Status summary selector (optional)
export const selectEventsStatus = (state) => ({
  publicLoading: state.events.publicLoading,
  myLoading: state.events.myLoading,
  availableLoading: state.events.availableLoading,
  assignedLoading: state.events.assignedLoading,
  countsLoading: state.events.countsLoading,
  error: state.events.error,
});

/** ---------- Exports ---------- */
export const {
  setTab,
  setFilters,
  resetFilters,
  setPublicPage,
  setSelectedEvent,
} = eventsSlice.actions;

export default eventsSlice.reducer;
