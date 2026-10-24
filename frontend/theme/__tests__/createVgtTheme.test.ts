import { describe, expect, it } from "vitest";
import { createVgtTheme } from "../createVgtTheme";

describe("createVgtTheme", () => {
  it("uses the accent color as-is", () => {
    const theme = createVgtTheme("dark", "normal", "#7c4dff");

    expect(theme.palette.primary.main).toBe("#7c4dff");
    expect(theme.palette.primary.contrastText).toBe("#ffffff");
  });

  it("puts dark text on accents too light for white", () => {
    expect(createVgtTheme("light", "normal", "#fbc02d").palette.primary.contrastText).toBe("#111418");
  });

  it("has fixed slate surfaces in dark mode and near-white ones in light mode", () => {
    expect(createVgtTheme("dark", "normal", "#7c4dff").palette.background.default).toBe("#15181e");
    expect(createVgtTheme("light", "normal", "#7c4dff").palette.background.default).toBe("#f4f6f9");
  });

  it("strengthens borders and secondary text in high contrast", () => {
    const normal = createVgtTheme("dark", "normal", "#7c4dff");
    const high = createVgtTheme("dark", "high", "#7c4dff");

    expect(high.palette.divider).not.toBe(normal.palette.divider);
    expect(high.palette.text.secondary).toBe(normal.palette.text.primary);
  });

  it("uses Inter at a 14px base", () => {
    const theme = createVgtTheme("light", "normal", "#7c4dff");

    expect(theme.typography.fontFamily).toMatch(/^"Inter"/);
    expect(theme.typography.fontSize).toBe(14);
  });
});
