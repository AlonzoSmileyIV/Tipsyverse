export function formatBidStatus(status) {
  if (!status || status === "none") return null;

  const s = status.toLowerCase();

  return {
    label:
      s === "selected"
        ? "Selected"
        : s === "waitlist"
        ? "Waitlisted"
        : s === "interested"
        ? "Interested"
        : s === "not_interested"
        ? "Not Interested"
        : s,
    color:
      s === "selected"
        ? "success"
        : s === "waitlist"
        ? "warning"
        : s === "interested"
        ? "info"
        : s === "not_interested"
        ? "default"
        : "default",
  };
}
