export const makeIdToEmailMap = (users) => {
  const m = new Map();
  for (const u of users) m.set(u._id.toString(), u.email);
  return m;
};