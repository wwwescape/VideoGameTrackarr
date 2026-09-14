import { useQuery } from "@tanstack/react-query";
import { listStorefronts } from "../api/storefronts";

export function useStorefronts() {
  return useQuery({ queryKey: ["storefronts"], queryFn: listStorefronts });
}
