const STAFF_ROLES = new Set(["admin", "employee"]);
const STAFF_STATUSES = new Set([
  "interested",
  "not_interested",
  "rejected",
  "selected",
  "denied",
  "waitlist",
  "dropped",
]);
const BARTENDER_STATUSES = new Set(["interested", "not_interested"]);

export const canToggleBidInterest = ({ user, event }) =>
  user?.role === "bartender" &&
  ["ready_to_assign", "bidding", "selecting"].includes(event?.status);

export const canUpdateBid = ({ user, bartenderUserId, status, event }) => {
  const isStaff = STAFF_ROLES.has(user?.role);
  const ownsBid =
    user?.role === "bartender" &&
    String(user?.id || user?._id || "") === String(bartenderUserId || "");
  const allowedStatus = (isStaff ? STAFF_STATUSES : BARTENDER_STATUSES).has(status);
  const eventAcceptsInterest =
    status !== "interested" || canToggleBidInterest({ user, event });
  return {
    allowed:
      (isStaff || ownsBid) && allowedStatus && (isStaff || eventAcceptsInterest),
    isStaff,
    ownsBid,
    allowedStatus: allowedStatus && (isStaff || eventAcceptsInterest),
  };
};
