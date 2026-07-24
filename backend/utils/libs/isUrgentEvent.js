// utils/events.js
export const isUrgentEvent = (startAt, hours = 48) => {
  if (!startAt) return false;
  const now = Date.now();
  return new Date(startAt).getTime() - now <= hours * 3600_000;
}
