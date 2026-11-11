import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acknowledgeJobStatus,
  clearJobLogs,
  getJobLog,
  listJobLogs,
  listJobs,
  runJob,
  updateJobSchedule,
} from "../api/jobs";

export const jobsQueryKey = ["jobs"] as const;

// Unlike useRestoreStatus (polled constantly from AppShell for the whole session), this is
// only mounted while Settings' Jobs section is on screen: fast while something runs, then a
// slow 30s check so a run the scheduler starts on its own still shows up on an open page.
export function useJobsList() {
  return useQuery({
    queryKey: jobsQueryKey,
    queryFn: listJobs,
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.some((job) => job.run.status === "running") ? 3000 : 30_000),
  });
}

export function useRunJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runJob,
    onSuccess: (_data, jobId) => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKey });
      queryClient.invalidateQueries({ queryKey: jobLogsQueryKey(jobId) });
    },
  });
}

export function useAcknowledgeJobStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acknowledgeJobStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKey });
    },
  });
}

export function useUpdateJobSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, enabled, cronExpression }: { jobId: string; enabled: boolean; cronExpression: string | null }) =>
      updateJobSchedule(jobId, { enabled, cronExpression }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKey });
    },
  });
}

export const jobLogsQueryKey = (jobId: string) => ["jobs", jobId, "logs"] as const;

// Only mounted while a job's Logs dialog is open; polls while a run is in progress so it
// moves from "Running" to its outcome without a reopen.
export function useJobLogs(jobId: string, enabled: boolean) {
  return useQuery({
    queryKey: jobLogsQueryKey(jobId),
    queryFn: () => listJobLogs(jobId),
    enabled,
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.some((log) => log.status === "running") ? 3000 : false),
  });
}

export function useJobLog(jobId: string, logId: number | null) {
  return useQuery({
    queryKey: [...jobLogsQueryKey(jobId), logId] as const,
    queryFn: () => getJobLog(jobId, logId as number),
    enabled: logId !== null,
    staleTime: 0,
    // A running log's lines are live on the server; follow them until it finishes.
    refetchInterval: (query) => (query.state.data?.status === "running" ? 2000 : false),
  });
}

export function useClearJobLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clearJobLogs,
    // Prefix match: also refreshes every ["jobs", id, "logs", ...] query and each card's lastRun.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKey });
    },
  });
}
