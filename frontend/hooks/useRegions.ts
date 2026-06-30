import { useQuery } from "@tanstack/react-query";
import { listRegions } from "../api/regions";

export function useRegions() {
  return useQuery({ queryKey: ["regions"], queryFn: listRegions });
}
