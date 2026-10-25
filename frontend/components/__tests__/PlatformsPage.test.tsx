import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryPlatform } from "../../api/types";
import { createLogoLookup } from "../../utils/platformLogos";
import PlatformsPage from "../PlatformsPage";

let platforms: LibraryPlatform[] = [];
vi.mock("../../hooks/usePlatforms", () => ({
  useLibraryPlatforms: () => ({ data: platforms, isLoading: false }),
}));

// Pretend only ps5.png has been dropped into assets/platforms/.
vi.mock("../../utils/platformLogos", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/platformLogos")>();
  return {
    ...actual,
    platformLogoUrl: actual.createLogoLookup({ "../assets/platforms/ps5.png": "/assets/ps5.png" }),
  };
});

// Render every card plainly — virtualisation isn't what's under test here.
vi.mock("../VirtualGameGrid", () => ({
  default: <T,>({
    items,
    getKey,
    renderItem,
  }: {
    items: T[];
    getKey: (item: T) => number;
    renderItem: (item: T) => ReactNode;
  }) => (
    <div>
      {items.map((item) => (
        <div key={getKey(item)} data-testid="grid-item">
          {renderItem(item)}
        </div>
      ))}
    </div>
  ),
}));

function platform(id: number, name: string, slug: string | null, owned: number, wishlisted = 0): LibraryPlatform {
  return {
    id,
    name,
    slug,
    abbreviation: slug ? slug.toUpperCase() : null,
    format: null,
    storefront: null,
    ownedCount: owned,
    wishlistedCount: wishlisted,
  };
}

const PlatformParam = () => {
  const { platformSlug } = useParams();
  const { search } = useLocation();
  return <div>{`Platform page ${platformSlug}${search ? ` ${search}` : ""}`}</div>;
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/games/platforms"]}>
      <Routes>
        <Route path="/games/platforms" element={<PlatformsPage />} />
        <Route path="/games/platforms/:platformSlug" element={<PlatformParam />} />
      </Routes>
    </MemoryRouter>
  );
}

const cardNames = () => screen.getAllByTestId("grid-item").map((item) => within(item).getByTitle(/./).textContent);

describe("PlatformsPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    platforms = [
      platform(1, "PlayStation 5", "ps5", 2, 1),
      platform(2, "Nintendo Switch", "switch", 5),
      platform(3, "Atari Jaguar", null, 1),
    ];
  });

  it("shows the logo when there is one, and the abbreviation otherwise", () => {
    renderPage();

    const ps5Card = screen.getByTitle("PlayStation 5").closest("[data-testid=grid-item]") as HTMLElement;
    expect(ps5Card.querySelector("img")).toHaveAttribute("src", "/assets/ps5.png");
    const switchCard = screen.getByTitle("Nintendo Switch").closest("[data-testid=grid-item]") as HTMLElement;
    expect(switchCard.querySelector("img")).toBeNull();
    expect(within(switchCard).getByText("SWITCH")).toBeInTheDocument();
  });

  it("shows owned and wishlisted counts", () => {
    renderPage();

    const ps5Card = screen.getByTitle("PlayStation 5").closest("[data-testid=grid-item]") as HTMLElement;
    expect(within(ps5Card).getByText("2 owned")).toBeInTheDocument();
    expect(within(ps5Card).getByText("1 wishlisted")).toBeInTheDocument();
    const switchCard = screen.getByTitle("Nintendo Switch").closest("[data-testid=grid-item]") as HTMLElement;
    expect(within(switchCard).getByText("5 owned")).toBeInTheDocument();
    expect(within(switchCard).getByText("0 wishlisted")).toBeInTheDocument();
  });

  it("sorts by name by default", () => {
    renderPage();

    expect(cardNames()).toEqual(["Atari Jaguar", "Nintendo Switch", "PlayStation 5"]);
  });

  it("sorts by most games (owned plus wishlisted)", () => {
    window.sessionStorage.setItem("vgt.view.platforms.sort", JSON.stringify("count_desc"));
    renderPage();

    expect(cardNames()).toEqual(["Nintendo Switch", "PlayStation 5", "Atari Jaguar"]);
  });

  it("filters by search", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Search platforms"), { target: { value: "play" } });

    expect(cardNames()).toEqual(["PlayStation 5"]);
  });

  it("links by id for a platform without a slug", () => {
    renderPage();

    fireEvent.click(screen.getByTitle("Atari Jaguar"));

    expect(screen.getByText("Platform page 3")).toBeInTheDocument();
  });

  it("links by slug", () => {
    renderPage();

    fireEvent.click(screen.getByTitle("PlayStation 5"));

    expect(screen.getByText("Platform page ps5")).toBeInTheDocument();
  });
});

