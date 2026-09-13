export const SESSION_ACTIVITY_KEY = "sessionLastActivityAt";
export const SESSION_WARNING_DURATION_MS = 5 * 60 * 1000;
export const ABSOLUTE_SESSION_LIMIT_MS = 8 * 60 * 60 * 1000;
export const ACTIVITY_WRITE_THROTTLE_MS = 15 * 1000;
export const SESSION_ACTIVITY_EVENTS = [
  "mousemove",
  "keydown",
  "scroll",
  "click",
  "touchstart",
];

const STAFF_ROLES = new Set(["employee", "admin"]);

export const getInactivityLimitMs = (role) =>
  STAFF_ROLES.has(role) ? 30 * 60 * 1000 : 60 * 60 * 1000;

export function getSessionState({
  now,
  sessionStartedAt,
  lastActivityAt,
  role,
}) {
  if (now - sessionStartedAt >= ABSOLUTE_SESSION_LIMIT_MS) {
    return { status: "expired", remainingMs: 0 };
  }

  const remainingMs = getInactivityLimitMs(role) - (now - lastActivityAt);
  if (remainingMs <= 0) return { status: "inactive", remainingMs: 0 };
  if (remainingMs <= SESSION_WARNING_DURATION_MS) {
    return { status: "warning", remainingMs };
  }
  return { status: "active", remainingMs };
}
