// features/users/usersSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// --- Async Thunks ---

export const fetchAllUsers = createAsyncThunk("users/fetchAll", async () => {
  const res = await api.get("/users");
  return res.data;
});

export const fetchAllRegularUsers = createAsyncThunk(
  "users/fetchRegulars",
  async () => {
    const res = await api.get("/users/regulars");
    return res.data;
  }
);

export const fetchAllBartenders = createAsyncThunk(
  "users/fetchBartenders",
  async () => {
    const res = await api.get("/users/bartenders");
    return res.data;
  }
);

export const fetchAllEmployees = createAsyncThunk(
  "users/fetchEmployees",
  async () => {
    const res = await api.get("/users/employees");
    return res.data;
  }
);

export const fetchMe = createAsyncThunk(
  "users/fetchMe",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/users/me");
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch user."
      );
    }
  }
);

export const fetchMyBartenderInfo = createAsyncThunk(
  "users/fetchMyBartenderInfo",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/users/me/bartender-info");
      return res.data;
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch user."
      );
    }
  }
);

export const fetchBartenderById = createAsyncThunk(
  "users/fetchBartenderById",
  async (id) => {
    const res = await api.get(`/users/bartenders/${id}`);
    return res.data;
  }
);


export const fetchMyRequirements = createAsyncThunk(
  "users/fetchMyRequirements",
  async (role, { rejectWithValue }) => {
    try {
      const res = await api.get("/users/me/requirements", { params: { role } });
      return { role, data: res.data }; // ← return role too
    } catch (err) {
      return rejectWithValue(
        err.response?.data?.message || "Failed to fetch user."
      );
    }
  }
);

export const fetchAllBartenderLicenses = createAsyncThunk(
  "users/fetchAllBartenderLicenses",
  async (id) => {
    const res = await api.get(`/users/admin/licenses`);
    return res.data;
  }
);

export const hydrateLoggedInUser = createAsyncThunk(
  "users/hydrateLoggedInUser",
  async (roleArg, { getState, dispatch }) => {
    // 1) Always refresh the user
    await dispatch(fetchMe());

    // 2) Figure out the role for requirements (arg wins, else from state)
    const state = getState();
    const role = roleArg || state.users?.loggedInUser?.user?.role;

    // 3) Fire the other calls in parallel (reducers above will merge/persist)
    await Promise.allSettled([
      dispatch(fetchMyBartenderInfo()),
      role ? dispatch(fetchMyRequirements(role)) : Promise.resolve(),
    ]);

    return true;
  }
);

export const fetchUser = createAsyncThunk("users/fetchById", async (id) => {
  const res = await api.get(`/users/${id}`);
  return res.data;
});

// Login thunk
export const loginUser = createAsyncThunk(
  "users/login",
  async ({ emailOrUsername, password }, { rejectWithValue }) => {
    try {
      const res = await api.post("/users/login", { emailOrUsername, password });
      const { accessToken, refreshToken, sessionStartedAt, user } = res.data;
      return { user, accessToken, refreshToken, sessionStartedAt };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Login failed");
    }
  }
);

export const logoutUserAsync = createAsyncThunk(
  "users/logout",
  // optional reason string lets you tag logout sources ("manual", "inactivity", etc.)
  async (reason = "manual", { rejectWithValue }) => {
    try {
      // withCredentials is already true on your axios instance
      await api.post("/users/logout", { reason });
      return true;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.message || "Logout failed");
    }
  }
);

// --- Helpers ---

const getInitialLoggedInUser = () => {
  try {
    const data = JSON.parse(localStorage.getItem("loggedInUser"));
    return data || null;
  } catch {
    return null;
  }
};

// --- Initial State ---

const initialState = {
  loggedInUser: getInitialLoggedInUser(),
  bartenderInfoStatus: "idle",
  requirementsStatus: "idle",
  bartenderInfoError: null,
  requirementsError: null,
  currentUser: null,
  allUsers: [],
  allRegularUsers: [],
  allEmployees: [],
  allBartenders: [],
  allBartenderLicenses: [],
  allBartenderLicensesStatus: "idle",   // 👈 add
  allBartenderLicensesError: null,      // 👈 add
  status: "idle",
  error: null,
  loginStatus: "idle",
  loginError: null,
};


// --- Slice ---

