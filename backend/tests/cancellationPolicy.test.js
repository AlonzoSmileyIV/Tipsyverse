import assert from "node:assert/strict";
import test from "node:test";
import {
  CUSTOMER_CANCELLATION_REASONS,
  STAFF_CANCELLATION_REASONS,
  deriveCancellationPolicy,
} from "../utils/libs/cancellationPolicy.js";

test("cancellation policy records timing without automatically refunding", () => {
  const result = deriveCancellationPolicy({
    event: { status: "confirmed", startAt: "2026-09-15T18:00:00.000Z" },
    paid: 125.678,
    now: "2026-09-14T18:00:00.000Z",
  });

  assert.equal(result.cancelable, true);
  assert.equal(result.timingTier, "inside_48_hours");
  assert.equal(result.paidAtCancellation, 125.68);
  assert.equal(result.refundEligibleAmount, 125.68);
  assert.equal(result.refundReviewStatus, "pending");
  assert.equal(result.automaticRefund, false);
});

test("cancellation policy requires no refund review when nothing was paid", () => {
  const result = deriveCancellationPolicy({
    event: { status: "submitted", startAt: "2026-10-01T18:00:00.000Z" },
    paid: 0,
    now: "2026-09-01T18:00:00.000Z",
  });

  assert.equal(result.timingTier, "before_48_hours");
  assert.equal(result.refundEligibleAmount, 0);
  assert.equal(result.refundReviewStatus, "not_required");
});

test("staff cancellation reasons are a strict superset of customer reasons", () => {
  for (const reason of CUSTOMER_CANCELLATION_REASONS) {
    assert.equal(STAFF_CANCELLATION_REASONS.includes(reason), true);
  }
  assert.equal(CUSTOMER_CANCELLATION_REASONS.includes("nonpayment"), false);
  assert.equal(STAFF_CANCELLATION_REASONS.includes("nonpayment"), true);
});
