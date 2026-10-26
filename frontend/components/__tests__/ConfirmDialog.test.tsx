import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConfirmDialog from "../ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders nothing visible when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        title="Remove game?"
        description="This can't be undone."
        confirmLabel="Remove"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.queryByText("Remove game?")).not.toBeInTheDocument();
  });

  it("renders the title, description, and confirm label when open", () => {
    render(
      <ConfirmDialog
        open
        title="Remove game?"
        description="This can't be undone."
        confirmLabel="Remove"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText("Remove game?")).toBeInTheDocument();
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("calls onConfirm when the confirm button is clicked", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Remove game?"
        description="This can't be undone."
        confirmLabel="Remove"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Remove game?"
        description="This can't be undone."
        confirmLabel="Remove"
        onClose={onClose}
        onConfirm={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("while busy, spins the confirm button and can't be confirmed, cancelled or closed", async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        open
        busy
        title="Confirm resync"
        description="Fetch the latest from IGDB?"
        confirmLabel="Resync"
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );

    const confirm = screen.getByRole("button", { name: /Resync/ });
    expect(confirm).toBeDisabled();
    expect(within(confirm).getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
