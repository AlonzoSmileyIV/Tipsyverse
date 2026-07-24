const getAt = (obj, path) => path.split('.').reduce((o,k) => (o == null ? o : o[k]), obj);
export const diffFields = (before, after, fields) => {
  const changes = [];
  for (const path of fields) {
    const from = getAt(before, path);
    const to   = getAt(after, path);
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes.push({ path, from, to });
    }
  }
  return changes;
};