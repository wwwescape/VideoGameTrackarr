import { describe, expect, it } from "vitest";
import { gamesFromCsv, parseCsv } from "../csv";

describe("parseCsv", () => {
  it("handles quoted cells, doubled quotes and Windows line ends", () => {
    expect(parseCsv('name,notes\r\n"Diablo IV","the ""good"" one"\r\nHades,\r\n')).toEqual([
      ["name", "notes"],
      ["Diablo IV", 'the "good" one'],
      ["Hades", ""],
    ]);
  });

  it("reads semicolon-separated files, as spreadsheets export them in many locales", () => {
    expect(parseCsv("name;igdb_id\nOverwatch 2;153577")).toEqual([
      ["name", "igdb_id"],
      ["Overwatch 2", "153577"],
    ]);
  });
});

describe("gamesFromCsv", () => {
  it("takes the name, IGDB id and own id columns from the header", () => {
    expect(gamesFromCsv("﻿Title,IGDB ID,id\nDiablo IV,125165,d4\nStarCraft II,,")).toEqual([
      { id: "d4", name: "Diablo IV", igdbId: 125165 },
      { id: "StarCraft II", name: "StarCraft II" },
    ]);
  });

  it("uses the first column as the name without a header, and skips empty rows", () => {
    expect(gamesFromCsv("Hearthstone\n\nThe Sims 4")).toEqual([
      { id: "Hearthstone", name: "Hearthstone" },
      { id: "The Sims 4", name: "The Sims 4" },
    ]);
  });
});
