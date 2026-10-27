import { useSessionState } from "./useSessionState";

export type HardwareStatusFilter = "all" | "owned" | "wishlist";
export type HardwareSort = "name" | "releaseDate" | "dateAddedDesc" | "dateAddedAsc";

// Shared by the Devices and Accessories lists. Release date only exists on accessories, so
// devices (which have none of their own) stay by name for it.
export function compareHardware<
  T extends { officialName: string; createdAt: string; releaseDate?: number | null },
>(sort: HardwareSort): (a: T, b: T) => number {
  if (sort === "dateAddedDesc" || sort === "dateAddedAsc") {
    const direction = sort === "dateAddedDesc" ? -1 : 1;
    return (a, b) =>
      direction * (Date.parse(a.createdAt) - Date.parse(b.createdAt)) ||
      a.officialName.localeCompare(b.officialName);
  }
  if (sort === "releaseDate") {
    return (a, b) =>
      a.releaseDate === undefined || b.releaseDate === undefined
        ? a.officialName.localeCompare(b.officialName)
        : (b.releaseDate ?? 0) - (a.releaseDate ?? 0);
  }
  return (a, b) => a.officialName.localeCompare(b.officialName);
}

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
  const [sort, setSort] = useSessionState<HardwareSort>("hardware.sort", "name");
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
    setSort,
    devices,
    accessories,
    activeFilterCount,
    clearFilters,
  };
}

export type HardwareListState = ReturnType<typeof useHardwareListState>;
