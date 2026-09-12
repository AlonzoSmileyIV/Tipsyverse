// src/components/LicenseDetailForm/LicenseDetailForm.jsx
import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
  MenuItem,
  FormHelperText,
  DialogActions,
  Dialog,
  DialogTitle,
  DialogContent,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import api from "../../services/api";
import { Visibility } from "@mui/icons-material";
import { parseDateOnlyParts } from "../../utils/dateOnly";
import DateTextField from "../DateTextField/DateTextField";

const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

const DENY_REASONS = [
  {
    value: "invalid_license_number",
    label: "License number does not match state records",
  },
  {
    value: "expired_license",
    label: "License is expired and not currently valid",
  },
  {
    value: "identity_mismatch",
    label: "Name or identity does not match the license document",
  },
  {
    value: "illegible_document",
    label: "Uploaded document is blurry, cut off, or unreadable",
  },
  {
    value: "wrong_document_type",
    label: "Wrong document type uploaded (not a server/bartender permit)",
  },
  {
    value: "unrecognized_authority",
    label: "License appears to be issued by an unrecognized authority",
  },
  {
    value: "suspected_fraud",
    label: "Document appears altered or fraudulent",
  },
];

// Optional: map state codes -> full names (for nicer search queries)
const STATE_NAMES = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

const STATE_PORTALS = {
  IN: "https://www.mylicense.in.gov/everification/", // Indiana ATC Permit Lookup
  TX: "https://www.tabc.texas.gov/services/online-tools/", // Texas TABC
  CA: "https://www.abc.ca.gov/licensing/license-lookup/", // California ABC License Lookup
  FL: "https://www.myfloridalicense.com/wl11.asp", // Florida License Lookup
  NY: "https://www.sla.ny.gov/brand-label-search", // NY SLA / Permit Search
};

// Build a URL where admins can search licenses for that state.
// You can later swap this to real state portals if you want.
function getLicenseSearchUrl(stateCode) {
  const code = (stateCode || "").toUpperCase().trim();
  if (!code) return null;

  // 1️⃣ If we have an official portal → return it
  if (STATE_PORTALS[code]) {
    return STATE_PORTALS[code];
  }

  // 2️⃣ Otherwise → fallback to Google
  const stateName = STATE_NAMES[code] || code;
  const query = encodeURIComponent(`${stateName} bartender permit lookup`);
  return `https://www.google.com/search?q=${query}`;
}

function getBartenderUserIdFromLicense(license) {
  if (!license) return null;
  return (
    license.bartenderId ||
    license.userId ||
    license.user?._id ||
    license.bartender?._id ||
    license.ownerId ||
    null
  );
}

const handleOpenInspectionSite = (stateCode) => {
  const url = getLicenseSearchUrl(stateCode);

  if (url) {
    setTimeout(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    }, 500); // 0.5 seconds
  }
};

