import { useQuery } from "@tanstack/react-query";
import { getDashboardStats, getReleaseCalendar } from "../api/dashboard";

export function useDashboardStats() {
  return useQuery({ queryKey: ["dashboard", "stats"], queryFn: getDashboardStats });
}

export function useReleaseCalendar() {
  return useQuery({ queryKey: ["dashboard", "release-calendar"], queryFn: getReleaseCalendar });
}
