import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEventPaymentSchedule,
  deriveEventPaymentPolicy,
} from "../utils/libs/eventPaymentPolicy.js";

const startAt = new Date("2026-09-30T22:00:00.000Z");

test("sets a standard balance due date seven days before an event", () => {
  const schedule = buildEventPaymentSchedule({
    startAt,
    confirmedAt: "2026-08-01T12:00:00.000Z",
  });
  assert.equal(schedule.dueAt.toISOString(), "2026-09-23T22:00:00.000Z");
  assert.equal(schedule.shortNotice, false);
});

test("short-notice events are due immediately when confirmed", () => {
  const confirmedAt = "2026-09-27T12:00:00.000Z";
  const schedule = buildEventPaymentSchedule({ startAt, confirmedAt });
  assert.equal(schedule.dueAt.toISOString(), confirmedAt);
  assert.equal(schedule.shortNotice, true);
  assert.equal(
    deriveEventPaymentPolicy({
      startAt,
      confirmedAt,
      total: 500,
      paid: 0,
      now: confirmedAt,
    }).status,
    "due_now"
  );
});

test("unpaid balances progress from due soon through staff action required", () => {
  const base = { startAt, total: 500, paid: 150, confirmedAt: "2026-08-01" };
  assert.equal(deriveEventPaymentPolicy({ ...base, now: "2026-09-17" }).status, "due_soon");
  assert.equal(deriveEventPaymentPolicy({ ...base, now: "2026-09-24" }).status, "past_due");
  assert.equal(deriveEventPaymentPolicy({ ...base, now: "2026-09-27T23:00:00Z" }).status, "payment_hold");
  assert.equal(deriveEventPaymentPolicy({ ...base, now: "2026-09-29T00:00:00Z" }).status, "action_required");
});

test("payment and approved arrangements override hold states", () => {
  assert.equal(deriveEventPaymentPolicy({ startAt, total: 500, paid: 500, now: "2026-09-29" }).status, "paid");
  assert.equal(deriveEventPaymentPolicy({ startAt, total: 500, paid: 100, arrangementApproved: true, now: "2026-09-29" }).status, "arrangement");
});

test("calendar-day deadlines preserve venue wall time across daylight saving", () => {
  const schedule = buildEventPaymentSchedule({
    startAt: "2026-03-12T22:00:00.000Z",
    confirmedAt: "2026-01-01T12:00:00.000Z",
    timeZone: "America/New_York",
  });
  assert.equal(schedule.dueAt.toISOString(), "2026-03-05T23:00:00.000Z");
});
