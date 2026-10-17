import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CatalogRefCard from "../CatalogRefCard";

function renderCard(coverUrls: string[]) {
  const { container } = render(
    <CatalogRefCard name="The Legend of Zelda" gameCount={6} coverUrls={coverUrls} onClick={vi.fn()} />
  );
  return container.querySelectorAll("img");
}

const covers = (count: number) => Array.from({ length: count }, (_, i) => `https://img.example/${i}.jpg`);

describe("CatalogRefCard covers", () => {
  it("shows a placeholder without covers", () => {
    expect(renderCard([])).toHaveLength(0);
    expect(screen.getByText("No cover")).toBeInTheDocument();
  });

  it("shows each cover, in order, up to four", () => {
    expect(renderCard(covers(3))).toHaveLength(3);
  });

  it("ignores covers past the fourth", () => {
    const images = renderCard(covers(6));

    expect(images).toHaveLength(4);
    expect(images[0]).toHaveAttribute("src", "https://img.example/0.jpg");
  });

  it("still shows the name and game count", () => {
    renderCard(covers(1));

    expect(screen.getByText("The Legend of Zelda")).toBeInTheDocument();
    expect(screen.getByText("6 games")).toBeInTheDocument();
  });
});
