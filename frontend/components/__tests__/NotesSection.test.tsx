import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import NotesSection from "../NotesSection";

const NOTES = [{ id: 1, body: "Left off at the castle", updatedAt: "2026-10-20T18:00:00Z" }];

function renderSection(notes = NOTES) {
  const handlers = { onCreate: vi.fn(async () => undefined), onUpdate: vi.fn(async () => undefined), onDelete: vi.fn(async () => undefined) };
  render(<NotesSection notes={notes} {...handlers} />);
  return { user: userEvent.setup(), ...handlers };
}

describe("NotesSection", () => {
  it("says so when there are no notes", () => {
    renderSection([]);

    expect(screen.getByText("No notes yet.")).toBeInTheDocument();
  });

  it("adds a note from Add note", async () => {
    const { user, onCreate } = renderSection([]);

    await user.click(screen.getByRole("button", { name: "Add note" }));
    await user.type(screen.getByRole("textbox", { name: "Notes" }), "Try the hard mode");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(onCreate).toHaveBeenCalledWith("Try the hard mode");
  });

  it("edits and deletes a note from its row", async () => {
    const { user, onUpdate, onDelete } = renderSection();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const field = screen.getByRole("textbox", { name: "Notes" });
    await user.clear(field);
    await user.type(field, "Beat the castle");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onUpdate).toHaveBeenCalledWith(1, "Beat the castle");

    await user.click(within(screen.getByText("Left off at the castle").closest("div")!.parentElement!.parentElement!).getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
