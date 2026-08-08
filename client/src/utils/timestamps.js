export const isValidTimeZone = (value) => {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

export const getBrowserTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export const getEventTimeZone = (event) => {
  const zone = event?.timezone || event?.location?.timezone;
  return isValidTimeZone(zone) ? zone : "America/Indiana/Indianapolis";
};

export const formatTimestamp = (
  value,
  { timeZone = "UTC", includeDate = true, includeTime = true, fallback = "—" } = {}
) => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const safeZone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  const options = {
    timeZone: safeZone,
    timeZoneName: "short",
    ...(includeDate ? { year: "numeric", month: "short", day: "numeric" } : {}),
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  };
  return new Intl.DateTimeFormat("en-US", options).format(date);
};

export const formatEventTimestamp = (event, value, options) =>
  formatTimestamp(value, { ...options, timeZone: getEventTimeZone(event) });

const zonedParts = (value, timeZone) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: isValidTimeZone(timeZone) ? timeZone : "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

export const getDatePartInTimeZone = (value, timeZone) => {
  const parts = zonedParts(value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const getTimePartInTimeZone = (value, timeZone) => {
  const parts = zonedParts(value, timeZone);
  return `${parts.hour}:${parts.minute}`;
};

export const zonedLocalDateTimeToIso = (datePart, timePart, timeZone) => {
  const match = `${datePart || ""}T${timePart || ""}`.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );
  if (!match || !isValidTimeZone(timeZone)) return null;
  const targetWallTime = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5])
  );
  let candidate = new Date(targetWallTime);
  for (let index = 0; index < 3; index += 1) {
    const parts = zonedParts(candidate, timeZone);
    const representedWallTime = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute)
    );
    candidate = new Date(candidate.getTime() + targetWallTime - representedWallTime);
  }
  return candidate.toISOString();
};
