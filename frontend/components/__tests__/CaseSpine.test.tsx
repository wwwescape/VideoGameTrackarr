import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GameCaseLook } from "../../api/types";
import { shelfPlatform } from "../../test/shelfFixtures";
import CaseSpine from "../CaseSpine";

const look = (overrides: Partial<GameCaseLook> = {}): GameCaseLook => ({
  ...shelfPlatform(1, "PlayStation 3", 171, 12).case,
  ...overrides,
});

// 171mm drawn 342px tall: 2px per mm.
const renderSpine = (overrides: Partial<GameCaseLook> = {}) =>
  render(<CaseSpine width={24} height={342} look={look(overrides)} fallbackLabel="PS3" title="Demon's Souls" />);

describe("CaseSpine", () => {
  it("draws the line under the logo band only when the case has one", () => {
    const { unmount } = renderSpine();
    expect(screen.queryByTestId("logo-line")).toBeNull();
    unmount();

    renderSpine({ logoLineColor: "#d40000" });
    const line = screen.getByTestId("logo-line");
    expect(line).toHaveStyle({ backgroundColor: "#d40000", height: "3px" });
    // Between the logo band and the title band.
    expect(screen.getByTestId("logo-band").nextElementSibling).toBe(line);
    expect(line.nextElementSibling).toBe(screen.getByTestId("title-band"));
  });

  it("keeps a 1px line 1px in a tiny preview", () => {
    // MUI's sx reads a bare 1 as 100%, which once stretched the line down the whole spine.
    render(<CaseSpine width={4} height={26} look={look({ logoLineColor: "#ffffff" })} fallbackLabel="PS4" />);
    expect(screen.getByTestId("logo-line")).toHaveStyle({ height: "1px" });
  });

  it("shows the case top above the logo band, at its real size", () => {
    renderSpine({ caseTopMm: 17 });
    expect(screen.getByTestId("case-spine")).toHaveStyle({ paddingTop: "34px" });
  });

  it("keeps a thin edge when the case has no top", () => {
    renderSpine({ caseTopMm: 0 });
    expect(screen.getByTestId("case-spine")).toHaveStyle({ paddingTop: "2px" });
  });
});
