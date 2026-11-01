import { apiClient } from "./client";
import type { VersionInfo, WhatsNewInfo } from "./types";

export async function getVersion(force = false): Promise<VersionInfo> {
  const response = await apiClient.get<VersionInfo>("/api/version", {
    params: force ? { force: true } : undefined,
  });
  return response.data;
}

export async function getWhatsNew(): Promise<WhatsNewInfo> {
  const response = await apiClient.get<WhatsNewInfo>("/api/version/whats-new");
  return response.data;
}

// Marks the running version's What's New as seen, on the account (every device).
export async function markWhatsNewSeen(): Promise<void> {
  await apiClient.post("/api/version/whats-new/seen");
}
