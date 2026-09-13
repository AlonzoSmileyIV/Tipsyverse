export const normalizeContact = (c) => {
  if (!c) return c;
  const fullName = c.fullName ?? c.name; // accept either
  return {
    fullName: String(fullName || "").trim(),
    email: String(c.email || "").trim(),
    phone: String(c.phone || "").trim(),
    preferred: c.preferred ?? "call",
    role: String(c.role ?? "organizer").trim(),
  };
};
