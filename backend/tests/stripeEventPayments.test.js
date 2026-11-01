import assert from "node:assert/strict";
import test from "node:test";
import {
  getRequiredInitialPayment,
  getSavedCardCollection,
  savedCardIdempotencyKey,
  settledPaymentStatuses,
} from "../utils/libs/stripeEventPayments.js";

const now = new Date("2026-01-01T12:00:00.000Z");

test("standard events collect the existing 30 percent initial payment", () => {
  assert.equal(
    getRequiredInitialPayment({
      total: 1000,
      startAt: "2026-02-01T12:00:00.000Z",
      now,
    }),
    300
  );
});

test("events within seven days require full payment", () => {
  assert.equal(
    getRequiredInitialPayment({
      total: 1000,
      startAt: "2026-01-08T12:00:00.000Z",
      now,
    }),
    1000
  );
});

test("initial collection subtracts settled payments and never overpays", () => {
  assert.deepEqual(
    getSavedCardCollection({
      total: 1000,
      paid: 125,
      startAt: "2026-02-01T12:00:00.000Z",
      now,
    }),
    {
      total: 1000,
      paid: 125,
      balance: 875,
      requiredInitial: 300,
      collectible: 175,
    }
  );
  assert.equal(
    getSavedCardCollection({
      total: 1000,
      paid: 350,
      startAt: "2026-02-01T12:00:00.000Z",
      now,
    }).collectible,
    0
  );
});

test("balance collection uses only the outstanding ledger balance", () => {
  const snapshot = getSavedCardCollection({
    total: 1000,
    paid: 300,
    startAt: "2026-02-01T12:00:00.000Z",
    now,
    collectionType: "balance",
  });
  assert.equal(snapshot.collectible, 700);
  assert.equal(
    getSavedCardCollection({
      total: 1000,
      paid: 1200,
      startAt: "2026-02-01T12:00:00.000Z",
      now,
      collectionType: "balance",
    }).collectible,
    0
  );
});

test("only recorded payments are settled for Finance and assignment", () => {
  assert.equal(settledPaymentStatuses.has("recorded"), true);
  for (const status of ["processing", "requires_action", "failed", "voided", "refunded"]) {
    assert.equal(settledPaymentStatuses.has(status), false);
  }
});

test("concurrent collection modes share one ledger-revision idempotency key", () => {
  const initial = savedCardIdempotencyKey("event-1", 4);
  const balance = savedCardIdempotencyKey("event-1", 4);
  assert.equal(initial, balance);
  assert.notEqual(initial, savedCardIdempotencyKey("event-1", 5));
});

