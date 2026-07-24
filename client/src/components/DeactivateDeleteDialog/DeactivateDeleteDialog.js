import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  TextField,
  Typography,
  Alert,
  Stack,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  IconButton,
} from "@mui/material";
import api from "../../services/api";
import { useDispatch } from "react-redux";
import { logoutUser } from "../../features/users/userSlice";
import { navigateOrReload } from "../../utils/navigateOrReload";
import { useNavigate } from "react-router-dom";
import { Visibility, VisibilityOff } from "@mui/icons-material";

const DEACTIVATE_REASONS = [
  "I’m taking a break",
  "Privacy concerns",
  "Too many emails/notifications",
  "Content isn’t relevant",
  "I created a duplicate account",
  "Unwanted messages/interactions",
  "App performance or bugs",
  "Can’t find friends/creators I care about",
  "Safety or harassment concerns",
  "Other",
];

const DELETE_REASONS = [
  "Privacy concerns",
  "Too many emails/notifications",
  "Content isn’t relevant",
  "I created a duplicate account",
  "Unwanted messages/interactions",
  "App performance or bugs",
  "Can’t find friends/creators I care about",
  "Safety or harassment concerns",
  "Other",
];

// freeze a local date to UTC midnight (date-only semantics)
function toUTCDateOnly(d = new Date()) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}
function addMonthsUTC(date, months) {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}
function fmtUTCDate(d) {
  // show date in "MM/DD/YYYY" using UTC so it’s timezone-agnostic
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC" }).format(d);
}

