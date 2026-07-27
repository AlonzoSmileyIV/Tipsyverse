import { BrowserRouter, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styles/globalStyles.scss";
import AppOverlays from "./app/AppOverlays";
import AppRoutes from "./app/routing/AppRoutes";
import useSessionLifecycle from "./features/auth/session/useSessionLifecycle";
import useRealtimeNotifications from "./features/notifications/useRealtimeNotifications";
import AvailabilityGate from "./app/AvailabilityGate";
import RouteErrorBoundary from "./app/RouteErrorBoundary";
import { fetchMe } from "./features/users/userSlice";

function AppContent() {
  const dispatch = useDispatch();
  const location = useLocation();
  const loggedInUser = useSelector((state) => state.users.loggedInUser);
  const user = loggedInUser?.user;
  const session = useSessionLifecycle({ loggedInUser, user });
  const { canShowWebsiteNotifications } = useRealtimeNotifications(user);

  // A reload intentionally loses the access token. Calling /me once lets the
  // HTTP-only refresh cookie restore it through the normal interceptor flow.
  useEffect(() => {
    dispatch(fetchMe());
  }, [dispatch]);

  return (
    <AvailabilityGate>
      <RouteErrorBoundary resetKey={location.key}>
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

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
