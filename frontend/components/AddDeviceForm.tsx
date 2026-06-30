import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import type { HardwareCondition, LibraryStatus, RatingBoard } from "../api/types";
import { useCreateDevice } from "../hooks/useDevice";
import { useColors, useStorageVariants } from "../hooks/useHardwareLookups";
import { CONDITION_LABELS, RATING_BOARD_LABELS } from "../utils/hardwareLabels";
import { hardwareIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import AutocompleteSelect from "./AutocompleteSelect";
import DevicePredefinedFields, { type DevicePredefinedValues } from "./DevicePredefinedFields";
import FreeSoloLookupField from "./FreeSoloLookupField";

const EMPTY_PREDEFINED: DevicePredefinedValues = {
  manufacturer: "",
  deviceType: "",
  hardwarePlatform: "",
  suggestedOfficialName: "",
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

const AddDeviceForm = () => {
  const navigate = useNavigate();
  const createDevice = useCreateDevice();
  const { data: storageVariants } = useStorageVariants();
  const { data: colors } = useColors();

  const [predefined, setPredefined] = useState<DevicePredefinedValues>(EMPTY_PREDEFINED);
  const [officialName, setOfficialName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [model, setModel] = useState("");
  const [revision, setRevision] = useState("");
  const [storageVariant, setStorageVariant] = useState("");
  const [ratingBoard, setRatingBoard] = useState<RatingBoard | null>(null);
  const [color, setColor] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<LibraryStatus>("owned");
  const [condition, setCondition] = useState<HardwareCondition | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!nameTouched) {
      setOfficialName(predefined.suggestedOfficialName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predefined.suggestedOfficialName]);

  const handleSubmit = async () => {
    if (
      !predefined.manufacturer.trim() ||
      !predefined.hardwarePlatform.trim() ||
      !predefined.deviceType.trim() ||
      !officialName.trim()
    ) {
      toast.error("Brand, console, variant, and official name are required.", TOAST_OPTIONS);
      return;
    }
    try {
      const device = await createDevice.mutateAsync({
        manufacturer: predefined.manufacturer.trim(),
        deviceType: predefined.deviceType.trim(),
        hardwarePlatform: predefined.hardwarePlatform.trim() || null,
        officialName: officialName.trim(),
        model: model.trim() || null,
        revision: revision.trim() || null,
        storageVariant: storageVariant.trim() || null,
        color: color.trim() || null,
        ratingBoard,
        hardwareReferenceEntryId: predefined.hardwareReferenceEntryId,
        ownership: {
          status,
          condition,
          serialNumber: serialNumber.trim() || null,
          purchasePrice: price.trim() ? Number(price) : null,
          notes: notes.trim() || null,
        },
      });
      toast.success("Device added!", TOAST_OPTIONS);
      navigate(`/hardware/device/${hardwareIdentifier(device.officialName, device.uuid)}`);
    } catch (error) {
      console.error("Error adding device:", error);
      toast.error("Error adding device. Please try again.", TOAST_OPTIONS);
    }
  };

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
      <Grid container spacing={2.5}>
        <Grid size={12}>
          <DevicePredefinedFields
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
        <Grid size={{ xs: 12, sm: 6 }}>
          <FreeSoloLookupField
            label="Storage"
            options={storageVariants ?? []}
            value={storageVariant}
            onChange={setStorageVariant}
          />
        </Grid>
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
          <Button variant="contained" onClick={() => void handleSubmit()} disabled={createDevice.isPending}>
            Add Device
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default AddDeviceForm;
