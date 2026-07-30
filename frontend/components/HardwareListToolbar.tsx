import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { useTranslation } from "react-i18next";
import type { NamedLookup } from "../api/types";
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
  value: number | "";
  onChange: (value: number | "") => void;
  placeholder: string;
}

const LookupFilter = ({ label, options, value, onChange, placeholder }: LookupFilterProps) => (
  <AutocompleteSelect<NamedLookup>
    label={label}
    options={options}
    value={options.find((option) => option.id === value) ?? null}
    onChange={(newValue) => onChange(newValue ? newValue.id : "")}
    getOptionLabel={(option) => option.name}
    isOptionEqualToValue={(option, val) => option.id === val.id}
    placeholder={placeholder}
    sx={{ minWidth: 160 }}
  />
);

interface HardwareListToolbarProps {
  sort: HardwareSort;
  onSortChange: (sort: HardwareSort) => void;
  manufacturerOptions: NamedLookup[];
  manufacturerId: number | "";
  onManufacturerChange: (id: number | "") => void;
  typeLabel: string;
  typeOptions: NamedLookup[];
  typeId: number | "";
  onTypeChange: (id: number | "") => void;
  platformOptions: NamedLookup[];
  platformId: number | "";
  onPlatformChange: (id: number | "") => void;
}

// Lookup-table filter dropdowns + a client-side sort dropdown, shown once per section
// (Devices/Accessories) — only the type dropdown's label/options differ between them
// (Device Type vs Accessory Type). Search + status are shared across both sections via
// HardwareSearchBar instead, since those apply the same way regardless of hardware kind.
const HardwareListToolbar = ({
  sort,
  onSortChange,
  manufacturerOptions,
  manufacturerId,
  onManufacturerChange,
  typeLabel,
  typeOptions,
  typeId,
  onTypeChange,
  platformOptions,
  platformId,
  onPlatformChange,
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
          value={manufacturerId}
          onChange={onManufacturerChange}
          placeholder={allPlaceholder}
        />
        <LookupFilter
          label={typeLabel}
          options={typeOptions}
          value={typeId}
          onChange={onTypeChange}
          placeholder={allPlaceholder}
        />
        <LookupFilter
          label={t("hardware.listToolbar.platformLabel")}
          options={platformOptions}
          value={platformId}
          onChange={onPlatformChange}
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
