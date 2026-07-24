export const pmLabel = (pm) => {
  const brand = (pm.brand || "").toUpperCase();
  const mask  = pm.last4 ? `•••• ${pm.last4}` : "••••";
  const nick  = pm.nickname ? ` (${pm.nickname})` : "";
  return `${brand} ${mask}${nick}`.trim();
};