const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    logoutUser: (state) => {
      state.loggedInUser = null;
      state.loginStatus = "idle";
      state.loginError = null;
      localStorage.removeItem("loggedInUser");
      localStorage.removeItem("sessionLastActivityAt");
    },
    updateLoggedInUser: (state, action) => {
      const { user, accessToken, refreshToken, ...rest } = action.payload;
      state.loggedInUser = { ...rest, user, accessToken, refreshToken };
      localStorage.setItem(
        "loggedInUser",
        JSON.stringify(state.loggedInUser)
      );
    },
    syncAccessToken: (state, action) => {
      const { accessToken, sessionStartedAt } = action.payload || {};
      if (!accessToken || !state.loggedInUser) return;

      state.loggedInUser.accessToken = accessToken;
      if (sessionStartedAt) {
        state.loggedInUser.sessionStartedAt = sessionStartedAt;
      }
      const stored =
        JSON.parse(localStorage.getItem("loggedInUser") || "null") || {};
      localStorage.setItem(
        "loggedInUser",
        JSON.stringify({
          ...stored,
          ...state.loggedInUser,
          accessToken,
          ...(sessionStartedAt ? { sessionStartedAt } : {}),
        })
      );
    },
  },
  extraReducers: (builder) => {
    builder
      // --- fetchAllUsers ---
      .addCase(fetchAllUsers.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.allUsers = action.payload;
      })
      .addCase(fetchAllUsers.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      })

      // --- fetchAllRegularUsers ---
      .addCase(fetchAllRegularUsers.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchAllRegularUsers.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.allRegularUsers = action.payload;
      })
      .addCase(fetchAllRegularUsers.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      })

      // --- fetchAllEmployees ---
      .addCase(fetchAllEmployees.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchAllEmployees.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.allEmployees = action.payload;
      })
      .addCase(fetchAllEmployees.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      })

       // --- fetchAllBartenders ---
      .addCase(fetchAllBartenders.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchAllBartenders.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.allBartenders = action.payload;
      })
      .addCase(fetchAllBartenders.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      })

       // --- fetchBartender ---
      .addCase(fetchBartenderById.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchBartenderById.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.currentUser = action.payload;
      })
      .addCase(fetchBartenderById.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      })

      // --- fetchAllBartenderLicenses ---
    .addCase(fetchAllBartenderLicenses.pending, (state) => {
      state.allBartenderLicensesStatus = "loading";
      state.allBartenderLicensesError = null;
    })
    .addCase(fetchAllBartenderLicenses.fulfilled, (state, action) => {
      state.allBartenderLicensesStatus = "succeeded";
      // if your endpoint returns { success, data, pagination }
      const payload = action.payload;
      state.allBartenderLicenses = payload?.data || payload || [];
    })
    .addCase(fetchAllBartenderLicenses.rejected, (state, action) => {
      state.allBartenderLicensesStatus = "failed";
      state.allBartenderLicensesError =
        action.payload || action.error?.message || "Failed to fetch licenses.";
    })

      // --- fetchUser ---
      .addCase(fetchUser.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.currentUser = action.payload;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message;
      })

      // --- loginUser ---
      .addCase(loginUser.pending, (state) => {
        state.loginStatus = "loading";
        state.loginError = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        const { user, accessToken, refreshToken, sessionStartedAt } = action.payload;
        state.loginStatus = "succeeded";
        state.loggedInUser = { user, accessToken, refreshToken, sessionStartedAt };
        localStorage.setItem("sessionLastActivityAt", String(Date.now()));
        localStorage.setItem(
          "loggedInUser",
          JSON.stringify(state.loggedInUser)
        );
      })

      .addCase(loginUser.rejected, (state, action) => {
        state.loginStatus = "failed";
        state.loginError = action.payload;
      })
      // --- logoutUserAsync ---
      .addCase(logoutUserAsync.pending, (state) => {
        state.status = "loading";
      })
      .addCase(logoutUserAsync.fulfilled, (state) => {
        state.status = "succeeded";
        state.loggedInUser = null;
        state.loginStatus = "idle";
        state.loginError = null;
        localStorage.removeItem("loggedInUser");
        localStorage.removeItem("sessionLastActivityAt");
      })
      .addCase(logoutUserAsync.rejected, (state, action) => {
        // even if server fails (network/CORS), clear client to avoid zombie sessions
        state.status = "failed";
        state.error = action.payload || "Logout failed";
        state.loggedInUser = null;
        state.loginStatus = "idle";
        state.loginError = null;
        localStorage.removeItem("loggedInUser");
        localStorage.removeItem("sessionLastActivityAt");
      })
      // fetchMe
      .addCase(fetchMe.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.status = "succeeded";

        const prev =
          state.loggedInUser ||
          JSON.parse(localStorage.getItem("loggedInUser")) ||
          {};

        const accessToken = prev?.accessToken || null;
        const refreshToken = prev?.refreshToken || null; // keep if you use it

        state.loggedInUser = {
          ...prev, // preserves bartenderInfo / requirementsByRole
          user: action.payload, // fresh /me
          accessToken,
          refreshToken,
        };

        localStorage.setItem(
          "loggedInUser",
          JSON.stringify(state.loggedInUser)
        );
      })
      .addCase(fetchMe.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(fetchMyBartenderInfo.pending, (state) => {
        state.bartenderInfoStatus = "loading";
        state.bartenderInfoError = null;
      })
      .addCase(fetchMyBartenderInfo.fulfilled, (state, action) => {
        state.bartenderInfoStatus = "succeeded";
        const prev = state.loggedInUser || {};
        state.loggedInUser = { ...prev, bartenderInfo: action.payload };
        localStorage.setItem(
          "loggedInUser",
          JSON.stringify(state.loggedInUser)
        );
      })
      .addCase(fetchMyBartenderInfo.rejected, (state, action) => {
        state.bartenderInfoStatus = "failed";
        state.bartenderInfoError =
          action.payload || "Failed to fetch bartender info";
      })

      .addCase(fetchMyRequirements.pending, (state) => {
        state.requirementsStatus = "loading";
        state.requirementsError = null;
      })
      .addCase(fetchMyRequirements.fulfilled, (state, action) => {
        state.requirementsStatus = "succeeded";
        const { role, data } = action.payload;
        const prev = state.loggedInUser || {};
        const prevReqs = prev.requirementsByRole || {};
        state.loggedInUser = {
          ...prev,
          requirementsByRole: {
            ...prevReqs,
            [role || prev?.user?.role || ""]: data,
          },
        };
        localStorage.setItem(
          "loggedInUser",
          JSON.stringify(state.loggedInUser)
        );
      })
      .addCase(fetchMyRequirements.rejected, (state, action) => {
        state.requirementsStatus = "failed";
        state.requirementsError =
          action.payload || "Failed to fetch requirements";
      });
  },
});

export const { logoutUser, updateLoggedInUser, syncAccessToken } = usersSlice.actions;
export default usersSlice.reducer;
