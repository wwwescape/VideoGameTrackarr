import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SaveStatePickerDialog from "../SaveStatePickerDialog";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

const listSaveStates = vi.fn();
const deleteSaveState = vi.fn();
vi.mock("../../api/library", () => ({
  listSaveStates: (...args: unknown[]) => listSaveStates(...args),
  deleteSaveState: (...args: unknown[]) => deleteSaveState(...args),
  saveStateScreenshotPath: (romId: number, stateId: number) =>
    `/api/roms/${romId}/states/${stateId}/screenshot`,
}));

const blobGet = vi.fn();
vi.mock("../../api/client", () => ({
  apiClient: { get: (...args: unknown[]) => blobGet(...args) },
}));

const states = [
  { id: 2, createdAt: "2026-09-27T12:00:00Z", sizeBytes: 4096, hasScreenshot: true },
  { id: 1, createdAt: "2026-09-26T08:30:00Z", sizeBytes: 2048, hasScreenshot: false },
];

function renderPicker(onLoad = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SaveStatePickerDialog
        open
        romId={7}
        title="Load a save state"
        loadLabel="Load"
        onLoad={onLoad}
        onClose={vi.fn()}
      />
    </QueryClientProvider>
  );
  return onLoad;
}

describe("SaveStatePickerDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSaveStates.mockResolvedValue(states);
    deleteSaveState.mockResolvedValue(undefined);
    blobGet.mockResolvedValue({ data: new Blob(["png"], { type: "image/png" }) });
    URL.createObjectURL = vi.fn(() => "blob:shot");
    URL.revokeObjectURL = vi.fn();
  });

  it("lists states newest first with their screenshot, and loads the picked one", async () => {
    const user = userEvent.setup();
    const onLoad = renderPicker();

    const loadButtons = await screen.findAllByRole("button", { name: /^Load / });
    expect(loadButtons).toHaveLength(2);
    expect(await screen.findByAltText("Save state screenshot")).toHaveAttribute("src", "blob:shot");
    expect(blobGet).toHaveBeenCalledWith("/api/roms/7/states/2/screenshot", {
      responseType: "blob",
    });
    expect(screen.getByText("4.0 KB")).toBeInTheDocument();

    await user.click(loadButtons[0]);
    expect(onLoad).toHaveBeenCalledWith(states[0]);
  });

  it("deletes a state only after confirmation", async () => {
    const user = userEvent.setup();
    renderPicker();

    const deleteButtons = await screen.findAllByRole("button", { name: /^Delete save state from/ });
    await user.click(deleteButtons[1]);
    expect(deleteSaveState).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteSaveState).toHaveBeenCalledWith(7, 1));
  });
});
