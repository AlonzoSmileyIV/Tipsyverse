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

const routeTitle = (pathname) => {
  if (pathname.startsWith("/admin")) return "Tipsyverse administration";
  if (pathname.startsWith("/bartend")) return "Bartender portal";
  if (pathname.startsWith("/my-events")) return "My events";
  if (pathname.startsWith("/book")) return "Book an event";
  if (pathname.startsWith("/drinks/")) return "Drink details";
  if (pathname.startsWith("/drinks")) return "Drinks";
  if (pathname.startsWith("/learn/")) return "Course details";
  if (pathname.startsWith("/learn")) return "Learning courses";
  if (pathname.startsWith("/settings")) return "Account settings";
  if (pathname.startsWith("/about")) return "About Tipsyverse";
  if (pathname.startsWith("/contact")) return "Contact Tipsyverse";
  if (pathname.startsWith("/faq")) return "Frequently asked questions";
  if (pathname.startsWith("/privacy")) return "Privacy policy";
  if (pathname.startsWith("/terms")) return "Terms and conditions";
  if (pathname.startsWith("/login")) return "Log in";
  if (pathname.startsWith("/register")) return "Create an account";
  return pathname === "/" ? "Tipsyverse" : "Tipsyverse page";
};

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
      <RouteErrorBoundary resetKey={location.key}>
        <AppOverlays
          session={session}
          user={user}
          canShowWebsiteNotifications={canShowWebsiteNotifications}
        >
          <Typography
            component="h1"
            sx={{
              position: "absolute",
              width: 1,
              height: 1,
              p: 0,
              m: -1,
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
              whiteSpace: "nowrap",
              border: 0,
            }}
          >
            {routeTitle(location.pathname)}
          </Typography>
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
  const hasPersistedSession = useSelector(
    (state) => Boolean(state.users.loggedInUser)
  );
  const [authenticationReady, setAuthenticationReady] = useState(
    !hasPersistedSession
  );
  const authenticationBootstrap = useRef(null);

  useEffect(() => {
    let active = true;

    const bootstrapAuthentication = async () => {
      if (!hasPersistedSession) {
        if (active) setAuthenticationReady(true);
        return;
      }

      if (!authenticationBootstrap.current) {
        authenticationBootstrap.current = (async () => {
          try {
            const accessToken = await restoreAuthentication();
            if (accessToken) {
              dispatch(syncAccessToken({ accessToken }));
              await dispatch(fetchMe()).unwrap();
            }
          } catch (error) {
            if ([401, 403].includes(error.response?.status)) {
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
  }, [dispatch, hasPersistedSession]);

  if (!authenticationReady) return <AuthenticationLoadingScreen />;

  return <ReadyAppContent />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
