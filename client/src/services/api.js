import axios from "axios";
import {
  clearAccessToken,
  getAccessToken,
  readPersistedSession,
  setAccessToken,
} from "./authSessionStore";

const api = axios.create({
  baseURL: `${process.env.REACT_APP_BASE_URL}`,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// Authentication transport is centralized here so feature thunks never need
// to know how tokens are persisted or refreshed.
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Only one refresh request may run at a time. Requests that fail concurrently
// wait for its result, preventing refresh-token reuse during rotation.
let isRefreshing = false;
let waiters = [];
const notifyWaiters = (token) => {
  waiters.forEach((resume) => resume(token));
  waiters = [];
};

const persistRefreshedAccessToken = (accessToken, sessionStartedAt) => {
  if (!accessToken) return;

  setAccessToken(accessToken);
  const current = readPersistedSession() || {};
  if (sessionStartedAt) {
    localStorage.setItem(
      "loggedInUser",
      JSON.stringify({ ...current, sessionStartedAt })
    );
  }
  api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

  // The API module cannot import the Redux store without creating an
  // infrastructure-to-feature dependency. A browser event keeps Redux
  // synchronized without introducing that cycle.
  window.dispatchEvent(
    new CustomEvent("auth:access-token-refreshed", {
      detail: { accessToken, sessionStartedAt },
    })
  );
};

const forceLogoutToLogin = (message) => {
  clearAccessToken();
  localStorage.removeItem("loggedInUser");
  if (message) localStorage.setItem("authLogoutMessage", message);
  if (window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
};

const notifySuspendedAccount = (payload = {}) => {
  window.dispatchEvent(
    new CustomEvent("auth:account-suspended", {
      detail: {
        message:
          payload.message ||
          "Your account is suspended and you will be logged out.",
        reason: payload.reason || payload.message || "",
      },
    })
  );
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config || {};
    const status = err.response?.status;
    const msg = (err.response?.data?.message || "").toLowerCase();

    if (original.skipAuthRefresh || original.__isRefreshCall) {
      return Promise.reject(err);
    }

    const forceLogoutCodes = new Set([
      "ACCOUNT_SUSPENDED",
      "ACCOUNT_DEACTIVATED",
      "ACCOUNT_TERMINATED",
      "ACCOUNT_NOT_FOUND",
    ]);

    if (err.response?.data?.code === "ACCOUNT_SUSPENDED") {
      notifySuspendedAccount(err.response.data);
      return Promise.reject(err);
    }

    if (err.response?.data?.forceLogout || forceLogoutCodes.has(err.response?.data?.code)) {
      forceLogoutToLogin(
        err.response?.data?.message ||
          "Your session ended. Please sign in again."
      );
      return Promise.reject(err);
    }

    // A normal 403 means "authenticated but forbidden" and must not trigger a
    // refresh. Legacy endpoints sometimes return 403 for an invalid token, so
    // only token-shaped 403 responses enter the refresh path.
    const looksLikeTokenProblem =
      msg.includes("token") ||
      msg.includes("jwt") ||
      msg.includes("expired") ||
      msg.includes("unauthorized");

    const shouldTryRefresh =
      !original._retry && (status === 401 || (status === 403 && looksLikeTokenProblem));

    if (!shouldTryRefresh) {
      return Promise.reject(err);
    }

    original._retry = true;

    try {
      if (!isRefreshing) {
        isRefreshing = true;
        const res = await axios.post(
          `${process.env.REACT_APP_BASE_URL}/users/refresh-token`,
          {},
          { withCredentials: true, __isRefreshCall: true }
        );
        const accessToken = res.data?.accessToken || null;
        const sessionStartedAt = res.data?.sessionStartedAt || null;

        persistRefreshedAccessToken(accessToken, sessionStartedAt);
        notifyWaiters(accessToken);
      } else {
        // wait for the in-flight refresh
        const waitedToken = await new Promise((resolve) => waiters.push(resolve));
        if (!waitedToken) {
          throw new Error("Session refresh failed.");
        }
      }

      // Ensure the retried request uses the new token, even if original headers were frozen
      const fresh = getAccessToken();
      if (fresh) {
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${fresh}` };
      }

      return api(original);
    } catch (refreshErr) {
      const refreshStatus = refreshErr.response?.status;
      const refreshCode = refreshErr.response?.data?.code;
      const invalidRefreshCodes = new Set([
        "REFRESH_TOKEN_MISSING",
        "REFRESH_TOKEN_INVALID",
        "REFRESH_TOKEN_REUSED",
        "SESSION_ABSOLUTE_EXPIRED",
      ]);
      const refreshTokenIsInvalid =
        [401, 403].includes(refreshStatus) && invalidRefreshCodes.has(refreshCode);

      notifyWaiters(null);

      // A network interruption or server error does not invalidate the user's
      // refresh token. Preserve the session and allow a later request to retry.
      if (refreshTokenIsInvalid) {
        forceLogoutToLogin(
          refreshErr.response?.data?.message ||
            "Your session expired. Please sign in again."
        );
      }

      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);


export default api;
