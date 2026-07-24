const tzAbbr = (date, timeZone) => {
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

const parseLocal = (s) => (s ? new Date(s) : null);

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