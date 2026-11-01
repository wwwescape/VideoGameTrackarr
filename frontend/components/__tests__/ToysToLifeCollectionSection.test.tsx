import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToysToLifeCopy } from "../../api/types";
import ToysToLifeCollectionSection from "../ToysToLifeCollectionSection";

const createCopy = vi.fn();
const updateCopy = vi.fn();
vi.mock("../../hooks/useToysToLife", () => ({
  useCreateToysToLifeCopy: () => ({ mutateAsync: createCopy, isPending: false }),
  useUpdateToysToLifeCopy: () => ({ mutateAsync: updateCopy, isPending: false }),
  useDeleteToysToLifeCopy: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("react-toastify", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }) }));

const COPIES: ToysToLifeCopy[] = [
  { id: 2, status: "wishlist", price: null, notes: null },
  { id: 1, status: "owned", price: 14.99, notes: "Sealed" },
];

describe("ToysToLifeCollectionSection", () => {
  beforeEach(() => {
    createCopy.mockReset().mockResolvedValue({});
    updateCopy.mockReset().mockResolvedValue({});
  });

  it("lists owned copies first, each with its chip, price and notes", () => {
    render(<ToysToLifeCollectionSection itemId={8} copies={COPIES} />);

    expect(screen.getByRole("heading", { name: "Your Collection" })).toBeInTheDocument();
    const rows = screen.getAllByRole("button", { name: /^(Owned|Wishlist) · / });
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([expect.stringMatching(/^Owned · .*14\.99/), "Wishlist · No price"]);
    expect(within(rows[0]).getByText("Sealed")).toBeInTheDocument();
  });

  it("adds a copy with a price and notes", async () => {
    const user = userEvent.setup();
    render(<ToysToLifeCollectionSection itemId={8} copies={[]} />);

    expect(screen.getByText("Not in your collection or wishlist yet.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add Pack" }));
    await user.click(screen.getByRole("menuitem", { name: "To your wishlist" }));
    const dialog = screen.getByRole("dialog", { name: "Add to your wishlist" });
    await user.type(within(dialog).getByLabelText("Price"), "9.5");
    await user.type(within(dialog).getByLabelText("Notes"), "  Boxed  ");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));

    expect(createCopy).toHaveBeenCalledWith({ status: "wishlist", price: 9.5, notes: "Boxed" });
  });

  it("moves a copy between the collection and the wishlist", async () => {
    const user = userEvent.setup();
    render(<ToysToLifeCollectionSection itemId={8} copies={COPIES} />);

    await user.click(screen.getByRole("button", { name: "Move to wishlist" }));
    expect(updateCopy).toHaveBeenCalledWith({ copyId: 1, input: { status: "wishlist" } });
    await user.click(screen.getByRole("button", { name: "Move to collection" }));
    expect(updateCopy).toHaveBeenCalledWith({ copyId: 2, input: { status: "owned" } });
  });
});
