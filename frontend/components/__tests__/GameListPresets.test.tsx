import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameListState, PresetField } from "../../hooks/useGameListState";
import { useGameListPresets } from "../GameListPresets";

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
    snapshotFilters: vi.fn(() => ({ localPlayersMin: 2, coopOnly: true })),
    ...overrides,
  } as unknown as GameListState;
}

// What GameListControls does with the hook: the Filter caret opens the menu, and the active
// preset's chip shows its label and clears it.
const Harness = ({
  state,
  canSave = true,
  enabled = true,
  fixedFields,
}: {
  state: GameListState;
  canSave?: boolean;
  enabled?: boolean;
  fixedFields?: PresetField[];
}) => {
  const presets = useGameListPresets(state, { enabled, canSave, fixedFields });
  return (
    <>
      <button type="button" aria-label="Presets" onClick={(event) => presets.openMenu(event.currentTarget)} />
      {presets.activeLabel ? (
        <button type="button" onClick={presets.clearActive}>
          Clear {presets.activeLabel}
        </button>
      ) : null}
      {presets.elements}
    </>
  );
};

describe("useGameListPresets", () => {
  beforeEach(() => {
    savedFilters = [couch];
    vi.clearAllMocks();
  });

  it("puts a saved preset back and makes it the active one", async () => {
    const user = userEvent.setup();
    const state = listState();
    render(<Harness state={state} />);

    await user.click(screen.getByRole("button", { name: "Presets" }));
    await user.click(screen.getByRole("menuitem", { name: /Couch Switch/ }));

    expect(state.applyFilters).toHaveBeenCalledWith({ localPlayersMin: 2 }, []);
    expect(state.setActiveView).toHaveBeenCalledWith("Couch Switch");
  });

  it("saves the current filters under a name", async () => {
    const user = userEvent.setup();
    const state = listState();
    render(<Harness state={state} />);

    await user.click(screen.getByRole("button", { name: "Presets" }));
    await user.click(screen.getByRole("menuitem", { name: "Save current filters…" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Co-op night");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(saveFilter).toHaveBeenCalledWith("Co-op night", { localPlayersMin: 2, coopOnly: true });
    expect(state.setActiveView).toHaveBeenCalledWith("Co-op night");
  });

  it("labels a changed preset and offers to update it", async () => {
    const user = userEvent.setup();
    const state = listState({ activeView: "Couch Switch", matchesFilters: vi.fn(() => false) });
    render(<Harness state={state} />);

    expect(screen.getByRole("button", { name: "Clear Couch Switch (changed)" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Presets" }));
    await user.click(screen.getByRole("menuitem", { name: "Update “Couch Switch”" }));

    expect(saveFilter).toHaveBeenCalledWith("Couch Switch", { localPlayersMin: 2, coopOnly: true });
  });

  it("clears the active preset's filters (not the page's fixed ones) and the preset", async () => {
    const user = userEvent.setup();
    const state = listState({ activeView: "Couch Switch" });
    render(<Harness state={state} fixedFields={["platform"]} />);

    await user.click(screen.getByRole("button", { name: "Clear Couch Switch" }));

    expect(state.applyFilters).toHaveBeenCalledWith({}, ["platform"]);
    expect(state.setActiveView).toHaveBeenCalledWith(null);
  });

  it("leaves the fields a page fixes alone, putting a preset back and saving one", async () => {
    const user = userEvent.setup();
    const state = listState({ activeView: "Couch Switch", matchesFilters: vi.fn(() => false) });
    render(<Harness state={state} fixedFields={["platform"]} />);

    expect(state.matchesFilters).toHaveBeenCalledWith({ localPlayersMin: 2 }, ["platform"]);
    await user.click(screen.getByRole("button", { name: "Presets" }));
    await user.click(screen.getByRole("menuitem", { name: "Update “Couch Switch”" }));
    expect(state.snapshotFilters).toHaveBeenCalledWith(["platform"]);

    await user.click(screen.getByRole("button", { name: "Presets" }));
    // The preset itself, not the "Update" item below it.
    await user.click(screen.getAllByRole("menuitem", { name: /Couch Switch/ })[0]);
    expect(state.applyFilters).toHaveBeenCalledWith({ localPlayersMin: 2 }, ["platform"]);
  });

  it("has no active preset once no filter is set", () => {
    render(<Harness state={listState({ activeView: "Couch Switch" })} canSave={false} />);

    expect(screen.queryByRole("button", { name: /^Clear/ })).not.toBeInTheDocument();
  });

  it("has nothing while the Filter Presets lab is off", async () => {
    const user = userEvent.setup();
    render(<Harness state={listState({ activeView: "Couch Switch" })} enabled={false} />);

    expect(screen.queryByRole("button", { name: /^Clear/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Presets" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("deletes from the pencil with an Undo toast that saves it back", async () => {
    const user = userEvent.setup();
    render(<Harness state={listState()} />);

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
