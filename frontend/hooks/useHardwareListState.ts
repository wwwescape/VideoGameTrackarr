import { useTranslation } from "react-i18next";
import type { HardwareSortField } from "../components/HardwareListViews";
import type { SortField } from "../utils/listSort";
import { useListSort } from "./useListSort";
import { useSessionState } from "./useSessionState";

export type HardwareStatusFilter = "all" | "owned" | "wishlist";

// One kind's lookup filters (Devices or Accessories): its type vocabularies differ, so each
// keeps its own.
export interface HardwareKindFilters {
  manufacturerIds: number[];
  setManufacturerIds: (ids: number[]) => void;
  typeIds: number[];
  setTypeIds: (ids: number[]) => void;
  platformIds: number[];
  setPlatformIds: (ids: number[]) => void;
}

function useKindFilters(kind: "devices" | "accessories"): HardwareKindFilters {
  const [manufacturerIds, setManufacturerIds] = useSessionState<number[]>(
    `hardware.${kind}.manufacturerIds`,
    []
  );
  const [typeIds, setTypeIds] = useSessionState<number[]>(`hardware.${kind}.typeIds`, []);
  const [platformIds, setPlatformIds] = useSessionState<number[]>(
    `hardware.${kind}.platformIds`,
    []
  );
  return { manufacturerIds, setManufacturerIds, typeIds, setTypeIds, platformIds, setPlatformIds };
}

// The Hardware page's search, status, sort and per-kind filters, remembered for the browser
// session like the Games list's (see hooks/useSessionState.ts).
export function useHardwareListState() {
  const [searchKeyword, setSearchKeyword] = useSessionState("hardware.searchKeyword", "");
  const [status, setStatus] = useSessionState<HardwareStatusFilter>("hardware.status", "all");
  // Shared by the Devices and Accessories sections. Release date only exists on accessories,
  // so devices (which have none of their own) stay by name for it.
  const { t } = useTranslation();
  const sortFields: SortField<HardwareSortField>[] = [
    { field: "name", label: t("games.listView.columnName") },
    { field: "manufacturer", label: t("hardware.listToolbar.manufacturerLabel") },
    { field: "detail", label: t("hardware.listToolbar.sortOptionPlatformOrType") },
    { field: "library", label: t("games.listView.columnLibrary") },
    { field: "quantity", label: t("hardware.filter.columnQuantity"), defaultDirection: "desc" },
    { field: "date_added", label: t("games.listView.sortDateAdded"), defaultDirection: "desc" },
    { field: "release_date", label: t("hardware.listToolbar.sortOptionReleaseDate"), defaultDirection: "desc" },
  ];
  const sort = useListSort("hardware.sortBy", sortFields, { field: "name", direction: "asc" });
  const devices = useKindFilters("devices");
  const accessories = useKindFilters("accessories");

  const kindCount = (filters: HardwareKindFilters) =>
    filters.manufacturerIds.length + filters.typeIds.length + filters.platformIds.length;
  const activeFilterCount =
    (status === "all" ? 0 : 1) + kindCount(devices) + kindCount(accessories);

  const clearFilters = () => {
    setStatus("all");
    [devices, accessories].forEach((filters) => {
      filters.setManufacturerIds([]);
      filters.setTypeIds([]);
      filters.setPlatformIds([]);
    });
  };

  return {
    searchKeyword,
    setSearchKeyword,
    status,
    setStatus,
    sort,
    devices,
    accessories,
    activeFilterCount,
    clearFilters,
  };
}

export type HardwareListState = ReturnType<typeof useHardwareListState>;
