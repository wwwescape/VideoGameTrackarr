import { useEffect, useState } from "react";
import Grid from "@mui/material/Grid";
import { useHardwareReferenceEntries } from "../hooks/useHardwareReference";
import AutocompleteSelect from "./AutocompleteSelect";

export interface AccessoryPredefinedValues {
  manufacturer: string;
  accessoryType: string;
  suggestedOfficialName: string;
  compatiblePlatforms: string[];
  hardwareReferenceEntryId: number | null;
}

interface AccessoryPredefinedFieldsProps {
  onChange: (values: AccessoryPredefinedValues) => void;
}

function unique(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((value): value is string => !!value))).sort();
}

// Brand → Console → Accessory cascade, reading from the HardwareReferenceEntry rows
// imported from data/hardware/*.xlsx (type=Accessory) — same pattern
// DevicePredefinedFields.tsx uses for Brand → Console → Variant. Picking a console narrows
// the Accessory options to ones offered for it; the selected console becomes this
// accessory's reported compatible platform. The parent (AddAccessoryForm) owns the actual
// editable Official Name/Model Number fields, since it needs to interleave them with other
// form fields in a specific row layout.
const AccessoryPredefinedFields = ({ onChange }: AccessoryPredefinedFieldsProps) => {
  const { data: entries } = useHardwareReferenceEntries("Accessory");

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
      accessoryType: matchedEntry?.category ?? "",
      suggestedOfficialName: officialNameChoice,
      compatiblePlatforms: platform ? [platform] : [],
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
          label="Accessory"
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

export default AccessoryPredefinedFields;
