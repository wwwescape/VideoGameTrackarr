import type { OwnershipStatus } from "../components/GameListToolbar";

// The Ownership filter is the one filter applied client-side (owned/wishlisted already
// arrive on every GameSummary), so its Any/All and Exclude rules live here rather than in
// game_repository._apply_optional_game_filters. Same semantics as the server-side filters:
// "all" needs every selected status, and Exclude negates whichever of the two was chosen.
export function matchesOwnership(
  item: { owned: boolean; wishlisted: boolean },
  statuses: OwnershipStatus[],
  exclude: boolean,
  matchAll: boolean | undefined
): boolean {
  if (statuses.length === 0) return true;
  const has = (status: OwnershipStatus) => (status === "owned" ? item.owned : item.wishlisted);
  const matches = matchAll ? statuses.every(has) : statuses.some(has);
  return exclude ? !matches : matches;
}
