import { useQuery } from "@tanstack/react-query";
import { getCollection, listCollections } from "../api/collections";
import { getFranchise, listFranchises } from "../api/franchises";

export function useFranchises() {
  return useQuery({
    queryKey: ["franchises"],
    queryFn: () => listFranchises(),
  });
}

export function useFranchise(slug: string | undefined) {
  return useQuery({
    queryKey: ["franchises", slug],
    queryFn: () => getFranchise(slug!),
    enabled: !!slug,
  });
}

export function useCollections() {
  return useQuery({
    queryKey: ["collections"],
    queryFn: () => listCollections(),
  });
}

export function useCollection(slug: string | undefined) {
  return useQuery({
    queryKey: ["collections", slug],
    queryFn: () => getCollection(slug!),
    enabled: !!slug,
  });
}
