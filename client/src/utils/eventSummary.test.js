import { describe, expect, it } from "vitest";
import {
  getApprovedBartenderCount,
  getEventPaymentSummary,
  getEventPaymentTotal,
  getRecommendedBartenderCount,
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
      retained: 0,
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

  it("keeps an approved exception separate from recommended staffing", () => {
    const event = {
      counts: {
        recommendedBartenders: 2,
        approvedBartenders: 1,
        neededBartenders: 1,
      },
      pricing: { bartendersRequested: 1 },
    };
    expect(getRecommendedBartenderCount(event)).toBe(2);
    expect(getApprovedBartenderCount(event)).toBe(1);
    expect(getRequiredBartenderCount(event)).toBe(1);
  });

  it("rounds payment summaries to currency precision", () => {
    expect(
      getEventPaymentSummary({ payment: { total: 0.3, paidTotal: 0.1 + 0.2 } })
    ).toEqual({ total: 0.3, paid: 0.3, retained: 0, balance: 0, credit: 0 });
  });

  it("turns a canceled event's net payment into reviewable credit", () => {
    expect(
      getEventPaymentSummary({
        status: "canceled",
        payment: { total: 500, paidTotal: 200 },
        cancellation: { retainedAmount: 25 },
      })
    ).toEqual({
      total: 500,
      paid: 200,
      retained: 25,
      balance: 0,
      credit: 175,
    });
  });
});
