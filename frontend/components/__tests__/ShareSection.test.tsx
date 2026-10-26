import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShareSection from "../ShareSection";

const api = vi.hoisted(() => ({
  getShareLink: vi.fn(),
  enableShareLink: vi.fn(),
  disableShareLink: vi.fn(),
  regenerateShareLink: vi.fn(),
}));
vi.mock("../../api/share", () => api);

const renderSection = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ShareSection />
    </QueryClientProvider>
  );

describe("ShareSection", () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
  });

  it("shows no links while sharing is off, and turns it on on request", async () => {
    api.getShareLink.mockResolvedValue(null);
    api.enableShareLink.mockResolvedValue("tok123");
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Turn on sharing" }));

    expect(api.enableShareLink).toHaveBeenCalled();
    expect(
      await screen.findByDisplayValue(`${window.location.origin}/public/tok123/games`)
    ).toBeInTheDocument();
  });

  it("turns sharing off after confirming", async () => {
    api.getShareLink.mockResolvedValue("tok123");
    api.disableShareLink.mockResolvedValue(undefined);
    renderSection();

    await userEvent.click(await screen.findByRole("button", { name: "Turn off sharing" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Turn off sharing" }));

    expect(api.disableShareLink).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Turn on sharing" })).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/tok123/)).not.toBeInTheDocument();
  });
});
