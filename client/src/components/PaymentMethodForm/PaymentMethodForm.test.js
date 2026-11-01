import { describe, expect, it } from "vitest";
import { requiredBillingAddressErrors } from "./PaymentMethodForm";

describe("payment method billing address validation", () => {
  it("clears required errors when populated values are present", () => {
    expect(requiredBillingAddressErrors({
      address1: "7 Wales Court",
      city: "Indianapolis",
      state: "IN",
      zipcode: "46222",
      country: "US",
    })).toEqual({ address1: "", city: "", state: "", zipcode: "", country: "" });
  });

  it("retains errors only for missing fields", () => {
    expect(requiredBillingAddressErrors({ address1: "7 Wales Court", country: "US" })).toEqual({
      address1: "",
      city: "City is required.",
      state: "State is required.",
      zipcode: "ZIP Code is required.",
      country: "",
    });
  });
});
