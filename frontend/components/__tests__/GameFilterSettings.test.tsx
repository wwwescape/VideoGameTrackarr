import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GameFilterSettings from "../GameFilterSettings";

const setHiddenFields = vi.fn();
const deleteFilter = vi.fn();
let hiddenFields = new Set<string>();

vi.mock("../../hooks/useGameFilterPreferences", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/useGameFilterPreferences")>()),
  useGameFilterPreferences: () => ({
    hiddenFields,
    setHiddenFields,
    savedFilters: [{ name: "Couch Switch", filters: {} }],
    deleteFilter,
    renameFilter: vi.fn(),
    restoreFilter: vi.fn(),
    saving: false,
  }),
}));

let presetsLab = true;
vi.mock("../../hooks/useLabs", () => ({
  useEnabledLabs: () => new Set(presetsLab ? ["filter_presets"] : []),
}));

describe("GameFilterSettings", () => {
  beforeEach(() => {
    presetsLab = true;
    hiddenFields = new Set(["format"]);
    setHiddenFields.mockClear();
    deleteFilter.mockClear();
  });

  it("counts the fields shown and switches more off on Save", async () => {
    const user = userEvent.setup();
    render(<GameFilterSettings />);
    expect(screen.getByText(/17 of 18 fields shown/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Customize" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("switch", { name: "Formats" })).not.toBeChecked();
    await user.click(within(dialog).getByRole("switch", { name: "Steelbooks only" }));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(setHiddenFields).toHaveBeenCalledWith(new Set(["format", "steelbook"]));
  });

  it("renames or deletes a saved view from its edit button", async () => {
    const user = userEvent.setup();
    render(<GameFilterSettings />);

    await user.click(screen.getByRole("button", { name: "Edit Couch Switch" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    expect(deleteFilter).toHaveBeenCalledWith("Couch Switch");
  });

  it("lists saved presets only while the Filter Presets lab is on", () => {
    presetsLab = false;
    render(<GameFilterSettings />);

    expect(screen.getByRole("button", { name: "Customize" })).toBeInTheDocument();
    expect(screen.queryByText("Saved presets")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Couch Switch" })).not.toBeInTheDocument();
  });
});
