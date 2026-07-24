import React from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import moment from "moment";

/* ----------------------- small UI pieces ----------------------- */
export function PricingRow({ left, middle, right, dense = false }) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      alignItems={{ xs: "flex-start", md: "center" }}
      justifyContent="space-between"
      spacing={1}
      sx={{ mb: dense ? 6 : 2 }}
    >
      <Box sx={{ flex: "1 1 40%", minWidth: 260 }}>{left}</Box>
      <Box sx={{ flex: "1 1 35%", textAlign: { xs: "left", md: "center" } }}>
        {middle}
      </Box>
      <Box
        sx={{
          flex: "0 0 25%",
          textAlign: { xs: "left", md: "right" },
          fontWeight: 600,
        }}
      >
        {right}
      </Box>
    </Stack>
  );
}
export function PricingHeader() {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      alignItems={{ xs: "flex-start", md: "center" }}
      justifyContent="space-between"
      sx={{ fontWeight: 700, mb: 1 }}
    >
      <Box sx={{ flex: "1 1 40%", minWidth: 260 }}>Pricing Inputs</Box>
      <Box sx={{ flex: "1 1 35%", textAlign: { xs: "left", md: "center" } }}>
        Details
      </Box>
      <Box sx={{ flex: "0 0 25%", textAlign: { xs: "left", md: "right" } }}>
        Cost
      </Box>
    </Stack>
  );
}
export const Row = ({ label, value }) => (
  <Stack spacing={0.5} sx={{ mb: 1.25 }}>
    <Typography variant="overline" color="text.secondary">
      {label}
    </Typography>
    <Typography variant="body1">{value ?? "—"}</Typography>
  </Stack>
);

export function ContactAttemptsList({ attempts = [], outcomeOptions = [] }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Previous Attempts
      </Typography>
      {attempts.length ? (
        <Box sx={{ maxHeight: 220, overflowY: "auto" }}>
          <Stack spacing={1}>
            {attempts.map((attempt, index) => {
              const at = attempt.attemptAt || attempt.createdAt || attempt.at;
              const rawUser =
                attempt.attemptedBy ||
                attempt.createdBy ||
                attempt.user ||
                attempt.by ||
                null;
              const user = rawUser && typeof rawUser === "object" ? rawUser : {};
              const profile =
                user.profile && typeof user.profile === "object" ? user.profile : {};
              const name =
                user.fullName ||
                user.fullname ||
                user.name ||
                profile.fullName ||
                profile.fullname ||
                profile.name ||
                user.email ||
                "Unknown team member";
              const avatarSrc =
                profile.photo ||
                profile.photoUrl ||
                user.avatarUrl ||
                user.photoUrl ||
                user.image ||
                "";
              const outcomeLabel =
                outcomeOptions.find((opt) => opt.value === attempt.outcome)?.label ||
                attempt.outcome ||
                "Unknown";

              return (
                <Paper key={attempt._id || index} variant="outlined" sx={{ p: 1.25 }}>
                  <Stack spacing={0.75}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Avatar src={avatarSrc} sx={{ width: 32, height: 32 }}>
                          {name?.[0]?.toUpperCase?.() || "?"}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {outcomeLabel}
                          </Typography>
                          {user.email && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                            >
                              {user.email}
                            </Typography>
                          )}
                        </Box>
                      </Stack>

                      <Typography variant="caption" color="text.secondary">
                        {at
                          ? moment(at).format("MMM D, YYYY • h:mm a")
                          : "Time not recorded"}
                      </Typography>
                    </Stack>

                    {attempt.followUpAt && (
                      <Typography variant="caption" color="text.secondary">
                        Follow-up at:{" "}
                        {moment(attempt.followUpAt).format("MMM D, YYYY • h:mm a")}
                      </Typography>
                    )}

                    {attempt.notes && (
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        {attempt.notes}
                      </Typography>
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No attempts logged yet.
        </Typography>
      )}
    </Box>
  );
}

export function PaymentStatusSummary({
  paymentStatus,
  paymentChipColor,
  amountPaid,
  discountedTotal,
  paymentsLoading,
  paymentRequest,
  paymentRequests = [],
  formatMoney,
}) {
  return (
    <>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        sx={{ mb: 2 }}
      >
        <Chip label={paymentStatus} color={paymentChipColor} />

        <Typography variant="body2" color="text.secondary">
          Paid {formatMoney(amountPaid)} / {formatMoney(discountedTotal)}
        </Typography>
      </Stack>

      {paymentsLoading ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Loading payment activity...
        </Typography>
      ) : paymentRequest ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Payment request on file:{" "}
          <strong>{formatMoney(paymentRequest.amountRequested)}</strong> via{" "}
          {paymentRequest.provider} ({paymentRequest.status}). You can collect
          payment for this request.
        </Alert>
      ) : paymentRequests.length > 0 ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Previous payment request found, but it is already completed, expired,
          or cancelled.
        </Alert>
      ) : null}
    </>
  );
}

export function RecordedPaymentsList({
  payments = [],
  formatMoney,
  formatDate,
  onPaymentAction,
}) {
  if (!payments.length) return null;

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Recorded Payments
      </Typography>
      <Stack spacing={1}>
        {payments.map((payment) => {
          const status = String(payment.status || "recorded").toLowerCase();
          const isReversible = !["voided", "refunded"].includes(status);
          return (
            <Paper
              key={payment._id || payment.createdAt}
              variant="outlined"
              sx={{ p: 1.25 }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                spacing={1}
              >
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                    <Typography variant="subtitle2">
                      {formatMoney(payment.amount)}
                    </Typography>
                    <Chip
                      size="small"
                      label={status}
                      color={
                        status === "recorded"
                          ? "success"
                          : status === "refunded"
                          ? "warning"
                          : "default"
                      }
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {[payment.method, payment.reference].filter(Boolean).join(" • ") ||
                      "No reference"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {payment.receivedAt
                      ? formatDate(payment.receivedAt)
                      : "Date not recorded"}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={!isReversible}
                    onClick={() => onPaymentAction(payment, "void")}
                  >
                    Void
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    disabled={!isReversible}
                    onClick={() => onPaymentAction(payment, "refund")}
                  >
                    Refund
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}
