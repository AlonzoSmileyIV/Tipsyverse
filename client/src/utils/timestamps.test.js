import { describe, expect, it } from "vitest";
import {
  formatTimestamp,
  getEventTimeZone,
  zonedLocalDateTimeToIso,
} from "./timestamps";

describe("timezone-safe timestamps", () => {
  it("stores a venue wall time as one UTC instant", () => {
    expect(
      zonedLocalDateTimeToIso(
        "2026-08-08",
        "16:45",
        "America/Denver"
      )
    ).toBe("2026-08-08T22:45:00.000Z");
  });

  it("renders the same instant accurately in different zones", () => {
    const instant = "2026-08-08T22:45:00.000Z";
    expect(formatTimestamp(instant, { timeZone: "America/Denver" })).toContain(
      "4:45 PM"
    );
    expect(formatTimestamp(instant, { timeZone: "America/New_York" })).toContain(
      "6:45 PM"
    );
  });

  it("uses an existing location timezone for older events", () => {
    expect(
      getEventTimeZone({ location: { timezone: "America/Chicago" } })
    ).toBe("America/Chicago");
  });

  it("uses the legacy business timezone when an older event has no timezone", () => {
    expect(getEventTimeZone({})).toBe("America/Indiana/Indianapolis");
  });
});
