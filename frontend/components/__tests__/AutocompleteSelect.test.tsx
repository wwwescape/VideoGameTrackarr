import { render, screen, waitForElementToBeRemoved, within } from "@testing-library/react";
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
  it("opens a sheet with nothing focused, so the keyboard stays down until search is tapped", async () => {
    mockTouchScreen(true);
    const user = userEvent.setup();
    render(
      <AutocompleteSelect label="Rating" options={OPTIONS} value={null} onChange={vi.fn()} getOptionLabel={(o) => o} />
    );

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Rating" }));

    const sheet = screen.getByRole("dialog", { name: "Rating" });
    const search = within(sheet).getByRole("searchbox", { name: "Search" });
    expect(search).not.toHaveFocus();
    expect(document.activeElement?.tagName).not.toBe("INPUT");
  });

  it("filters the list as you type in the search box, and closes on a pick", async () => {
    mockTouchScreen(true);
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AutocompleteSelect label="Rating" options={OPTIONS} value={null} onChange={onChange} getOptionLabel={(o) => o} />
    );

    await user.click(screen.getByRole("combobox", { name: "Rating" }));
    const sheet = screen.getByRole("dialog", { name: "Rating" });
    await user.type(within(sheet).getByRole("searchbox", { name: "Search" }), "puz");
    expect(within(sheet).queryByRole("button", { name: "Indie" })).not.toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Puzzle" }));

    expect(onChange).toHaveBeenCalledWith("Puzzle");
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
  });

  it("clears from the placeholder entry at the top", async () => {
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
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "All" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("shows a value that isn't in the options yet", () => {
    mockTouchScreen(true);
    render(
      <AutocompleteSelect label="Type" options={[]} value="Controller" onChange={vi.fn()} getOptionLabel={(o) => o} />
    );

    expect(screen.getByRole("combobox", { name: "Type" })).toHaveTextContent("Controller");
  });

  it("keeps type-to-filter with a mouse", () => {
    mockTouchScreen(false);
    render(
      <AutocompleteSelect label="Rating" options={OPTIONS} value={null} onChange={vi.fn()} getOptionLabel={(o) => o} />
    );

    expect(screen.getByRole("combobox", { name: "Rating" })).toHaveAttribute("type", "text");
  });
});

describe("AutocompleteMultiSelect on a touch screen", () => {
  it("ticks options in the sheet, shows them as removable chips, and Done closes it", async () => {
    mockTouchScreen(true);
    const user = userEvent.setup();
    const onChange = vi.fn();
    const props = { label: "Genres", options: OPTIONS, onChange, getOptionLabel: (o: string) => o };
    const { rerender } = render(<AutocompleteMultiSelect {...props} value={[]} />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Genres" }));
    const sheet = screen.getByRole("dialog", { name: "Genres" });
    expect(within(sheet).getByRole("searchbox", { name: "Search" })).not.toHaveFocus();
    await user.click(within(sheet).getByRole("button", { name: "Puzzle" }));
    expect(onChange).toHaveBeenCalledWith(["Puzzle"]);

    rerender(<AutocompleteMultiSelect {...props} value={["Puzzle"]} />);
    expect(within(screen.getByRole("dialog")).getByRole("checkbox", { checked: true })).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));

    await user.click(within(screen.getByRole("button", { name: "Puzzle" })).getByTestId("CancelIcon"));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("filters the sheet's list from the search box", async () => {
    mockTouchScreen(true);
    const user = userEvent.setup();
    render(
      <AutocompleteMultiSelect label="Genres" options={OPTIONS} value={[]} onChange={vi.fn()} getOptionLabel={(o) => o} />
    );

    await user.click(screen.getByRole("combobox", { name: "Genres" }));
    const sheet = screen.getByRole("dialog", { name: "Genres" });
    await user.type(within(sheet).getByRole("searchbox", { name: "Search" }), "ind");

    expect(within(sheet).getByRole("button", { name: "Indie" })).toBeInTheDocument();
    expect(within(sheet).queryByRole("button", { name: "Adventure" })).not.toBeInTheDocument();
  });
});
