import { apiClient } from "./client";
import type {
  Connector,
  ConnectorDevice,
  ConnectorInput,
  ConnectorPairing,
  ConnectorSyncResult,
  ReportedGame,
} from "./types";

export async function listConnectors(): Promise<Connector[]> {
  const response = await apiClient.get<Connector[]>("/api/connectors");
  return response.data;
}

export async function createConnector(input: ConnectorInput): Promise<Connector> {
  const response = await apiClient.post<Connector>("/api/connectors", input);
  return response.data;
}

export async function updateConnector(id: number, input: ConnectorInput): Promise<Connector> {
  const response = await apiClient.put<Connector>(`/api/connectors/${id}`, input);
  return response.data;
}

export async function deleteConnector(id: number): Promise<void> {
  await apiClient.delete(`/api/connectors/${id}`);
}

export async function revokeConnectorDevice(connectorId: number, deviceId: number): Promise<void> {
  await apiClient.delete(`/api/connectors/${connectorId}/devices/${deviceId}`);
}

export async function getConnectorPairing(code: string): Promise<ConnectorPairing> {
  const response = await apiClient.get<ConnectorPairing>(
    `/api/connectors/pairings/${encodeURIComponent(code)}`
  );
  return response.data;
}

export async function approveConnectorPairing(code: string): Promise<ConnectorDevice> {
  const response = await apiClient.post<ConnectorDevice>(
    `/api/connectors/pairings/${encodeURIComponent(code)}/approve`
  );
  return response.data;
}

// A store connector's sign-in page (Epic, GOG), opened in a new tab.
export async function getConnectorLoginUrl(id: number): Promise<string> {
  const response = await apiClient.get<{ url: string }>(`/api/connectors/${id}/login-url`);
  return response.data.url;
}

// What the store's sign-in page ended on: its code, JSON or URL.
export async function signInConnector(id: number, code: string): Promise<Connector> {
  const response = await apiClient.post<Connector>(`/api/connectors/${id}/sign-in`, { code });
  return response.data;
}

// Starts the store sync job (every signed-in store connector); it shows on the Jobs page.
export async function syncStoreConnectors(): Promise<void> {
  await apiClient.post("/api/connectors/sync-stores");
}

export async function importConnectorGames(
  id: number,
  games: ReportedGame[]
): Promise<ConnectorSyncResult> {
  const response = await apiClient.post<ConnectorSyncResult>(`/api/connectors/${id}/import`, {
    games,
  });
  return response.data;
}
