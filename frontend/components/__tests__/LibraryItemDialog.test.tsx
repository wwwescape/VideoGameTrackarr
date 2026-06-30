import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PlatformResponse, RegionResponse } from "../../api/types";
import LibraryItemDialog from "../LibraryItemDialog";

const platforms: PlatformResponse[] = [
  { id: 1, igdbId: 6, name: "PC (Microsoft Windows)", slug: "win", abbreviation: "PC" },
  { id: 2, igdbId: 48, name: "Sony PlayStation 4", slug: "ps4", abbreviation: "PS4" },
];

const regions: RegionResponse[] = [{ id: 1, name: "Worldwide" }];

describe("LibraryItemDialog", () => {
  it("shows Digital Storefront when PC and Digital format are selected", async () => {
    const user = userEvent.setup();
    render(
      <LibraryItemDialog
        open
        title="Add game to your collection"
        platforms={platforms}
        regions={regions}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Add"
      />
    );

    expect(screen.queryByLabelText("Digital Storefront")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Platform *"));
    await user.click(await screen.findByRole("option", { name: "PC (Microsoft Windows)" }));

    await user.click(screen.getByRole("radio", { name: "Digital" }));

    expect(await screen.findByLabelText("Digital Storefront")).toBeInTheDocument();
  });

  it("shows Digital Storefront when format is picked before platform", async () => {
    const user = userEvent.setup();
    render(
      <LibraryItemDialog
        open
        title="Add game to your collection"
        platforms={platforms}
        regions={regions}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Add"
      />
    );

    await user.click(screen.getByRole("radio", { name: "Digital" }));

    await user.click(screen.getByLabelText("Platform *"));
    await user.click(await screen.findByRole("option", { name: "PC (Microsoft Windows)" }));

    expect(await screen.findByLabelText("Digital Storefront")).toBeInTheDocument();
  });

  it("shows Digital Storefront when editing an existing PC/Digital item", async () => {
    render(
      <LibraryItemDialog
        open
        title="Update game in your collection"
        platforms={platforms}
        regions={regions}
        defaultValues={{ platformId: 1, format: "digital" }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Update"
      />
    );

    expect(await screen.findByLabelText("Digital Storefront")).toBeInTheDocument();
  });
});
