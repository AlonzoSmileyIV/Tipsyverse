/* ----------------------- utils ----------------------- */
export function tzShort(tz, date = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
      year: "numeric",
    });
    const parts = fmt.formatToParts(date);
    const part = parts.find((p) => p.type === "timeZoneName");
    return part?.value?.replace(/^GMT([+]\d{1,2})(?::\d{2})?$/, "GMT$1") || "—";
  } catch {
    return "—";
  }
}

export const fmtMoney = (n) => `$${(Number(n) || 0).toFixed(2)}`;
export const pct = (n) => `${Number(n) || 0}%`;

// --- currency helpers: do math in cents (integers) ---
export const toNumber = (v) => Number(v) || 0;
export const toCents = (v) => Math.round(toNumber(v) * 100); // $ -> ¢
export const fromCents = (c) => c / 100; // ¢ -> $
export const fmtMoneyC = (cents) => {
  const c = Number(cents);
  const safe = Number.isFinite(c) ? c : 0;
  return `$${(safe / 100).toFixed(2)}`;
};
// format cents
export const pctOfCents = (baseCents, pctWhole) =>
  Math.round(baseCents * (toNumber(pctWhole) / 100));

export const formatPhone = (raw = "") => {
  const d = (raw || "").replace(/\D+/g, "").slice(0, 11); // allow leading 1
  const n = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  if (n.length === 10)
    return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  return raw || "";
};

export const pctToDecimal = (v) =>
  v === "" || v == null ? undefined : (Number(v) || 0) / 100;

export const formatLocationPretty = (loc = {}) => {
  if (loc.formattedAddress || loc.formatted)
    return loc.formattedAddress || loc.formatted;
  const line1 = [loc.address1, loc.address2].filter(Boolean).join(" ");
  const line2 = [loc.city, loc.state].filter(Boolean).join(", ");
  const line3 = [loc.zipcode, loc.country].filter(Boolean).join(" ");
  return [line1, line2, line3].filter(Boolean).join(" • ");
};

export const parseLocal = (s) => (s ? new Date(s) : null);

export const tzAbbr = (date, timeZone) => {
  if (!timeZone) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
      hour: "2-digit",
    }).formatToParts(date);
    const name = parts.find((p) => p.type === "timeZoneName")?.value || "";
    if (/^[A-Z]{2,5}$/.test(name)) return name;
    if (/^GMT[+]\d{1,2}/i.test(name)) return name.toUpperCase();
  } catch {}
  return "";
};

export const formatWhen = (startStr, endStr, timeZone = "UTC") => {
  const s = parseLocal(startStr);
  const e = parseLocal(endStr);
  if (!s || !e || isNaN(s) || isNaN(e)) return "—";
  const sameDay = s.toDateString() === e.toDateString();
  const dateFmt = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  const mins = Math.max(0, Math.round((e - s) / 60000));
  const dur =
    mins >= 60
      ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}`
      : `${mins}m`;
  const abbr = tzAbbr(s, timeZone);
  const abbrSuffix = abbr ? ` ${abbr}` : "";
  if (sameDay)
    return `${dateFmt.format(s)} • ${timeFmt.format(s)}–${timeFmt.format(
      e
    )}${abbrSuffix} (${dur})`;
  return `${dateFmt.format(s)} ${timeFmt.format(s)} → ${dateFmt.format(
    e
  )} ${timeFmt.format(e)}${abbrSuffix} (${dur})`;
};
