// utils/holiday.js

// Basic flat fee for all holidays (you can tweak per-holiday later)
const DEFAULT_HOLIDAY_FEE = 150;

export const HOLIDAY_DATES = [
  { month: 1, day: 1, name: "New Year's Day" },
  { month: 7, day: 4, name: "Independence Day" },
  { month: 6, day: 19, name: "Juneteenth" },
  { month: 12, day: 24, name: "Christmas Eve" },
  { month: 12, day: 25, name: "Christmas Day" },
  { month: 12, day: 31, name: "New Year's Eve" },
];


// nth weekday of month helper (e.g., 4th Thursday in November)
function nthWeekdayOfMonth(year, monthIndex, weekday, nth) {
  const first = new Date(year, monthIndex, 1);
  const firstDow = first.getDay(); // 0 = Sun
  const offset = (weekday - firstDow + 7) % 7;
  const day = 1 + offset + 7 * (nth - 1);
  return new Date(year, monthIndex, day);
}

// last weekday of month helper (e.g., last Monday in May)
function lastWeekdayOfMonth(year, monthIndex, weekday) {
  const last = new Date(year, monthIndex + 1, 0); // last day of month
  const lastDow = last.getDay();
  const offset = (lastDow - weekday + 7) % 7;
  const day = last.getDate() - offset;
  return new Date(year, monthIndex, day);
}

export function getUsHolidayList(year) {
  // Fixed-date holidays
  const newYearsDay   = new Date(year, 0, 1);   // Jan 1
  const juneteenth    = new Date(year, 5, 19);  // Jun 19
  const july4th       = new Date(year, 6, 4);   // Jul 4
  const christmasEve  = new Date(year, 11, 24); // Dec 24
  const christmasDay  = new Date(year, 11, 25); // Dec 25
  const newYearsEve   = new Date(year, 11, 31); // Dec 31

  // Floating holidays
  const memorialDay = lastWeekdayOfMonth(year, 4, 1);      // May, Monday (1)
  const laborDay    = nthWeekdayOfMonth(year, 8, 1, 1);    // Sept, 1st Monday
  const thanksgiving = nthWeekdayOfMonth(year, 10, 4, 4);  // Nov, 4th Thursday
  const blackFriday  = new Date(
    thanksgiving.getFullYear(),
    thanksgiving.getMonth(),
    thanksgiving.getDate() + 1
  );

  // All holidays you care about
  return [
    { code: "new_years_day",     name: "New Year's Day",      date: newYearsDay,  fee: DEFAULT_HOLIDAY_FEE },
    { code: "memorial_day",      name: "Memorial Day",        date: memorialDay,  fee: DEFAULT_HOLIDAY_FEE },
    { code: "juneteenth",        name: "Juneteenth",          date: juneteenth,   fee: DEFAULT_HOLIDAY_FEE },
    { code: "independence_day",  name: "4th of July",         date: july4th,      fee: DEFAULT_HOLIDAY_FEE },
    { code: "labor_day",         name: "Labor Day",           date: laborDay,     fee: DEFAULT_HOLIDAY_FEE },
    { code: "thanksgiving",      name: "Thanksgiving",        date: thanksgiving, fee: DEFAULT_HOLIDAY_FEE },
    { code: "black_friday",      name: "Day After Thanksgiving", date: blackFriday, fee: DEFAULT_HOLIDAY_FEE },
    { code: "christmas_eve",     name: "Christmas Eve",       date: christmasEve, fee: DEFAULT_HOLIDAY_FEE },
    { code: "christmas_day",     name: "Christmas Day",       date: christmasDay, fee: DEFAULT_HOLIDAY_FEE },
    { code: "new_years_eve",     name: "New Year's Eve",      date: newYearsEve,  fee: DEFAULT_HOLIDAY_FEE },
  ];
}


// utils/holiday.js (continuing)

function toStartOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isHoliday(startAt, endAt) {
  if (!startAt) return {
    isHoliday: false,
    holidays: [],
    primaryHoliday: null,
    maxFee: 0,
  };

  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : new Date(startAt);

  if (isNaN(start) || isNaN(end)) {
    return {
      isHoliday: false,
      holidays: [],
      primaryHoliday: null,
      maxFee: 0,
    };
  }

  // Normalize order
  let rangeStart = start < end ? start : end;
  let rangeEnd   = start < end ? end   : start;

  // Strip times (work ‘by day’)
  rangeStart = toStartOfDay(rangeStart);
  rangeEnd   = toStartOfDay(rangeEnd);

  const startYear = rangeStart.getFullYear();
  const endYear   = rangeEnd.getFullYear();

  const hits = [];

  for (let year = startYear; year <= endYear; year++) {
    const holidays = getUsHolidayList(year);
    for (const h of holidays) {
      const day = toStartOfDay(h.date);
      if (day >= rangeStart && day <= rangeEnd) {
        hits.push({
          code: h.code,
          name: h.name,
          date: day.toISOString().slice(0, 10), // "YYYY-MM-DD"
          fee: h.fee,
        });
      }
    }
  }

  const isHolidayRange = hits.length > 0;
  const maxFee = hits.reduce((m, h) => Math.max(m, h.fee || 0), 0);
  const primaryHoliday = hits[0] || null; // You can change rule if needed

  return {
    isHoliday: isHolidayRange,
    holidays: hits,
    primaryHoliday,
    maxFee,
  };
}


export function isDateAHoliday(date) {
  const d = new Date(date);

  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dow = d.getDay(); // 0 = Sun

  // Fixed holidays
  if (HOLIDAY_DATES.some(h => h.month === month && h.day === day)) return true;

  // Thanksgiving = 4th Thursday in November
  if (month === 11) {
    const first = new Date(d.getFullYear(), 10, 1);
    const firstThursday = 1 + ((4 - first.getDay() + 7) % 7);
    const thanksgiving = firstThursday + 21; // 4th Thursday
    if (day === thanksgiving) return true;
    if (day === thanksgiving + 1) return true; // Black Friday
  }

  // Memorial Day = Last Monday in May
  if (month === 5 && dow === 1) {
    const lastDay = new Date(d.getFullYear(), 5, 0).getDate();
    if (day > lastDay - 7) return true;
  }

  // Labor Day = 1st Monday in September
  if (month === 9 && dow === 1 && day <= 7) return true;

  return false;
}
