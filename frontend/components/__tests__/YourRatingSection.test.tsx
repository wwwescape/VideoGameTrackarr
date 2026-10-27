import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import YourRatingSection from "../YourRatingSection";

const saveRating = vi.fn();
vi.mock("../../hooks/useGames", () => ({ useSetGameRating: () => ({ mutateAsync: saveRating }) }));
const toastError = vi.fn();
vi.mock("react-toastify", () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

describe("YourRatingSection", () => {
  beforeEach(() => {
    saveRating.mockReset().mockResolvedValue(undefined);
    toastError.mockReset();
  });

  it("shows ten stars and saves the one you click", () => {
    render(<YourRatingSection gameId={1} rating={null} />);

    expect(screen.getByRole("heading", { name: "Your Rating" })).toBeInTheDocument();
    expect(screen.getByText("Unrated")).toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: /^\d+ stars?$/ })).toHaveLength(10);
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();

    // MUI's Rating reads the star from the pointer position, which jsdom doesn't lay out, so
    // these pick the star's own radio input (as MUI's own tests do).
    fireEvent.click(screen.getByLabelText("8 stars"));

    expect(saveRating).toHaveBeenCalledWith(8);
    expect(screen.getByText("8/10")).toBeInTheDocument();
  });

  it("clears the rating", async () => {
    const user = userEvent.setup();
    render(<YourRatingSection gameId={1} rating={7} />);

    expect(screen.getByText("7/10")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(saveRating).toHaveBeenCalledWith(null);
    expect(screen.getByText("Unrated")).toBeInTheDocument();
  });

  it("goes back to the saved rating when saving fails", async () => {
    saveRating.mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<YourRatingSection gameId={1} rating={4} />);

    fireEvent.click(screen.getByLabelText("9 stars"));

    expect(await screen.findByText("4/10")).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith("Couldn't save your rating. Please try again.", expect.anything());
  });
});
