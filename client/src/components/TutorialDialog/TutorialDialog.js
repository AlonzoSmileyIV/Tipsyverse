// src/components/TutorialDialog/TutorialDialog.jsx
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  MobileStepper,
  Checkbox,
  FormControlLabel,
} from "@mui/material";

import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import api from "../../services/api";
import logoPhoto from "../../assets/images/logo.png";
import engagagePhoto from "../../assets/images/undraw_social-interaction_6fi7.svg";
import explorePhoto from "../../assets/images/undraw_searching_no1g.svg";

// LocalStorage key as a reliable fallback if user not logged in
const LS_KEY = "hasSeenTutorial";

const defaultSteps = [
  {
    title: "Welcome to Tipsyverse",
    description:
      "Discover classic and modern cocktails, see trending drinks, and explore curated categories.",
    image: logoPhoto,
  },
  {
    title: "Interact & Engage",
    description:
      "Like, bookmark, and comment on cocktails. Follow conversations and share your favorites.",
    image: engagagePhoto,
  },
  // UNCOMMENT WHEN READY FOR NEXT FEATURES 
  //   {
  //     title: "Book Bartenders (Optional)",
  //     description:
  //       "Request certified bartenders for events, set availability, and manage bookings with ease.",
  //     image:
  //       "https://images.unsplash.com/photo-1541976076758-347942db1970?q=80&w=1200&auto=format&fit=crop",
  //   },
  {
    title: "Ready to Explore",
    description:
      "Use search and filters to find drinks by liquor, taste, or color. Dive in and have fun!",
    image: explorePhoto,
  },
];

