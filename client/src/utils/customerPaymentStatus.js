export const getCustomerPaymentStatus = (totalValue, paidValue) => {
  const total = Math.max(0, Number(totalValue) || 0);
  const paid = Math.max(0, Number(paidValue) || 0);

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
