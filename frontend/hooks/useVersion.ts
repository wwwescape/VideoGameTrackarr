import { useQuery } from "@tanstack/react-query";
import { getVersion } from "../api/version";

// Changes at most once per release — no need for interval polling like the jobs list or
// restore status; a long staleTime just avoids refetching on every remount/focus.
export function useVersion() {
  return useQuery({
    queryKey: ["version"],
    queryFn: getVersion,
    staleTime: 60 * 60 * 1000,
  });
}
