import { useQuery } from "@tanstack/react-query";
import { listCompanies } from "../api/companies";

export function useCompanies() {
  return useQuery({ queryKey: ["companies"], queryFn: listCompanies });
}
