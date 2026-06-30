import { apiClient } from "./client";
import type { CatalogBrowseResult, CatalogRefSummary } from "./types";

export async function listFranchises(): Promise<CatalogRefSummary[]> {
  const response = await apiClient.get<CatalogRefSummary[]>("/api/franchises");
  return response.data;
}

export async function getFranchise(slug: string): Promise<CatalogBrowseResult> {
  const response = await apiClient.get<CatalogBrowseResult>(`/api/franchises/${slug}`);
  return response.data;
}
