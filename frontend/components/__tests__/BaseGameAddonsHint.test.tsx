import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BaseGameAddons } from "../../api/addonLinks";
import BaseGameAddonsHint from "../BaseGameAddonsHint";

const addon = (igdbId: number, linked: boolean) => ({
  igdbId,
  name: `Add-on ${igdbId}`,
  coverUrl: null,
  category: "dlc_addon" as const,
  firstReleaseDate: null,
  gameId: null,
  linked,
});

const query = { data: undefined as BaseGameAddons | undefined };
vi.mock("../../hooks/useAddonLinks", () => ({ useBaseGameAddons: () => query }));

// This test environment has no window.localStorage; a small in-memory one stands in.
function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  });
}

describe("BaseGameAddonsHint", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    stubLocalStorage();
    query.data = {
      baseGame: { igdbId: 100, name: "Forza Horizon 5", gameId: null },
      addons: [addon(1, false), addon(2, false), addon(3, true)],
    };
  });

  it("counts the base game's unlinked add-ons and opens the picker", async () => {
    const onOpenPicker = vi.fn();
    render(<BaseGameAddonsHint gameId={7} enabled onOpenPicker={onOpenPicker} />);

    expect(
      screen.getByText("Forza Horizon 5 has 2 add-ons that aren't linked here. Link the ones that work with this edition.")
    ).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Link add-ons" }));
    expect(onOpenPicker).toHaveBeenCalled();
  });

  it("stays away without a base game, with nothing left to link, or when disabled", () => {
    const { unmount } = render(<BaseGameAddonsHint gameId={7} enabled={false} onOpenPicker={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Link add-ons" })).not.toBeInTheDocument();
    unmount();

    query.data = { baseGame: null, addons: [] };
    const second = render(<BaseGameAddonsHint gameId={7} enabled onOpenPicker={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Link add-ons" })).not.toBeInTheDocument();
    second.unmount();

    query.data = { baseGame: { igdbId: 100, name: "Forza Horizon 5", gameId: null }, addons: [addon(3, true)] };
    render(<BaseGameAddonsHint gameId={7} enabled onOpenPicker={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Link add-ons" })).not.toBeInTheDocument();
  });

  it("stays dismissed for that game", async () => {
    const { unmount } = render(<BaseGameAddonsHint gameId={7} enabled onOpenPicker={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("button", { name: "Link add-ons" })).not.toBeInTheDocument();
    unmount();

    render(<BaseGameAddonsHint gameId={7} enabled onOpenPicker={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Link add-ons" })).not.toBeInTheDocument();
  });
});
