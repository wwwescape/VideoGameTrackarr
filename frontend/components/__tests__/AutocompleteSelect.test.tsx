import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AutocompleteMultiSelect from "../AutocompleteMultiSelect";
import AutocompleteSelect from "../AutocompleteSelect";

const OPTIONS = ["Adventure", "Indie", "Puzzle"];

function mockTouchScreen(touch: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: touch && query.includes("coarse"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AutocompleteSelect on a touch screen", () => {
  it("is a plain list with nothing to type in, so the keyboard never opens", async () => {
    mockTouchScreen(true);
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AutocompleteSelect
        label="Rating"
        options={OPTIONS}
        value={null}
        onChange={onChange}
        getOptionLabel={(o) => o}
        placeholder="All"
      />
    );

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Rating" }));
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Indie" }));

    expect(onChange).toHaveBeenCalledWith("Indie");
  });

  it("clears from the placeholder entry", async () => {
    mockTouchScreen(true);
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AutocompleteSelect
        label="Rating"
        options={OPTIONS}
        value="Indie"
        onChange={onChange}
        getOptionLabel={(o) => o}
        placeholder="All"
      />
    );

    await user.click(screen.getByRole("combobox", { name: "Rating" }));
    await user.click(screen.getByRole("option", { name: "All" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("keeps type-to-filter with a mouse", () => {
    mockTouchScreen(false);
    render(
      <AutocompleteSelect
        label="Rating"
        options={OPTIONS}
        value={null}
        onChange={vi.fn()}
        getOptionLabel={(o) => o}
      />
    );

    expect(screen.getByRole("combobox", { name: "Rating" })).toHaveAttribute("type", "text");
  });
});

describe("AutocompleteMultiSelect on a touch screen", () => {
  it("ticks options in a plain list and shows them as removable chips", async () => {
    mockTouchScreen(true);
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <AutocompleteMultiSelect
        label="Genres"
        options={OPTIONS}
        value={[]}
        onChange={onChange}
        getOptionLabel={(o) => o}
      />
    );

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Genres" }));
    await user.click(screen.getByRole("option", { name: "Puzzle" }));
    expect(onChange).toHaveBeenCalledWith(["Puzzle"]);

    await user.keyboard("{Escape}");
    rerender(
      <AutocompleteMultiSelect
        label="Genres"
        options={OPTIONS}
        value={["Puzzle"]}
        onChange={onChange}
        getOptionLabel={(o) => o}
      />
    );
    await user.click(
      within(screen.getByRole("button", { name: "Puzzle" })).getByTestId("CancelIcon")
    );
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
