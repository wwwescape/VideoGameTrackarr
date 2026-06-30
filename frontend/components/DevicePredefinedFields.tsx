import { useEffect, useState } from "react";
import Grid from "@mui/material/Grid";
import { useHardwareReferenceEntries } from "../hooks/useHardwareReference";
import AutocompleteSelect from "./AutocompleteSelect";

export interface DevicePredefinedValues {
  manufacturer: string;
  deviceType: string;
  hardwarePlatform: string;
  suggestedOfficialName: string;
  hardwareReferenceEntryId: number | null;
}

interface DevicePredefinedFieldsProps {
  onChange: (values: DevicePredefinedValues) => void;
}

function unique(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((value): value is string => !!value))).sort();
}

// Brand → Console → Variant cascade, reading from the HardwareReferenceEntry rows imported
// from data/hardware/*.xlsx (type=Device). Each selection clears the ones below it. Reports
// the resolved create-device fields plus a suggested official name up to the parent on every
// change — the parent (AddDeviceForm) owns the actual editable Official Name field, since it
// needs to interleave it with other form fields (Edition, etc.) in a specific row layout.
const DevicePredefinedFields = ({ onChange }: DevicePredefinedFieldsProps) => {
  const { data: entries } = useHardwareReferenceEntries("Device");

  const [manufacturer, setManufacturer] = useState("");
  const [platform, setPlatform] = useState("");
  const [officialNameChoice, setOfficialNameChoice] = useState("");

  const allEntries = entries ?? [];
  const brandEntries = allEntries.filter((entry) => entry.brand === manufacturer);
  const platformEntries = brandEntries.filter((entry) => entry.generation === platform);
  const matchedEntry = platformEntries.find((entry) => entry.officialName === officialNameChoice);

  useEffect(() => {
    onChange({
      manufacturer,
      deviceType: matchedEntry?.category ?? "",
      hardwarePlatform: platform,
      suggestedOfficialName: officialNameChoice,
      hardwareReferenceEntryId: matchedEntry?.id ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manufacturer, platform, officialNameChoice]);

  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <AutocompleteSelect<string>
          label="Brand"
          fullWidth
          required
          options={unique(allEntries.map((entry) => entry.brand))}
          value={manufacturer || null}
          getOptionLabel={(option) => option}
          helperText="More brands coming soon!"
          onChange={(newValue) => {
            setManufacturer(newValue ?? "");
            setPlatform("");
            setOfficialNameChoice("");
          }}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <AutocompleteSelect<string>
          label="Console"
          fullWidth
          required
          options={unique(brandEntries.map((entry) => entry.generation))}
          value={platform || null}
          getOptionLabel={(option) => option}
          disabled={!manufacturer}
          onChange={(newValue) => {
            setPlatform(newValue ?? "");
            setOfficialNameChoice("");
          }}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <AutocompleteSelect<string>
          label="Variant"
          fullWidth
          required
          options={unique(platformEntries.map((entry) => entry.officialName))}
          value={officialNameChoice || null}
          getOptionLabel={(option) => option}
          disabled={!platform}
          onChange={(newValue) => {
            setOfficialNameChoice(newValue ?? "");
          }}
        />
      </Grid>
    </Grid>
  );
};

export default DevicePredefinedFields;
