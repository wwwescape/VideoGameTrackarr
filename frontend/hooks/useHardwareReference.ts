import { useQuery } from "@tanstack/react-query";
import { listHardwareReferenceEntries } from "../api/hardwareReference";
import type { HardwareReferenceType } from "../api/types";

export function useHardwareReferenceEntries(type: HardwareReferenceType) {
  return useQuery({
    queryKey: ["hardware-reference-entries", type],
    queryFn: () => listHardwareReferenceEntries(type),
  });
}
