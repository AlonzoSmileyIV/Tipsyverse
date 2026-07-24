export function startOfUTCDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Month-add that respects UTC and month-length rollover
export function addMonthsUTC(date, months) {
  if (!date) return null;
  const d = new Date(date);
  // normalize to UTC midnight of that calendar day
  const base = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  // JS Date handles month overflow (e.g., 2025-01 + 6 = 2025-07)
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, base.getUTCDate(), 0, 0, 0, 0));
}

// Format a UTC date as MM/DD/YYYY in UTC
export function formatUTC(dateUTC) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC" }).format(dateUTC);
}

