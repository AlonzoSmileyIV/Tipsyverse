import { createSlice, createAsyncThunk, createSelector } from "@reduxjs/toolkit";
import api from "../../services/api";

/* ------------------------------- Thunks -------------------------------- */

export const fetchMyPaymentMethods = createAsyncThunk(
  "paymentMethods/fetchMine",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/payment-methods");
      return res.data; // { data: [...] }
    } catch (e) {
      return rejectWithValue(e.response?.data?.message || e.message);
    }
  }
);

export const fetchPaymentMethodsByUser = createAsyncThunk(
  "paymentMethods/fetchByUser",
  async (userId, { rejectWithValue }) => {
    try {
      const res = await api.get(`payment-methods/${userId}`);
      return { userId, payload: res.data }; // { data: [...] }
    } catch (e) {
      return rejectWithValue({ userId, message: e.response?.data?.message || e.message });
    }
  }
);

/* ------------------------------ Helpers ------------------------------- */

const listInit = { data: [], status: "idle", error: null };
const sortMethods = (arr = []) =>
  [...arr].sort((a, b) => {
    if (!!b.isDefault - !!a.isDefault) return !!b.isDefault - !!a.isDefault; // default first
    const ad = new Date(a.createdAt || 0).getTime();
    const bd = new Date(b.createdAt || 0).getTime();
    return ad - bd; // oldest first as tie-breaker
  });

/* -------------------------------- Slice -------------------------------- */

const paymentMethodSlice = createSlice({
  name: "paymentMethods",
  initialState: {
    mine: { ...listInit },
    currentUser: { userId: null, ...listInit },
  },
  reducers: {
    setCurrentUserContext: (state, action) => {
      state.currentUser.userId = action.payload || null;
    },
    clearMine: (state) => {
      state.mine = { ...listInit };
    },
    clearCurrentUserList: (state) => {
      state.currentUser = { userId: null, ...listInit };
    },
  },
  extraReducers: (builder) => {
    // mine
    builder
      .addCase(fetchMyPaymentMethods.pending, (state) => {
        state.mine.status = "loading";
        state.mine.error = null;
      })
      .addCase(fetchMyPaymentMethods.fulfilled, (state, action) => {
        state.mine.status = "succeeded";
        state.mine.data = sortMethods(action.payload?.data ?? []);
      })
      .addCase(fetchMyPaymentMethods.rejected, (state, action) => {
        state.mine.status = "failed";
        state.mine.error = action.payload || action.error.message;
      });

    // by user
    builder
      .addCase(fetchPaymentMethodsByUser.pending, (state, action) => {
        state.currentUser.userId = action.meta.arg;
        state.currentUser.status = "loading";
        state.currentUser.error = null;
      })
      .addCase(fetchPaymentMethodsByUser.fulfilled, (state, action) => {
        state.currentUser.status = "succeeded";
        state.currentUser.data = sortMethods(action.payload?.payload?.data ?? []);
      })
      .addCase(fetchPaymentMethodsByUser.rejected, (state, action) => {
        state.currentUser.status = "failed";
        state.currentUser.error =
          action.payload?.message || action.error.message;
      });
  },
});

export const {
  setCurrentUserContext,
  clearMine,
  clearCurrentUserList,
} = paymentMethodSlice.actions;

/* ------------------------------ Selectors ------------------------------ */

export const selectPaymentMethodsMine = (s) => s.paymentMethods.mine;
export const selectPaymentMethodsCurrentUser = (s) => s.paymentMethods.currentUser;

export const selectMyDefaultPaymentMethod = createSelector(
  (s) => s.paymentMethods.mine.data,
  (list) => list.find((x) => x.isDefault) || null
);

export default paymentMethodSlice.reducer;
