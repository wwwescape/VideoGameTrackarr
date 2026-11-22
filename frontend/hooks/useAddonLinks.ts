import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addAddonLinks,
  getBaseGameAddons,
  getRemovalPreview,
  linkBaseGameAddons,
  listAddonLinkCandidates,
  listAllAddonLinks,
  listWorksWith,
  removeAddonLink,
} from "../api/addonLinks";

// Under ["games", id, ...] like useAddons, so anything that refreshes a game refreshes these.
export function useWorksWith(gameId: number, enabled = true) {
  return useQuery({
    queryKey: ["games", gameId, "works-with"],
    queryFn: () => listWorksWith(gameId),
    enabled: enabled && Number.isFinite(gameId),
  });
}

export function useAddonLinkCandidates(gameId: number, search: string, enabled: boolean) {
  return useQuery({
    queryKey: ["games", gameId, "addon-link-candidates", search],
    queryFn: () => listAddonLinkCandidates(gameId, search || undefined),
    enabled: enabled && Number.isFinite(gameId),
    // Typing in the picker's search keeps the last list up instead of flashing empty.
    placeholderData: keepPreviousData,
  });
}

// An edition's base-game add-ons, read live from IGDB (cached briefly on the server too). No
// retries: when IGDB isn't set up (503) the picker group and the hint just stay away.
export function useBaseGameAddons(gameId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["games", gameId, "base-game-addons"],
    queryFn: () => getBaseGameAddons(gameId),
    enabled: enabled && Number.isFinite(gameId),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useRemovalPreview(gameId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["games", gameId, "removal-preview"],
    queryFn: () => getRemovalPreview(gameId),
    enabled: enabled && Number.isFinite(gameId),
    staleTime: 0,
  });
}

// A link shows on both sides (the add-on's Works with, the game's Add-ons), in the Games list's
// Include add-ons matches and on Settings → Linked Add-ons, so all of those refresh.
function useInvalidateGames() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["games"] }),
      queryClient.invalidateQueries({ queryKey: ["addon-links"] }),
    ]);
}

// Settings → Linked Add-ons.
export function useAllAddonLinks() {
  return useQuery({ queryKey: ["addon-links"], queryFn: listAllAddonLinks });
}

// Unlinking from Settings, where each row names both sides.
export function useRemoveAddonLinkPair() {
  const invalidate = useInvalidateGames();
  return useMutation({
    mutationFn: ({ addonId, gameId }: { addonId: number; gameId: number }) => removeAddonLink(addonId, gameId),
    onSuccess: invalidate,
  });
}

export function useAddAddonLinks(gameId: number) {
  const invalidate = useInvalidateGames();
  return useMutation({
    mutationFn: (ids: number[]) => addAddonLinks(gameId, ids),
    onSuccess: invalidate,
  });
}

export function useRemoveAddonLink(gameId: number) {
  const invalidate = useInvalidateGames();
  return useMutation({
    mutationFn: (otherId: number) => removeAddonLink(gameId, otherId),
    onSuccess: invalidate,
  });
}

// Imports the picked base-game add-ons that aren't in VGT yet and links them all.
export function useLinkBaseGameAddons(gameId: number) {
  const invalidate = useInvalidateGames();
  return useMutation({
    mutationFn: (igdbIds: number[]) => linkBaseGameAddons(gameId, igdbIds),
    onSuccess: invalidate,
  });
}
