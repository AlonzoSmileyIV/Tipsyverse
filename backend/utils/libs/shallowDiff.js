export function shallowDiff(before = {}, after = {}) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out = [];
  for (const k of keys) {
    const from = before[k];
    const to = after[k];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      out.push({ path: k, from, to });
    }
  }
  return out;
}

export const setDiff = (a, b) => {
  const A = new Set(a), B = new Set(b);
  return {
    added: [...B].filter(x => !A.has(x)),
    removed: [...A].filter(x => !B.has(x)),
  };
};