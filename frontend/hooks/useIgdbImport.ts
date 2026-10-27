import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getJobStatus } from "../api/jobs";
import {
  getIgdbImportEntries,
  linkIgdbImportEntry,
  linkSelectedIgdbImportEntries,
  setIgdbImportIgnored,
} from "../api/igdbImport";

export const igdbImportEntriesKey = ["igdb-import-entries"] as const;

export function useIgdbImportEntries() {
  return useQuery({ queryKey: igdbImportEntriesKey, queryFn: getIgdbImportEntries });
}

// Linking changes the games themselves too (custom → IGDB, or merged away).
export function useInvalidateAfterLinking() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: igdbImportEntriesKey });
    queryClient.invalidateQueries({ queryKey: ["games"] });
    queryClient.invalidateQueries({ queryKey: ["insights"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

export function useLinkIgdbImportEntry() {
  const invalidate = useInvalidateAfterLinking();
  return useMutation({ mutationFn: linkIgdbImportEntry, onSuccess: invalidate });
}

export function useLinkSelectedIgdbImportEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: linkSelectedIgdbImportEntries,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: igdbImportEntriesKey });
      // The Link job just started: refetching its status starts following it.
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useSetIgdbImportIgnored() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ gameIds, ignored }: { gameIds: number[]; ignored: boolean }) => setIgdbImportIgnored(gameIds, ignored),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: igdbImportEntriesKey }),
  });
}

// One job's status, polled every 2s while it runs — for a job the Jobs list doesn't show
// (IGDB Import's Link job), or to follow one from its own page.
export function useJobStatus(jobId: string) {
  return useQuery({
    queryKey: ["jobs", jobId],
    queryFn: () => getJobStatus(jobId),
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.run.status === "running" ? 2000 : false),
  });
}
