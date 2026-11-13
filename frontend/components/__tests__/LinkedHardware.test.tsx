import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { LinkedHardware as LinkedHardwareItem } from "../../api/types";
import { LinkedHardware } from "../HardwareDetailParts";

const item = (overrides: Partial<LinkedHardwareItem>): LinkedHardwareItem => ({
  id: 1,
  uuid: "11111111-1111-1111-1111-111111111111",
  officialName: "Sony DualSense Wireless Controller",
  manufacturerName: "Sony",
  detail: "Controller",
  imageUrl: null,
  isCustom: false,
  owned: true,
  wishlisted: false,
  ...overrides,
});

function renderLinked(items: LinkedHardwareItem[], kind: "device" | "accessory" = "accessory") {
  const router = createMemoryRouter(
    [
      { path: "/", element: <LinkedHardware items={items} kind={kind} emptyText="Nothing linked yet." /> },
      { path: "/hardware/:kind/:identifier", element: <div>Opened</div> },
    ],
    { initialEntries: ["/"] }
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("LinkedHardware", () => {
  it("shows each linked item as a card, like the Hardware page", () => {
    renderLinked([
      item({}),
      item({ id: 2, uuid: "22222222-2222-2222-2222-222222222222", officialName: "Charging Station", detail: null, isCustom: true }),
    ]);

    expect(screen.getByText("Sony DualSense Wireless Controller")).toBeInTheDocument();
    expect(screen.getByText("Sony · Controller")).toBeInTheDocument();
    expect(screen.getByText("Charging Station")).toBeInTheDocument();
    // No detail: just the manufacturer.
    expect(screen.getAllByText("Sony")).toHaveLength(1);
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("opens the linked item's page", async () => {
    const router = renderLinked([item({ officialName: "Test Console" })], "device");

    await userEvent.click(screen.getByText("Test Console"));

    expect(router.state.location.pathname).toBe("/hardware/device/test-console-11111111-1111-1111-1111-111111111111");
  });

  it("says when nothing is linked", () => {
    renderLinked([]);
    expect(screen.getByText("Nothing linked yet.")).toBeInTheDocument();
  });
});
