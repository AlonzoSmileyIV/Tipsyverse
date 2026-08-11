import { describe, expect, it } from "vitest";
import {
  getEventPaymentSummary,
  getEventPaymentTotal,
  getRequiredBartenderCount,
} from "./eventSummary";

describe("eventSummary", () => {
  it("uses the confirmed bill instead of a larger recalculated fallback", () => {
    const event = {
      payment: { total: 300, paidTotal: 125 },
      pricing: { estimatedTotal: 500 },
    };
    expect(getEventPaymentTotal(event, 600)).toBe(300);
    expect(getEventPaymentSummary(event, 600)).toEqual({
      total: 300,
      paid: 125,
      balance: 175,
      credit: 0,
    });
  });

  it("uses fallback pricing only when no confirmed bill exists", () => {
    expect(
      getEventPaymentTotal({ pricing: { estimatedTotal: 500 } }, 600)
    ).toBe(600);
  });

  it("uses the larger staffing requirement during legacy mismatches", () => {
    expect(
      getRequiredBartenderCount({
        counts: { neededBartenders: 2 },
        pricing: { bartendersRequested: 1 },
      })
    ).toBe(2);
  });

  it("rounds payment summaries to currency precision", () => {
    expect(
      getEventPaymentSummary({ payment: { total: 0.3, paidTotal: 0.1 + 0.2 } })
    ).toEqual({ total: 0.3, paid: 0.3, balance: 0, credit: 0 });
  });
});
