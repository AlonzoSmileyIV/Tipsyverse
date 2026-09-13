import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { fetchMe, syncAccessToken } from "../../users/userSlice";
import { useLogout } from "../../../utils/handleLogoutAsync";
import {
  ACTIVITY_WRITE_THROTTLE_MS,
  getSessionState,
  SESSION_ACTIVITY_EVENTS,
  SESSION_ACTIVITY_KEY,
  SESSION_WARNING_DURATION_MS,
} from "./sessionPolicy";

export default function useSessionLifecycle({ loggedInUser, user }) {
  const dispatch = useDispatch();
  const logout = useLogout();
  const logoutInProgress = useRef(false);
  const lastActivityWriteAt = useRef(0);
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const [countdown, setCountdown] = useState(SESSION_WARNING_DURATION_MS / 1000);
  const [suspensionNotice, setSuspensionNotice] = useState(null);
  const [suspensionCountdown, setSuspensionCountdown] = useState(5);

  // Token refresh occurs in the transport layer. These events synchronize the
  // Redux copy in this tab and sessions updated by another browser tab.
  useEffect(() => {
    const synchronizeToken = ({ accessToken, sessionStartedAt } = {}) => {
      if (accessToken) dispatch(syncAccessToken({ accessToken, sessionStartedAt }));
    };
    const handleTokenRefresh = (event) => synchronizeToken(event.detail);
    const handleStoredSessionChange = (event) => {
      if (event.key !== "loggedInUser" || !event.newValue) return;
      try {
        synchronizeToken(JSON.parse(event.newValue));
      } catch {
        // Ignore malformed storage written by extensions or obsolete builds.
      }
    };

    window.addEventListener("auth:access-token-refreshed", handleTokenRefresh);
    window.addEventListener("storage", handleStoredSessionChange);
    return () => {
      window.removeEventListener("auth:access-token-refreshed", handleTokenRefresh);
      window.removeEventListener("storage", handleStoredSessionChange);
    };
  }, [dispatch]);

  useEffect(() => {
    if (!user?._id) return undefined;

    logoutInProgress.current = false;
    const storedStart = Number(loggedInUser?.sessionStartedAt);
    const sessionStartedAt = Number.isFinite(storedStart) ? storedStart : Date.now();
    if (!Number(localStorage.getItem(SESSION_ACTIVITY_KEY))) {
      localStorage.setItem(SESSION_ACTIVITY_KEY, String(Date.now()));
    }

    // All automatic session endings pass through the normal logout workflow so
    // the server can revoke the refresh session and clear its cookie.
    const endSession = (reason) => {
      if (logoutInProgress.current) return;
      logoutInProgress.current = true;
      if (reason === "inactivity") localStorage.setItem("inactiveLogout", "true");
      setShowInactivityModal(false);
      logout(reason);
    };
    // Pointer and keyboard events can fire rapidly. Throttling localStorage
    // writes avoids synchronous I/O on every interaction.
    const recordActivity = () => {
      const now = Date.now();
      if (now - lastActivityWriteAt.current < ACTIVITY_WRITE_THROTTLE_MS) return;
      lastActivityWriteAt.current = now;
      localStorage.setItem(SESSION_ACTIVITY_KEY, String(now));
      setShowInactivityModal(false);
      setCountdown(SESSION_WARNING_DURATION_MS / 1000);
    };
    const checkSession = () => {
      const now = Date.now();
      const state = getSessionState({
        now,
        sessionStartedAt,
        lastActivityAt: Number(localStorage.getItem(SESSION_ACTIVITY_KEY)) || now,
        role: user.role,
      });
      if (state.status === "expired") return endSession("session-expired");
      if (state.status === "inactive") return endSession("inactivity");
      if (state.status === "warning") {
        setShowInactivityModal(true);
        setCountdown(Math.max(1, Math.ceil(state.remainingMs / 1000)));
      } else {
        setShowInactivityModal(false);
      }
    };

    SESSION_ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, recordActivity, { passive: true })
    );
    checkSession();
    const timer = window.setInterval(checkSession, 1000);
    return () => {
      SESSION_ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, recordActivity)
      );
      window.clearInterval(timer);
    };
  }, [loggedInUser?.sessionStartedAt, logout, user?._id, user?.role]);

  useEffect(() => {
    if (!user?._id) return undefined;
    // Periodic account refresh lets server-side suspension or role changes
    // take effect without requiring a page reload.
    const timer = window.setInterval(() => dispatch(fetchMe()), 60000);
    return () => window.clearInterval(timer);
  }, [dispatch, user?._id]);

  useEffect(() => {
    const handleSuspendedAccount = (event) => {
      if (logoutInProgress.current) return;
      const message =
        event.detail?.message ||
        "Your account is suspended and you will be logged out.";
      setSuspensionNotice({ message, reason: event.detail?.reason || message });
      setSuspensionCountdown(5);
    };
    window.addEventListener("auth:account-suspended", handleSuspendedAccount);
    return () =>
      window.removeEventListener("auth:account-suspended", handleSuspendedAccount);
  }, []);

  useEffect(() => {
    if (!suspensionNotice) return undefined;
    if (suspensionCountdown <= 0) {
      if (!logoutInProgress.current) {
        logoutInProgress.current = true;
        logout("account-suspended");
      }
      return undefined;
    }
    const timer = window.setTimeout(
      () => setSuspensionCountdown((current) => current - 1),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [logout, suspensionCountdown, suspensionNotice]);

  const handleStayLoggedIn = useCallback(() => {
    const now = Date.now();
    localStorage.setItem(SESSION_ACTIVITY_KEY, String(now));
    lastActivityWriteAt.current = now;
    setShowInactivityModal(false);
    setCountdown(SESSION_WARNING_DURATION_MS / 1000);
  }, []);

  return {
    countdown,
    handleStayLoggedIn,
    showInactivityModal,
    suspensionCountdown,
    suspensionNotice,
  };
}