describe("PlatformsPage PC storefront cards", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    const pc = { id: 9, name: "PC (Microsoft Windows)", slug: "win", abbreviation: "PC", wishlistedCount: 0 };
    platforms = [
      { ...pc, format: "digital", storefront: "Steam", ownedCount: 12 },
      { ...pc, format: "digital", storefront: "itch.io", ownedCount: 2 },
      { ...pc, format: "physical", storefront: null, ownedCount: 3 },
    ];
  });

  it("names each card after its storefront or format", () => {
    renderPage();

    expect(cardNames()).toEqual(["PC · itch.io", "PC · Physical", "PC · Steam"]);
  });

  it("shows a known storefront's logo, and the storefront's name otherwise", () => {
    renderPage();

    const steamCard = screen.getByTitle("PC · Steam").closest("[data-testid=grid-item]") as HTMLElement;
    expect(steamCard.querySelector("img")).not.toBeNull();
    const itchCard = screen.getByTitle("PC · itch.io").closest("[data-testid=grid-item]") as HTMLElement;
    expect(itchCard.querySelector("img")).toBeNull();
    expect(within(itchCard).getByText("itch.io")).toBeInTheDocument();
  });

  it("links to the platform page scoped to that storefront", () => {
    renderPage();

    fireEvent.click(screen.getByTitle("PC · Steam"));

    expect(screen.getByText("Platform page win ?format=digital&storefront=Steam")).toBeInTheDocument();
  });
});

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

describe("PlatformsPage toolbar", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.stubGlobal("localStorage", memoryStorage());
    platforms = [platform(1, "PlayStation 5", "ps5", 2, 1), platform(2, "Nintendo Switch", "switch", 5)];
  });
  afterEach(() => vi.unstubAllGlobals());

  it("has Options, View and Sort, search beside the breadcrumbs and a count", () => {
    renderPage();

    const toolbar = screen.getByRole("toolbar");
    for (const name of ["Options", "View", "Sort"]) {
      expect(within(toolbar).getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("textbox", { name: "Search platforms" })).toBeInTheDocument();
    expect(screen.getByText("2 platforms")).toBeInTheDocument();
  });

  it("switches to the Table view with owned and wishlisted counts, and remembers it", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "View" }));
    await user.click(screen.getByRole("menuitem", { name: /Table/ }));

    const row = screen.getByRole("row", { name: "PlayStation 5" });
    expect(within(row).getByText("2")).toBeInTheDocument();
    expect(within(row).getByText("1")).toBeInTheDocument();
    expect(screen.queryAllByTestId("grid-item")).toHaveLength(0);
    expect(localStorage.getItem("vgt.pref.platforms.view")).toBe(JSON.stringify("table"));

    await user.click(row);
    expect(screen.getByText("Platform page ps5")).toBeInTheDocument();
  });

  it("sorts from the Sort menu and remembers it for the session", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Sort" }));
    await user.click(screen.getByRole("menuitem", { name: /Most games/ }));

    expect(cardNames()).toEqual(["Nintendo Switch", "PlayStation 5"]);
    expect(window.sessionStorage.getItem("vgt.view.platforms.sort")).toBe(JSON.stringify("count_desc"));
  });
});

describe("createLogoLookup", () => {
  const lookup = createLogoLookup({
    "../assets/platforms/ps4.png": "/a/ps4.png",
    "../assets/platforms/Switch.svg": "/a/switch.svg",
  });

  it("matches by slug, ignoring IGDB's --N suffix and case", () => {
    expect(lookup("ps4")).toBe("/a/ps4.png");
    expect(lookup("ps4--1")).toBe("/a/ps4.png");
    expect(lookup("switch")).toBe("/a/switch.svg");
  });

  it("returns nothing for a missing logo or slug", () => {
    expect(lookup("ps5")).toBeUndefined();
    expect(lookup(null)).toBeUndefined();
  });
});
