const roundMoney = (value) =>
  Math.round((Number(value) || 0) * 100) / 100;

export const getRequiredInitialPayment = ({
  total,
  startAt,
  now = new Date(),
  depositRate = 0.3,
}) => {
  const billedTotal = Math.max(0, roundMoney(total));
  const startsAt = new Date(startAt).getTime();
  const currentTime = new Date(now).getTime();
  const shortNotice =
    Number.isFinite(startsAt) &&
    Number.isFinite(currentTime) &&
    startsAt - currentTime <= 7 * 24 * 60 * 60 * 1000;

  return shortNotice
    ? billedTotal
    : Math.min(billedTotal, roundMoney(billedTotal * depositRate));
};

export const getSavedCardCollection = ({
  total,
  paid,
  startAt,
  now = new Date(),
  collectionType = "initial",
}) => {
  const billedTotal = Math.max(0, roundMoney(total));
  const settledPaid = Math.max(0, roundMoney(paid));
  const balance = Math.max(0, roundMoney(billedTotal - settledPaid));
  const requiredInitial = getRequiredInitialPayment({
    total: billedTotal,
    startAt,
    now,
  });
  const collectible =
    collectionType === "balance"
      ? balance
      : Math.min(
          balance,
          Math.max(0, roundMoney(requiredInitial - settledPaid))
        );

  return {
    total: billedTotal,
    paid: settledPaid,
    balance,
    requiredInitial,
    collectible: roundMoney(collectible),
  };
};

export const settledPaymentStatuses = new Set(["recorded"]);

export const savedCardIdempotencyKey = (eventId, ledgerVersion = 0) =>
  `event-${eventId}-ledger-${Number(ledgerVersion) || 0}`;

