import test from "node:test";
import assert from "node:assert/strict";
import buildEventUpdatedEmail from "../utils/libs/buildEventUpdatedEmail.js";

const event = {
  _id: "event-1",
  shortCode: "EVT-1",
  startAt: "2026-09-10T22:00:00.000Z",
  endAt: "2026-09-11T02:00:00.000Z",
  timezone: "America/Indiana/Indianapolis",
  contact: { fullName: "Customer" },
  payment: { total: 0, balance: 0 },
};

test("update email uses computed pricing when the payment snapshot is only default zeros", () => {
  const result = buildEventUpdatedEmail({
    evt: event,
    beforeDoc: event,
    afterDoc: event,
    beforeTotals: { total: 200 },
    afterTotals: { total: 300 },
    changes: [],
  });

  assert.match(result.text, /Old balance: \$200\.00/);
  assert.match(result.text, /Current balance: \$300\.00/);
  assert.match(result.text, /Difference: \$100\.00/);
});

test("update email preserves a paid-in-full zero from a real billing snapshot", () => {
  const billedEvent = { ...event, payment: { total: 200, balance: 0 } };
  const result = buildEventUpdatedEmail({
    evt: billedEvent,
    beforeDoc: billedEvent,
    afterDoc: billedEvent,
    beforeTotals: { total: 200 },
    afterTotals: { total: 300 },
    changes: [],
  });

  assert.match(result.text, /Old balance: \$0\.00/);
  assert.match(result.text, /Current balance: \$0\.00/);
});
