export const getCustomerPaymentStatus = (totalValue, paidValue, event = {}) => {
  const total = Math.max(0, Number(totalValue) || 0);
  const paid = Math.max(0, Number(paidValue) || 0);

  if (String(event?.status || "").toLowerCase() === "canceled") {
    const retained = Math.min(
      paid,
      Math.max(0, Number(event?.cancellation?.retainedAmount) || 0)
    );
    const credit = Math.max(0, paid - retained);
    return credit > 0
      ? {
          key: "refund_review",
          label: `Refund review $${credit.toFixed(2)}`,
          color: "info",
          severity: "info",
        }
      : {
          key: "canceled",
          label: "Canceled — no balance due",
          color: "default",
          severity: "info",
        };
  }

  if (total <= 0 && paid <= 0) {
    return {
      key: "pricing_pending",
      label: "Pricing pending",
      color: "default",
      severity: "info",
    };
  }

  if (paid > total) {
    return {
      key: "credit",
      label: "Paid / Credit",
      color: "success",
      severity: "success",
    };
  }

  if (total > 0 && paid >= total) {
    return {
      key: "paid_in_full",
      label: "Paid in full",
      color: "success",
      severity: "success",
    };
  }

  return {
    key: paid > 0 ? "partially_paid" : "balance_due",
    label: `Balance $${Math.max(0, total - paid).toFixed(2)}`,
    color: "warning",
    severity: "warning",
  };
};

export default getCustomerPaymentStatus;
