import type { TFunction } from "i18next";
import legoDimensionsLogo from "../assets/toys-to-life/lego-dimensions.png";
import type { ToysToLifeItemSummary, ToysToLifeParentGame } from "../api/types";
import { gameIdentifier, slugify } from "./identifiers";

// Each line's full-color logo, for its card on the Toys to Life page.
export const LINE_LOGOS: Record<string, string> = {
  "lego-dimensions": legoDimensionsLogo,
};

// A pack's address: its set number, then its name for a readable link ("71203-portal-2-level-pack").
// The backend looks a pack up by set number alone, so only the part before the first dash counts.
export function toyIdentifier(item: Pick<ToysToLifeItemSummary, "setNumber" | "name">): string {
  return `${item.setNumber}-${slugify(item.name)}`;
}

export function setNumberFromIdentifier(identifier: string | undefined): string | undefined {
  return identifier?.split("-")[0] || undefined;
}

export function toyPath(item: Pick<ToysToLifeItemSummary, "line" | "setNumber" | "name">): string {
  return `/toys-to-life/${item.line}/${toyIdentifier(item)}`;
}

// The line's game: its page when it's in your library, otherwise IGDB's preview of it.
export function parentGamePath(parent: ToysToLifeParentGame): string {
  return parent.slug !== null || parent.uuid !== null
    ? `/game/${gameIdentifier({ slug: parent.slug, uuid: parent.uuid ?? "", name: parent.name })}`
    : `/games/add/igdb/${parent.igdbId}`;
}

// Pack types are the CSV's English names; the known ones are translated.
const PACK_TYPE_KEYS: Record<string, string> = {
  "Starter Pack": "toysToLife.packTypes.starterPack",
  "Level Pack": "toysToLife.packTypes.levelPack",
  "Team Pack": "toysToLife.packTypes.teamPack",
  "Fun Pack": "toysToLife.packTypes.funPack",
  "Story Pack": "toysToLife.packTypes.storyPack",
  "Polybag / Promo": "toysToLife.packTypes.polybag",
};

// The order pack types are offered in, biggest boxes first.
export const PACK_TYPE_ORDER = Object.keys(PACK_TYPE_KEYS);

export function packTypeLabel(packType: string, t: TFunction): string {
  const key = PACK_TYPE_KEYS[packType];
  return key ? t(key) : packType;
}

// "Owned", "Wishlisted", both ("Owned · Wishlisted"), or "Not owned".
export function statusLabel(item: Pick<ToysToLifeItemSummary, "owned" | "wishlisted">, t: TFunction): string {
  const parts = [item.owned ? t("toysToLife.statusOwned") : null, item.wishlisted ? t("toysToLife.statusWishlist") : null];
  return parts.filter(Boolean).join(" · ") || t("toysToLife.statusNotOwned");
}