const DeactivateDeleteDialog = ({
  open,
  onClose,
  mode, // 'deactivate' | 'delete'
  user, // current user object (needs _id, email)
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // step control: 1 = reason, 2 = confirm
  const [step, setStep] = useState(1);

  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [ackChecked, setAckChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const isRedirecting = !!countdown;

  const reasonValue = reason === "Other" ? (otherReason || "").trim() : reason;
  const canContinueReason =
    !!reason &&
    (reason !== "Other" || (otherReason && otherReason.trim().length > 2));

  const sixMonthDeadlineUTC = useMemo(() => {
    const deactivatedTodayUTC = toUTCDateOnly(new Date());
    return addMonthsUTC(deactivatedTodayUTC, 6); // “until 6 months (UTC)”
  }, []);

  const isDelete = mode === "delete";
  const canDelete =
    isDelete &&
    emailConfirm.trim().toLowerCase() === user?.email?.toLowerCase() &&
    passwordConfirm.length > 0 &&
    ackChecked;

  const canDeactivate = !isDelete && canContinueReason && ackChecked;

  const resetLocalState = () => {
    setStep(1);
    setReason("");
    setOtherReason("");
    setEmailConfirm("");
    setPasswordConfirm("");
    setAckChecked(false);
    setAlertMessage(null);
    setSaving(false);
  };

  const handleClose = () => {
    if (saving || isRedirecting) return;
    resetLocalState();
    onClose?.();
  };

  const handleNext = () => {
    if (!canContinueReason) return;
    setAlertMessage(null);
    setStep(2);
  };

  const handleDeactivate = async () => {
    if (!user?._id) return;
    setSaving(true);
    setAlertMessage(null);
    try {
      const res = await api.post(`/users/deactivate`, {
        reason: reasonValue,
      });

      setSaving(true);

      startCountdown(
        10,
        () => {
          dispatch(logoutUser());
          navigateOrReload(navigate, "/login");
        },
        res?.data?.message || "Your account has been deactivated."
      );
    } catch (e) {
      setAlertMessage({
        type: "error",
        message: e?.response?.data?.message || "Failed to deactivate account.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user?._id) return;
    setSaving(true);
    setAlertMessage(null);
    try {
      await api.post(`/users/me/delete`, {
        email: emailConfirm.trim(),
        password: passwordConfirm,
        reason: reasonValue,
      });

      setSaving(true);
      startCountdown(
        3,
        () => {
          dispatch(logoutUser());
          navigateOrReload(navigate, "/login");
        },
        "Your account has been deleted permanently."
      );
    } catch (e) {
      setAlertMessage({
        type: "error",
        message: e?.response?.data?.message || "Failed to delete account.",
      });
    } finally {
      setSaving(false);
    }
  };

  const consequences = isDelete
    ? [
        "Your profile, activity, comments, likes, and bookmarks will be permanently removed.",
        "Your handle and content may not be recoverable.",
        "Recommendations & history will be erased.",
      ]
    : [
        "Your profile and activity will be hidden while deactivated.",
        "You won’t be able to like, comment, or bookmark.",
        "If you don’t log in within 6 months, your account will be permanently deleted.",
      ];

  const REASONS = mode === "deactivate" ? DEACTIVATE_REASONS : DELETE_REASONS;

  function startCountdown(seconds, doneCb, baseMessage) {
    setSaving(true);
    setCountdown({ seconds, onDone: doneCb });
    setAlertMessage({
      type: "success",
      message: `${baseMessage} Redirecting in ${seconds}s...`,
    });
  }

  useEffect(() => {
    if (!countdown) return;
    let secs = countdown.seconds;

    const id = setInterval(() => {
      secs -= 1;
      setCountdown((c) => (c ? { ...c, seconds: secs } : null));
      if (secs <= 0) {
        clearInterval(id);
        countdown.onDone?.();
        setCountdown(null);
      }
    }, 1000);

    return () => clearInterval(id);
  }, [countdown]);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {isDelete ? "Delete Account" : "Deactivate Account"}
      </DialogTitle>

      <DialogContent dividers>
        {alertMessage && (
          <Alert severity={alertMessage.type} sx={{ mb: 2 }}>
            {countdown && alertMessage.type === "success"
              ? alertMessage.message.replace(
                  /\d+s\.\.\.$/,
                  `${countdown.seconds}s...`
                )
              : alertMessage.message}
          </Alert>
        )}

        {step === 1 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Please tell us why you’re {isDelete ? "deleting" : "deactivating"}{" "}
              your account:
            </Typography>

            <TextField
              select
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              fullWidth
              size="small"
            >
              {REASONS.map((r) => (
                <MenuItem key={r} value={r}>
                  {r}
                </MenuItem>
              ))}
            </TextField>

            {reason === "Other" && (
              <TextField
                label="Please explain"
                multiline
                minRows={3}
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                fullWidth
              />
            )}
          </Stack>
        )}

        {step === 2 && (
          <Stack spacing={2}>
            {isDelete ? (
              <>
                <Typography variant="subtitle1" color="error">
                  This is permanent
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  If you delete your account, the following will happen:
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="subtitle1">Before you proceed</Typography>
                <Typography variant="body2" color="text.secondary">
                  While deactivated:
                </Typography>
              </>
            )}

            <Box component="ul" sx={{ pl: 3, mt: 0 }}>
              {consequences.map((c) => (
                <li key={c}>
                  <Typography variant="body2">{c}</Typography>
                </li>
              ))}
            </Box>

            {!isDelete && (
              <Alert severity="warning">
                If you deactivate today, you have until{" "}
                <strong>{fmtUTCDate(sixMonthDeadlineUTC)} (UTC)</strong> to log
                in and restore your account. After that, it will be permanently
                deleted.
              </Alert>
            )}

            {isDelete && (
              <Stack spacing={1}>
                <TextField
                  label="Confirm your email"
                  type="email"
                  value={emailConfirm}
                  onChange={(e) => setEmailConfirm(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Confirm your password"
                  type={showPassword ? "text" : "password"}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  fullWidth
                  InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
                />
              </Stack>
            )}

            <FormControlLabel
              control={
                <Checkbox
                  checked={ackChecked}
                  onChange={(e) => setAckChecked(e.target.checked)}
                />
              }
              label={
                isDelete
                  ? "I understand this action is permanent and cannot be undone."
                  : "I understand my account will be permanently deleted if I don’t log in within 6 months."
              }
            />
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        {step === 1 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!canContinueReason || saving}
          >
            Continue
          </Button>
        ) : isDelete ? (
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={!canDelete || saving || isRedirecting}
          >
            {saving ? "Deleting..." : "Delete permanently"}
          </Button>
        ) : (
          <Button
            variant="contained"
            color="warning"
            onClick={handleDeactivate}
            disabled={!canDeactivate || saving || isRedirecting} // 👈 add isRedirecting
          >
            {saving ? "Working..." : "Deactivate"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DeactivateDeleteDialog;
