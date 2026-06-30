import { useQuery } from "@tanstack/react-query";
import { listPlatforms } from "../api/platforms";

export function usePlatforms() {
  return useQuery({ queryKey: ["platforms"], queryFn: listPlatforms });
}
