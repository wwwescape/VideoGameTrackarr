import { apiClient } from "./client";
import type { HardwareStats } from "./types";

export async function getHardwareStats(): Promise<HardwareStats> {
  const response = await apiClient.get<HardwareStats>("/api/hardware-stats");
  return response.data;
}
