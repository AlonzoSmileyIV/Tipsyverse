import { describe, expect, it } from "vitest";
import { getDistanceDisplayLabel } from "./formatDistanceLabel";

describe("getDistanceDisplayLabel", () => {
  it("explains when an event has no coordinates", () => {
    expect(
      getDistanceDisplayLabel({
        sharingEnabled: true,
        from: { lat: 39.7684, lng: -86.1581 },
        eventLocationPoint: undefined,
      })
    ).toBe("Event coordinates not available");
  });

  it("distinguishes a missing bartender location", () => {
    expect(
      getDistanceDisplayLabel({
        sharingEnabled: true,
        from: null,
        eventLocationPoint: { type: "Point", coordinates: [-86.1581, 39.7684] },
      })
    ).toBe("Your live location is not available");
  });

  it("hides distance status when sharing is disabled", () => {
    expect(
      getDistanceDisplayLabel({
        sharingEnabled: false,
        from: { lat: 39.7684, lng: -86.1581 },
        eventLocationPoint: undefined,
      })
    ).toBeNull();
  });
});
