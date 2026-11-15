import { useQuery } from "@tanstack/react-query";
import { slugify } from "../utils/identifiers";
import {
  listAccessoryTypes,
  listColors,
  listDeviceTypes,
  listHardwarePlatforms,
  listLibraryHardwarePlatforms,
  listManufacturers,
  listStorageVariants,
} from "../api/hardwareLookups";

export function useManufacturers() {
  return useQuery({ queryKey: ["manufacturers"], queryFn: listManufacturers });
}

export function useHardwarePlatforms() {
  return useQuery({ queryKey: ["hardware-platforms"], queryFn: listHardwarePlatforms });
}

// Hardware → Platforms. Its counts change with every device/accessory add, edit or removal, so
// it's refetched on each visit rather than kept fresh by invalidation.
export function useLibraryHardwarePlatforms() {
  return useQuery({ queryKey: ["hardware-platforms", "library"], queryFn: listLibraryHardwarePlatforms, staleTime: 0 });
}

// A Hardware → Platforms page's platform, from its URL slug (platform names are unique).
export function useHardwarePlatformBySlug(slug: string | undefined) {
  const query = useHardwarePlatforms();
  const platform = slug ? query.data?.find((candidate) => slugify(candidate.name) === slug) : undefined;
  return { platform, isLoading: query.isLoading, notFound: !!query.data && !platform };
}

export function useDeviceTypes() {
  return useQuery({ queryKey: ["device-types"], queryFn: listDeviceTypes });
}

export function useAccessoryTypes() {
  return useQuery({ queryKey: ["accessory-types"], queryFn: listAccessoryTypes });
}

export function useStorageVariants() {
  return useQuery({ queryKey: ["storage-variants"], queryFn: listStorageVariants });
}

export function useColors() {
  return useQuery({ queryKey: ["colors"], queryFn: listColors });
}
