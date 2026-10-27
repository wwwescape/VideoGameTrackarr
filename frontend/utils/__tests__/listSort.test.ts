import { describe, expect, it } from "vitest";
import { libraryRank, nextListSort, pickListSort, sortRows, type SortField } from "../listSort";

type Field = "name" | "count" | "store";
const fields: SortField<Field>[] = [
  { field: "name", label: "Name" },
  { field: "count", label: "Count", defaultDirection: "desc" },
  { field: "store", label: "Store" },
];
const rows = [
  { name: "Celeste", count: 3, store: "Steam" },
  { name: "balatro", count: null, store: null },
  { name: "Hades", count: 3, store: "GOG" },
  { name: "Astro Bot", count: 10, store: "" },
];
const values = {
  name: (row: (typeof rows)[number]) => row.name,
  count: (row: (typeof rows)[number]) => row.count,
  store: (row: (typeof rows)[number]) => row.store,
};
const names = (field: Field, direction: "asc" | "desc") =>
  sortRows(rows, { field, direction }, values, (row) => row.name).map((row) => row.name);

describe("sortRows", () => {
  it("orders text ignoring case and numbers by value", () => {
    expect(names("name", "asc")).toEqual(["Astro Bot", "balatro", "Celeste", "Hades"]);
    expect(names("count", "asc")).toEqual(["Celeste", "Hades", "Astro Bot", "balatro"]);
  });

  it("keeps empty values last in either direction and breaks ties by name", () => {
    expect(names("count", "desc")).toEqual(["Astro Bot", "Celeste", "Hades", "balatro"]);
    expect(names("store", "asc")).toEqual(["Hades", "Celeste", "Astro Bot", "balatro"]);
    expect(names("store", "desc")).toEqual(["Celeste", "Hades", "Astro Bot", "balatro"]);
  });
});

describe("picking a sort", () => {
  it("starts a new field in its default direction, from the menu or a header", () => {
    expect(pickListSort({ field: "name", direction: "asc" }, "count", fields)).toEqual({ field: "count", direction: "desc" });
    expect(nextListSort({ field: "name", direction: "desc" }, "store", fields)).toEqual({ field: "store", direction: "asc" });
  });

  it("flips the direction when the sorted header is clicked again, but not from the menu", () => {
    expect(nextListSort({ field: "count", direction: "desc" }, "count", fields)).toEqual({ field: "count", direction: "asc" });
    expect(pickListSort({ field: "count", direction: "asc" }, "count", fields)).toEqual({ field: "count", direction: "asc" });
  });
});

describe("libraryRank", () => {
  it("ranks owned and wishlisted, then owned, then wishlisted, and nothing for neither", () => {
    expect(libraryRank({ owned: true, wishlisted: true })).toBe(0);
    expect(libraryRank({ owned: true, wishlisted: false })).toBe(1);
    expect(libraryRank({ owned: false, wishlisted: true })).toBe(2);
    expect(libraryRank({ owned: false, wishlisted: false })).toBeNull();
  });
});
