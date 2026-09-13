import { describe, expect, it } from "vitest";
import appTheme, { PRIMARY_COLOR } from "./appTheme";

describe("application Material UI theme", () => {
  it("uses the brand primary color", () => {
    expect(appTheme.palette.primary.main).toBe(PRIMARY_COLOR);
  });

  it("brands selected tabs and button variants", () => {
    expect(
      appTheme.components.MuiTab.styleOverrides.root["&.Mui-selected"].color
    ).toBe("var(--primary-color)");
    expect(appTheme.components.MuiButton.styleOverrides.contained.backgroundColor)
      .toBe("var(--primary-color)");
    expect(appTheme.components.MuiButton.styleOverrides.outlined.borderColor)
      .toBe("var(--primary-color)");
  });
});
