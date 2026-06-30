import { apiClient } from "./client";
import type { CatalogBrowseResult, CatalogRefSummary } from "./types";

export async function listCollections(): Promise<CatalogRefSummary[]> {
  const response = await apiClient.get<CatalogRefSummary[]>("/api/collections");
  return response.data;
}

export async function getCollection(slug: string): Promise<CatalogBrowseResult> {
  const response = await apiClient.get<CatalogBrowseResult>(`/api/collections/${slug}`);
  return response.data;
}
