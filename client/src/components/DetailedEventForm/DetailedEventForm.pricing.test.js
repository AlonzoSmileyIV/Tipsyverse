import {
  autoRushTier,
  buildPricingSnapshot,
  buildSnapshotFromEvent,
  hoursBetween,
  recommendBartenders,
} from "./DetailedEventForm.pricing";

test("bartender recommendations cover boundary guest counts", () => {
  expect(recommendBartenders(0)).toBe(1);
  expect(recommendBartenders(50)).toBe(1);
  expect(recommendBartenders(51)).toBe(2);
  expect(recommendBartenders(150)).toBe(3);
  expect(recommendBartenders(181)).toBe(4);
});

test("rush tiers change at documented hour boundaries", () => {
  expect(autoRushTier(48).pct).toBe(0.35);
  expect(autoRushTier(49).pct).toBe(0.2);
  expect(autoRushTier(120).pct).toBe(0.2);
  expect(autoRushTier(121).pct).toBe(0.1);
  expect(autoRushTier(169).pct).toBe(0);
});

test("invalid or reversed event windows cannot create negative billable hours", () => {
  expect(hoursBetween("2026-01-02", "2026-01-01")).toBe(0);
  expect(hoursBetween(null, "2026-01-01")).toBe(0);
});

test("pricing snapshot uses cents and includes labor, fees, and percentages", () => {
  const result = buildPricingSnapshot({
    form: {
      bartendersRequested: 2,
      startAt: "2026-01-01T18:00:00Z",
      endAt: "2026-01-01T22:00:00Z",
      procurementRequested: false,
      allowTipJars: false,
    },
    calcInput: {
      hourlyRate: 50,
      bookingFee: 100,
      gratuityPct: 20,
      taxPct: 10,
    },
    rushPctWholeEffective: 0,
  });
  expect(result.totals.flatSubtotalC).toBe(50_000);
  expect(result.totals.totalC).toBe(65_000);
});

test("confirmed staffing count is the saved pricing baseline", () => {
  const snapshot = buildSnapshotFromEvent({
    startAt: "2026-08-17T21:00:00.000Z",
    endAt: "2026-08-18T01:00:00.000Z",
    counts: { neededBartenders: 2 },
    pricing: {
      bartendersRequested: 1,
      hourlyRate: 40,
      bookingFee: 75,
      setupHours: 0.5,
      breakdownHours: 0.5,
      gratuityPct: 0.18,
      taxPct: 0.07,
    },
    options: { tipJarsAllowed: false },
  });

  expect(snapshot.meta.bartenders).toBe(2);
  expect(snapshot.meta.totalHours).toBe(5);
  expect(snapshot.lines.find((line) => line.key === "hourly")?.amountC).toBe(
    40_000
  );
  expect(snapshot.totals.totalC).toBe(59_375);
});
