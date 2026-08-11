import test from "node:test";
import assert from "node:assert/strict";
import {
  canToggleBidInterest,
  canUpdateBid,
} from "../utils/libs/bidAccess.js";
import {
  getEventPaymentTotal,
  getRequiredBartenderCount,
} from "../utils/libs/eventSummary.js";

test("the billed event total remains authoritative after pricing recalculation", () => {
  const event = {
    payment: { total: 300 },
    pricing: { estimatedTotal: 500 },
  };
  assert.equal(getEventPaymentTotal(event, 600), 300);
  assert.equal(getEventPaymentTotal({ pricing: { estimatedTotal: 500 } }, 600), 600);
});

test("staffing uses the larger synchronized requirement for legacy mismatches", () => {
  assert.equal(
    getRequiredBartenderCount({
      counts: { neededBartenders: 2 },
      pricing: { bartendersRequested: 1 },
    }),
    2
  );
  assert.equal(
    getRequiredBartenderCount({
      counts: { neededBartenders: 1 },
      pricing: { bartendersRequested: 3 },
    }),
    3
  );
});

test("only bartenders can toggle interest on assignable events", () => {
  const event = { status: "ready_to_assign" };
  assert.equal(canToggleBidInterest({ user: { role: "bartender" }, event }), true);
  assert.equal(canToggleBidInterest({ user: { role: "regular" }, event }), false);
  assert.equal(
    canToggleBidInterest({ user: { role: "bartender" }, event: { status: "confirmed" } }),
    false
  );
});

test("bartenders can update only their own interest while staff can manage statuses", () => {
  assert.equal(
    canUpdateBid({
      user: { id: "bartender-a", role: "bartender" },
      bartenderUserId: "bartender-a",
      status: "not_interested",
      event: { status: "confirmed" },
    }).allowed,
    true
  );
  assert.equal(
    canUpdateBid({
      user: { id: "bartender-b", role: "bartender" },
      bartenderUserId: "bartender-a",
      status: "not_interested",
      event: { status: "ready_to_assign" },
    }).allowed,
    false
  );
  assert.equal(
    canUpdateBid({
      user: { id: "bartender-a", role: "bartender" },
      bartenderUserId: "bartender-a",
      status: "selected",
      event: { status: "ready_to_assign" },
    }).allowed,
    false
  );
  assert.equal(
    canUpdateBid({
      user: { id: "staff", role: "employee" },
      bartenderUserId: "bartender-a",
      status: "selected",
      event: { status: "confirmed" },
    }).allowed,
    true
  );
  assert.equal(
    canUpdateBid({
      user: { id: "bartender-a", role: "bartender" },
      bartenderUserId: "bartender-a",
      status: "interested",
      event: { status: "confirmed" },
    }).allowed,
    false
  );
});
