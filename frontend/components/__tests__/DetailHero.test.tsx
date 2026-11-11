import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DetailHero } from "../Detail";

function setWidth(wide: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: wide && query.includes("min-width"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

function renderHero(corner?: React.ReactNode) {
  render(
    <MemoryRouter>
      <DetailHero
        backdrop={null}
        media={<div />}
        mediaWidth={{ xs: 112, md: 210 }}
        crumbs={[]}
        title="Astro Bot"
        subline={["2024"]}
        pills={<span>Owned</span>}
        links={<a href="https://store.example.test">Store</a>}
        corner={corner}
      />
    </MemoryRouter>
  );
}

describe("DetailHero corner", () => {
  afterEach(() => vi.restoreAllMocks());

  it("puts the control in the hero's corner on a wide screen", () => {
    setWidth(true);
    renderHero(<button type="button">Toggle</button>);
    expect(within(screen.getByTestId("detail-hero-corner")).getByRole("button", { name: "Toggle" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Toggle" })).toHaveLength(1);
  });

  it("moves it beside the links on a narrow one", () => {
    setWidth(false);
    renderHero(<button type="button">Toggle</button>);
    expect(screen.queryByTestId("detail-hero-corner")).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Store" });
    expect(within(link.parentElement as HTMLElement).getByRole("button", { name: "Toggle" })).toBeInTheDocument();
  });

  it("has no corner when the page gives none", () => {
    setWidth(true);
    renderHero();
    expect(screen.queryByTestId("detail-hero-corner")).not.toBeInTheDocument();
  });
});
