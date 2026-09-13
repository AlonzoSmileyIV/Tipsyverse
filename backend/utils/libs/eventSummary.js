const numberOrZero = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
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

export const getEventPaymentTotal = (event = {}, fallbackTotal = 0) => {
  const billedTotal = numberOrZero(
    event?.payment?.total ??
      event?.payment?.totalAfterDiscount ??
      event?.payment?.totalAfterDiscounts
  );
  return billedTotal > 0
    ? billedTotal
    : Math.max(0, numberOrZero(event?.pricing?.estimatedTotal), numberOrZero(fallbackTotal));
};
