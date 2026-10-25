import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessorySummary, DeviceSummary } from "../../api/types";
import HardwarePage from "../HardwarePage";

const useDeviceListMock = vi.fn();
const useAccessoryListMock = vi.fn();
let devices: Partial<DeviceSummary>[] = [];
let accessories: Partial<AccessorySummary>[] = [];

vi.mock("../../hooks/useDevice", () => ({
  useDeviceList: (filters: unknown) => {
    useDeviceListMock(filters);
    return { data: devices, isLoading: false };
  },
}));
vi.mock("../../hooks/useAccessories", () => ({
  useAccessoryList: (filters: unknown) => {
    useAccessoryListMock(filters);
    return { data: accessories, isLoading: false };
  },
}));
vi.mock("../../hooks/useHardwareLookups", () => ({
  useManufacturers: () => ({ data: [{ id: 1, name: "Sony" }, { id: 2, name: "Nintendo" }] }),
  useDeviceTypes: () => ({ data: [{ id: 10, name: "Console" }] }),
  useAccessoryTypes: () => ({ data: [{ id: 20, name: "Controller" }] }),
  useHardwarePlatforms: () => ({ data: [{ id: 30, name: "PlayStation" }] }),
}));

// Render every card plainly — virtualisation isn't what's under test here.
vi.mock("../VirtualGameGrid", () => ({
  default: <T,>({ items, getKey, renderItem }: { items: T[]; getKey: (item: T) => number; renderItem: (item: T) => ReactNode }) => (
    <div>
      {items.map((item) => (
        <div key={getKey(item)} data-testid="grid-item">
          {renderItem(item)}
        </div>
      ))}
    </div>
  ),
}));

// No usable localStorage in this test environment; the page keeps its view and card size there.
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => Array.from(items.keys())[index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

const device = (id: number, officialName: string): Partial<DeviceSummary> => ({
  id,
  uuid: `d${id}`,
  officialName,
  manufacturerName: "Sony",
  hardwarePlatformName: "PlayStation",
  imageUrl: null,
  owned: true,
  wishlisted: false,
  ownedQuantity: 1,
});

const accessory = (id: number, officialName: string, releaseDate: number | null): Partial<AccessorySummary> => ({
  id,
  uuid: `a${id}`,
  officialName,
  manufacturerName: "Sony",
  accessoryTypeName: "Controller",
  releaseDate,
  imageUrl: null,
  owned: true,
  wishlisted: false,
  ownedQuantity: 1,
});

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/hardware"]}>
      <HardwarePage />
    </MemoryRouter>
  );
  return userEvent.setup();
}

const sectionNames = (id: string) =>
  within(document.getElementById(id) as HTMLElement)
    .getAllByTestId("grid-item")
    .map((item) => within(item).getByRole("button").getAttribute("aria-label"));

describe("HardwarePage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.stubGlobal("localStorage", memoryStorage());
    useDeviceListMock.mockClear();
    useAccessoryListMock.mockClear();
    devices = [device(1, "PlayStation 5"), device(2, "PlayStation 4")];
    accessories = [accessory(1, "DualSense", 2020), accessory(2, "DualShock 4", 2013), accessory(3, "Access", 2010)];
  });
  afterEach(() => vi.unstubAllGlobals());

  it("has the toolbar actions, search beside the breadcrumbs and a section per kind with its count", () => {
    renderPage();

    const toolbar = screen.getByRole("toolbar");
    for (const name of ["Add Device", "Add Accessory", "Options", "View", "Sort", "Filter"]) {
      expect(within(toolbar).getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("textbox", { name: "Search" })).toBeInTheDocument();
    expect(within(document.getElementById("devices") as HTMLElement).getByText("2")).toBeInTheDocument();
    expect(within(document.getElementById("accessories") as HTMLElement).getByText("3")).toBeInTheDocument();
  });

  it("restores the session's status and filters, shows them as chips and sends them", () => {
    window.sessionStorage.setItem("vgt.view.hardware.status", JSON.stringify("owned"));
    window.sessionStorage.setItem("vgt.view.hardware.devices.manufacturerIds", JSON.stringify([1]));
    window.sessionStorage.setItem("vgt.view.hardware.accessories.typeIds", JSON.stringify([20]));
    renderPage();

    expect(screen.getByText("Owned")).toBeInTheDocument();
    expect(screen.getByText("Devices: Sony")).toBeInTheDocument();
    expect(screen.getByText("Accessories: Controller")).toBeInTheDocument();
    expect(useDeviceListMock).toHaveBeenLastCalledWith(expect.objectContaining({ manufacturerIds: [1], status: "owned" }));
    expect(useAccessoryListMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ accessoryTypeIds: [20], manufacturerIds: undefined, status: "owned" })
    );
  });

  it("removes a filter from its chip and forgets it", async () => {
    window.sessionStorage.setItem("vgt.view.hardware.devices.manufacturerIds", JSON.stringify([1, 2]));
    const user = renderPage();

    await user.click(screen.getByLabelText("Remove filter Devices: Sony"));

    expect(screen.queryByText("Devices: Sony")).not.toBeInTheDocument();
    expect(screen.getByText("Devices: Nintendo")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("vgt.view.hardware.devices.manufacturerIds")).toBe(JSON.stringify([2]));
  });

  it("sets the status from the Filter dialog and clears every filter", async () => {
    window.sessionStorage.setItem("vgt.view.hardware.accessories.platformIds", JSON.stringify([30]));
    const user = renderPage();

    await user.click(screen.getByRole("button", { name: "Filter" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Wishlist" }));
    expect(useDeviceListMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: "wishlist" }));

    await user.click(within(dialog).getByRole("button", { name: "Clear filters" }));
    expect(useDeviceListMock).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined }));
    expect(useAccessoryListMock).toHaveBeenLastCalledWith(expect.objectContaining({ hardwarePlatformIds: undefined }));
  });

  it("sorts accessories by release date, newest first, and keeps devices by name", async () => {
    const user = renderPage();
    expect(sectionNames("accessories")).toEqual(["Access", "DualSense", "DualShock 4"]);

    await user.click(screen.getByRole("button", { name: "Sort" }));
    await user.click(screen.getByRole("menuitem", { name: /Release date/ }));

    expect(sectionNames("accessories")).toEqual(["DualSense", "DualShock 4", "Access"]);
    expect(sectionNames("devices")).toEqual(["PlayStation 4", "PlayStation 5"]);
    expect(window.sessionStorage.getItem("vgt.view.hardware.sort")).toBe(JSON.stringify("releaseDate"));
  });

  it("switches to the Table view with a row per device", async () => {
    const user = renderPage();

    await user.click(screen.getByRole("button", { name: "View" }));
    await user.click(screen.getByRole("menuitem", { name: /Table/ }));

    expect(screen.getByRole("row", { name: "PlayStation 5" })).toBeInTheDocument();
    expect(screen.queryAllByTestId("grid-item")).toHaveLength(0);
  });
});
