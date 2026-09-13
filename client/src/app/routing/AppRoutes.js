import { Suspense } from "react";
import { Box, CircularProgress } from "@mui/material";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import AccessDenied from "../../components/AccessDenied/AccessDenied";
import lazyWithRetry from "../../utils/lazyWithRetry";

const route = (key, importer) => lazyWithRetry(importer, key);

const HomeScreen = route("home", () => import("../../screens/HomeScreen/HomeScreen"));
const DrinksScreen = route("drinks", () => import("../../screens/DrinksScreen/DrinksScreen"));
const DrinkDetailScreen = route("drink-detail", () =>
  import("../../screens/DrinkDetailScreen/DrinkDetailScreen")
);
const EventsScreen = route("events", () => import("../../screens/EventsScreen/EventsScreen"));
const BartenderScreen = route("bartender", () =>
  import("../../screens/BartenderScreen/BartenderScreen")
);
const BookEventScreen = route("book-event", () =>
  import("../../screens/BookEventScreen/BookEventScreen")
);
const MyLearningCoursesScreen = route("learning", () =>
  import("../../screens/MyLearningCoursesScreen/MyLearningCoursesScreen")
);
const LearningCourseScreen = route("learning-course", () =>
  import("../../screens/LearningCourseScreen/LearningCourseScreen")
);
const AboutUsScreen = route("about", () => import("../../screens/AboutUsScreen/AboutUsScreen"));
const PrivacyPolicyScreen = route("privacy", () =>
  import("../../screens/PrivacyPolicyScreen/PrivacyPolicyScreen")
);
const TermsConditionsScreen = route("terms", () =>
  import("../../screens/TermsConditionsScreen/TermsConditionsScreen")
);
const ContactUsScreen = route("contact", () =>
  import("../../screens/ContactUsScreen/ContactUsScreen")
);
const LoginScreen = route("login", () => import("../../screens/LoginScreen/LoginScreen"));
const RegistrationScreen = route("registration", () =>
  import("../../screens/RegistrationScreen/RegistrationScreen")
);
const ForgotPasswordScreen = route("forgot-password", () =>
  import("../../screens/ForgotPasswordScreen/ForgotPasswordScreen")
);
const ResetPasswordScreen = route("reset-password", () =>
  import("../../screens/ResetPasswordScreen/ResetPasswordScreen")
);
const AccountActivationScreen = route("account-activation", () =>
  import("../../screens/AccountActivationScreen/AccountActivationScreen")
);
const UserSettingsScreen = route("user-settings", () =>
  import("../../screens/UserSettingsScreen/UserSettingsScreen")
);
const AdminSettingsScreen = route("admin", () =>
  import("../../screens/AdminSettingsScreen/AdminSettingsScreen")
);
const NotFoundScreen = route("not-found", () =>
  import("../../screens/NotFoundScreen/NotFoundScreen")
);
const FAQScreen = route("faq", () => import("../../screens/FAQScreen/FAQScreen"));
const PaymentRequestScreen = route("payment-request", () =>
  import("../../screens/PaymentRequestScreen/PaymentRequestScreen")
);

// Route modules remain lazy to keep public pages from downloading the large
// authenticated/admin feature bundles.
export function RouteLoadingFallback() {
  return (
    <Box
      sx={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <CircularProgress
        aria-label="Loading page"
        sx={{ color: "var(--primary-color)" }}
      />
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

// This guard controls navigation only. Backend authorization middleware is the
// security boundary for every protected resource.
function RequireAuthentication({ isAuthenticated, children }) {
  const location = useLocation();

  if (isAuthenticated) return children;

  const redirect = encodeURIComponent(location.pathname + location.search);
  return <Navigate to={`/login?redirect=${redirect}`} replace />;
}

export default function AppRoutes({ loggedInUser, user }) {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/home" element={<HomeScreen />} />
        <Route path="/drinks" element={<DrinksScreen />} />
        <Route path="/drinks/:slug" element={<DrinkDetailScreen />} />
        <Route path="/my-events" element={<EventsScreen />} />
        <Route path="/my-events/:eventId/:tab?" element={<EventsScreen />} />
        <Route path="/events" element={<LegacyEventsRedirect />} />
        <Route path="/events/:eventId/:tab?" element={<LegacyEventsRedirect />} />
        <Route path="/book" element={<BookEventScreen />} />
        <Route path="/events/book" element={<BookEventScreen />} />
        <Route path="/book-event" element={<BookEventScreen />} />
        <Route path="/bartend/*" element={<BartenderScreen />} />
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
        <Route path="/reset-password/:token" element={<ResetPasswordScreen />} />
        <Route
          path="/activate-account/:token"
          element={<AccountActivationScreen />}
        />
        <Route
          path="/pay/:paymentRequestId"
          element={
            <RequireAuthentication isAuthenticated={Boolean(loggedInUser)}>
              <PaymentRequestScreen />
            </RequireAuthentication>
          }
        />
        <Route
          path="/settings/*"
          element={
            <RequireAuthentication isAuthenticated={Boolean(loggedInUser)}>
              <UserSettingsScreen />
            </RequireAuthentication>
          }
        />
        <Route
          path="/admin/*"
          element={
            <RequireAuthentication isAuthenticated={Boolean(loggedInUser)}>
              {["employee", "admin"].includes(user?.role) ? (
                <AdminSettingsScreen />
              ) : (
                <AccessDenied />
              )}
            </RequireAuthentication>
          }
        />
        <Route path="*" element={<NotFoundScreen />} />
      </Routes>
    </Suspense>
  );
}
