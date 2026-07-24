// utils/money.js
// libs/money.js
export function calcTotals({
  hourlyRate = 0,
  durationHours = 0,
  setupHours = 0.5,
  breakdownHours = 0.5,
  bartenders = 1,
  gratuityPctIfNoTips = 0,
  bookingFee = 0,
  travel = 0,
  rushPct = 0,
  holidayFee = 0,

  // NEW
  publicFee = 0,
} = {}) {
  const laborHours = Math.max(0, Number(durationHours) + Number(setupHours) + Number(breakdownHours));
  const labor = hourlyRate * laborHours * bartenders;

  const base = labor + bookingFee + travel + publicFee; // <-- add here
  const rush   = base * rushPct;
  const holiday= holidayFee;

  const subtotal = round2(base + rush + holiday);
  const gratuity = round2(subtotal * gratuityPctIfNoTips);
  const total    = round2(subtotal + gratuity);

  return { subtotal, gratuity, total };
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function calcDeposit({ total, depositPct=0.5, depositAmount=0 }) {
  const base = depositAmount > 0 ? depositAmount : Math.round(total * (depositPct || 0) * 100)/100;
  return Math.max(0, base);
}