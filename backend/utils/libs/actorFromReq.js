// Build standard actor block from req.user
export const actorFromReq = (req) => ({
  type: "User",
  id: req.user?._id || req.user?.id,
  label: {
    fullName: req.user?.fullName,
    email: req.user?.email,
    role: req.user?.role,
  },
});