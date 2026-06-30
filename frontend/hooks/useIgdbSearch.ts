import { useQuery } from "@tanstack/react-query";
import { searchIgdb } from "../api/igdb";

export function useIgdbSearch(query: string, categoryScope: "game" | "addon" = "game") {
  return useQuery({
    queryKey: ["igdb-search", query, categoryScope],
    queryFn: ({ signal }) => searchIgdb(query, signal, categoryScope),
    enabled: query.trim().length > 3,
    staleTime: 60_000,
  });
}
