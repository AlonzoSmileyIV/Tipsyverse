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
});
