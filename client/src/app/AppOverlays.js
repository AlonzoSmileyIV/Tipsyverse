import {
  Alert,
  Dialog,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import AgeVerificationModal from "../components/AgeVerificationModal/AgeVerificationModal";
import BirthdayModal from "../components/BrithdayModal/BirthdayModal";
import InactivityModal from "../components/InactivityModal/InactivityModal";
import TutorialDialog from "../components/TutorialDialog/TutorialDialog";
import useTutorialGate from "../hooks/useTutorialGate";
import { isTodayBirthday } from "../utils/isTodayBirthday";

const AGE_EXCLUDED_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/activate-account",
  "/privacy",
  "/terms-conditions",
  "/about",
];

const TUTORIAL_EXCLUDED_ROUTES = [
  ...AGE_EXCLUDED_ROUTES,
  "/admin",
  "/settings",
];

export default function AppOverlays({
  session,
  user,
  children,
  canShowWebsiteNotifications,
}) {
  const location = useLocation();
  const { shouldShow } = useTutorialGate(user);
  const [ageVerified, setAgeVerified] = useState(
    localStorage.getItem("ageVerified") === "true"
  );
  const params = new URLSearchParams(location.search);
  const forceTour = params.get("tour") === "1";
  const forceBirth = params.get("birth") === "1";
  const resetBirth = params.get("resetBirth") === "1";
  const yearKey = `hasSeenBirthdayPopup-${user?._id || "anon"}-${new Date().getFullYear()}`;
  const birthSeen = localStorage.getItem(yearKey) === "true";
  const showAgeModal =
    !user &&
    !ageVerified &&
    !AGE_EXCLUDED_ROUTES.some((path) => location.pathname.startsWith(path));
  const showTutorial =
    !showAgeModal &&
    ["/", "/home"].includes(location.pathname) &&
    !TUTORIAL_EXCLUDED_ROUTES.some((path) =>
      location.pathname.startsWith(path)
    ) &&
    shouldShow;
  const shouldRenderBirthday =
    Boolean(user) &&
    (isTodayBirthday(user?.profile?.birthday) || forceBirth) &&
    !birthSeen &&
    canShowWebsiteNotifications;

  useEffect(() => {
    if (resetBirth) {
      localStorage.removeItem(
        `hasSeenBirthdayPopup-${user?._id || "anon"}-${new Date().getFullYear()}`
      );
    }
  }, [resetBirth, user?._id]);

  return (
    <>
      {showAgeModal && (
        <AgeVerificationModal open onVerify={() => setAgeVerified(true)} />
      )}
      {shouldRenderBirthday && (
        <BirthdayModal
          user={user}
          onDismiss={() => localStorage.setItem(yearKey, "true")}
        />
      )}
      {user && (
        <InactivityModal
          open={session.showInactivityModal}
          countdown={session.countdown}
          onStayLoggedIn={session.handleStayLoggedIn}
        />
      )}
      <Dialog
        open={Boolean(session.suspensionNotice)}
        maxWidth="xs"
        fullWidth
        disableEscapeKeyDown
      >
        <DialogTitle>Account Suspended</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="warning">
              {session.suspensionNotice?.message ||
                "Your account is suspended and you will be logged out."}
            </Alert>
            <Typography variant="body2" color="text.secondary">
              You will be logged out in {session.suspensionCountdown} seconds.
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.max(
                0,
                Math.min(100, ((5 - session.suspensionCountdown) / 5) * 100)
              )}
              sx={{
                "& .MuiLinearProgress-bar": {
                  backgroundColor: "var(--primary-color)",
                },
              }}
            />
          </Stack>
        </DialogContent>
      </Dialog>
      {(showTutorial || forceTour) && (
        <TutorialDialog
          user={user}
          enableServerPersist
          forceOpen={forceTour}
        />
      )}
      <div
        style={{
          filter: showAgeModal ? "blur(8px)" : "none",
          transition: "filter 0.3s ease",
          pointerEvents: showAgeModal ? "none" : "auto",
        }}
      >
        {children}
      </div>
    </>
  );
}
