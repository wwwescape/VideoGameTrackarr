import { apiClient } from "./client";
import type { NamedLookup } from "./types";

export async function listCompanies(): Promise<NamedLookup[]> {
  const response = await apiClient.get<NamedLookup[]>("/api/companies");
  return response.data;
}
