import { apiClient } from "./client";
import type { HardwareReferenceEntry, HardwareReferenceType } from "./types";

export async function listHardwareReferenceEntries(
  type: HardwareReferenceType
): Promise<HardwareReferenceEntry[]> {
  const response = await apiClient.get<HardwareReferenceEntry[]>("/api/hardware-reference-entries", {
    params: { type },
  });
  return response.data;
}
