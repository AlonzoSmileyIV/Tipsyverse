const toLocalDateOnly = (val) => {
  if (!val) return null;

  // Date instance or ms timestamp or ISO string → normalize to local date
  if (
    val instanceof Date ||
    typeof val === "number" ||
    /\dT\d/.test(String(val))
  ) {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  if (typeof val === "string") {
    // YYYY-MM-DD
    let m = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

    // MM/DD/YYYY
    m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  }

  return null; // unknown format
}

export default  toLocalDateOnly;