import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { listenForInstallPrompt } from "../../hooks/useInstallApp";
import InstallAppRow from "../InstallAppRow";

function installOffer(outcome: "accepted" | "dismissed") {
  const prompt = vi.fn(() => Promise.resolve());
  const event = Object.assign(new Event("beforeinstallprompt"), {
    prompt,
    userChoice: Promise.resolve({ outcome }),
  });
  return { event, prompt };
}

const standalone = (matches: boolean) => (query: string) => ({ matches: matches && query.includes("standalone") });

// The install state lives at module level, as the browser's offer arrives once at startup, so
// these run in order: the offer is used up in the fourth test and installed in the last.
describe("InstallAppRow", () => {
  beforeAll(() => listenForInstallPrompt());

  beforeEach(() => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("matchMedia", standalone(false));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("says it's installed when running in its own window", () => {
    vi.stubGlobal("matchMedia", standalone(true));
    render(<InstallAppRow />);
    expect(screen.getByText("You're using the installed app.")).toBeInTheDocument();
  });

  it("explains Add to Home Screen on an iPhone", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1"
    );
    render(<InstallAppRow />);
    expect(screen.getByText(/tap Share, then Add to Home Screen/)).toBeInTheDocument();
  });

  it("explains that plain http can't be installed", () => {
    vi.stubGlobal("isSecureContext", false);
    render(<InstallAppRow />);
    expect(screen.getByText(/only install apps opened over HTTPS/)).toBeInTheDocument();
  });

  it("offers Install once the browser can install the app, and prompts on click", async () => {
    render(<InstallAppRow />);
    expect(screen.getByText(/install icon in the address bar/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();

    const { event, prompt } = installOffer("dismissed");
    act(() => {
      window.dispatchEvent(event);
    });
    expect(screen.getByText(/opens in its own window/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Install" }));
    });
    expect(prompt).toHaveBeenCalledTimes(1);
    // An offer only prompts once; the browser's own install option is described instead.
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
    expect(screen.getByText(/install icon in the address bar/)).toBeInTheDocument();
  });

  it("says it's installed after the browser installs it", () => {
    render(<InstallAppRow />);
    act(() => {
      window.dispatchEvent(installOffer("accepted").event);
    });
    expect(screen.getByRole("button", { name: "Install" })).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(screen.getByText("You're using the installed app.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
  });
});
