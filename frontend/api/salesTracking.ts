import { apiClient } from "./client";

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
