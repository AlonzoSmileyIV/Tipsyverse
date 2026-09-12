import assert from "node:assert/strict";
import test from "node:test";
import {
  assertActivePaymentRequest,
  assertCollectibleEvent,
} from "../utils/libs/paymentLedger.js";

test("completed and canceled events cannot collect more money", () => {
  for (const status of ["canceled", "completed", "closed"]) {
    assert.throws(
      () => assertCollectibleEvent({ status }),
      (error) => error.statusCode === 409 && error.message.includes(status)
    );
  }
  assert.doesNotThrow(() => assertCollectibleEvent({ status: "confirmed" }));
});

test("only sent, unexpired payment requests are collectible", () => {
  assert.doesNotThrow(() =>
    assertActivePaymentRequest({ status: "sent", expiresAt: "2030-01-01" }, {
      now: new Date("2029-01-01"),
    })
  );
  assert.throws(
    () => assertActivePaymentRequest({ status: "cancelled" }),
    (error) => error.statusCode === 409
  );
  assert.throws(
    () =>
      assertActivePaymentRequest({ status: "sent", expiresAt: "2028-01-01" }, {
        now: new Date("2029-01-01"),
      }),
    /expired/
  );
});
