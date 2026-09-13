import { fmtMoney, pctOfCents, toCents } from "./DetailedEventForm.formatters";

/* ----------------------- pricing helpers ----------------------- */
export const recommendBartenders = (guests) => {
  const g = Number(guests) || 0;
  if (g <= 0) return 1;
  if (g <= 50) return 1;
  if (g <= 100) return 2;
  if (g <= 150) return 3;
  return Math.ceil(g / 60);
};

// --- Rush helpers ---
export const hoursUntil = (start, now = new Date()) =>
  Math.max(0, (new Date(start) - now) / 36e5);
export const autoRushTier = (hrs) => {
  if (hrs <= 48) return { pct: 0.35, label: "≤48h (rush)" };
  if (hrs <= 120) return { pct: 0.2, label: "3–5 days (short notice)" };
  if (hrs <= 168) return { pct: 0.1, label: "6–7 days (late booking)" };
  return { pct: 0, label: "No rush" };
};
export const clientGhostedThenLate = (event) => {
  const attempts = event?.contactAttempts || [];
  if (attempts.length < 2) return false;
  const first = new Date(attempts[0]?.createdAt || attempts[0]?.at || 0);
  const last = new Date(
    attempts[attempts.length - 1]?.createdAt ||
      attempts[attempts.length - 1]?.at ||
      0
  );
  const daysBetween = (last - first) / (24 * 36e5);
  return daysBetween >= 7;
};
export const computeAutoRush = (event, startAt, now = new Date()) => {
  const hrs = hoursUntil(startAt, now);
  let tier = autoRushTier(hrs);
  if (hrs <= 48 && clientGhostedThenLate(event))
    tier = { pct: 0.35, label: "≤48h (rush)" };
  const reasons = {
    "≤48h (rush)": "Confirmed within 48h of event",
    "3–5 days (short notice)": "Confirmed within 3–5 days",
    "6–7 days (late booking)": "Confirmed within 6–7 days",
    "No rush": "Confirmed ≥7 days in advance",
  };
  return { ...tier, reason: reasons[tier.label] || "Auto-calculated" };
};

