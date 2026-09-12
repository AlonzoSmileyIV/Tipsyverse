export const PAYMENT_POLICY = Object.freeze({
  firstReminderDaysBeforeEvent: 14,
  balanceDueDaysBeforeEvent: 7,
  pastDueWarningDaysBeforeEvent: 5,
  holdHoursBeforeEvent: 72,
  actionHoursBeforeEvent: 48,
});

const asValidDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const beforeEvent = (startAt, milliseconds) =>
  new Date(startAt.getTime() - milliseconds);

const zonedParts = (value, timeZone) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

const subtractCalendarDays = (value, days, timeZone) => {
  const parts = zonedParts(value, timeZone);
  const targetWallTime = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day - days,
    parts.hour,
    parts.minute,
    parts.second
  );
  let candidate = new Date(targetWallTime);
  for (let index = 0; index < 3; index += 1) {
    const candidateParts = zonedParts(candidate, timeZone);
    const representedWallTime = Date.UTC(
      candidateParts.year,
      candidateParts.month - 1,
      candidateParts.day,
      candidateParts.hour,
      candidateParts.minute,
      candidateParts.second
    );
    candidate = new Date(candidate.getTime() + targetWallTime - representedWallTime);
  }
  return candidate;
};

export const buildEventPaymentSchedule = ({
  startAt,
  confirmedAt,
  existingDueAt,
  timeZone = "UTC",
} = {}) => {
  const start = asValidDate(startAt);
  if (!start) return null;

  const confirmed = asValidDate(confirmedAt) || new Date();
  const standardDueAt = subtractCalendarDays(
    start,
    PAYMENT_POLICY.balanceDueDaysBeforeEvent,
    timeZone
  );
  const dueAt =
    asValidDate(existingDueAt) ||
    (confirmed >= standardDueAt ? confirmed : standardDueAt);

  return {
    firstReminderAt: subtractCalendarDays(
      start,
      PAYMENT_POLICY.firstReminderDaysBeforeEvent,
      timeZone
    ),
    dueAt,
    pastDueWarningAt: subtractCalendarDays(
      start,
      PAYMENT_POLICY.pastDueWarningDaysBeforeEvent,
      timeZone
    ),
    holdAt: beforeEvent(
      start,
      PAYMENT_POLICY.holdHoursBeforeEvent * 60 * 60 * 1000
    ),
    actionRequiredAt: beforeEvent(
      start,
      PAYMENT_POLICY.actionHoursBeforeEvent * 60 * 60 * 1000
    ),
    shortNotice: confirmed >= standardDueAt,
  };
};

export const deriveEventPaymentPolicy = ({
  startAt,
  confirmedAt,
  existingDueAt,
  total,
  paid,
  arrangementApproved = false,
  now = new Date(),
  timeZone = "UTC",
} = {}) => {
  const schedule = buildEventPaymentSchedule({
    startAt,
    confirmedAt,
    existingDueAt,
    timeZone,
  });
  const billedTotal = Math.max(0, Number(total) || 0);
  const paidTotal = Math.max(0, Number(paid) || 0);
  const balance = Math.max(0, billedTotal - paidTotal);

  if (!schedule || billedTotal <= 0) {
    return { status: "not_priced", balance, schedule };
  }
  if (balance <= 0) return { status: "paid", balance: 0, schedule };
  if (arrangementApproved) {
    return { status: "arrangement", balance, schedule };
  }

  const current = asValidDate(now) || new Date();
  if (current >= schedule.actionRequiredAt) {
    return { status: "action_required", balance, schedule };
  }
  if (current >= schedule.holdAt) {
    return { status: "payment_hold", balance, schedule };
  }
  if (current >= schedule.dueAt) {
    return {
      status: schedule.shortNotice ? "due_now" : "past_due",
      balance,
      schedule,
    };
  }
  if (current >= schedule.firstReminderAt) {
    return { status: "due_soon", balance, schedule };
  }
  return { status: "current", balance, schedule };
};

export default deriveEventPaymentPolicy;
