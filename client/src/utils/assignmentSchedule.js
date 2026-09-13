const CLOSED_EVENT_STATUSES = new Set(["canceled", "completed", "closed"]);

export const assignmentScheduleBucket = (assignment, now = new Date()) => {
  const assignmentStatus = assignment?.status || "active";
  const event = assignment?.event || {};
  const startAt = event.startAt ? new Date(event.startAt) : null;
  const endAt = event.endAt ? new Date(event.endAt) : startAt;

  if (assignmentStatus === "removed") return "removed";
  if (!endAt || Number.isNaN(endAt.getTime())) return "unknown";
  if (CLOSED_EVENT_STATUSES.has(event.status) || endAt < now) return "past";
  return "upcoming";
};
