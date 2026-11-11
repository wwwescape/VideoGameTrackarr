import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ScreensaverToggle from "../ScreensaverToggle";

const mutate = vi.fn();
vi.mock("../../hooks/useScreensaver", () => ({
  useSetScreensaverExcluded: () => ({ mutate }),
}));
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("react-toastify", () => ({ toast: { success: (...a: unknown[]) => toast.success(...a), error: (...a: unknown[]) => toast.error(...a) } }));

describe("ScreensaverToggle", () => {
  beforeEach(() => {
    mutate.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
  });

  it("offers to hide a game that's shown", async () => {
    render(<ScreensaverToggle gameId={5} excluded={false} />);
    const button = screen.getByRole("button", { name: "Hide from the screensaver" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(button);
    expect(mutate).toHaveBeenCalledWith(true, expect.anything());
    const [, callbacks] = mutate.mock.calls[0] as [boolean, { onSuccess: () => void; onError: () => void }];
    callbacks.onSuccess();
    expect(toast.success).toHaveBeenCalledWith("Hidden from the screensaver", expect.anything());
  });

  it("offers to show a hidden game again, and says when saving failed", async () => {
    render(<ScreensaverToggle gameId={5} excluded />);
    const button = screen.getByRole("button", { name: "Show in the screensaver" });
    expect(button).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(button);
    expect(mutate).toHaveBeenCalledWith(false, expect.anything());
    const [, callbacks] = mutate.mock.calls[0] as [boolean, { onSuccess: () => void; onError: () => void }];
    callbacks.onError();
    expect(toast.error).toHaveBeenCalledWith("Couldn't change that. Please try again.", expect.anything());
  });
});
