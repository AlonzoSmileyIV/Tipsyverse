export const DEFAULT_EVENT_PAYMENT_PROVIDER = "stripe";

export const selectDefaultPaymentMethodId = (methods = [], currentId = "") => {
  if (currentId && methods.some((method) => method._id === currentId)) {
    return currentId;
  }
  return methods.find((method) => method.isDefault)?._id || "";
};

export const isSettledPayment = (payment) =>
  String(payment?.status || "recorded").toLowerCase() === "recorded";

