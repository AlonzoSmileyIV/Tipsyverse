// utils/pricing.js
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function hoursBetween(startAt, endAt) {
  if (!startAt || !endAt) return 0;
  const ms = new Date(endAt).getTime() - new Date(startAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return ms / 36e5;
}

// returns dollars (not cents) for simplicity; you can switch to cents later
function computeEventTotals(evt) {
  const p = evt?.pricing || {};
  const o = evt?.options || {};

  const bartenders = Math.max(
    1,
    toNum(p.bartendersRequested || 1),
    toNum(evt?.counts?.neededBartenders || 0)
  );
  const hourlyRate = toNum(p.hourlyRate);
  const bookingFee = toNum(p.bookingFee);
  const setupHours = toNum(p.setupHours);
  const breakdownHours = toNum(p.breakdownHours);

  // IMPORTANT: schema uses procurementServiceFee, UI might send procurementFee
  const procurementFee = toNum(p.procurementServiceFee ?? p.procurementFee ?? 0);
  const publicFee = toNum(p.publicFee ?? 0);

  // your schema currently treats holidayFee like a Number (not necessarily %).
  // If it's meant as FLAT dollars, keep it here:
  const holidayFee = toNum(p.holidayFee ?? 0);

  const baseHours = hoursBetween(evt.startAt, evt.endAt);
  const totalHours = Math.max(0, baseHours + setupHours + breakdownHours);

  const hourlyLabor = hourlyRate * bartenders * totalHours;

  const flatSubtotal =
    hourlyLabor + bookingFee + procurementFee + publicFee + holidayFee;

  const gratuity = flatSubtotal * toNum(p.gratuityPct); // p.gratuityPct is decimal like 0.18
  const rush = flatSubtotal * toNum(p.rushPct);         // decimal like 0.35
  const tax = flatSubtotal * toNum(p.taxPct);           // decimal like 0.07

  const total = flatSubtotal + gratuity + rush + tax;

  return {
    bartenders,
    baseHours,
    totalHours,
    lineItems: {
      hourlyLabor,
      bookingFee,
      procurementFee,
      publicFee,
      holidayFee,
      gratuity,
      rush,
      tax,
    },
    flatSubtotal,
    total,
  };
}

export default computeEventTotals;
