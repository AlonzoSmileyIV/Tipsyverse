import { describe, expect, it } from "vitest";
import reducer, {
  clearMine,
  selectMyDefaultPaymentMethod,
} from "./paymentMethodsSlice";

describe("payment methods state", () => {
  it("selects the default payment method", () => {
    const state = {
      paymentMethods: {
        mine: { data: [{ _id: "one" }, { _id: "two", isDefault: true }] },
      },
    };
    expect(selectMyDefaultPaymentMethod(state)?._id).toBe("two");
  });

  it("clears customer payment methods on session changes", () => {
    const state = reducer(undefined, { type: "init" });
    expect(reducer(state, clearMine()).mine).toEqual({
      data: [], status: "idle", error: null,
    });
  });
});
