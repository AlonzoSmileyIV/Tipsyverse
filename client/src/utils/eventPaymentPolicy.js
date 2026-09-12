const HOUR_MS = 60 * 60 * 1000;

const asDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

export const formatPaymentDueDate = (value, timeZone = "UTC") => {
  const date = asDate(value);
  return date
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone,
        timeZoneName: "short",
      }).format(date)
    : "Not scheduled";
};

export const getEventPaymentPolicyView = (
  event,
  { total = 0, paid = 0, now = new Date() } = {}
) => {
  const billed = Math.max(0, Number(total) || 0);
  const received = Math.max(0, Number(paid) || 0);
  const balance = Math.max(0, billed - received);
  const payment = event?.payment || {};
  const dueAt = asDate(payment.balanceDueAt);
  const startAt = asDate(event?.startAt);

  if (billed <= 0 && received <= 0) {
    return { status: "not_priced", label: "Pricing pending", severity: "info", dueAt };
  }
  if (balance <= 0) {
    return { status: "paid", label: "Paid in full", severity: "success", dueAt };
  }
  if (payment.policyStatus === "arrangement" && payment.arrangementApprovedAt) {
    return { status: "arrangement", label: "Payment arrangement", severity: "info", dueAt, balance };
  }
  if (payment.policyStatus === "canceled_nonpayment") {
    return { status: "canceled_nonpayment", label: "Canceled — nonpayment", severity: "error", dueAt, balance };
  }

  const current = asDate(now) || new Date();
  let status = payment.policyStatus || "current";
  if (startAt && current >= new Date(startAt.getTime() - 48 * HOUR_MS)) {
    status = "action_required";
  } else if (startAt && current >= new Date(startAt.getTime() - 72 * HOUR_MS)) {
    status = "payment_hold";
  } else if (dueAt && current >= dueAt) {
    status = payment.shortNoticeFullPayment ? "due_now" : "past_due";
  }

  const dueLabel = formatPaymentDueDate(
    dueAt,
    event?.timezone ||
      event?.location?.timezone ||
      "America/Indiana/Indianapolis"
  );
  const views = {
    action_required: { label: "Payment action required", severity: "error" },
    payment_hold: { label: "Payment hold", severity: "error" },
    past_due: { label: `Past due • ${dueLabel}`, severity: "warning" },
    due_now: { label: "Full payment due now", severity: "warning" },
    due_soon: { label: `Due ${dueLabel}`, severity: "warning" },
    current: { label: `Due ${dueLabel}`, severity: "info" },
  };
  return { status, balance, dueAt, ...(views[status] || views.current) };
};

export default getEventPaymentPolicyView;
