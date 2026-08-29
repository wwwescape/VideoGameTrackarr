import { useQuery } from "@tanstack/react-query";
import { listPublicAccessories, listPublicDevices, listPublicGames } from "../api/public";

export function usePublicGames(token: string | undefined, search?: string) {
  return useQuery({
    queryKey: ["public", token, "games", search],
    queryFn: () => listPublicGames(token!, search),
    enabled: !!token,
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
