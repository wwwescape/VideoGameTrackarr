import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DangerZoneSection from "../DangerZoneSection";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

const runAction = vi.fn();

vi.mock("../../hooks/useDangerZone", () => ({
  useDangerZoneAction: () => ({ mutateAsync: runAction, isPending: false }),
}));

describe("DangerZoneSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runAction.mockResolvedValue({ removed: {}, safetySnapshotPath: null });
  });

  it("says what each action removes and keeps", () => {
    render(<DangerZoneSection />);

    expect(screen.getByText("Danger Zone")).toBeInTheDocument();
    expect(screen.getByText(/Removes your rating from every game\. Keeps everything else\./)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Clear" })).toHaveLength(5);
    expect(screen.getAllByRole("button", { name: "Reset" })).toHaveLength(3);
  });

  it("runs a clear action once confirmed", async () => {
    const user = userEvent.setup();
    render(<DangerZoneSection />);

    await user.click(screen.getAllByRole("button", { name: "Clear" })[1]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Clear ratings?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Clear ratings" }));

    expect(runAction).toHaveBeenCalledWith({ action: "clear_ratings", confirmation: undefined });
  });

  it("only resets once RESET is typed exactly", async () => {
    const user = userEvent.setup();
    render(<DangerZoneSection />);

    await user.click(screen.getAllByRole("button", { name: "Reset" })[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/safety snapshot/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Reset game library" });
    const field = within(dialog).getByLabelText("Type RESET to confirm");

    await user.type(field, "reset");
    expect(confirm).toBeDisabled();
    await user.clear(field);
    await user.type(field, "RESET");
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    expect(runAction).toHaveBeenCalledWith({ action: "reset_library", confirmation: "RESET" });
  });
});
