import { CouponModel as Coupon } from "../../models/index.js";

export async function lookupCoupon(code) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode) return null;

  return Coupon.findOne({
    code: normalizedCode,
    active: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: new Date() } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gt: new Date() } }] },
    ],
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }).lean();
}

// returns { discountedTotal, applied: { code, type, value, amountOffTotal } }
export function applyCouponToTotal(total, coupon) {
  if (!coupon) return { discountedTotal: total, applied: null };
  if (total < Number(coupon.minimumSubtotal || 0)) {
    return { discountedTotal: total, applied: null };
  }

  let discountedTotal = total;
  let amountOffTotal = 0;

  switch (coupon.type) {
    case "PERCENT_TOTAL": {
      amountOffTotal = Math.max(0, Math.round(total * coupon.value * 100) / 100);
      discountedTotal = Math.max(0, Math.round((total - amountOffTotal) * 100) / 100);
      break;
    }
    case "AMOUNT_TOTAL": {
      amountOffTotal = Math.min(total, Math.max(0, Number(coupon.value || 0)));
      discountedTotal = Math.max(0, Math.round((total - amountOffTotal) * 100) / 100);
      break;
    }
    case "FIXED_DEPOSIT": {
      // handled in deposit phase (no change to total)
      break;
    }
    default:
      break;
  }
  return {
    discountedTotal,
    applied: amountOffTotal > 0
      ? { code: coupon.code, type: coupon.type, value: coupon.value, amountOffTotal }
      : null
  };
}

// Calculate deposit after total discount. If FIXED_DEPOSIT coupon, override deposit
export function calcDepositWithCoupon({ totalAfterDiscount, baseDepositPct, baseDepositAmount, coupon }) {
  // base deposit (your existing logic)
  let deposit = baseDepositAmount > 0
    ? Number(baseDepositAmount)
    : Math.round(totalAfterDiscount * (baseDepositPct || 0) * 100) / 100;

  if (coupon?.type === "FIXED_DEPOSIT") {
    deposit = Math.max(0, Number(coupon.value || 0));
  }

  // Clamp: deposit can't exceed total, never negative
  deposit = Math.min(deposit, totalAfterDiscount);
  deposit = Math.max(0, Math.round(deposit * 100) / 100);
  return deposit;
}
