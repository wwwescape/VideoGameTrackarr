import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listLabs, setLabEnabled, type LabId } from "../api/labs";

export const labsQueryKey = ["labs"] as const;

// Read by the sidebar and the Settings tabs on every page. Always refetched on mount (it's tiny):
// the query cache is persisted for offline use, and a remembered answer from before a lab was
// turned on (here or in another tab) mustn't hide or redirect its pages.
export function useLabs() {
  return useQuery({ queryKey: labsQueryKey, queryFn: listLabs, staleTime: 0 });
}

// The labs that are on; empty until loaded, so lab features stay hidden rather than flash in.
export function useEnabledLabs(): ReadonlySet<LabId> {
  const { data } = useLabs();
  return new Set((data ?? []).filter((lab) => lab.enabled).map((lab) => lab.id));
}

export function useSetLabEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: LabId; enabled: boolean }) => setLabEnabled(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labsQueryKey });
      // A lab adds or removes pages and their data.
      queryClient.invalidateQueries({ queryKey: ["games", "shelf"] });
      queryClient.invalidateQueries({ queryKey: ["game-cases"] });
    },
  });
}
