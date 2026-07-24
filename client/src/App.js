import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import "./styles/globalStyles.scss";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import socket from "./services/socket"; // Adjust path if needed
import { playNotificationSound, primeAudio } from "./utils/notificationAudio";
import InactivityModal from "./components/InactivityModal/InactivityModal";

import AccessDenied from "./components/AccessDenied/AccessDenied";
import { useSelector } from "react-redux";
import AgeVerificationModal from "./components/AgeVerificationModal/AgeVerificationModal";
import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import BirthdayModal from "./components/BrithdayModal/BirthdayModal";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import CustomToast from "./components/CustomToast/CustomToast";
import { useDispatch } from "react-redux";
import {
  addNotification,
  fetchNotificationsByUserId,
  toggleMarkAllReadOrUnread,
} from "./features/notifications/notificationSlice";
import { fetchMe, syncAccessToken } from "./features/users/userSlice";
import { useLogout } from "./utils/handleLogoutAsync";
import TutorialDialog from "./components/TutorialDialog/TutorialDialog";
import useTutorialGate from "./hooks/useTutorialGate";
import { isTodayBirthday } from "./utils/isTodayBirthday";

const HomeScreen = lazy(() => import("./screens/HomeScreen/HomeScreen"));
const DrinksScreen = lazy(() => import("./screens/DrinksScreen/DrinksScreen"));
const DrinkDetailScreen = lazy(() =>
  import("./screens/DrinkDetailScreen/DrinkDetailScreen")
);
const EventsScreen = lazy(() => import("./screens/EventsScreen/EventsScreen"));
const BartenderScreen = lazy(() =>
  import("./screens/BartenderScreen/BartenderScreen")
);
const BookEventScreen = lazy(() =>
  import("./screens/BookEventScreen/BookEventScreen")
);
const MyLearningCoursesScreen = lazy(() =>
  import("./screens/MyLearningCoursesScreen/MyLearningCoursesScreen")
);
const LearningCourseScreen = lazy(() =>
  import("./screens/LearningCourseScreen/LearningCourseScreen")
);
const AboutUsScreen = lazy(() => import("./screens/AboutUsScreen/AboutUsScreen"));
const PrivacyPolicyScreen = lazy(() =>
  import("./screens/PrivacyPolicyScreen/PrivacyPolicyScreen")
);
const TermsConditionsScreen = lazy(() =>
  import("./screens/TermsConditionsScreen/TermsConditionsScreen")
);
const ContactUsScreen = lazy(() =>
  import("./screens/ContactUsScreen/ContactUsScreen")
);
const LoginScreen = lazy(() => import("./screens/LoginScreen/LoginScreen"));
const RegistrationScreen = lazy(() =>
  import("./screens/RegistrationScreen/RegistrationScreen")
);
const ForgotPasswordScreen = lazy(() =>
  import("./screens/ForgotPasswordScreen/ForgotPasswordScreen")
);
const ResetPasswordScreen = lazy(() =>
  import("./screens/ResetPasswordScreen/ResetPasswordScreen")
);
const UserSettingsScreen = lazy(() =>
  import("./screens/UserSettingsScreen/UserSettingsScreen")
);
const AdminSettingsScreen = lazy(() =>
  import("./screens/AdminSettingsScreen/AdminSettingsScreen")
);
const NotFoundScreen = lazy(() =>
  import("./screens/NotFoundScreen/NotFoundScreen")
);
const FAQScreen = lazy(() => import("./screens/FAQScreen/FAQScreen"));

