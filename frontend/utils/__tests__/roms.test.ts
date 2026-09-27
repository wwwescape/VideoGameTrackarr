import { describe, expect, it } from "vitest";
import type { LibraryItem } from "../../api/types";
import { canHoldRom, fileExtension, formatFileSize, hasPlayableRom } from "../roms";

describe("roms utils", () => {
  it("only lets owned ROM/Abandonware/ISO copies hold a ROM", () => {
    expect(canHoldRom("owned", "rom")).toBe(true);
    expect(canHoldRom("owned", "abandonware")).toBe(true);
    expect(canHoldRom("owned", "iso")).toBe(true);
    expect(canHoldRom("owned", "physical")).toBe(false);
    expect(canHoldRom("owned", undefined)).toBe(false);
    expect(canHoldRom("wishlist", "rom")).toBe(false);
  });

  it("extracts lowercase file extensions", () => {
    expect(fileExtension("Game (USA).NES")).toBe("nes");
    expect(fileExtension("archive.tar.zip")).toBe("zip");
    expect(fileExtension("noext")).toBe("");
  });

  it("formats file sizes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(40976)).toBe("40.0 KB");
    expect(formatFileSize(3 * 1024 * 1024)).toBe("3.0 MB");
  });

  it("detects a playable ROM on an owned copy only", () => {
    const withRom = (status: LibraryItem["status"], playable: boolean) =>
      ({ status, rom: { playable } }) as unknown as LibraryItem;
    expect(hasPlayableRom(undefined)).toBe(false);
    expect(hasPlayableRom([withRom("owned", false)])).toBe(false);
    expect(hasPlayableRom([withRom("wishlist", true)])).toBe(false);
    expect(hasPlayableRom([withRom("owned", false), withRom("owned", true)])).toBe(true);
  });
});
