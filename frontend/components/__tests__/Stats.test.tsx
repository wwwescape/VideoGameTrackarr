import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BarList } from "../Stats";

const rows = (count: number) => Array.from({ length: count }, (_, i) => ({ label: `Row ${i + 1}`, value: 100 - i }));

describe("BarList", () => {
  it("says so when there's nothing to show", () => {
    render(<BarList rows={[]} empty="Nothing yet" otherLabel="Other" />);

    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
  });

  it("folds rows past the limit into one Other row with their total", () => {
    render(<BarList rows={rows(5)} empty="" limit={3} otherLabel="Other" />);

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Row 2")).toBeInTheDocument();
    expect(screen.queryByText("Row 3")).not.toBeInTheDocument();
    // 98 + 97 + 96
    expect(screen.getByTitle("Other: 291")).toBeInTheDocument();
  });

  it("opens a row that links somewhere, and leaves the rest plain", () => {
    const onClick = vi.fn();
    render(<BarList rows={[{ label: "PS5", value: 3, onClick }, { label: "Genre", value: 1 }]} empty="" otherLabel="Other" />);

    fireEvent.click(screen.getByRole("button", { name: /PS5/ }));
    expect(onClick).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Genre/ })).toBeNull();
  });
});
