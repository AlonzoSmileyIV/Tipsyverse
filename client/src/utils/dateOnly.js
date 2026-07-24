export const parseDateOnlyParts = (value) => {
  if (!value) return null;

  const toValidParts = (year, month, day) => {
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() + 1 !== month ||
      date.getDate() !== day
    ) {
      return null;
    }

    return { year, month, day };
  };

  if (typeof value === "string") {
    const dateOnly = value.trim().split("T")[0];
    let match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return toValidParts(Number(match[1]), Number(match[2]), Number(match[3]));
    }

    match = dateOnly.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      return toValidParts(Number(match[3]), Number(match[1]), Number(match[2]));
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return toValidParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
};

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
