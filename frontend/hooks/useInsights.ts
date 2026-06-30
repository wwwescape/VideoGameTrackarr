import { useQuery } from "@tanstack/react-query";
import { listAccessoriesWithoutOwnedHardware, listDuplicateLibraryItems, listMissingDlc } from "../api/insights";

export function useDuplicateLibraryItems() {
  return useQuery({ queryKey: ["insights", "duplicate-library-items"], queryFn: listDuplicateLibraryItems });
}

export function useMissingDlc() {
  return useQuery({ queryKey: ["insights", "missing-dlc"], queryFn: listMissingDlc });
}

export function useAccessoriesWithoutOwnedHardware() {
  return useQuery({
    queryKey: ["insights", "accessories-without-owned-hardware"],
    queryFn: listAccessoriesWithoutOwnedHardware,
  });
}
