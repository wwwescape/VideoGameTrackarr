import { apiClient } from "./client";
import type { Connector, ConnectorDevice, ConnectorInput, ConnectorPairing } from "./types";

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
  const response = await apiClient.get<ConnectorPairing>(`/api/connectors/pairings/${encodeURIComponent(code)}`);
  return response.data;
}

export async function approveConnectorPairing(code: string): Promise<ConnectorDevice> {
  const response = await apiClient.post<ConnectorDevice>(
    `/api/connectors/pairings/${encodeURIComponent(code)}/approve`
  );
  return response.data;
}
