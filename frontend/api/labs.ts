import { apiClient } from "./client";

// Settings > Labs: VGT's feature flags. Each lab is off until turned on, for the whole app.
export type LabId = "game_shelf" | "screensaver";

export interface Lab {
  id: LabId;
  enabled: boolean;
}

export async function listLabs(): Promise<Lab[]> {
  const response = await apiClient.get<Lab[]>("/api/labs");
  return response.data;
}

export async function setLabEnabled(id: LabId, enabled: boolean): Promise<Lab> {
  const response = await apiClient.put<Lab>(`/api/labs/${id}`, { enabled });
  return response.data;
}
