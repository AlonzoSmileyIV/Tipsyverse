const numberOrZero = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const roundMoney = (value) => Math.round(numberOrZero(value) * 100) / 100;

export const getEventPaidTotal = (event = {}) =>
  numberOrZero(
    event?.payment?.paidTotal ??
      event?.recordedPaidTotal ??
      event?.paidTotal
  );

export const getEventPaymentTotal = (event = {}, fallbackTotal = 0) => {
  const billedTotal = numberOrZero(
    event?.payment?.total ??
      event?.payment?.totalAfterDiscount ??
      event?.payment?.totalAfterDiscounts
  );
  if (billedTotal > 0) return billedTotal;

  return Math.max(
    0,
    numberOrZero(event?.pricing?.estimatedTotal),
    numberOrZero(fallbackTotal)
  );
};

export const getEventPaymentSummary = (event = {}, fallbackTotal = 0) => {
  const total = roundMoney(getEventPaymentTotal(event, fallbackTotal));
  const paid = roundMoney(getEventPaidTotal(event));
  return {
    total,
    paid,
    balance: Math.max(0, roundMoney(total - paid)),
    credit: Math.max(0, roundMoney(paid - total)),
  };
};

export const getApprovedBartenderCount = (event = {}, minimum = 0) => {
  const approved = numberOrZero(event?.counts?.approvedBartenders);
  if (approved > 0) return Math.max(minimum, approved);
  return Math.max(
    minimum,
    numberOrZero(event?.counts?.neededBartenders),
    numberOrZero(event?.pricing?.bartendersRequested)
  );
};

export const getRecommendedBartenderCount = (event = {}, minimum = 0) => {
  const recommended = numberOrZero(event?.counts?.recommendedBartenders);
  return recommended > 0
    ? Math.max(minimum, recommended)
    : getApprovedBartenderCount(event, minimum);
};

export const getRequiredBartenderCount = getApprovedBartenderCount;
