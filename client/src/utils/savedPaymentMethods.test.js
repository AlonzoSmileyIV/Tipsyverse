import { describe, expect, it } from "vitest";
import {
  DEFAULT_EVENT_PAYMENT_PROVIDER,
  isSettledPayment,
  selectDefaultPaymentMethodId,
} from "./savedPaymentMethods";

describe("saved payment method selection", () => {
  const methods = [
    { _id: "first", isDefault: false },
    { _id: "default", isDefault: true },
  ];

  it("defaults event payment collection to credit or debit card", () => {
    expect(DEFAULT_EVENT_PAYMENT_PROVIDER).toBe("stripe");
  });

  it("preselects the customer's default method", () => {
    expect(selectDefaultPaymentMethodId(methods)).toBe("default");
  });

  it("preserves a valid staff selection and replaces a stale one", () => {
    expect(selectDefaultPaymentMethodId(methods, "first")).toBe("first");
    expect(selectDefaultPaymentMethodId(methods, "deleted")).toBe("default");
  });

  it("requires an explicit choice when no card is the default", () => {
    expect(
      selectDefaultPaymentMethodId([
        { _id: "first", isDefault: false },
        { _id: "second", isDefault: false },
      ])
    ).toBe("");
  });

  it("counts only authoritative recorded payments as settled", () => {
    expect(isSettledPayment({ status: "recorded" })).toBe(true);
    for (const status of ["processing", "requires_action", "failed", "voided", "refunded"]) {
      expect(isSettledPayment({ status })).toBe(false);
    }
  });
});

