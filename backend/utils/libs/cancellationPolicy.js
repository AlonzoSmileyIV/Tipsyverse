export const CANCELLATION_POLICY_VERSION = "2026-09-no-auto-refund";

export const CUSTOMER_CANCELLATION_REASONS = Object.freeze([
  "no_longer_needed",
  "date_changed",
  "budget",
  "other_vendor",
  "duplicate",
  "incorrect_details",
  "other",
]);

export const STAFF_CANCELLATION_REASONS = Object.freeze([
  ...CUSTOMER_CANCELLATION_REASONS,
  "not_responding",
  "nonpayment",
  "unable_to_staff",
  "safety_concern",
  "weather",
  "venue_issue",
]);

export const deriveCancellationPolicy = ({ event, paid = 0, now = new Date() } = {}) => {
  const status = String(event?.status || "").toLowerCase();
  const startAt = event?.startAt ? new Date(event.startAt) : null;
  const canceledOrFinal = ["canceled", "completed", "closed"].includes(status);
  const millisecondsUntilStart = startAt && !Number.isNaN(startAt.getTime())
    ? startAt.getTime() - new Date(now).getTime()
    : null;
  const timingTier = millisecondsUntilStart == null
    ? "unscheduled"
    : millisecondsUntilStart <= 0
    ? "event_started"
    : millisecondsUntilStart <= 48 * 60 * 60 * 1000
    ? "inside_48_hours"
    : "before_48_hours";
  const paidAtCancellation = Math.max(0, Math.round((Number(paid) || 0) * 100) / 100);

  return {
    policyVersion: CANCELLATION_POLICY_VERSION,
    cancelable: !canceledOrFinal,
    timingTier,
    cancellationFee: 0,
    retainedAmount: 0,
    paidAtCancellation,
    refundEligibleAmount: paidAtCancellation,
    refundReviewStatus: paidAtCancellation > 0 ? "pending" : "not_required",
    automaticRefund: false,
  };
};
