import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "react-toastify";
import type { TagCoverage } from "../../api/types";
import ManageTagsDialog from "../ManageTagsDialog";

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const getTagCoverage = vi.fn();
const createTag = vi.fn();
const attachTag = vi.fn();
const detachTag = vi.fn();

vi.mock("../../api/tags", () => ({
  getTagCoverage: (...args: unknown[]) => getTagCoverage(...args),
  createTag: (...args: unknown[]) => createTag(...args),
  attachTag: (...args: unknown[]) => attachTag(...args),
  detachTag: (...args: unknown[]) => detachTag(...args),
}));

const coverage: TagCoverage[] = [
  { id: 2, name: "Action", color: null, textColor: null, gameIds: [1, 2] },
  { id: 3, name: "Adventure", color: null, textColor: null, gameIds: [] },
  { id: 1, name: "Marvel", color: null, textColor: null, gameIds: [1] },
];

function renderDialog(gameIds: number[] = [1, 2]) {
  const queryClient = new QueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<ManageTagsDialog open gameIds={gameIds} onClose={vi.fn()} />, { wrapper: Wrapper });
}

describe("ManageTagsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTagCoverage.mockResolvedValue(coverage);
    attachTag.mockResolvedValue([]);
    detachTag.mockResolvedValue([]);
  });

  it("shows every tag with its coverage among the selected games", async () => {
    renderDialog();

    expect(await screen.findByText("Marvel")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 games")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 games")).toBeInTheDocument();
    expect(screen.getByText("0 of 2 games")).toBeInTheDocument();
  });

  it("computes the real union of games for the Remove tab, not a flat sum", async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText("Marvel");

    await user.click(screen.getByRole("tab", { name: "Remove tags" }));
    await user.click(screen.getByRole("checkbox", { name: /Marvel/ }));
    await user.click(screen.getByRole("checkbox", { name: /Action/ }));

    // Marvel covers game 1, Action covers games 1 and 2 — union is 2 games, not 1 + 2 = 3.
    expect(await screen.findByText("Remove from 2 games")).toBeInTheDocument();
  });

  it("keeps Add and Remove tab selections independent", async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText("Marvel");

    await user.click(screen.getByRole("checkbox", { name: /Marvel/ }));
    await user.click(screen.getByRole("tab", { name: "Remove tags" }));

    expect(screen.getByRole("checkbox", { name: /Marvel/ })).not.toBeChecked();
  });

  it("submits Add by attaching every checked tag to every selected game", async () => {
    const user = userEvent.setup();
    renderDialog([1, 2]);
    await screen.findByText("Marvel");

    await user.click(screen.getByRole("checkbox", { name: /Marvel/ }));
    await user.click(screen.getByRole("button", { name: "Add to 2 games" }));

    await waitFor(() => expect(attachTag).toHaveBeenCalledTimes(2));
    expect(attachTag).toHaveBeenCalledWith(1, 1);
    expect(attachTag).toHaveBeenCalledWith(2, 1);
    expect(toast.success).toHaveBeenCalledOnce();
  });
});
