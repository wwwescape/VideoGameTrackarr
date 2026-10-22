import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GameListFilters } from "../api/games";
import {
  getPlatform,
  listLibraryPlatforms,
  listPlatformAddons,
  listPlatforms,
  setPlatformCaseSize,
  setPlatformSpineStyle,
  setPlatformSpineTemplate,
} from "../api/platforms";

export function usePlatforms() {
  return useQuery({ queryKey: ["platforms"], queryFn: listPlatforms });
}

// Keyed under ["games", ...] (unlike the plain platform list above): the counts change
// whenever a library copy is added, moved or removed, and every one of those mutations
// already invalidates ["games"] (see hooks/useGames.ts).
export function useLibraryPlatforms() {
  return useQuery({ queryKey: ["games", "platforms-library"], queryFn: listLibraryPlatforms });
}

export function usePlatform(slugOrId: string | undefined) {
  return useQuery({
    queryKey: ["platforms", "detail", slugOrId],
    queryFn: () => getPlatform(slugOrId!),
    enabled: !!slugOrId,
  });
}

// Only fetched while the Platform page's Include Addons toggle is on, like
// useCollectionAddons/useFranchiseAddons. Under ["games", ...] for the same reason as
// useLibraryPlatforms.
export function usePlatformAddons(slugOrId: string | undefined, filters: GameListFilters, enabled: boolean) {
  return useQuery({
    queryKey: ["games", "platform-addons", slugOrId, filters],
    queryFn: ({ signal }) => listPlatformAddons(slugOrId!, filters, signal),
    enabled: enabled && !!slugOrId,
  });
}

export function useSetPlatformSpineTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ platformId, spineUrl }: { platformId: number; spineUrl: string | null }) =>
      setPlatformSpineTemplate(platformId, spineUrl),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platforms"] }),
  });
}

export function useSetPlatformCaseSize() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      platformId,
      heightMm,
      spineMm,
    }: {
      platformId: number;
      heightMm: number | null;
      spineMm: number | null;
    }) => setPlatformCaseSize(platformId, heightMm, spineMm),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platforms"] }),
  });
}

export function useSetPlatformSpineStyle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      platformId,
      color,
      icon,
      iconUrl,
    }: {
      platformId: number;
      color: string | null;
      icon: string | null;
      iconUrl?: string | null;
    }) => setPlatformSpineStyle(platformId, color, icon, iconUrl ?? null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platforms"] }),
  });
}
