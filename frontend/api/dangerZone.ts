import { apiClient } from "./client";

export type DangerZoneAction =
  | "clear_progress"
  | "clear_ratings"
  | "clear_notes"
  | "clear_tags"
  | "clear_sync_caches"
  | "reset_library"
  | "reset_hardware"
  | "reset_everything";

export interface DangerZoneResult {
  // How many of each kind were removed, e.g. { games: 12 }.
  removed: Record<string, number>;
  // Where the pre-reset safety snapshot was saved on the server (resets only).
  safetySnapshotPath: string | null;
}

// The resets need "RESET" typed as `confirmation`; the clear actions don't.
export async function runDangerZoneAction(action: DangerZoneAction, confirmation?: string): Promise<DangerZoneResult> {
  const response = await apiClient.post<DangerZoneResult>(`/api/danger-zone/${action}`, { confirmation });
  return response.data;
}
