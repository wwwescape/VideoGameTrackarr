import { describe, expect, it } from "vitest";
import { phoneColumns, phoneGridColumns } from "../VirtualGameGrid";

describe("phoneColumns", () => {
  it("turns the card size into 3, 2 or 1 columns on phones", () => {
    expect(phoneColumns(140)).toBe(3);
    expect(phoneColumns(150)).toBe(3);
    // The default card size keeps the two columns phones always had.
    expect(phoneColumns(170)).toBe(2);
    expect(phoneColumns(230)).toBe(2);
    expect(phoneColumns(240)).toBe(1);
    expect(phoneColumns(300)).toBe(1);
  });

  it("gives the CSS-grid columns for the non-windowed grids", () => {
    expect(phoneGridColumns(140)).toBe("repeat(3, minmax(0, 1fr))");
    expect(phoneGridColumns(260)).toBe("repeat(1, minmax(0, 1fr))");
  });
});
