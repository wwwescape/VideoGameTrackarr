import { apiClient } from "./client";
import type { DashboardStats, UpcomingRelease } from "./types";

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await apiClient.get<DashboardStats>("/api/dashboard/stats");
  return response.data;
}

export async function getReleaseCalendar(): Promise<UpcomingRelease[]> {
  const response = await apiClient.get<UpcomingRelease[]>("/api/dashboard/release-calendar");
  return response.data;
}
