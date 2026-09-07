// components/AgeVerificationModal.js
import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControlLabel,
  Button,
  Typography,
  Link,
  Box,
  Alert,
  Slide,
  Snackbar,
} from "@mui/material";
import { isAtLeastAge, parseDateOnlyParts } from "../../utils/dateOnly";
import DateTextField from "../DateTextField/DateTextField";

const AgeVerificationModal = ({ open, onVerify }) => {
  const clinkAudio = new Audio("/sounds/glass-clink.mp3");
  const [showToast, setShowToast] = useState(false);

  const [dob, setDob] = useState("");
  const [confirmDOB, setConfirmDOB] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState("");

  const formatDobInput = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  const handleVerify = () => {
    const trimmedDob = dob.trim();

    if (!trimmedDob || !confirmDOB || !agreeTerms) {
      setError("Please complete all fields.");
      return;
    }

    if (!parseDateOnlyParts(trimmedDob)) {
      setError("Please enter a valid date of birth.");
      return;
    }

    if (!isAtLeastAge(trimmedDob, 21)) {
      const id = `SIP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      setError(
        `🚫 Sorry, you're not 21! But hey... here's your official Tipsyverse™ Bar ID: ${id} 😎 — Looks fake, smells fake, but it's yours!`
      );
      return;
    }

    localStorage.setItem("ageVerified", "true");
    clinkAudio.play(); // 🍸 play sound
    setShowToast(true);

    setTimeout(() => {
      onVerify();
    }, 1000); // Wait 1 second before closing the modal
  };

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      TransitionComponent={Slide}
      TransitionProps={{ direction: "down" }}
    >
      <Box
        sx={{
          p: 3,
          width: "100%",
          height: "100%",
          maxHeight: 600,
          overflow: "auto",
          animation: error ? "shake 0.4s" : "none",
          "@keyframes shake": {
            "0%": { transform: "translateX(0)" },
            "25%": { transform: "translateX(-8px)" },
            "50%": { transform: "translateX(8px)" },
            "75%": { transform: "translateX(-8px)" },
            "100%": { transform: "translateX(0)" },
          },
        }}
      >
        <DialogTitle textAlign="center" fontWeight="bold">
          🍸 Welcome to Tipsyverse
        </DialogTitle>

        <DialogContent>
          <Typography textAlign="center" mb={2}>
            Before we shake things up, we need to make sure you're of legal
            sipping age. Drop your birthday and confirm you're 21 or older — no
            fake IDs 😉
          </Typography>

          <DateTextField
            fullWidth
            label="Date of Birth"
            value={dob}
            onChange={(e) => {
              setDob(formatDobInput(e.target.value));
              setError("");
            }}
            helperText="Use MM/DD/YYYY, like 07/02/1998."
            sx={{ mb: 2 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={confirmDOB}
                onChange={(e) => {
                  setConfirmDOB(e.target.checked);
                  setError("");
                }}
              />
            }
            label="I declare that the above date is my date of birth"
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={agreeTerms}
                onChange={(e) => {
                  setAgreeTerms(e.target.checked);
                  setError("");
                }}
              />
            }
            label={
              <Typography>
                I agree to the{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener"
                  sx={{ color: "var(--primary-color)" }}
                >
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link
                  href="/terms-conditions"
                  target="_blank"
                  rel="noopener"
                  sx={{ color: "var(--primary-color)" }}
                >
                  Terms and Conditions
                </Link>
              </Typography>
            }
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ justifyContent: "center", pb: 3 }}>
          <Button
            variant="contained"
            sx={{ backgroundColor: "var(--primary-color)" }}
            onClick={handleVerify}
          >
            Let's Go 🍹
          </Button>
        </DialogActions>
        <Typography textAlign="center" mt={1}>
          Already have an account?{" "}
          <Link
            href="/login"
            underline="hover"
            sx={{ color: "var(--primary-color)" }}
          >
            Login
          </Link>
        </Typography>
      </Box>
      <Snackbar
        open={showToast}
        autoHideDuration={3000}
        onClose={() => setShowToast(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setShowToast(false)}
          severity="success"
          sx={{ width: "100%" }}
        >
          🍸 Cheers! You’re verified! Enjoy!
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default AgeVerificationModal;