const formatDateInput = (value) => {
  const digits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const datePartsToInput = (value) => {
  const parts = parseDateOnlyParts(value);
  if (!parts) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${pad(parts.month)}/${pad(parts.day)}/${parts.year}`;
};

const datePartsToISODate = (parts) => {
  if (!parts) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
};

const compareDateParts = (left, right) => {
  if (!left || !right) return 0;
  const leftValue = left.year * 10000 + left.month * 100 + left.day;
  const rightValue = right.year * 10000 + right.month * 100 + right.day;
  return leftValue - rightValue;
};

function LicenseDetailForm({
  mode = "create", // "create" | "edit"
  initialValue = null,
  onClose,
  onSaved,
  onDeleted,
  isEmployee = false,
  keepInputsDisabled = false,
  disableDeleteAndSave = false,
}) {
  const [state, setState] = useState(initialValue?.state || "IN");
  const [licenseNumber, setLicenseNumber] = useState(
    initialValue?.permitNumber || initialValue?.licenseNumber || ""
  );
  const [expiresAt, setExpiresAt] = useState(
    initialValue?.expiresAt ? datePartsToInput(initialValue.expiresAt) : ""
  );
  const [verificationDocument, setVerificationDocument] = useState(null);
  const [attested, setAttested] = useState(false);
  const [trainingAttested, setTrainingAttested] = useState(
    Boolean(initialValue?.serverTraining?.attestedRequiredTraining)
  );
  const [compliancePolicy, setCompliancePolicy] = useState({
    permitRequired: true,
    trainingAttestationRequired: true,
    adminReviewRequired: true,
  });
  const [status, setStatus] = useState(
    initialValue?.complianceStatus || initialValue?.status || "pending"
  );
  const [denyDialogOpen, setDenyDialogOpen] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [denyReasonError, setDenyReasonError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isEdit = mode === "edit";
  const isReviewStatus = ["pending", "under_review"].includes(status);

  const showApproveDeny = isEmployee && isEdit && isReviewStatus;

  // disable fields only when employee is actively reviewing OR parent forces it
  const disableFields =
    (isEmployee && isEdit && isReviewStatus) || keepInputsDisabled;

  const todayParts = parseDateOnlyParts(new Date());
  const expiresAtParts = parseDateOnlyParts(expiresAt);

  const isFormValid =
    Boolean(state) &&
    (!compliancePolicy.permitRequired ||
      (Boolean(licenseNumber) &&
        Boolean(expiresAtParts) &&
        compareDateParts(expiresAtParts, todayParts) >= 0)) &&
    attested &&
    (!compliancePolicy.trainingAttestationRequired || trainingAttested);

  useEffect(() => {
    if (!state) return;
    let active = true;
    api.get("/users/compliance-policy", { params: { state } })
      .then((response) => {
        if (active && response.data?.data) setCompliancePolicy(response.data.data);
      })
      .catch(() => {
        if (active) setCompliancePolicy({ permitRequired: true, trainingAttestationRequired: true, adminReviewRequired: true });
      });
    return () => { active = false; };
  }, [state]);

  useEffect(() => {
    if (!initialValue) return;
    setState(initialValue.state || "");
    setLicenseNumber(
      initialValue.permitNumber || initialValue.licenseNumber || ""
    );
    setExpiresAt(
      initialValue.expiresAt ? datePartsToInput(initialValue.expiresAt) : ""
    );
    setStatus(
      initialValue.complianceStatus || initialValue.status || "pending"
    );
    setTrainingAttested(
      Boolean(initialValue.serverTraining?.attestedRequiredTraining)
    );
  }, [initialValue]);

  const handleApprove = async () => {
    if (!initialValue?.licenseId) return;

    const userId = getBartenderUserIdFromLicense(initialValue);

    if (!userId) {
      setError("Missing bartender user ID for this license.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await api.patch(
        `/users/${userId}/licenses/${initialValue.licenseId}/decision`,
        {
          action: "approve",
        }
      );

      setStatus(response.data?.data?.complianceStatus || "verified");

      await onSaved?.();
    } catch (e) {
      console.error(e);
      setError(
        e?.response?.data?.message ||
          "Failed to approve license. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // This is just the entry point → opens the dialog
  const handleOpenDenyDialog = () => {
    setDenyReason("");
    setDenyReasonError("");
    setDenyDialogOpen(true);
  };

  const handleCloseDenyDialog = () => {
    if (!submitting) {
      setDenyDialogOpen(false);
    }
  };

  const handleConfirmDeny = async () => {
    if (!initialValue?.licenseId) return;

    if (!denyReason) {
      setDenyReasonError("Please select a reason for denial.");
      return;
    }

    const userId = getBartenderUserIdFromLicense(initialValue);
    if (!userId) {
      setError("Missing bartender user ID for this license.");
      return;
    }

    const reasonLabel =
      DENY_REASONS.find((r) => r.value === denyReason)?.label || denyReason;

    try {
      setSubmitting(true);
      setDenyReasonError("");

      await api.patch(
        `/users/${userId}/licenses/${initialValue?.licenseId}/decision`,
        {
          action: "deny",
          note: reasonLabel, // this goes to `decisionNote` in your backend
        }
      );

      setDenyDialogOpen(false);
      onSaved?.();
    } catch (e) {
      console.error(e);
      setError(
        e?.response?.data?.message ||
          "Failed to deny license. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = async () => {
    setError("");

    const parsedExpiresAt = parseDateOnlyParts(expiresAt);

    if (!state || (compliancePolicy.permitRequired && (!licenseNumber || !expiresAt))) {
      setError("State is required. This state also requires a permit number and expiration date.");
      return;
    }

    if (expiresAt && !parsedExpiresAt) {
      setError("Please enter a valid expiration date.");
      return;
    }

    if (parsedExpiresAt && compareDateParts(parsedExpiresAt, todayParts) < 0) {
      setError("Expiration date cannot be in the past.");
      return;
    }

    try {
      setSubmitting(true);

      const payload = new FormData();
      payload.append("state", state);
      payload.append("permitNumber", licenseNumber);
      if (parsedExpiresAt) payload.append("expiresAt", datePartsToISODate(parsedExpiresAt));
      payload.append("attestedAuthenticAndCurrent", String(attested));
      payload.append("attestedRequiredTraining", String(trainingAttested));
      if (verificationDocument)
        payload.append("verificationDocument", verificationDocument);

      if (isEdit && initialValue?._id) {
        await api.patch(`/users/me/licenses/${initialValue?._id}`, payload);
      } else {
        await api.post("/users/me/licenses", payload);
      }

      onSaved?.();
    } catch (e) {
      console.error(e);
      setError(
        e?.response?.data?.message ||
          "Failed to save license. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!initialValue?._id) return;

    try {
      setSubmitting(true);
      await api.delete(`/users/me/licenses/${initialValue?._id}`);
      onDeleted?.();
    } catch (e) {
      console.error(e);
      setError(
        e?.response?.data?.message ||
          "Failed to delete license. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewVerificationDocument = async () => {
    try {
      const licenseId = initialValue?.licenseId || initialValue?._id;
      const response = await api.get(
        `/users/licenses/${licenseId}/verification-document`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(response.data);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(
        e?.response?.data?.message ||
          "Failed to open the verification document."
      );
    }
  };

  return (
    <Box sx={{ width: { xs: "100vw", sm: 420 }, p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">
          {isEdit ? "License Details" : "Add New License"}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Stack>

      <Divider sx={{ my: 2 }} />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
        License
      </Typography>

      <Stack spacing={2}>
        <TextField
          select
          label="State"
          disabled={disableFields}
          value={state}
          onChange={(e) => setState(e.target.value)}
          fullWidth
          size="small"
        >
          {US_STATES.map((s) => (
            <MenuItem key={s.value} value={s.value}>
              {s.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label={`License / Permit Number${compliancePolicy.permitRequired ? "" : " (optional)"}`}
          value={licenseNumber}
          disabled={disableFields}
          onChange={(e) => setLicenseNumber(e.target.value)}
          fullWidth
          size="small"
        />

        <DateTextField
          label={`Expiration Date${compliancePolicy.permitRequired ? "" : " (optional)"}`}
          value={expiresAt}
          disabled={disableFields}
          onChange={(e) => {
            setExpiresAt(formatDateInput(e.target.value));
            setError("");
          }}
          fullWidth
          size="small"
          helperText={compliancePolicy.permitRequired
            ? "Use MM/DD/YYYY. Expiration date cannot be in the past."
            : "Optional when this state does not require an individual permit."}
        />

        {state && (
          <>

            {!disableFields && (
              <Button variant="outlined" component="label">
                {verificationDocument
                  ? verificationDocument.name
                  : initialValue?.serverTraining?.hasVerificationDocument
                  ? "Replace permit document"
                  : "Upload supporting document (optional)"}
                <input
                  hidden
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) =>
                    setVerificationDocument(e.target.files?.[0] || null)
                  }
                />
              </Button>
            )}
            {disableFields && (
              <Typography variant="body2" color="text.secondary">
                Required server training confirmed: {initialValue?.serverTraining?.attestedRequiredTraining ? "Yes" : "No"}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              Upload only relevant permit or verification proof. Redact SSNs, driver-license
              numbers, and unrelated personal information first.
            </Typography>
            {!disableFields && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={attested}
                    onChange={(e) => setAttested(e.target.checked)}
                  />
                }
                label="I attest that this document is authentic and current."
              />
            )}
            {!disableFields && compliancePolicy.trainingAttestationRequired && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={trainingAttested}
                    onChange={(e) => setTrainingAttested(e.target.checked)}
                  />
                }
                label="I confirm I completed any server training required for this permit."
              />
            )}
            {isEmployee &&
              initialValue?.serverTraining?.hasVerificationDocument && (
                <Button
                  variant="outlined"
                  onClick={handleViewVerificationDocument}
                >
                  View verification document
                </Button>
              )}
          </>
        )}

        {isEdit && (
          <TextField
            label="Status"
            value={status}
            size="small"
            disabled
            helperText="Status is managed by Tipsyverse staff."
          />
        )}
      </Stack>

      {/* Employee review actions */}
      {showApproveDeny && isEmployee && (
        <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
          <Button
            variant="outlined"
            startIcon={<Visibility />}
            onClick={() => handleOpenInspectionSite(state)}
            disabled={submitting}
          >
            Inspect
          </Button>

          <Box sx={{ flex: 1 }} />

          <Button
            variant="outlined"
            color="error"
            onClick={handleOpenDenyDialog}
            disabled={submitting}
          >
            Deny
          </Button>

          <Button
            variant="contained"
            onClick={handleApprove}
            disabled={submitting}
            sx={{ backgroundColor: "var(--primary-color)" }}
          >
            Approve
          </Button>
        </Stack>
      )}

      <Stack
        direction="row"
        spacing={1.5}
        sx={{ mt: 3 }}
        justifyContent="space-between"
        alignItems="center"
      >
        <Button
          variant="outlined"
          color="inherit"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </Button>

        {!showApproveDeny && !disableDeleteAndSave && (
          <Stack direction="row" spacing={1.5}>
            {isEdit && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setDeleteDialogOpen(true)}
                disabled={submitting}
              >
                Delete
              </Button>
            )}

            <Button
              variant="contained"
              onClick={handleSave}
              disabled={submitting || !isFormValid}
              sx={{ backgroundColor: "var(--primary-color)" }}
            >
              {isEdit ? "Save Changes" : "Add New License"}
            </Button>
          </Stack>
        )}
      </Stack>

      <Dialog
        open={denyDialogOpen}
        onClose={handleCloseDenyDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Deny License</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Please select a reason for denying this bartender license. This note
            may be visible to the bartender and stored in the activity log.
          </Typography>

          <FormControl fullWidth size="small" error={!!denyReasonError}>
            <InputLabel id="deny-reason-label">Reason for denial</InputLabel>
            <Select
              labelId="deny-reason-label"
              label="Reason for denial"
              value={denyReason}
              onChange={(e) => {
                setDenyReason(e.target.value);
                if (denyReasonError) setDenyReasonError("");
              }}
            >
              {DENY_REASONS.map((reason) => (
                <MenuItem key={reason.value} value={reason.value}>
                  {reason.label}
                </MenuItem>
              ))}
            </Select>
            {denyReasonError && (
              <FormHelperText>{denyReasonError}</FormHelperText>
            )}
          </FormControl>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseDenyDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDeny}
            color="error"
            variant="contained"
            disabled={!denyReason || submitting} // ← here
          >
            {submitting ? "Denying..." : "Confirm Denial"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => !submitting && setDeleteDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Delete License</DialogTitle>

        <DialogContent dividers>
          <Typography variant="body2">
            Are you sure you want to delete this license? This action cannot be
            undone.
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>

          <Button
            color="error"
            variant="contained"
            onClick={confirmDelete}
            disabled={submitting}
          >
            {submitting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default LicenseDetailForm;
