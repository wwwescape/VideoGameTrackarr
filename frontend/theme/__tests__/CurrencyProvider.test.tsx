import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "../../api/types";
import { CurrencyProvider, useCurrency } from "../CurrencyProvider";

// No usable localStorage in this test environment, and the provider reads it as it loads.
vi.hoisted(() => {
  const items = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, String(value)),
      removeItem: (key: string) => void items.delete(key),
      clear: () => items.clear(),
    },
  });
});

let user: CurrentUser | undefined;
let signedIn = true;
const updatePreferences = vi.fn(async ({ currency }: { currency: string }) => ({ ...user!, currency }));

vi.mock("../../hooks/useAuth", () => ({
  currentUserQueryKey: ["auth", "me"],
  useCurrentUser: () => ({ data: user }),
}));
vi.mock("../../api/auth", () => ({
  isAuthenticated: () => signedIn,
  updatePreferences: (prefs: { currency: string }) => updatePreferences(prefs),
}));

let setCurrency: (currency: string) => void = () => {};
const Show = () => {
  const value = useCurrency();
  setCurrency = value.setCurrency;
  return <div data-testid="currency">{value.currency}</div>;
};

function renderProvider() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CurrencyProvider>
        <Show />
      </CurrencyProvider>
    </QueryClientProvider>
  );
}

describe("CurrencyProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    updatePreferences.mockClear();
    signedIn = true;
  });

  it("uses the account's currency over this browser's", () => {
    localStorage.setItem("vgt.currency", "GBP");
    user = { id: 1, username: "admin", currency: "EUR" };
    renderProvider();

    expect(screen.getByTestId("currency")).toHaveTextContent("EUR");
    expect(localStorage.getItem("vgt.currency")).toBe("EUR");
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it("saves this browser's choice to an account that has none yet", async () => {
    localStorage.setItem("vgt.currency", "GBP");
    user = { id: 1, username: "admin", currency: null };
    renderProvider();

    await waitFor(() => expect(updatePreferences).toHaveBeenCalledWith({ currency: "GBP" }));
    expect(screen.getByTestId("currency")).toHaveTextContent("GBP");
  });

  it("saves a new choice to the account", async () => {
    user = { id: 1, username: "admin", currency: "USD" };
    renderProvider();

    act(() => setCurrency("JPY"));

    expect(screen.getByTestId("currency")).toHaveTextContent("JPY");
    await waitFor(() => expect(updatePreferences).toHaveBeenCalledWith({ currency: "JPY" }));
  });

  it("only keeps the choice in this browser when signed out", () => {
    user = undefined;
    signedIn = false;
    renderProvider();

    act(() => setCurrency("JPY"));

    expect(localStorage.getItem("vgt.currency")).toBe("JPY");
    expect(updatePreferences).not.toHaveBeenCalled();
  });
});
