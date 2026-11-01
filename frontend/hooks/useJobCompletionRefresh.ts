import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listJobs } from "../api/jobs";
import { jobsQueryKey } from "./useJobs";

// Background jobs (IGDB resync, Events Sync, Steam import, price refreshes, IGDB Import)
// change data on the server, whether started here, from another tab or by their schedule.
// Mounted once in AppShell: checks the jobs list every minute while the app is on screen
// (every few seconds while one runs) and, when a job finishes, refetches everything on
// screen and marks the rest stale, so pages don't keep showing data from before the job
// until the 5-minute staleTime (index.tsx) runs out.
export function useJobCompletionRefresh() {
  const queryClient = useQueryClient();
  const { data: jobs } = useQuery({
    queryKey: jobsQueryKey,
    queryFn: listJobs,
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.data?.some((job) => job.run.status === "running") ? 3000 : 60_000,
  });
  // Each job's last finish time as of the previous check; null until the first check.
  const lastFinished = useRef<Map<string, string | null> | null>(null);

  useEffect(() => {
    if (!jobs) return;
    const finished = new Map(
      jobs.map((job) => [job.id, job.run.status === "running" ? null : job.run.finishedAt])
    );
    const previous = lastFinished.current;
    lastFinished.current = finished;
    // The first check only records where things stand: the page's own data is fresh.
    if (!previous) return;
    const anyFinished = [...finished].some(([id, at]) => at !== null && at !== previous.get(id));
    if (anyFinished) {
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== jobsQueryKey[0],
      });
    }
  }, [jobs, queryClient]);
}
