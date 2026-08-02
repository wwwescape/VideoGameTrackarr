import { apiClient } from "./client";
import type { JobSummary } from "./types";

export async function listJobs(): Promise<JobSummary[]> {
  const response = await apiClient.get<JobSummary[]>("/api/jobs");
  return response.data;
}

export async function getJobStatus(jobId: string): Promise<JobSummary> {
  const response = await apiClient.get<JobSummary>(`/api/jobs/${jobId}/status`);
  return response.data;
}

export async function runJob(jobId: string): Promise<JobSummary> {
  const response = await apiClient.post<JobSummary>(`/api/jobs/${jobId}/run`);
  return response.data;
}

export async function acknowledgeJobStatus(jobId: string): Promise<void> {
  await apiClient.post(`/api/jobs/${jobId}/status/acknowledge`);
}

export async function updateJobSchedule(
  jobId: string,
  body: { enabled: boolean; cronExpression: string | null }
): Promise<JobSummary> {
  const response = await apiClient.put<JobSummary>(`/api/jobs/${jobId}/schedule`, body);
  return response.data;
}
