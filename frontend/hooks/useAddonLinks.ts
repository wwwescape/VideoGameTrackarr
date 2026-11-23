import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addAddonLinks,
  addPackLinks,
  getBaseGameAddons,
  getRemovalPreview,
  linkBaseGameAddons,
  setAddonRelation,
  listAddonLinkCandidates,
  listAllAddonLinks,
  listPackCandidates,
  listPackContents,
  listPacks,
  listWorksWith,
  removeAddonLink,
  removeFromPack,
} from "../api/addonLinks";
import type { AddonRelation, RelationIds } from "../api/addonLinks";

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

// The pickers' lists: marked stale after a change, so they're fresh the next time a picker
// opens, but not refetched right away (the base-game one asks IGDB).
const PICKER_QUERIES = new Set(["addon-link-candidates", "pack-candidates", "base-game-addons"]);

// A link shows on both sides (the add-on's Works with, the game's Add-ons), in owned/wishlist
// status, the Games list's Include add-ons matches and on Settings → Linked Add-ons, so all of
// those refresh. Fire and forget: a mutation resolves as soon as the server has saved it, so
// dialogs close at once instead of waiting for every refetch.
function useInvalidateGames() {
  const queryClient = useQueryClient();
  return () => {
    const isPicker = (key: readonly unknown[]) => PICKER_QUERIES.has(String(key[2]));
    void queryClient.invalidateQueries({ queryKey: ["games"], predicate: (query) => !isPicker(query.queryKey) });
    void queryClient.invalidateQueries({
      queryKey: ["games"],
      predicate: (query) => isPicker(query.queryKey),
      refetchType: "none",
    });
    void queryClient.invalidateQueries({ queryKey: ["addon-links"] });
  };
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
    mutationFn: ({ ids, ...relations }: { ids: number[] } & RelationIds) => addAddonLinks(gameId, ids, relations),
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
    mutationFn: ({ igdbIds, ...relations }: { igdbIds: number[] } & RelationIds) =>
      linkBaseGameAddons(gameId, igdbIds, relations),
    onSuccess: invalidate,
  });
}

// Sets how an add-on goes with a game; gameId and otherId can be either side.
export function useSetAddonRelation(gameId: number) {
  const invalidate = useInvalidateGames();
  return useMutation({
    mutationFn: ({ otherId, relation }: { otherId: number; relation: AddonRelation }) =>
      setAddonRelation(gameId, otherId, relation),
    onSuccess: invalidate,
  });
}

// The same from Settings, where each row names both sides.
export function useSetAddonRelationPair() {
  const invalidate = useInvalidateGames();
  return useMutation({
    mutationFn: ({ addonId, gameId, relation }: { addonId: number; gameId: number; relation: AddonRelation }) =>
      setAddonRelation(addonId, gameId, relation),
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
