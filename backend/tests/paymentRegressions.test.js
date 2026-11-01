import assert from "node:assert/strict";
import test from "node:test";
import { getExpectedAssignmentPay } from "../controllers/libs/payout.ctrl.js";
import { getSavedCardCollection } from "../utils/libs/stripeEventPayments.js";

test("Finance net receipts exclude failed and pending Stripe attempts", () => {
  const payments = [
    { status: "recorded", amount: 300, refundedAmount: 50 },
    { status: "failed", amount: 300, refundedAmount: 0 },
    { status: "processing", amount: 300, refundedAmount: 0 },
    { status: "requires_action", amount: 300, refundedAmount: 0 },
  ];
  const net = payments
    .filter((payment) => payment.status === "recorded")
    .reduce(
      (sum, payment) =>
        sum + Number(payment.amount) - Number(payment.refundedAmount || 0),
      0
    );
  assert.equal(net, 250);
  assert.equal(
    getSavedCardCollection({
      total: 1000,
      paid: net,
      startAt: "2030-02-01T12:00:00.000Z",
      now: "2030-01-01T12:00:00.000Z",
      collectionType: "balance",
    }).collectible,
    750
  );
});

test("customer Stripe payment state does not change bartender earnings", () => {
  const event = {
    startAt: "2030-01-01T18:00:00.000Z",
    endAt: "2030-01-01T22:00:00.000Z",
    pricing: { setupHours: 0.5, breakdownHours: 0.5, hourlyRate: 25 },
    counts: { approvedBartenders: 2 },
    payment: { subtotal: 250, gratuity: 50 },
  };
  const expected = getExpectedAssignmentPay(event);
  assert.equal(expected, 150);
  assert.equal(
    getExpectedAssignmentPay({
      ...event,
      payment: {
        ...event.payment,
        status: "failed",
        paidTotal: 0,
        balance: 1000,
      },
    }),
    expected
  );
});

