import { useQuery } from "@tanstack/react-query";
import { listGenres } from "../api/genres";

// Under ["games", ...] like useLibraryPlatforms: which genres the library has changes
// whenever a game is added or removed, and those mutations already invalidate ["games"].
export function useGenres() {
  return useQuery({ queryKey: ["games", "genres"], queryFn: listGenres });
}
