import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { useTranslation } from "react-i18next";
import type { NamedLookup } from "../api/types";
import AutocompleteMultiSelect from "./AutocompleteMultiSelect";
import AutocompleteSelect from "./AutocompleteSelect";

export type HardwareStatusFilter = "all" | "owned" | "wishlist";
export type HardwareSort = "name" | "releaseDate";

interface SortOption {
  value: HardwareSort;
  label: string;
}

interface LookupFilterProps {
  label: string;
  options: NamedLookup[];
  value: number[];
  onChange: (value: number[]) => void;
  placeholder: string;
}

const LookupFilter = ({ label, options, value, onChange, placeholder }: LookupFilterProps) => (
  <AutocompleteMultiSelect<NamedLookup>
    label={label}
    options={options}
    value={options.filter((option) => value.includes(option.id))}
    onChange={(newValue) => onChange(newValue.map((option) => option.id))}
    getOptionLabel={(option) => option.name}
    isOptionEqualToValue={(option, val) => option.id === val.id}
    placeholder={placeholder}
    sx={{ minWidth: 200 }}
  />
);

interface HardwareListToolbarProps {
  sort: HardwareSort;
  onSortChange: (sort: HardwareSort) => void;
  manufacturerOptions: NamedLookup[];
  manufacturerIds: number[];
  onManufacturerIdsChange: (ids: number[]) => void;
  typeLabel: string;
  typeOptions: NamedLookup[];
  typeIds: number[];
  onTypeIdsChange: (ids: number[]) => void;
  platformOptions: NamedLookup[];
  platformIds: number[];
  onPlatformIdsChange: (ids: number[]) => void;
}

// Lookup-table filter dropdowns + a client-side sort dropdown, shown once per section
// (Devices/Accessories) — only the type dropdown's label/options differ between them
// (Device Type vs Accessory Type). Search + status are shared across both sections via
// HardwareSearchBar instead, since those apply the same way regardless of hardware kind.
const HardwareListToolbar = ({
  sort,
  onSortChange,
  manufacturerOptions,
  manufacturerIds,
  onManufacturerIdsChange,
  typeLabel,
  typeOptions,
  typeIds,
  onTypeIdsChange,
  platformOptions,
  platformIds,
  onPlatformIdsChange,
}: HardwareListToolbarProps) => {
  const { t } = useTranslation();

  const sortOptions: SortOption[] = [
    { value: "name", label: t("hardware.listToolbar.sortOptionName") },
    { value: "releaseDate", label: t("hardware.listToolbar.sortOptionReleaseDate") },
  ];

  const allPlaceholder = t("hardware.listToolbar.allOption");

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
      <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
        <LookupFilter
          label={t("hardware.listToolbar.manufacturerLabel")}
          options={manufacturerOptions}
          value={manufacturerIds}
          onChange={onManufacturerIdsChange}
          placeholder={allPlaceholder}
        />
        <LookupFilter
          label={typeLabel}
          options={typeOptions}
          value={typeIds}
          onChange={onTypeIdsChange}
          placeholder={allPlaceholder}
        />
        <LookupFilter
          label={t("hardware.listToolbar.platformLabel")}
          options={platformOptions}
          value={platformIds}
          onChange={onPlatformIdsChange}
          placeholder={allPlaceholder}
        />
        <AutocompleteSelect<SortOption>
          label={t("hardware.listToolbar.sortByLabel")}
          options={sortOptions}
          value={sortOptions.find((option) => option.value === sort) ?? null}
          onChange={(newValue) => onSortChange(newValue!.value)}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, val) => option.value === val.value}
          disableClearable
          sx={{ minWidth: 160 }}
        />
      </Stack>
    </Paper>
  );
};

export default HardwareListToolbar;
