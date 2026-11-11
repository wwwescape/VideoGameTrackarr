import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Lab } from "../../api/labs";
import LabsPage from "../LabsPage";

let labs: Lab[] = [];
const mutate = vi.fn();
vi.mock("../../hooks/useLabs", () => ({
  useLabs: () => ({ data: labs, isLoading: false, isError: false }),
  useEnabledLabs: () => new Set(labs.filter((lab) => lab.enabled).map((lab) => lab.id)),
  useSetLabEnabled: () => ({ mutate, isPending: false, isError: false }),
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/settings/labs"]}>
      <LabsPage />
    </MemoryRouter>
  );

describe("Settings → Labs", () => {
  beforeEach(() => {
    labs = [{ id: "game_shelf", enabled: false }];
    mutate.mockClear();
  });

  it("lists each lab with what it does and a switch", () => {
    renderPage();
    expect(screen.getByText("Game Shelf")).toBeInTheDocument();
    expect(screen.getByText(/physical games as cases on a shelf/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Game Shelf" })).not.toBeChecked();
  });

  it("turns a lab on", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("switch", { name: "Game Shelf" }));
    expect(mutate).toHaveBeenCalledWith({ id: "game_shelf", enabled: true });
  });

  it("is a Settings tab, and shows the lab's own tab once it's on", () => {
    labs = [{ id: "game_shelf", enabled: true }];
    renderPage();
    const toolbar = screen.getByRole("toolbar");
    expect(toolbar).toHaveTextContent("Labs");
    expect(screen.getByRole("link", { name: "Game Cases" })).toHaveAttribute(
      "href",
      "/settings/game-cases"
    );
  });
});
