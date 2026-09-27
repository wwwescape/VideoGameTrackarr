import { useQuery } from "@tanstack/react-query";
import { getIgdbGamePreview, searchIgdb } from "../api/igdb";

export function useIgdbSearch(query: string, categoryScope: "game" | "addon" = "game") {
  return useQuery({
    queryKey: ["igdb-search", query, categoryScope],
    queryFn: ({ signal }) => searchIgdb(query, signal, categoryScope),
    enabled: query.trim().length > 2,
    staleTime: 60_000,
  });
}

export function useIgdbGamePreview(igdbId: number) {
  return useQuery({
    queryKey: ["igdb-preview", igdbId],
    queryFn: () => getIgdbGamePreview(igdbId),
    enabled: Number.isFinite(igdbId),
    // IGDB data for a game barely changes within a session; don't refetch on every visit.
    staleTime: 10 * 60_000,
    retry: false,
  });
}
