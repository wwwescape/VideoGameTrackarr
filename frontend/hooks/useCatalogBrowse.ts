import { useQuery } from "@tanstack/react-query";
import { getCollection, listCollectionAddons, listCollections } from "../api/collections";
import { getFranchise, listFranchiseAddons, listFranchises } from "../api/franchises";
import type { GameListFilters } from "../api/games";

export function useFranchises() {
  return useQuery({
    queryKey: ["franchises"],
    queryFn: () => listFranchises(),
  });
}

export function useFranchise(slug: string | undefined) {
  return useQuery({
    queryKey: ["franchises", slug],
    queryFn: () => getFranchise(slug!),
    enabled: !!slug,
  });
}

// Only fetched while CatalogBrowseGrid.tsx's Include Addons toggle is on (enabled) — no
// point hitting this endpoint for a section the user hasn't expanded. Nested under
// ["franchises", slug, ...] so CatalogResyncButton.tsx's existing invalidateQueries({
// queryKey: ["franchises", slug] }) on a completed resync already covers this too, via
// react-query's default prefix matching — no extra invalidation needed there.
export function useFranchiseAddons(slug: string | undefined, filters: GameListFilters, enabled: boolean) {
  return useQuery({
    queryKey: ["franchises", slug, "addons", filters],
    queryFn: ({ signal }) => listFranchiseAddons(slug!, filters, signal),
    enabled: enabled && !!slug,
  });
}

export function useCollections() {
  return useQuery({
    queryKey: ["collections"],
    queryFn: () => listCollections(),
  });
}

export function useCollection(slug: string | undefined) {
  return useQuery({
    queryKey: ["collections", slug],
    queryFn: () => getCollection(slug!),
    enabled: !!slug,
  });
}

// See useFranchiseAddons above — same reasoning, mirrored for collections.
export function useCollectionAddons(slug: string | undefined, filters: GameListFilters, enabled: boolean) {
  return useQuery({
    queryKey: ["collections", slug, "addons", filters],
    queryFn: ({ signal }) => listCollectionAddons(slug!, filters, signal),
    enabled: enabled && !!slug,
  });
}
