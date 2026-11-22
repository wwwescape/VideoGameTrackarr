import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addAddonLinks,
  addPackLinks,
  getBaseGameAddons,
  getRemovalPreview,
  linkBaseGameAddons,
  setAddonIncluded,
  listAddonLinkCandidates,
  listAllAddonLinks,
  listPackCandidates,
  listPackContents,
  listPacks,
  listWorksWith,
  removeAddonLink,
  removeFromPack,
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
    mutationFn: ({ ids, includedIds = [] }: { ids: number[]; includedIds?: number[] }) =>
      addAddonLinks(gameId, ids, includedIds),
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
    mutationFn: ({ igdbIds, includedIgdbIds = [] }: { igdbIds: number[]; includedIgdbIds?: number[] }) =>
      linkBaseGameAddons(gameId, igdbIds, includedIgdbIds),
    onSuccess: invalidate,
  });
}

// Marks an add-on Included in a game, or clears it; gameId and otherId can be either side.
export function useSetAddonIncluded(gameId: number) {
  const invalidate = useInvalidateGames();
  return useMutation({
    mutationFn: ({ otherId, included }: { otherId: number; included: boolean }) =>
      setAddonIncluded(gameId, otherId, included),
    onSuccess: invalidate,
  });
}

// The same from Settings, where each row names both sides.
export function useSetAddonIncludedPair() {
  const invalidate = useInvalidateGames();
  return useMutation({
    mutationFn: ({ addonId, gameId, included }: { addonId: number; gameId: number; included: boolean }) =>
      setAddonIncluded(addonId, gameId, included),
    onSuccess: invalidate,
  });
}

// --- Packs (Season Pass, Ultimate Pack) and what's inside them.

export function usePackContents(packId: number, enabled = true) {
  return useQuery({
    queryKey: ["games", packId, "pack-contents"],
    queryFn: () => listPackContents(packId),
    enabled: enabled && Number.isFinite(packId),
  });
}

export function usePacks(addonId: number, enabled = true) {
  return useQuery({
    queryKey: ["games", addonId, "packs"],
    queryFn: () => listPacks(addonId),
    enabled: enabled && Number.isFinite(addonId),
  });
}

export function usePackCandidates(gameId: number, search: string, enabled: boolean) {
  return useQuery({
    queryKey: ["games", gameId, "pack-candidates", search],
    queryFn: () => listPackCandidates(gameId, search || undefined),
    enabled: enabled && Number.isFinite(gameId),
    placeholderData: keepPreviousData,
  });
}

// On a pack, puts add-ons inside it; on any other add-on, puts it inside packs.
export function useAddPackLinks(gameId: number) {
  const invalidate = useInvalidateGames();
  return useMutation({
    mutationFn: (ids: number[]) => addPackLinks(gameId, ids),
    onSuccess: invalidate,
  });
}

export function useRemoveFromPack() {
  const invalidate = useInvalidateGames();
  return useMutation({
    mutationFn: ({ packId, addonId }: { packId: number; addonId: number }) => removeFromPack(packId, addonId),
    onSuccess: invalidate,
  });
}
