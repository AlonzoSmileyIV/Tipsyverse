// utils/isTodayBirthday.js
export const isTodayBirthday = (iso) => {
  if (!iso) return false;
  const [, mm, dd] = iso.split('T')[0].split('-'); // YYYY-MM-DD
  const today = new Date();
  const m = today.getMonth() + 1; // 1..12
  const d = today.getDate();      // 1..31
  return Number(mm) === m && Number(dd) === d;
};
