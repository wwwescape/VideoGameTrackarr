import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RestoreStatus } from "../../api/types";
import RestoreGuard from "../RestoreGuard";

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

let status: RestoreStatus = { status: "running", startedAt: null, finishedAt: null, result: null, error: null };
const runJob = vi.fn();
vi.mock("../../hooks/useImportExport", () => ({
  useRestoreStatus: () => ({ data: status }),
  useAcknowledgeRestoreStatus: () => ({ mutate: vi.fn() }),
}));
vi.mock("../../hooks/useJobs", () => ({ useRunJob: () => ({ mutateAsync: runJob, isPending: false }) }));

const renderGuard = () => {
  const client = new QueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <RestoreGuard />
    </QueryClientProvider>
  );
  return { ...view, client };
};

describe("RestoreGuard", () => {
  beforeEach(() => {
    runJob.mockReset().mockResolvedValue(undefined);
    status = { status: "running", startedAt: null, finishedAt: null, result: null, error: null };
  });

  it("says what came back when a restore finishes, and offers to resync", async () => {
    const user = userEvent.setup();
    const { rerender, client } = renderGuard();
    expect(screen.getByText("Have patience while restore is in progress.")).toBeInTheDocument();

    status = {
      ...status,
      status: "completed",
      result: {
        restoredGames: 12,
        restoredLibraryItems: 15,
        safetySnapshotPath: "/x.json",
        restoredDevices: 2,
        restoredAccessories: 3,
        restoredRoms: 4,
        restoredBiosFiles: 0,
        restoredImages: 5,
      },
    };
    rerender(
      <QueryClientProvider client={client}>
        <RestoreGuard />
      </QueryClientProvider>
    );

    const dialog = await screen.findByRole("dialog", { name: "Restore complete" });
    expect(dialog).toHaveTextContent("12 games, with 15 copies");
    expect(dialog).toHaveTextContent("2 devices and 3 accessories");
    expect(dialog).toHaveTextContent("4 ROMs, with their saves");
    expect(dialog).toHaveTextContent("5 images");
    expect(dialog).not.toHaveTextContent("BIOS");

    await user.click(screen.getByRole("button", { name: "Resync now" }));
    expect(runJob).toHaveBeenCalledWith("resync_all");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
