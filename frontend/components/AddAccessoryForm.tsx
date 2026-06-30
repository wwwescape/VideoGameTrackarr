import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CloseIcon from "@mui/icons-material/Close";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { toast } from "react-toastify";
import { resolveAssetUrl } from "../api/client";
import type { HardwareCondition, LibraryStatus, RatingBoard } from "../api/types";
import { useAccessoryList, useCreateAccessory } from "../hooks/useAccessories";
import { useDeviceList } from "../hooks/useDevice";
import { useColors, useManufacturers } from "../hooks/useHardwareLookups";
import { useHardwareReferenceEntries } from "../hooks/useHardwareReference";
import { useUploadAccessoryImage } from "../hooks/useUploads";
import { CONDITION_LABELS, EXTRA_CUSTOM_ACCESSORY_TYPES, RATING_BOARD_LABELS } from "../utils/hardwareLabels";
import { hardwareIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import AccessoryPredefinedFields, { type AccessoryPredefinedValues } from "./AccessoryPredefinedFields";
import AutocompleteSelect from "./AutocompleteSelect";
import FreeSoloLookupField from "./FreeSoloLookupField";

type AddMode = "predefined" | "custom";

const EMPTY_PREDEFINED: AccessoryPredefinedValues = {
  manufacturer: "",
  accessoryType: "",
  suggestedOfficialName: "",
  compatiblePlatforms: [],
  hardwareReferenceEntryId: null,
};

interface StatusOption {
  value: LibraryStatus;
  label: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: "owned", label: "Owned" },
  { value: "wishlist", label: "Wishlist" },
];

interface ConditionOption {
  value: HardwareCondition;
  label: string;
}

const CONDITION_OPTIONS: ConditionOption[] = Object.entries(CONDITION_LABELS).map(([value, label]) => ({
  value: value as HardwareCondition,
  label,
}));

interface RatingBoardOption {
  value: RatingBoard | null;
  label: string;
}

const RATING_BOARD_OPTIONS: RatingBoardOption[] = [
  { value: null, label: "None" },
  ...Object.entries(RATING_BOARD_LABELS).map(([value, label]) => ({ value: value as RatingBoard, label })),
];

function unique(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((value): value is string => !!value))).sort();
}

