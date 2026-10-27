import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePreferences } from "../api/auth";
import type { OverviewSectionSetting } from "../api/types";
import { currentUserQueryKey, useCurrentUser } from "./useAuth";

// Every Overview section, in the default order. Adding a section here is enough: a saved
// layout that doesn't mention it yet gets it in its default place (see resolveOverviewLayout).
export const OVERVIEW_SECTION_KEYS = [
  "stats",
  "quickAdd",
  "events",
  "onSale",
  "gamesCalendar",
  "hardwareCalendar",
  "nowPlaying",
  "recentlyPlayed",
  "recentlyAddedGames",
  "recentlyAddedHardware",
  "needsAttention",
] as const;

export type OverviewSectionKey = (typeof OVERVIEW_SECTION_KEYS)[number];

export interface OverviewSection {
  key: OverviewSectionKey;
  hidden: boolean;
}

export const DEFAULT_OVERVIEW_LAYOUT: OverviewSection[] = OVERVIEW_SECTION_KEYS.map((key) => ({
  key,
  hidden: false,
}));

const isSectionKey = (key: string): key is OverviewSectionKey =>
  (OVERVIEW_SECTION_KEYS as readonly string[]).includes(key);

// The saved layout made safe to render: unknown keys (from a newer version) and repeats are
// dropped, and sections it doesn't mention (added in a later version) go back in after the
// section that precedes them by default, so they show up where they'd normally be.
export function resolveOverviewLayout(
  saved: OverviewSectionSetting[] | null | undefined
): OverviewSection[] {
  if (!saved?.length) return DEFAULT_OVERVIEW_LAYOUT;
  const layout: OverviewSection[] = [];
  for (const entry of saved) {
    if (isSectionKey(entry.key) && !layout.some((section) => section.key === entry.key)) {
      layout.push({ key: entry.key, hidden: Boolean(entry.hidden) });
    }
  }
  OVERVIEW_SECTION_KEYS.forEach((key, defaultIndex) => {
    if (layout.some((section) => section.key === key)) return;
    const previous = OVERVIEW_SECTION_KEYS.slice(0, defaultIndex).reverse();
    const after = previous
      .map((prev) => layout.findIndex((section) => section.key === prev))
      .find((index) => index >= 0);
    layout.splice(after === undefined ? 0 : after + 1, 0, { key, hidden: false });
  });
  return layout;
}

// The Overview's section order and visibility, kept on the account (like the currency) so
// every browser shows the same page.
export function useOverviewLayout() {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const layout = useMemo(() => resolveOverviewLayout(user?.overviewLayout), [user?.overviewLayout]);
  const save = useMutation({
    mutationFn: (next: OverviewSection[]) => updatePreferences({ overviewLayout: next }),
    onSuccess: (updated) => queryClient.setQueryData(currentUserQueryKey, updated),
  });
  return { layout, save };
}
