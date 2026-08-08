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

// Login restoration and 401 retries must share the same request. The server
// rotates refresh tokens, so two simultaneous refreshes with the same cookie
// would make the second request look like token reuse and revoke the session.
let refreshRequestPromise = null;
const refreshAccessToken = () => {
  if (refreshRequestPromise) return refreshRequestPromise;

  refreshRequestPromise = axios
    .post(
      `${process.env.REACT_APP_BASE_URL}/users/refresh-token`,
      {},
      { withCredentials: true, __isRefreshCall: true }
    )
    .then((res) => {
      const accessToken = res.data?.accessToken || null;
      persistRefreshedAccessToken(
        accessToken,
        res.data?.sessionStartedAt || null
      );
      return accessToken;
    })
    .finally(() => {
      refreshRequestPromise = null;
    });

  return refreshRequestPromise;
};

export const restoreAuthentication = () => {
  if (getAccessToken()) {
    return Promise.resolve(getAccessToken());
  }
  if (!readPersistedSession()) {
    return Promise.resolve(null);
  }
  return refreshAccessToken();
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
      const accessToken = await refreshAccessToken();
      if (!accessToken) {
        throw new Error("Session refresh failed.");
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

      // A network interruption or server error does not invalidate the user's
      // refresh token. Preserve the session and allow a later request to retry.
      if (refreshTokenIsInvalid) {
        forceLogoutToLogin(
          refreshErr.response?.data?.message ||
            "Your session expired. Please sign in again."
        );
      }

      return Promise.reject(refreshErr);
    }
  }
);


export default api;