export default function TutorialDialog({
  /**
   * Optionally provide steps: [{ title, description, image }]
   */
  steps = defaultSteps,
  /**
   * Force the dialog to appear even if hasSeenTutorial is true (for testing)
   */
  forceOpen = false,
  /**
   * If you already know whether the user is logged in and want to persist to server.
   * Otherwise the component will try a best-effort call and silently fallback.
   */
  enableServerPersist = true,
  /**
   * Optionally pass the current user object if you have it in context/Redux.
   * The component only needs to know if user is logged in; it won’t render any PII.
   */
  user,
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(true); // default checked
  const maxSteps = steps.length;

  const isLoggedIn = !!user?._id; // Adjust if your user object differs
  const blockingModal = useSelector((s) => s.ui.blockingModal);
  const birthdayBlocking = blockingModal === "birthday";
  const storageKey = user?._id ? `${LS_KEY}-${user._id}` : LS_KEY;

  const primaryBtnSX = {
    // use your CSS var if present; otherwise theme primary
    bgcolor: "var(--primary-color)",
    "&:hover": { bgcolor: "var(--primary-color)" },
    color: "#fff",
  };

  // Determine initial open state
  useEffect(() => {
    const lsVal = localStorage.getItem(storageKey);
    const localSeen = lsVal === "true";

    // If forceOpen, ignore stored values
    if (forceOpen) {
      if (!birthdayBlocking) setOpen(true);
      return;
    }

    // If user has a server flag in Redux/context, prefer that (if available)
    // Otherwise check localStorage. If neither says "seen", open it once.
    const serverSeen = user?.preferences?.hasSeenTutorial === true;

    if (!serverSeen && !localSeen && !birthdayBlocking) {
      setOpen(true);
    }
  }, [forceOpen, user, birthdayBlocking, storageKey]);

  useEffect(() => {
  if (birthdayBlocking && open) setOpen(false);
}, [birthdayBlocking, open]);

  const handleClose = async (eventType) => {
    // eventType: "skip" | "finish" | "close"
    setOpen(false);

    // Persist decision:
    // If "Don't show again" is checked (true), mark as seen.
    if (dontShowAgain) {
      localStorage.setItem(storageKey, "true");
      if (enableServerPersist && isLoggedIn) {
        try {
          await api.patch(
            "/users/me/turn-off-tutorial",
            { skipAuthRefresh: false }
          );
          // You can also dispatch a Redux action to update local user state if needed
        } catch (err) {
          // Silent failure: localStorage fallback will still prevent re-open
          // console.error("Failed to persist hasSeenTutorial:", err);
        }
      }
    }
  };

  const handleNext = () =>
    setActiveStep((prev) => Math.min(prev + 1, maxSteps - 1));
  const handleBack = () => setActiveStep((prev) => Math.max(prev - 1, 0));

  const current = steps[activeStep] || {};

  return (
    <Dialog
      fullWidth
      maxWidth="md"
      open={open}
      onClose={() => handleClose("close")}
      aria-labelledby="tutorial-dialog-title"
      PaperProps={{
        sx: {
          borderRadius: 3,
          m: { xs: 2, sm: 4 },
          maxHeight: { xs: "calc(100% - 32px)", sm: "calc(100% - 64px)" },
        },
      }}
    >
      <DialogTitle id="tutorial-dialog-title" sx={{ fontWeight: 700 }}>
        {current.title || "Welcome"}
      </DialogTitle>

      <DialogContent dividers tabIndex={0} sx={{ pt: 0 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 3,
            alignItems: "center",
          }}
        >
          {/* Image */}
          <Box
            sx={{
              width: "100%",
              height: { xs: 210, sm: 300, md: 400 },
              aspectRatio: "16 / 10",
              overflow: "hidden",
              borderRadius: 2,
              boxShadow: (t) => t.shadows[3],
              bgcolor: "grey.100",
            }}
          >
            {current.image ? (
              <img
                src={current.image}
                alt={current.title || "Tutorial step"}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
                loading="lazy"
              />
            ) : (
              <Box
                sx={{
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  color: "text.secondary",
                }}
              >
                <Typography variant="body2">No image provided</Typography>
              </Box>
            )}
          </Box>

          {/* Copy */}
          <Box>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
              {current.title}
            </Typography>
            <Typography variant="body1" sx={{ color: "text.secondary", mb: 2 }}>
              {current.description}
            </Typography>

            {activeStep === maxSteps - 1 && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                  />
                }
                label="Don’t show this again"
                sx={{ mt: 1 }}
              />
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          gap: 1.5,
          px: 3,
          pb: 2,
        }}
      >
        <Box sx={{ flex: 1 }}>
          <MobileStepper
            variant="dots"
            steps={maxSteps}
            position="static"
            activeStep={activeStep}
            nextButton={
        activeStep === maxSteps - 1 ? (
          // ✅ FINISH: normal primary button, no arrow
          <Button
            size="small"
            variant="contained"
            onClick={() => handleClose("finish")}
            sx={primaryBtnSX}
          >
            Finish
          </Button>
        ) : (
          // ✅ NEXT: primary, with arrow
          <Button
            size="small"
            variant="contained"
            onClick={handleNext}
            sx={primaryBtnSX}
            endIcon={<KeyboardArrowRight />}
          >
            Next
          </Button>
        )
      }
           backButton={
        activeStep === 0 ? (
          // ✅ SKIP on first step; make it look like a primary text button
          <Button
            size="small"
            variant="text"
            color="primary"
            onClick={() => handleClose("skip")}
            sx={{
              color: "var(--primary-color)",
              "&:hover": { backgroundColor: "transparent", textDecoration: "underline" },
            }}
          >
            Skip
          </Button>
        ) : (
          // ✅ BACK: outlined primary
          <Button
            size="small"
            variant="outlined"
            color="primary"
            onClick={handleBack}
            startIcon={<KeyboardArrowLeft />}
            sx={{
              borderColor: "var(--primary-color)",
              color: "var(--primary-color)",
              "&:hover": {
                borderColor: "var(--primary-color)",
                backgroundColor: "transparent",
              },
            }}
          >
            Back
          </Button>
        )
      }
            sx={{ px: 0, bgcolor: "transparent" }}
          />
        </Box>
      </DialogActions>
    </Dialog>
  );
}
