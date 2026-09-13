import { describe, expect, it } from "vitest";
import { formatTimezoneConfirmation } from "./timezones";

describe("formatTimezoneConfirmation", () => {
  it("shows a readable venue timezone and city", () => {
    const label = formatTimezoneConfirmation("America/Indiana/Indianapolis");
    expect(label).toContain("Indianapolis");
    expect(label).not.toContain("America/");
  });

  it("keeps an invalid timezone visible for correction", () => {
    expect(formatTimezoneConfirmation("Invalid/Zone")).toBe("Invalid/Zone");
  });
});
