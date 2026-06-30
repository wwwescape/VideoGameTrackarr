import { useQuery } from "@tanstack/react-query";
import {
  listAccessoryTypes,
  listColors,
  listDeviceTypes,
  listHardwarePlatforms,
  listManufacturers,
  listStorageVariants,
} from "../api/hardwareLookups";

export function useManufacturers() {
  return useQuery({ queryKey: ["manufacturers"], queryFn: listManufacturers });
}

export function useHardwarePlatforms() {
  return useQuery({ queryKey: ["hardware-platforms"], queryFn: listHardwarePlatforms });
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
