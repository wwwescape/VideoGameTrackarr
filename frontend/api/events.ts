import { apiClient } from "./client";
import type { EventDetail, EventSummary } from "./types";

export async function listUpcomingEvents(): Promise<EventSummary[]> {
  const response = await apiClient.get<EventSummary[]>("/api/events");
  return response.data;
}

export async function getEvent(identifier: string): Promise<EventDetail> {
  const response = await apiClient.get<EventDetail>(`/api/events/${identifier}`);
  return response.data;
}

export async function resyncEvent(eventId: number): Promise<EventDetail> {
  const response = await apiClient.post<EventDetail>(`/api/events/${eventId}/resync`);
  return response.data;
}
