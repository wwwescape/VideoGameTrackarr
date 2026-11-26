import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GameCaseLook } from "../../api/types";
import { shelfPlatform } from "../../test/shelfFixtures";
import SteelbookSpine from "../SteelbookSpine";

const look = shelfPlatform(1, "PlayStation 3", 171, 12).case;

// 171mm drawn 342px tall: 2px per mm, so the 1.5mm rims are 3px.
const renderSteelbook = (width = 30, height = 342, caseLook: GameCaseLook = look) =>
  render(
    <SteelbookSpine
      width={width}
      height={height}
      look={caseLook}
      fallbackLabel="PS3"
      title="Astro Bot"
    />
  );

describe("SteelbookSpine", () => {
  it("sets the platform's spine art in a steel case with a rim down each side", () => {
    renderSteelbook();
    const steelbook = screen.getByTestId("steelbook-spine");
    expect(steelbook).toHaveStyle({
      width: "30px",
      height: "342px",
      paddingLeft: "3px",
      paddingRight: "3px",
      borderRadius: "3px",
    });
    const art = within(steelbook).getByTestId("case-spine");
    expect(art).toHaveStyle({ width: "24px", height: "342px" });
  });

  it("leaves the plastic case's colour out, so the steel shows through", () => {
    renderSteelbook();
    expect(screen.getByTestId("case-spine")).toHaveStyle({
      backgroundColor: "rgba(0, 0, 0, 0)",
      boxShadow: "none",
    });
  });

  it("keeps the case's spine art: logo band, its line and the game's name", () => {
    renderSteelbook(30, 342, { ...look, logoLineColor: "#1f5fc8" });
    expect(screen.getByTestId("logo-band")).toHaveTextContent("PS3");
    expect(screen.getByTestId("logo-band")).toHaveStyle({ backgroundColor: "#222222" });
    expect(screen.getByTestId("logo-line")).toHaveStyle({ backgroundColor: "#1f5fc8" });
    expect(screen.getByTestId("title-band")).toHaveTextContent("Astro Bot");
  });

  it("keeps a 1px rim in a tiny preview", () => {
    renderSteelbook(6, 26);
    expect(screen.getByTestId("steelbook-spine")).toHaveStyle({ paddingLeft: "1px" });
    expect(screen.getByTestId("case-spine")).toHaveStyle({ width: "4px" });
  });
});
