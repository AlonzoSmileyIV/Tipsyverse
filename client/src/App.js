import { BrowserRouter, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useRef, useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styles/globalStyles.scss";
import AppOverlays from "./app/AppOverlays";
import AppRoutes from "./app/routing/AppRoutes";
import useSessionLifecycle from "./features/auth/session/useSessionLifecycle";
import useRealtimeNotifications from "./features/notifications/useRealtimeNotifications";
import AvailabilityGate from "./app/AvailabilityGate";
import RouteErrorBoundary from "./app/RouteErrorBoundary";
import {
  fetchMe,
  logoutUser,
  syncAccessToken,
} from "./features/users/userSlice";
import { restoreAuthentication } from "./services/api";
import ScrollToTop from "./app/ScrollToTop";

function AuthenticationLoadingScreen() {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeContent: "center",
        justifyItems: "center",
        gap: 2,
        bgcolor: "background.default",
      }}
    >
      <CircularProgress aria-label="Restoring your session" />
      <Typography color="text.secondary">Restoring your session…</Typography>
    </Box>
  );
}

function ReadyAppContent() {
  const location = useLocation();
  const loggedInUser = useSelector((state) => state.users.loggedInUser);
  const user = loggedInUser?.user;
  const session = useSessionLifecycle({ loggedInUser, user });
  const { canShowWebsiteNotifications } = useRealtimeNotifications(user);

  return (
    <AvailabilityGate>
      <RouteErrorBoundary resetKey={location.pathname}>
        <AppOverlays
          session={session}
          user={user}
          canShowWebsiteNotifications={canShowWebsiteNotifications}
        >
          <AppRoutes loggedInUser={loggedInUser} user={user} />
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
              borderLeft: "4px solid var(--primary-color)",
              paddingLeft: 1,
              backgroundColor: "#fff",
              borderRadius: 1,
              boxShadow: 3,
              minWidth: 250,
            }}
          />
        </AppOverlays>
      </RouteErrorBoundary>
    </AvailabilityGate>
  );
}

function AppContent() {
  const dispatch = useDispatch();
  const hadPersistedSession = useSelector(
    (state) => Boolean(state.users.loggedInUser)
  );
  const [authenticationReady, setAuthenticationReady] = useState(false);
  const authenticationBootstrap = useRef(null);

  useEffect(() => {
    let active = true;

    const bootstrapAuthentication = async () => {
      if (!authenticationBootstrap.current) {
        authenticationBootstrap.current = (async () => {
          try {
            const accessToken = await restoreAuthentication();
            if (accessToken) {
              await dispatch(fetchMe()).unwrap();
              dispatch(syncAccessToken({ accessToken }));
            }
          } catch (error) {
            if ([401, 403].includes(error.response?.status)) {
              if (hadPersistedSession) {
                localStorage.setItem(
                  "authLogoutMessage",
                  error.response?.data?.message ||
                    "Your session expired. Please sign in again."
                );
              }
              dispatch(logoutUser());
            }
          }
        })();
      }

      try {
        await authenticationBootstrap.current;
      } finally {
        if (active) {
          setAuthenticationReady(true);
        }
      }
    };

    void bootstrapAuthentication();
    return () => {
      active = false;
    };
  }, [dispatch, hadPersistedSession]);

  if (!authenticationReady) return <AuthenticationLoadingScreen />;

  return <ReadyAppContent />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppContent />
    </BrowserRouter>
  );
}
