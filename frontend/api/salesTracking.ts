import { apiClient } from "./client";
import type { MediaFormat } from "./types";

export type SalesProvider = "itad" | "platprices";

export interface IgnoredSalesTitle {
  provider: SalesProvider;
  gameId: number;
  gameUuid: string;
  gameName: string;
  gameSlug: string | null;
  gameCoverUrl: string | null;
  checkedAt: string | null;
}

export async function getIgnoredSalesTitles(): Promise<IgnoredSalesTitle[]> {
  const response = await apiClient.get<IgnoredSalesTitle[]>("/api/sales-tracking/ignored");
  return response.data;
}

export async function retryIgnoredSalesTitle(provider: SalesProvider, gameId: number): Promise<void> {
  await apiClient.post(`/api/sales-tracking/ignored/${provider}/${gameId}/retry`);
}

export async function removeIgnoredSalesTitle(provider: SalesProvider, gameId: number): Promise<void> {
  await apiClient.post(`/api/sales-tracking/ignored/${provider}/${gameId}/remove`);
}

export interface TrackedSalesItem {
  libraryItemId: number;
  gameId: number;
  gameUuid: string;
  gameName: string;
  gameSlug: string | null;
  gameCoverUrl: string | null;
  platformId: number | null;
  platformName: string | null;
  format: MediaFormat | null;
  digitalStorefront: string | null;
  targetPrice: number | null;
}

export async function getTrackedSalesItems(): Promise<TrackedSalesItem[]> {
  const response = await apiClient.get<TrackedSalesItem[]>("/api/sales-tracking/tracked");
  return response.data;
}

export async function untrackSalesItem(libraryItemId: number): Promise<void> {
  await apiClient.post(`/api/sales-tracking/tracked/${libraryItemId}/untrack`);
}
