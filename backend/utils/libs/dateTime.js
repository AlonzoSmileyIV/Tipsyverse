const DATE_ONLY_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_ONLY_US = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export const parseDateOnlyParts = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    const dateOnly = value.split("T")[0];
    let match = dateOnly.match(DATE_ONLY_ISO);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      };
    }

    match = dateOnly.match(DATE_ONLY_US);
    if (match) {
      return {
        year: Number(match[3]),
        month: Number(match[1]),
        day: Number(match[2]),
      };
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
};

export const isValidDateOnly = (value) => !!parseDateOnlyParts(value);

export const calculateAgeFromDateOnly = (birthday, todayValue = new Date()) => {
  const today = parseDateOnlyParts(todayValue);
  const birthDate = parseDateOnlyParts(birthday);
  if (!today || !birthDate) return 0;

  let age = today.year - birthDate.year;
  const monthDifference = today.month - birthDate.month;
  const dayDifference = today.day - birthDate.day;

  if (monthDifference < 0 || (monthDifference === 0 && dayDifference < 0)) {
    age--;
  }

  return age;
};

export const isAtLeastAge = (birthday, age, todayValue = new Date()) =>
  calculateAgeFromDateOnly(birthday, todayValue) >= age;

export const formatDateTime = (
  value,
  {
    locale = "en-US",
    timeZone,
    dateStyle = "medium",
    timeStyle = "short",
    fallback = "Not specified",
  } = {}
) => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat(locale, {
    dateStyle,
    timeStyle,
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
};

export const formatDateTimeWithZones = (
  value,
  { localTimeZone, globalTimeZone = "UTC", locale = "en-US" } = {}
) => {
  const local = formatDateTime(value, { locale, timeZone: localTimeZone });
  const global = formatDateTime(value, { locale, timeZone: globalTimeZone });
  return {
    local,
    global,
    label:
      local === global
        ? local
        : `${local}${localTimeZone ? ` (${localTimeZone})` : ""} / ${global} (${globalTimeZone})`,
  };
};

