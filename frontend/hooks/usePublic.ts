import { useQuery } from "@tanstack/react-query";
import {
  getPublicGame,
  getPublicLabs,
  getPublicShelf,
  listPublicAccessories,
  listPublicDevices,
  listPublicGames,
} from "../api/public";
import type { GameSortOption } from "../api/types";

export function usePublicGames(token: string | undefined, search?: string, sort?: GameSortOption) {
  return useQuery({
    queryKey: ["public", token, "games", search, sort],
    queryFn: () => listPublicGames(token!, search, sort),
    enabled: !!token,
  });
}

export function usePublicGame(token: string | undefined, gameId: number) {
  return useQuery({
    queryKey: ["public", token, "game", gameId],
    queryFn: () => getPublicGame(token!, gameId),
    enabled: !!token && Number.isFinite(gameId),
  });
}

export function usePublicDevices(token: string | undefined, search?: string) {
  return useQuery({
    queryKey: ["public", token, "devices", search],
    queryFn: () => listPublicDevices(token!, search),
    enabled: !!token,
  });
}

export function usePublicAccessories(token: string | undefined, search?: string) {
  return useQuery({
    queryKey: ["public", token, "accessories", search],
    queryFn: () => listPublicAccessories(token!, search),
    enabled: !!token,
  });
}

export function usePublicShelf(token: string | undefined, search?: string, sort?: GameSortOption) {
  return useQuery({
    queryKey: ["public", token, "shelf", search, sort],
    queryFn: () => getPublicShelf(token!, search, sort),
    enabled: !!token,
  });
}

// Whether a lab is on, for the share page's tabs; false until known, so a lab tab never flashes in.
export function usePublicLabEnabled(token: string | undefined, lab: string) {
  const query = useQuery({
    queryKey: ["public", token, "labs"],
    queryFn: () => getPublicLabs(token!),
    enabled: !!token,
    staleTime: 60_000,
  });
  return { enabled: query.data?.enabled.includes(lab) ?? false, isLoading: query.isLoading };
}
