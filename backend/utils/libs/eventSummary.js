const numberOrZero = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

export const getRequiredBartenderCount = (event = {}, minimum = 0) =>
  Math.max(
    minimum,
    numberOrZero(event?.counts?.neededBartenders),
    numberOrZero(event?.pricing?.bartendersRequested)
  );

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

