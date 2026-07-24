export const normalizeContact = (c) => {
  if (!c) return c;
  const fullName = c.fullName ?? c.name; // accept either
  return {
    fullName,
    email: c.email,
    phone: c.phone,
    preferred: c.preferred ?? "call",
    role: c.role ?? "organizer",
  };
};