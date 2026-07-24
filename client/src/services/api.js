import axios from "axios";

const api = axios.create({
  baseURL: `${process.env.REACT_APP_BASE_URL}`,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// 1️⃣ First interceptor – uses loggedInUser.accessToken
api.interceptors.request.use((config) => {
  const stored = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  const token = stored?.accessToken;
  // console.log("[API] ->", config.method?.toUpperCase(), config.url, "token?", !!token);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 2️⃣ Second interceptor – uses localStorage "accessToken"
// api.interceptors.request.use((config) => {
//   const raw = localStorage.getItem("accessToken"); // or from Redux
//   const token = raw && JSON.parse(raw);
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// });


// Avoid infinite refresh loops and allow requests to opt out of refresh
let isRefreshing = false;
let waiters = [];
const notifyWaiters = (token) => {
  waiters.forEach((resume) => resume(token));
  waiters = [];
};

const persistRefreshedAccessToken = (accessToken, sessionStartedAt) => {
  if (!accessToken) return;

  const current = JSON.parse(localStorage.getItem("loggedInUser") || "null") || {};
  current.accessToken = accessToken;
  if (sessionStartedAt) current.sessionStartedAt = sessionStartedAt;
  localStorage.setItem("loggedInUser", JSON.stringify(current));
  api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

  // Keep Redux synchronized with the token used by the API client. This avoids
  // a later reducer persisting the expired token back into localStorage.
  window.dispatchEvent(
    new CustomEvent("auth:access-token-refreshed", {
      detail: { accessToken, sessionStartedAt },
    })
  );
};

const forceLogoutToLogin = (message) => {
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

    // Treat 401 as unauthenticated; also treat 403 as unauthenticated if the message indicates token problems
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
        const current = JSON.parse(localStorage.getItem("loggedInUser") || "null") || {};
        const res = await axios.post(
          `${process.env.REACT_APP_BASE_URL}/users/refresh-token`,
          { refreshToken: current.refreshToken || null },
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
      const stored = JSON.parse(localStorage.getItem("loggedInUser") || "null");
      const fresh = stored?.accessToken;
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
