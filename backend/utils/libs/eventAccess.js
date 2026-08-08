const EMPLOYEE_ROLES = new Set([
  "owner",
  "ceo",
  "executive",
  "manager",
  "supervisor",
  "it",
  "helpdesk",
  "admin",
  "employee",
]);

const ASSIGNABLE_STATUSES = new Set(["ready_to_assign", "bidding", "selecting"]);
const normalize = (value) => String(value || "").trim().toLowerCase();

export const eventAccessLevel = ({ event, user, isAssigned = false }) => {
  const role = normalize(user?.role);
  if (EMPLOYEE_ROLES.has(role)) return "full";

  const userId = String(user?.id || user?._id || "");
  const organizerId = String(event?.organizer?._id || event?.organizer || "");
  const contactUserId = String(event?.contact?.userId?._id || event?.contact?.userId || "");
  const ownsEvent =
    Boolean(userId) &&
    (organizerId === userId ||
      contactUserId === userId ||
      (normalize(user?.email) && normalize(event?.contact?.email) === normalize(user.email)));

  if (ownsEvent) return "full";
  if (role !== "bartender") return "none";
  if (isAssigned) return "full";
  if (ASSIGNABLE_STATUSES.has(event?.status)) return "masked";
  return "none";
};
