import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useTranslation } from "react-i18next";
import type { NamedLookup } from "../api/types";
import type { HardwareKindFilters, HardwareListState, HardwareStatusFilter } from "../hooks/useHardwareListState";
import AutocompleteMultiSelect from "./AutocompleteMultiSelect";

export interface HardwareLookups {
  manufacturers: NamedLookup[];
  deviceTypes: NamedLookup[];
  accessoryTypes: NamedLookup[];
  platforms: NamedLookup[];
}

interface LookupFilterProps {
  label: string;
  options: NamedLookup[];
  value: number[];
  onChange: (value: number[]) => void;
}

const LookupFilter = ({ label, options, value, onChange }: LookupFilterProps) => {
  const { t } = useTranslation();
  return (
    <AutocompleteMultiSelect<NamedLookup>
      label={label}
      options={options}
      value={options.filter((option) => value.includes(option.id))}
      onChange={(newValue) => onChange(newValue.map((option) => option.id))}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      placeholder={t("hardware.listToolbar.allOption")}
      fullWidth
    />
  );
};

interface HardwareFilterDialogProps {
  state: HardwareListState;
  lookups: HardwareLookups;
  open: boolean;
  onClose: () => void;
}

// Status for both kinds, then Manufacturer, Type and Platform for Devices and for Accessories
// (their type vocabularies differ, so each kind keeps its own filters).
const HardwareFilterDialog = ({ state, lookups, open, onClose }: HardwareFilterDialogProps) => {
  const { t } = useTranslation();
  const statusOptions: { value: HardwareStatusFilter; label: string }[] = [
    { value: "all", label: t("hardware.searchBar.statusAll") },
    { value: "owned", label: t("hardware.detailsShared.statusOwned") },
    { value: "wishlist", label: t("hardware.detailsShared.statusWishlist") },
  ];

  const kindFields = (heading: string, filters: HardwareKindFilters, typeLabel: string, typeOptions: NamedLookup[]) => (
    <>
      <Grid size={12}>
        <Box sx={{ typography: "overline", color: "vgt.text3", mt: 1 }}>{heading}</Box>
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <LookupFilter
          label={t("hardware.listToolbar.manufacturerLabel")}
          options={lookups.manufacturers}
          value={filters.manufacturerIds}
          onChange={filters.setManufacturerIds}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <LookupFilter label={typeLabel} options={typeOptions} value={filters.typeIds} onChange={filters.setTypeIds} />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <LookupFilter
          label={t("hardware.listToolbar.platformLabel")}
          options={lookups.platforms}
          value={filters.platformIds}
          onChange={filters.setPlatformIds}
        />
      </Grid>
    </>
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t("games.listView.filterTitle")}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={12}>
            <Box id="hardware-status-label" sx={{ typography: "overline", color: "vgt.text3" }}>
              {t("hardware.filter.statusLabel")}
            </Box>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={state.status}
              onChange={(_event, value: HardwareStatusFilter | null) => value && state.setStatus(value)}
              aria-labelledby="hardware-status-label"
            >
              {statusOptions.map((option) => (
                <ToggleButton key={option.value} value={option.value} sx={{ px: 2, textTransform: "none" }}>
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Grid>
          {kindFields(t("hardware.page.devicesHeading"), state.devices, t("hardware.deviceList.typeLabel"), lookups.deviceTypes)}
          {kindFields(
            t("hardware.page.accessoriesHeading"),
            state.accessories,
            t("hardware.accessoryList.typeLabel"),
            lookups.accessoryTypes
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={state.clearFilters} disabled={state.activeFilterCount === 0}>
          {t("games.listToolbar.clearFiltersButton")}
        </Button>
        <Button onClick={onClose} variant="contained">
          {t("common.close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default HardwareFilterDialog;