function RouteLoadingFallback() {
  return (
    <Box
      sx={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <CircularProgress sx={{ color: "var(--primary-color)" }} />
    </Box>
  );
}

function LegacyEventsRedirect() {
  const location = useLocation();
  return (
    <Navigate
      to={`${location.pathname.replace(/^\/events/, "/my-events")}${location.search}${location.hash}`}
      replace
    />
  );
}

function AppContent() {
  const dispatch = useDispatch();
  const location = useLocation();
  const logout = useLogout();
  const logoutInProgress = useRef(false);
  const lastActivityWriteAt = useRef(0);
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const [countdown, setCountdown] = useState(5 * 60);
  const [suspensionNotice, setSuspensionNotice] = useState(null);
  const [suspensionCountdown, setSuspensionCountdown] = useState(5);

  const loggedInUser = useSelector((state) => state.users.loggedInUser);
  const user = loggedInUser?.user;

  useEffect(() => {
    const handleTokenRefresh = (event) => {
      const { accessToken, sessionStartedAt } = event.detail || {};
      if (accessToken) {
        dispatch(syncAccessToken({ accessToken, sessionStartedAt }));
      }
    };

    const handleStoredSessionChange = (event) => {
      if (event.key !== "loggedInUser" || !event.newValue) return;

      try {
        const stored = JSON.parse(event.newValue);
        if (stored?.accessToken) {
          dispatch(
            syncAccessToken({
              accessToken: stored.accessToken,
              sessionStartedAt: stored.sessionStartedAt,
            })
          );
        }
      } catch {
        // Ignore malformed storage written by browser extensions or old builds.
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
    if (!user?._id) return;

    logoutInProgress.current = false;
    const activityKey = "sessionLastActivityAt";
    const warningDurationMs = 5 * 60 * 1000;
    const absoluteSessionLimitMs = 8 * 60 * 60 * 1000;
    const inactivityLimitMs =
      ["employee", "admin"].includes(user.role)
        ? 30 * 60 * 1000
        : 60 * 60 * 1000;

    const storedSessionStart = Number(loggedInUser?.sessionStartedAt);
    const sessionStartedAt = Number.isFinite(storedSessionStart)
      ? storedSessionStart
      : Date.now();

    if (!Number(localStorage.getItem(activityKey))) {
      localStorage.setItem(activityKey, String(Date.now()));
    }

    const recordActivity = () => {
      const now = Date.now();
      if (now - lastActivityWriteAt.current < 15000) return;
      lastActivityWriteAt.current = now;
      localStorage.setItem(activityKey, String(now));
      setShowInactivityModal(false);
      setCountdown(5 * 60);
    };

    const activityEvents = ["mousemove", "keydown", "scroll", "click", "touchstart"];
    activityEvents.forEach((event) =>
      window.addEventListener(event, recordActivity, { passive: true })
    );

    const endSession = (reason) => {
      if (logoutInProgress.current) return;
      logoutInProgress.current = true;
      if (reason === "inactivity") {
        localStorage.setItem("inactiveLogout", "true");
      }
      setShowInactivityModal(false);
      logout(reason);
    };

    const checkSession = () => {
      const now = Date.now();
      if (now - sessionStartedAt >= absoluteSessionLimitMs) {
        endSession("session-expired");
        return;
      }

      const lastActivityAt =
        Number(localStorage.getItem(activityKey)) || now;
      const idleForMs = now - lastActivityAt;
      const remainingMs = inactivityLimitMs - idleForMs;

      if (remainingMs <= 0) {
        endSession("inactivity");
      } else if (remainingMs <= warningDurationMs) {
        setShowInactivityModal(true);
        setCountdown(Math.max(1, Math.ceil(remainingMs / 1000)));
      } else {
        setShowInactivityModal(false);
      }
    };

    checkSession();
    const timer = window.setInterval(checkSession, 1000);

    return () => {
      activityEvents.forEach((event) =>
        window.removeEventListener(event, recordActivity)
      );
      window.clearInterval(timer);
    };
  }, [loggedInUser?.sessionStartedAt, logout, user?._id, user?.role]);

  useEffect(() => {
    if (!user?._id) return;

    const timer = window.setInterval(() => {
      dispatch(fetchMe());
    }, 60000);

    return () => window.clearInterval(timer);
  }, [dispatch, user?._id]);

  useEffect(() => {
    const handleSuspendedAccount = (event) => {
      if (logoutInProgress.current) return;
      const message =
        event.detail?.message ||
        "Your account is suspended and you will be logged out.";
      setSuspensionNotice({
        message,
        reason: event.detail?.reason || message,
      });
      setSuspensionCountdown(5);
    };

    window.addEventListener("auth:account-suspended", handleSuspendedAccount);
    return () => {
      window.removeEventListener("auth:account-suspended", handleSuspendedAccount);
    };
  }, []);

  useEffect(() => {
    if (!suspensionNotice) return;

    if (suspensionCountdown <= 0) {
      if (!logoutInProgress.current) {
        logoutInProgress.current = true;
        logout("account-suspended");
      }
      return;
    }

    const timer = window.setTimeout(() => {
      setSuspensionCountdown((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [logout, suspensionCountdown, suspensionNotice]);

  const handleStayLoggedIn = () => {
    localStorage.setItem("sessionLastActivityAt", String(Date.now()));
    lastActivityWriteAt.current = Date.now();
    setShowInactivityModal(false);
    setCountdown(5 * 60);
  };

  const { shouldShow } = useTutorialGate(user);

  const excludedRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/privacy",
    "/terms-conditions",
    "/about",
  ];

  const [ageVerified, setAgeVerified] = useState(
    localStorage.getItem("ageVerified") === "true"
  );

  const showAgeModal =
    !user &&
    !ageVerified &&
    !excludedRoutes.some((path) => location.pathname.startsWith(path));

  const tutorialExcludedRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/privacy",
    "/terms-conditions",
    "/about",
    "/admin",
    "/settings",
  ];

  const params = new URLSearchParams(location.search);
  const forceTour = params.get("tour") === "1";
  const yearKey = `hasSeenBirthdayPopup-${
    user?._id || "anon"
  }-${new Date().getFullYear()}`;
  const birthSeen = localStorage.getItem(yearKey) === "true";
  const mute = !!user?.preferences?.notifications?.onMute;
  const inWebsite = user?.preferences?.notifications?.inWebsite;
  const canShowWebsiteNotifications = inWebsite !== false && !mute;
  const forceBirth = params.get("birth") === "1"; // dev override
  const resetBirth = params.get("resetBirth") === "1"; // dev reset

  useEffect(() => {
    if (resetBirth) {
      const key = `hasSeenBirthdayPopup-${new Date().getFullYear()}`;
      localStorage.removeItem(key);
    }
  }, [resetBirth]);

  const shouldRenderBirthday =
    !!user &&
    (isTodayBirthday(user?.profile?.birthday) || forceBirth) &&
    !birthSeen &&
    canShowWebsiteNotifications;

  const showTutorial =
    !showAgeModal && // don’t show under Age modal
    !tutorialExcludedRoutes.some((path) =>
      location.pathname.startsWith(path)
    ) &&
    shouldShow;

  useEffect(() => {
    const primeOnInteraction = () => {
      primeAudio();
      window.userHasInteracted = true;
      window.removeEventListener("click", primeOnInteraction);
      window.removeEventListener("keydown", primeOnInteraction);
      window.removeEventListener("scroll", primeOnInteraction);
    };

    if (!window.userHasInteracted) {
      window.addEventListener("click", primeOnInteraction);
      window.addEventListener("keydown", primeOnInteraction);
      window.addEventListener("scroll", primeOnInteraction);
    }
  }, []);

  useEffect(() => {
    if (user?._id) {
      socket.connect();

      socket.on("connect", () => {
        //console.log("✅ Socket.IO client connected with ID:", socket.id);
        socket.emit("register", user._id); // ✅ move it here
        //console.log("🔗 Socket registered user:", user._id);
      });

      socket.on("connect_error", (err) => {
        //console.error("❌ Socket.IO connection error:", err.message);
      });

      return () => {
        socket.disconnect();
        //console.log("❌ Socket disconnected.");
      };
    }
  }, [user?._id]);

  useEffect(() => {
    socket.on("notifications:bulkReadUpdated", ({ read }) => {
      dispatch(
        read
          ? toggleMarkAllReadOrUnread(true)
          : toggleMarkAllReadOrUnread(false)
      );
    });

    return () => {
      socket.off("notifications:bulkReadUpdated");
    };
  }, [dispatch, user?._id]);

  useEffect(() => {
    if (!user?._id) return;

    const handleNotification = (data) => {
      dispatch(addNotification(data));
      dispatch(fetchNotificationsByUserId());

      if (!canShowWebsiteNotifications) return;

      playNotificationSound();

      const toastData = {
        ...data,
        actors: data?.actors?.map((a) => a.actor),
      };
      toast(<CustomToast {...toastData} />);
    };

    socket.on("notifications:new", handleNotification);

    return () => {
      socket.off("notifications:new", handleNotification);
    };
  }, [
    user?._id,
    user?.preferences?.notifications?.inWebsite,
    user?.preferences?.notifications?.onMute,
    canShowWebsiteNotifications,
    dispatch,
  ]);

  return (
    <>
      {showAgeModal && (
        <AgeVerificationModal
          open={true}
          onVerify={() => setAgeVerified(true)}
        />
      )}
      {shouldRenderBirthday && (
        <BirthdayModal
          user={user}
          onDismiss={() => localStorage.setItem(yearKey, "true")} // set on close
        />
      )}
      {user && (
        <InactivityModal
          open={showInactivityModal}
          countdown={countdown}
          onStayLoggedIn={handleStayLoggedIn}
        />
      )}
      <Dialog
        open={Boolean(suspensionNotice)}
        maxWidth="xs"
        fullWidth
        disableEscapeKeyDown
      >
        <DialogTitle>Account Suspended</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="warning">
              {suspensionNotice?.message ||
                "Your account is suspended and you will be logged out."}
            </Alert>
            <Typography variant="body2" color="text.secondary">
              You will be logged out in {suspensionCountdown} seconds.
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.max(0, Math.min(100, ((5 - suspensionCountdown) / 5) * 100))}
              sx={{
                "& .MuiLinearProgress-bar": {
                  backgroundColor: "var(--primary-color)",
                },
              }}
            />
          </Stack>
        </DialogContent>
      </Dialog>
      {/* ✅ Tutorial Dialog (only when needed) */}
      {(showTutorial || forceTour) && (
        <TutorialDialog
          user={user} // lets it persist hasSeenTutorial to server when logged in
          enableServerPersist={true}
          forceOpen={forceTour}
          // Optional: pass custom steps or omit to use defaults defined in the component
        />
      )}

      <Box
        sx={{
          filter: showAgeModal ? "blur(8px)" : "none",
          transition: "filter 0.3s ease",
          pointerEvents: showAgeModal ? "none" : "auto",
        }}
      >
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/home" element={<HomeScreen />} />
            <Route path="/drinks" element={<DrinksScreen />} />
            <Route path="/my-events" element={<EventsScreen />} />
            <Route path="/my-events/:eventId/:tab?" element={<EventsScreen />} />
            <Route path="/events" element={<LegacyEventsRedirect />} />
            <Route path="/events/:eventId/:tab?" element={<LegacyEventsRedirect />} />
            <Route path="/book" element={<BookEventScreen />} />
            <Route path="/events/book" element={<BookEventScreen />} />
            <Route path="/book-event" element={<BookEventScreen />} />
            <Route path="/bartend/*" element={<BartenderScreen />} />
            <Route path="/drinks/:slug" element={<DrinkDetailScreen />} />

            <Route path="/learn" element={<MyLearningCoursesScreen />} />
            <Route path="/learn/:slug" element={<LearningCourseScreen />} />
            <Route path="/learn/:slug/modules" element={<LearningCourseScreen />} />
            <Route path="/about" element={<AboutUsScreen />} />
            <Route path="/privacy" element={<PrivacyPolicyScreen />} />
            <Route path="/terms-conditions" element={<TermsConditionsScreen />} />
            <Route path="/contact" element={<ContactUsScreen />} />
            <Route path="/faq" element={<FAQScreen />} />
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/register" element={<RegistrationScreen />} />

            <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
            <Route
              path="/reset-password/:token"
              element={<ResetPasswordScreen />}
            />
            <Route
              path="/settings/*"
              element={
                !loggedInUser ? (
                  <Navigate
                    to={`/login?redirect=${encodeURIComponent(
                      location.pathname + location.search
                    )}`}
                    replace
                  />
                ) : (
                  <UserSettingsScreen />
                )
              }
            />{" "}
            <Route
              path="/admin/*"
              element={
                !loggedInUser ? (
                  <Navigate
                    to={`/login?redirect=${encodeURIComponent(
                      location.pathname + location.search
                    )}`}
                    replace
                  />
                ) : user?.role === "employee" ? (
                  <AdminSettingsScreen />
                ) : (
                  <AccessDenied />
                )
              }
            />
            {/* Auth Routes (No Age Verification) */}
            {/* <Route path="/register" element={<RegisterScreen />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
        <Route path="/reset-password" element={<ResetPasswordScreen />} /> */}
            <Route path="*" element={<NotFoundScreen />} />
          </Routes>
        </Suspense>
        {/* Toast Container */}
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          pauseOnHover
          draggable
          theme="colored"
          toastStyle={{
            marginTop: "4rem",
            marginRight: "0.5rem",
            borderLeft: `4px solid var(--primary-color)`, // ✅ left border
            paddingLeft: 1,
            backgroundColor: "#fff",
            borderRadius: 1,
            boxShadow: 3,
            minWidth: 250,
          }} // 👈 pushes it down
        />
      </Box>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