export function hoursBetween(startAt, endAt) {
  if (!startAt || !endAt) return 0;
  const ms = new Date(endAt).getTime() - new Date(startAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return ms / (1000 * 60 * 60);
}

/**
 * Returns a "pricing snapshot" that you can diff.
 * You can tweak rules here (tip jars → gratuity default, procurement auto fee, holiday rules, etc.)
 */
export function buildPricingSnapshot({
  form,
  calcInput,
  rushPctWholeEffective, // the one you already compute (auto/manual)
  event,
}) {
  const bartenders = Number(form?.bartendersRequested) || 1;

  const baseHours = hoursBetween(form?.startAt, form?.endAt);
  const setupHours = Number(calcInput?.setupHours) || 0;
  const breakdownHours = Number(calcInput?.breakdownHours) || 0;
  const totalHours = Math.max(0, baseHours + setupHours + breakdownHours);

  const hourlyRate = Number(calcInput?.hourlyRate) || 0;
  const bookingFee = Number(calcInput?.bookingFee) || 0;

  // Procurement rule example (keep yours): if procurementRequested and fee is 0, maybe auto-apply 50
  const procurementRequested = !!form?.procurementRequested;
  const procurementFee =
    Number(calcInput?.procurementFee) || (procurementRequested ? 50 : 0);
  const procurementActualCost = Number(form?.procurementActualCost) || 0;

  // Tip jar → you mentioned gratuity rate changes; example:
  const allowTipJars = !!form?.allowTipJars;
  const gratuityPctWhole = allowTipJars
    ? Math.max(Number(calcInput?.gratuityPct) || 0, 18) // enforce minimum 18 if tip jars allowed
    : Number(calcInput?.gratuityPct) || 0;

  const rushPctWhole = Number(rushPctWholeEffective) || 0;
  const holidayFee = Number(calcInput?.holidayFee) || 0; // if your holiday is a flat fee, keep it; if % then treat it like % below
  const publicFee = Number(calcInput?.publicFee) || 0;
  const taxPctWhole = Number(calcInput?.taxPct) || 0;

  // ---- line items (in cents) ----
  const hourlyCostC = Math.round(toCents(hourlyRate) * bartenders * totalHours);

  const flatSubtotalC =
    hourlyCostC +
    toCents(bookingFee) +
    toCents(procurementFee) +
    toCents(holidayFee) +
    toCents(publicFee);

  const gratuityC = pctOfCents(flatSubtotalC, gratuityPctWhole); // expects whole
  const rushC = pctOfCents(flatSubtotalC, rushPctWhole);
  const taxC = pctOfCents(flatSubtotalC, taxPctWhole);

  const procurementActualC = toCents(procurementActualCost);
  const totalC = flatSubtotalC + gratuityC + rushC + taxC + procurementActualC;

  const lines = [
    {
      key: "hourly",
      label: "Hourly labor",
      details: `${bartenders} bartender(s) × ${totalHours.toFixed(
        2
      )} hrs × ${fmtMoney(hourlyRate)}`,
      amountC: hourlyCostC,
    },
    {
      key: "bookingFee",
      label: "Booking fee",
      details: "Flat fee",
      amountC: toCents(bookingFee),
    },
    {
      key: "procurementFee",
      label: "Procurement fee",
      details: procurementRequested
        ? "Procurement requested"
        : "No procurement",
      amountC: toCents(procurementFee),
    },
    {
      key: "procurementActualCost",
      label: "Pickup receipt total",
      details:
        procurementActualCost > 0
          ? "Receipt-backed customer reimbursement"
          : "No receipt total recorded",
      amountC: procurementActualC,
    },
    {
      key: "holidayFee",
      label: "Holiday fee",
      details: "Holiday rule",
      amountC: toCents(holidayFee),
    },
    {
      key: "publicFee",
      label: "Public fee",
      details: "Public event fee",
      amountC: toCents(publicFee),
    },
    {
      key: "gratuity",
      label: `Gratuity (${gratuityPctWhole}%)`,
      details: `${gratuityPctWhole}% of flat subtotal`,
      amountC: gratuityC,
    },
    {
      key: "rush",
      label: `Rush (${rushPctWhole}%)`,
      details: `${rushPctWhole}% of flat subtotal`,
      amountC: rushC,
    },
    {
      key: "tax",
      label: `Tax (${taxPctWhole}%)`,
      details: `${taxPctWhole}% of flat subtotal`,
      amountC: taxC,
    },
  ];

  return {
    meta: {
      bartenders,
      baseHours,
      setupHours,
      breakdownHours,
      totalHours,
      hourlyRate,
      gratuityPctWhole,
      rushPctWhole,
      taxPctWhole,
      procurementRequested,
      procurementActualCost,
    },
    lines,
    totals: {
      flatSubtotalC,
      totalC,
    },
  };
}

/** Build a snapshot from the currently saved event pricing (so "old" matches reality). */
export function buildSnapshotFromEvent(event) {
  const p = event?.pricing || {};
  const confirmedBartenderCount = Number(event?.counts?.neededBartenders) || 0;

  const formLike = {
    bartendersRequested:
      confirmedBartenderCount > 0
        ? confirmedBartenderCount
        : p.bartendersRequested,
    startAt: event?.startAt,
    endAt: event?.endAt,
    procurementRequested: !!event?.options?.procurementRequested,
    procurementActualCost: event?.options?.procurementActualCost ?? 0,
    allowTipJars: !!event?.options?.tipJarsAllowed,
  };

  const calcLike = {
    hourlyRate: p.hourlyRate ?? 0,
    bookingFee: p.bookingFee ?? 0,

    // ✅ FIX: schema uses procurementServiceFee
    procurementFee: p.procurementServiceFee ?? 0,

    // ✅ dollars (make schema match this)
    holidayFee: p.holidayFee ?? 0,
    publicFee: p.publicFee ?? 0,

    setupHours: p.setupHours ?? 0,
    breakdownHours: p.breakdownHours ?? 0,

    // DB decimals -> snapshot wants whole %
    gratuityPct: (Number(p.gratuityPct) || 0) * 100,
    taxPct: (Number(p.taxPct) || 0) * 100,
  };

  const rushPctWholeEffective = (Number(p.rushPct) || 0) * 100;

  return buildPricingSnapshot({
    form: formLike,
    calcInput: calcLike,
    rushPctWholeEffective,
    event,
  });
}

export function diffSnapshots(oldSnap, newSnap) {
  const oldMap = Object.fromEntries(
    (oldSnap?.lines || []).map((l) => [l.key, l])
  );
  const newMap = Object.fromEntries(
    (newSnap?.lines || []).map((l) => [l.key, l])
  );

  const keys = Array.from(
    new Set([...Object.keys(oldMap), ...Object.keys(newMap)])
  );

  const changes = keys
    .map((k) => {
      const o = oldMap[k];
      const n = newMap[k];
      const oldC = o?.amountC ?? 0; // cents
      const newC = n?.amountC ?? 0; // cents
      const deltaC = newC - oldC;

      return {
        key: k,
        label: n?.label || o?.label || k,
        details: n?.details || o?.details || "",
        oldC,
        newC,
        deltaC,
        changed: oldC !== newC,
      };
    })
    .filter((row) => row.changed);

  const oldTotalC = oldSnap?.totals?.totalC ?? 0;
  const newTotalC = newSnap?.totals?.totalC ?? 0;

  return {
    changes,
    oldTotalC,
    newTotalC,
    deltaTotalC: newTotalC - oldTotalC,
    hasChanges: changes.length > 0,
  };
}
