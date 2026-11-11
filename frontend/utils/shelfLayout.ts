import type { ShelfCaseEntry, ShelfPlatform } from "../api/types";
import { caseSizeToPixels, type PixelSize } from "./caseSpine";

// How the Game Shelf lays out its cases: one continuous run in the requested sort (platforms
// mixed, like a real shelf), each case sized from its platform's case at the chosen scale,
// then packed greedily into rows as wide as the shelf. Pure, so it's unit-tested apart from the
// page.

export const SHELF_GAP = 3;

export interface ShelfItem<C extends ShelfCaseEntry = ShelfCaseEntry> {
  key: string;
  case: C;
  platform: ShelfPlatform;
  width: number;
  height: number;
}

export interface ShelfRow<C extends ShelfCaseEntry = ShelfCaseEntry> {
  key: string;
  items: ShelfItem<C>[];
  // The tallest case's height, which the row's board sits under.
  height: number;
}

export function platformCaseSize(platform: ShelfPlatform, scale: number): PixelSize {
  return caseSizeToPixels(platform.case.heightMm, platform.case.spineMm, scale);
}

// The shelf's cases in the requested order; a case whose platform isn't in the payload is
// skipped.
export function buildShelfItems<C extends ShelfCaseEntry>(
  cases: C[],
  platforms: ShelfPlatform[],
  scale: number
): ShelfItem<C>[] {
  const platformsById = new Map(platforms.map((platform) => [platform.id, platform]));
  const sizes = new Map(
    platforms.map((platform) => [platform.id, platformCaseSize(platform, scale)])
  );
  return cases.flatMap((shelfCase) => {
    const platform = platformsById.get(shelfCase.platformId);
    if (!platform) return [];
    return [
      {
        key: `${shelfCase.gameId}:${shelfCase.platformId}`,
        case: shelfCase,
        platform,
        ...sizes.get(platform.id)!,
      },
    ];
  });
}

// Greedy rows no wider than maxWidth. A case wider than the shelf gets a row of its own.
export function packRows<C extends ShelfCaseEntry>(
  items: ShelfItem<C>[],
  maxWidth: number,
  gap = SHELF_GAP
): ShelfRow<C>[] {
  const rows: ShelfRow<C>[] = [];
  let current: ShelfItem<C>[] = [];
  let width = 0;
  const flush = () => {
    if (!current.length) return;
    rows.push({
      key: current[0].key,
      items: current,
      height: Math.max(...current.map((item) => item.height)),
    });
    current = [];
    width = 0;
  };
  for (const item of items) {
    if (current.length && width + gap + item.width > maxWidth) flush();
    width += (current.length ? gap : 0) + item.width;
    current.push(item);
  }
  flush();
  return rows;
}
