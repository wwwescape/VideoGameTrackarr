import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { acknowledgeJobStatus, listJobs, runJob, updateJobSchedule } from "../api/jobs";

export const jobsQueryKey = ["jobs"] as const;

// Unlike useRestoreStatus (polled constantly from AppShell for the whole session), this is
// only mounted while Settings' Jobs section is on screen — so it's safe (and kinder to the
// backend) to back off once nothing is running, rather than polling at a constant interval.
export function useJobsList() {
  return useQuery({
    queryKey: jobsQueryKey,
    queryFn: listJobs,
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.some((job) => job.run.status === "running") ? 3000 : false),
  });
}

export function useRunJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKey });
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
