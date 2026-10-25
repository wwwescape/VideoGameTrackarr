import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Settings from "../Settings";

// No usable localStorage in this test environment, and the theme providers read it when they
// load, so a small in-memory one goes in before anything imports them.
vi.hoisted(() => {
  const items = new Map<string, string>();
  const storage = {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key: string) => items.get(key) ?? null,
    key: (index: number) => Array.from(items.keys())[index] ?? null,
    removeItem: (key: string) => void items.delete(key),
    setItem: (key: string, value: string) => void items.set(key, String(value)),
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
});

const toggleColorMode = vi.fn();
const toggleContrast = vi.fn();
const logout = vi.fn();

vi.mock("../../hooks/useAuth", () => ({
  useCurrentUser: () => ({ data: { username: "admin" } }),
  useLogout: () => ({ mutate: logout }),
}));
vi.mock("../../theme/ColorModeProvider", () => ({
  useColorMode: () => ({
    mode: "dark",
    contrast: "normal",
    toggleColorMode,
    toggleContrast,
    accentColor: "#7c4dff",
    setAccentColor: vi.fn(),
    resetAccentColor: vi.fn(),
  }),
}));
// Their own tests cover them; here they only need to sit in their rows.
vi.mock("../DataManagementSection", () => ({ default: () => <div>Backup panel</div> }));
vi.mock("../ShareSection", () => ({ default: () => <div>Share panel</div> }));

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/settings"]}>
      <Settings />
    </MemoryRouter>
  );
  return userEvent.setup();
}

const group = (title: string) => screen.getByRole("heading", { name: title }).closest("section") as HTMLElement;

describe("Settings → General", () => {
  it("lays the settings out as groups of rows", () => {
    renderPage();

    for (const title of ["Display", "Regional", "Data", "Share", "Account"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(within(group("Regional")).getByRole("combobox", { name: "Language" })).toBeInTheDocument();
    expect(within(group("Regional")).getByRole("combobox", { name: "Currency" })).toBeInTheDocument();
    expect(within(group("Data")).getByText("Backup panel")).toBeInTheDocument();
    expect(within(group("Share")).getByText("Share panel")).toBeInTheDocument();
  });

  it("toggles dark mode and high contrast from their rows", async () => {
    const user = renderPage();

    const dark = within(group("Display")).getByRole("switch", { name: "Dark mode" });
    expect(dark).toBeChecked();
    await user.click(dark);
    await user.click(within(group("Display")).getByRole("switch", { name: "High contrast" }));

    expect(toggleColorMode).toHaveBeenCalled();
    expect(toggleContrast).toHaveBeenCalled();
  });

  it("shows the accent colours once, with the row naming them", () => {
    renderPage();

    expect(within(group("Display")).getAllByText("Accent color")).toHaveLength(2);
    expect(within(group("Display")).getByRole("group", { name: "Accent color" })).toBeInTheDocument();
  });

  it("logs out from Account", async () => {
    const user = renderPage();

    expect(within(group("Account")).getByText("admin")).toBeInTheDocument();
    await user.click(within(group("Account")).getByRole("button", { name: "Log out" }));
    expect(logout).toHaveBeenCalled();
  });
});
