import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameListState } from "../../hooks/useGameListState";
import GameListPresets from "../GameListPresets";

const saveFilter = vi.fn();
const renameFilter = vi.fn();
const deleteFilter = vi.fn();
const restoreFilter = vi.fn();
const couch = { name: "Couch Switch", filters: { localPlayersMin: 2 } };
let savedFilters = [couch];

vi.mock("../../hooks/useGameFilterPreferences", () => ({
  useGameFilterPreferences: () => ({ savedFilters, saveFilter, renameFilter, deleteFilter, restoreFilter }),
}));
const showUndoToast = vi.fn();
vi.mock("../UndoToast", () => ({ showUndoToast: (...args: unknown[]) => showUndoToast(...args) }));

function listState(overrides: Partial<GameListState> = {}) {
  return {
    activeView: null,
    setActiveView: vi.fn(),
    applyFilters: vi.fn(),
    matchesFilters: vi.fn(() => true),
    filterSnapshot: { localPlayersMin: 2, coopOnly: true },
    ...overrides,
  } as unknown as GameListState;
}

describe("GameListPresets", () => {
  beforeEach(() => {
    savedFilters = [couch];
    vi.clearAllMocks();
  });

  it("puts a saved view back and makes it the active one", async () => {
    const user = userEvent.setup();
    const state = listState();
    render(<GameListPresets state={state} canSave />);

    await user.click(screen.getByRole("button", { name: "Presets" }));
    await user.click(screen.getByRole("menuitem", { name: /Couch Switch/ }));

    expect(state.applyFilters).toHaveBeenCalledWith({ localPlayersMin: 2 });
    expect(state.setActiveView).toHaveBeenCalledWith("Couch Switch");
  });

  it("saves the current filters under a name", async () => {
    const user = userEvent.setup();
    const state = listState();
    render(<GameListPresets state={state} canSave />);

    await user.click(screen.getByRole("button", { name: "Presets" }));
    await user.click(screen.getByRole("menuitem", { name: "Save current filters…" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Co-op night");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(saveFilter).toHaveBeenCalledWith("Co-op night", { localPlayersMin: 2, coopOnly: true });
    expect(state.setActiveView).toHaveBeenCalledWith("Co-op night");
  });

  it("shows a changed view and offers to update it", async () => {
    const user = userEvent.setup();
    const state = listState({ activeView: "Couch Switch", matchesFilters: vi.fn(() => false) });
    render(<GameListPresets state={state} canSave />);

    await user.click(screen.getByRole("button", { name: "Couch Switch (changed)" }));
    await user.click(screen.getByRole("menuitem", { name: "Update “Couch Switch”" }));

    expect(saveFilter).toHaveBeenCalledWith("Couch Switch", { localPlayersMin: 2, coopOnly: true });
  });

  it("drops the active view once no filter is set", () => {
    render(<GameListPresets state={listState({ activeView: "Couch Switch" })} canSave={false} />);

    expect(screen.getByRole("button", { name: "Presets" })).toBeInTheDocument();
  });

  it("deletes from the pencil with an Undo toast that saves it back", async () => {
    const user = userEvent.setup();
    render(<GameListPresets state={listState()} canSave />);

    await user.click(screen.getByRole("button", { name: "Presets" }));
    await user.click(screen.getByRole("button", { name: "Edit Couch Switch" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(deleteFilter).toHaveBeenCalledWith("Couch Switch");
    const [message, undo] = showUndoToast.mock.calls[0];
    expect(message).toBe("Preset “Couch Switch” deleted");
    undo();
    expect(restoreFilter).toHaveBeenCalledWith(couch);
  });
});
