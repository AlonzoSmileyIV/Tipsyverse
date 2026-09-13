import { describe, expect, it } from "vitest";
import getCustomerPaymentStatus from "./customerPaymentStatus";

describe("getCustomerPaymentStatus", () => {
  it("does not call an unpriced zero-dollar request paid in full", () => {
    expect(getCustomerPaymentStatus(0, 0)).toMatchObject({
      key: "pricing_pending",
      label: "Pricing pending",
      severity: "info",
    });
  });

  it("only reports paid in full when a positive total has been paid", () => {
    expect(getCustomerPaymentStatus(100, 100).key).toBe("paid_in_full");
    expect(getCustomerPaymentStatus(100, 25).key).toBe("partially_paid");
    expect(getCustomerPaymentStatus(100, 0).key).toBe("balance_due");
  });

  it("shows refund review instead of a balance for a canceled event", () => {
    expect(
      getCustomerPaymentStatus(500, 200, {
        status: "canceled",
        cancellation: { retainedAmount: 25 },
      })
    ).toMatchObject({ key: "refund_review", label: "Refund review $175.00" });
    expect(getCustomerPaymentStatus(500, 0, { status: "canceled" })).toMatchObject({
      key: "canceled",
      label: "Canceled — no balance due",
    });
  });
});
