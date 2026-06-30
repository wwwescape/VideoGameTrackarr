import { useQuery } from "@tanstack/react-query";
import { getHardwareStats } from "../api/hardwareStats";

export function useHardwareStats() {
  return useQuery({ queryKey: ["hardware-stats"], queryFn: getHardwareStats });
}
