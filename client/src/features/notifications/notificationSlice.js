import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// features/notifications/notificationSlice.js
export const fetchNotificationsByUserId = createAsyncThunk(
  "notifications/fetchById",
  async (_, { getState, rejectWithValue }) => {
    try {
      const { users } = getState();
      const token = users?.loggedInUser?.accessToken;
      if (!token) {
        return rejectWithValue({ status: 0, message: "Not authenticated" });
      }

      const res = await api.get("/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    } catch (err) {
      const status = err?.response?.status ?? 0;
      const message = err?.response?.data?.message || err.message;
      return rejectWithValue({ status, message });
    }
  }
);

export const toggleReadStatus = createAsyncThunk(
  "notifications/toggleReadStatus",
  async ({ notificationId, read }, { getState, rejectWithValue }) => {
    try {
      const token = getState()?.users?.loggedInUser?.accessToken;
      const res = await api.patch(
        `/notifications/${notificationId}/read`,
        { read },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data.notification;
    } catch (err) {
      return rejectWithValue(err?.response?.data || err.message);
    }
  }
);

export const toggleMarkAllReadOrUnread = createAsyncThunk(
  "notifications/toggleMarkAllReadOrUnread",
  async (read, { getState, rejectWithValue }) => {
    try {
      const token = getState()?.users?.loggedInUser?.accessToken;
      await api.patch(
        "/notifications/mark-all",
        { read },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return { read };
    } catch (err) {
      return rejectWithValue(err?.response?.data || err.message);
    }
  }
);

const notificationSlice = createSlice({
  name: "notifications",
  initialState: {
    notifications: [],
    status: "idle",
    error: null,
  },
  reducers: {
    addNotification: (state, action) => {
      if (!Array.isArray(state.notifications)) {
        console.warn(
          "❗notifications was not an array. Resetting to empty array."
        );
        state.notifications = [];
      }

      const alreadyExists = state.notifications.some(
        (n) => n._id === action.payload._id
      );
      if (!alreadyExists) {
        state.notifications.unshift(action.payload);
      }
    },
    markNotificationAsRead: (state, action) => {
      const notif = state.notifications.find((n) => n._id === action.payload);
      if (notif) {
        notif.recipients.forEach((r) => {
          if (r.recipientType === "User") {
            r.read = true;
            r.readDateTime = new Date();
          }
        });
      }
    },
  },
  extraReducers: (builder) => {
    builder
      //  fetchAllDrinks
      .addCase(fetchNotificationsByUserId.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchNotificationsByUserId.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.notifications = Array.isArray(action.payload.data)
          ? action.payload.data
          : []; // 🔒 Safe fallback
      })
      .addCase(fetchNotificationsByUserId.rejected, (state, action) => {
        state.status = "failed";
        // Only store/show "real" errors (e.g., 5xx, 403)
        const status = action.payload?.status ?? 0;
        state.error =
          status >= 500 || status === 403 ? action.payload?.message : null;
      })

      .addCase(toggleReadStatus.fulfilled, (state, action) => {
        const updated = action.payload;
        const index = state.notifications.findIndex(
          (n) => n._id === updated._id
        );
        if (index !== -1) {
          state.notifications[index] = updated;
        }
      })
      .addCase(toggleMarkAllReadOrUnread.fulfilled, (state, action) => {
        const read = action.payload.read;
        const nowISO = read ? new Date().toISOString() : null;

        state.notifications.forEach((n) => {
          n.recipients = n.recipients.map((r) => ({
            ...r,
            read,
            readDateTime: r.recipientType === "User" ? nowISO : r.readDateTime,
          }));
        });
      });
  },
});
export const { addNotification, markNotificationAsRead } =
  notificationSlice.actions;
export default notificationSlice.reducer;
