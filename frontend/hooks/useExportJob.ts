import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getExportJobConfig,
  testExportJobConnection,
  updateExportJobConfig,
} from "../api/exportJob";

export function useExportJobConfig() {
  return useQuery({
    queryKey: ["jobs", "export-backup", "config"],
    queryFn: getExportJobConfig,
  });
}

export function useUpdateExportJobConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateExportJobConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs", "export-backup", "config"] });
    },
  });
}

export function useTestExportJobConnection() {
  return useMutation({
    mutationFn: testExportJobConnection,
  });
}
