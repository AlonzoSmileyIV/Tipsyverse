import { describe, expect, it } from "vitest";
import getEventPaymentPolicyView from "./eventPaymentPolicy";

const event = {
  startAt: "2026-09-30T22:00:00.000Z",
  payment: { balanceDueAt: "2026-09-23T22:00:00.000Z", policyStatus: "current" },
};

describe("event payment policy presentation", () => {
  it("shows an unpaid confirmed balance with its due date", () => {
    const result = getEventPaymentPolicyView(event, {
      total: 500,
      paid: 100,
      now: "2026-09-01",
    });
    expect(result.status).toBe("current");
    expect(result.label).toContain("Sep 23");
  });

  it("shows holds and staff action based on the event countdown", () => {
    expect(getEventPaymentPolicyView(event, { total: 500, now: "2026-09-28" }).status)
      .toBe("payment_hold");
    expect(getEventPaymentPolicyView(event, { total: 500, now: "2026-09-29" }).status)
      .toBe("action_required");
  });
});