const AddAccessoryForm = () => {
  const navigate = useNavigate();
  const createAccessory = useCreateAccessory();
  const uploadAccessoryImage = useUploadAccessoryImage();
  const { data: manufacturers } = useManufacturers();
  const { data: accessoryReferenceEntries } = useHardwareReferenceEntries("Accessory");
  const { data: colors } = useColors();
  const { data: deviceList } = useDeviceList();
  const { data: accessoryList } = useAccessoryList();

  const [mode, setMode] = useState<AddMode>("predefined");
  const [predefined, setPredefined] = useState<AccessoryPredefinedValues>(EMPTY_PREDEFINED);

  // Shared by both modes — lifted out of AccessoryPredefinedFields so the row layout can
  // interleave them with Edition/Linked Devices/etc.
  const [officialName, setOfficialName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [model, setModel] = useState("");

  // Custom-mode-only fields.
  const [manufacturer, setManufacturer] = useState("");
  const [accessoryType, setAccessoryType] = useState("");
  const [releaseYear, setReleaseYear] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [summary, setSummary] = useState("");

  // Shared by both modes.
  const [edition, setEdition] = useState("");
  const [color, setColor] = useState("");
  const [revision, setRevision] = useState("");
  const [ratingBoard, setRatingBoard] = useState<RatingBoard | null>(null);
  const [serialNumber, setSerialNumber] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<LibraryStatus>("owned");
  const [condition, setCondition] = useState<HardwareCondition | null>(null);
  const [notes, setNotes] = useState("");
  const [linkedDeviceIds, setLinkedDeviceIds] = useState<number[]>([]);
  const [linkedAccessoryIds, setLinkedAccessoryIds] = useState<number[]>([]);

  const isPredefined = mode === "predefined";

  useEffect(() => {
    if (isPredefined && !nameTouched) {
      setOfficialName(predefined.suggestedOfficialName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predefined.suggestedOfficialName, isPredefined]);

  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const { url } = await uploadAccessoryImage.mutateAsync(file);
      setImageUrl(url);
    } catch (error) {
      console.error("Error uploading accessory image:", error);
      toast.error("Error uploading accessory image. Please try again.", TOAST_OPTIONS);
    }
  };

  const handleSubmit = async () => {
    const resolvedManufacturer = isPredefined ? predefined.manufacturer : manufacturer;
    const resolvedAccessoryType = isPredefined ? predefined.accessoryType : accessoryType;

    if (isPredefined) {
      if (!resolvedManufacturer.trim() || predefined.compatiblePlatforms.length === 0 || !resolvedAccessoryType.trim() || !officialName.trim()) {
        toast.error("Brand, console, accessory, and official name are required.", TOAST_OPTIONS);
        return;
      }
    } else if (!resolvedManufacturer.trim() || !resolvedAccessoryType.trim() || !officialName.trim()) {
      toast.error("Brand, accessory type, and official name are required.", TOAST_OPTIONS);
      return;
    }
    try {
      const accessory = await createAccessory.mutateAsync({
        manufacturer: resolvedManufacturer.trim(),
        accessoryType: resolvedAccessoryType.trim(),
        officialName: officialName.trim(),
        model: model.trim() || null,
        edition: isPredefined ? null : edition.trim() || null,
        releaseDate: isPredefined ? null : releaseYear.trim() ? Number(releaseYear) : null,
        summary: isPredefined ? null : summary.trim() || null,
        color: color.trim() || null,
        revision: revision.trim() || null,
        ratingBoard,
        imageUrl: isPredefined ? null : imageUrl || null,
        compatiblePlatforms: isPredefined ? predefined.compatiblePlatforms : [],
        deviceIds: linkedDeviceIds,
        accessoryIds: linkedAccessoryIds,
        hardwareReferenceEntryId: isPredefined ? predefined.hardwareReferenceEntryId : null,
        ownership: {
          status,
          condition,
          serialNumber: serialNumber.trim() || null,
          purchasePrice: price.trim() ? Number(price) : null,
          notes: notes.trim() || null,
        },
      });
      toast.success("Accessory added!", TOAST_OPTIONS);
      navigate(`/hardware/accessory/${hardwareIdentifier(accessory.officialName, accessory.uuid)}`);
    } catch (error) {
      console.error("Error adding accessory:", error);
      toast.error("Error adding accessory. Please try again.", TOAST_OPTIONS);
    }
  };

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
      <RadioGroup row value={mode} onChange={(event) => setMode(event.target.value as AddMode)} sx={{ mb: 2 }}>
        <FormControlLabel value="predefined" control={<Radio />} label="Predefined" />
        <FormControlLabel value="custom" control={<Radio />} label="Custom" />
      </RadioGroup>

      <Grid container spacing={2.5}>
        {isPredefined ? (
          <>
            <Grid size={12}>
              <AccessoryPredefinedFields
                onChange={(values) => {
                  setPredefined(values);
                  setNameTouched(false);
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Official name"
                required
                fullWidth
                value={officialName}
                onChange={(event) => {
                  setOfficialName(event.target.value);
                  setNameTouched(true);
                }}
                helperText="Auto-filled from your selections — edit if you want to tweak it"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Edition" fullWidth disabled value="" helperText="Coming Soon!" />
            </Grid>
          </>
        ) : (
          <>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FreeSoloLookupField
                label="Brand"
                options={manufacturers ?? []}
                value={manufacturer}
                onChange={setManufacturer}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <AutocompleteSelect<string>
                label="Accessory type"
                fullWidth
                required
                options={unique([
                  ...(accessoryReferenceEntries ?? []).map((entry) => entry.category),
                  ...EXTRA_CUSTOM_ACCESSORY_TYPES,
                ])}
                value={accessoryType || null}
                getOptionLabel={(option) => option}
                onChange={(newValue) => setAccessoryType(newValue ?? "")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Official name"
                required
                fullWidth
                value={officialName}
                onChange={(event) => setOfficialName(event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Edition"
                fullWidth
                value={edition}
                onChange={(event) => setEdition(event.target.value)}
                helperText='Optional, e.g. "Spider-Man 2 Limited Edition"'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Release year"
                fullWidth
                value={releaseYear}
                onChange={(event) => setReleaseYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="e.g. 1998"
                slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 4 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", height: "100%" }}>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={uploadAccessoryImage.isPending ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                  disabled={uploadAccessoryImage.isPending}
                >
                  {imageUrl ? "Replace accessory image" : "Upload accessory image"}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => void handleImageFileChange(event)}
                  />
                </Button>
                {imageUrl ? (
                  <>
                    <Box
                      component="img"
                      src={resolveAssetUrl(imageUrl) ?? undefined}
                      alt="Accessory preview"
                      sx={{ height: 56, width: "auto", borderRadius: 1, border: "1px solid", borderColor: "divider" }}
                    />
                    <IconButton size="small" aria-label="Remove accessory image" onClick={() => setImageUrl("")}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </>
                ) : null}
              </Stack>
            </Grid>
            <Grid size={12}>
              <TextField
                label="Summary"
                fullWidth
                multiline
                minRows={3}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </Grid>
          </>
        )}

        <Grid size={12}>
          <Autocomplete
            multiple
            options={deviceList ?? []}
            getOptionLabel={(option) => option.officialName}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={(deviceList ?? []).filter((item) => linkedDeviceIds.includes(item.id))}
            onChange={(_event, newValue) => setLinkedDeviceIds(newValue.map((item) => item.id))}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Linked devices"
                helperText="Which specific console(s) does this come with or belong to?"
              />
            )}
          />
        </Grid>
        <Grid size={12}>
          <Autocomplete
            multiple
            options={accessoryList ?? []}
            getOptionLabel={(option) => option.officialName}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={(accessoryList ?? []).filter((item) => linkedAccessoryIds.includes(item.id))}
            onChange={(_event, newValue) => setLinkedAccessoryIds(newValue.map((item) => item.id))}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Linked accessories"
                helperText="Other accessories this one is associated with — e.g. a case for a specific controller"
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Model number" fullWidth value={model} onChange={(event) => setModel(event.target.value)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Serial number"
            fullWidth
            value={serialNumber}
            onChange={(event) => setSerialNumber(event.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FreeSoloLookupField label="Color" options={colors ?? []} value={color} onChange={setColor} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }} />
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Revision"
            fullWidth
            value={revision}
            onChange={(event) => setRevision(event.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <AutocompleteSelect<RatingBoardOption>
            label="Ratings Board"
            fullWidth
            options={RATING_BOARD_OPTIONS}
            value={RATING_BOARD_OPTIONS.find((option) => option.value === ratingBoard) ?? null}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(option, val) => option.value === val.value}
            disableClearable
            onChange={(newValue) => setRatingBoard(newValue?.value ?? null)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            type="number"
            label="Price"
            fullWidth
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }} />
        <Grid size={{ xs: 12, sm: 6 }}>
          <AutocompleteSelect<StatusOption>
            label="Status"
            fullWidth
            options={STATUS_OPTIONS}
            value={STATUS_OPTIONS.find((option) => option.value === status) ?? null}
            getOptionLabel={(option) => option.label}
            isOptionEqualToValue={(option, val) => option.value === val.value}
            disableClearable
            onChange={(newValue) => {
              const newStatus = newValue!.value;
              setStatus(newStatus);
              if (newStatus !== "owned") {
                setCondition(null);
              }
            }}
          />
        </Grid>
        {status === "owned" ? (
          <Grid size={{ xs: 12, sm: 6 }}>
            <AutocompleteSelect<ConditionOption>
              label="Condition"
              fullWidth
              options={CONDITION_OPTIONS}
              value={CONDITION_OPTIONS.find((option) => option.value === condition) ?? null}
              getOptionLabel={(option) => option.label}
              isOptionEqualToValue={(option, val) => option.value === val.value}
              onChange={(newValue) => setCondition(newValue?.value ?? null)}
            />
          </Grid>
        ) : (
          <Grid size={{ xs: 12, sm: 6 }} />
        )}
        <Grid size={12}>
          <TextField
            label="Notes"
            fullWidth
            multiline
            minRows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </Grid>
        <Grid size={12}>
          <Button variant="contained" onClick={() => void handleSubmit()} disabled={createAccessory.isPending}>
            Add Accessory
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default AddAccessoryForm;
