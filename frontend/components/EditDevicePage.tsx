import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { DeviceDetail, HardwareCondition, LibraryStatus, RatingBoard, UserDevice } from "../api/types";
import { useDeviceItem, useUpdateDevice } from "../hooks/useDevice";
import { useColors, useStorageVariants } from "../hooks/useHardwareLookups";
import { useAddUserDevice, useUpdateUserDevice, useUserDeviceList } from "../hooks/useUserDevice";
import { CONDITION_LABELS, RATING_BOARD_LABELS } from "../utils/hardwareLabels";
import { hardwareIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import AutocompleteSelect from "./AutocompleteSelect";
import FreeSoloLookupField from "./FreeSoloLookupField";

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

interface EditDeviceFormProps {
  device: DeviceDetail;
  primaryOwnership: UserDevice | null;
}

// Mirrors AddDeviceForm.tsx's field set, but Brand/Console/Variant are locked read-only —
// every Device comes from the predefined Brand/Console/Variant cascade, so there is no
// "custom" identity to re-resolve here, only the catalog/ownership details below it.
const EditDeviceForm = ({ device, primaryOwnership }: EditDeviceFormProps) => {
  const navigate = useNavigate();
  const updateDevice = useUpdateDevice(device.id);
  const addUserDevice = useAddUserDevice(device.id);
  const updateUserDevice = useUpdateUserDevice(device.id);
  const { data: storageVariants } = useStorageVariants();
  const { data: colors } = useColors();

  const [officialName, setOfficialName] = useState(device.officialName);
  const [model, setModel] = useState(device.model ?? "");
  const [revision, setRevision] = useState(device.revision ?? "");
  const [storageVariant, setStorageVariant] = useState(device.storageVariantName ?? "");
  const [color, setColor] = useState(device.colorName ?? "");
  const [ratingBoard, setRatingBoard] = useState<RatingBoard | null>(device.ratingBoard);
  const [serialNumber, setSerialNumber] = useState(primaryOwnership?.serialNumber ?? "");
  const [price, setPrice] = useState(primaryOwnership?.purchasePrice != null ? String(primaryOwnership.purchasePrice) : "");
  const [status, setStatus] = useState<LibraryStatus>(primaryOwnership?.status ?? "owned");
  const [condition, setCondition] = useState<HardwareCondition | null>(primaryOwnership?.condition ?? null);
  const [notes, setNotes] = useState(primaryOwnership?.notes ?? "");

  const isSubmitting = updateDevice.isPending || addUserDevice.isPending || updateUserDevice.isPending;

  const handleSubmit = async () => {
    if (!officialName.trim()) {
      toast.error("Official name is required.", TOAST_OPTIONS);
      return;
    }
    try {
      await updateDevice.mutateAsync({
        officialName: officialName.trim(),
        model: model.trim() || null,
        revision: revision.trim() || null,
        storageVariant: storageVariant.trim() || null,
        color: color.trim() || null,
        ratingBoard,
      });
      const ownershipInput = {
        status,
        condition,
        serialNumber: serialNumber.trim() || null,
        purchasePrice: price.trim() ? Number(price) : null,
        notes: notes.trim() || null,
      };
      if (primaryOwnership) {
        await updateUserDevice.mutateAsync({ itemId: primaryOwnership.id, input: ownershipInput });
      } else {
        await addUserDevice.mutateAsync(ownershipInput);
      }
      toast.success("Device updated.", TOAST_OPTIONS);
      navigate(`/hardware/device/${hardwareIdentifier(officialName.trim(), device.uuid)}`);
    } catch (error) {
      console.error("Error updating device:", error);
      toast.error("Error updating device. Please try again.", TOAST_OPTIONS);
    }
  };

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
      <Grid container spacing={2.5}>
        <Grid size={12}>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Brand" fullWidth disabled value={device.manufacturerName} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Console" fullWidth disabled value={device.hardwarePlatformName ?? ""} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Variant" fullWidth disabled value={device.hardwareReference?.artefact ?? ""} />
            </Grid>
          </Grid>
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
          <Stack direction="row" spacing={1.5}>
            <Button variant="contained" onClick={() => void handleSubmit()} disabled={isSubmitting}>
              Save Changes
            </Button>
            <Button
              variant="text"
              onClick={() => navigate(`/hardware/device/${hardwareIdentifier(device.officialName, device.uuid)}`)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );
};

const EditDevicePage = () => {
  const { identifier } = useParams<{ identifier: string }>();

  const { data: device, isLoading: isDeviceLoading } = useDeviceItem(identifier);
  const { data: ownershipRows, isLoading: isOwnershipLoading } = useUserDeviceList(device?.id ?? NaN);

  if (isDeviceLoading || isOwnershipLoading || !device) {
    return <Paper sx={{ p: 3, textAlign: "center" }}>Loading...</Paper>;
  }

  const primaryOwnership = ownershipRows?.find((row) => row.status === "owned") ?? ownershipRows?.[0] ?? null;

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Edit Device
        </Typography>
      </Box>
      <EditDeviceForm device={device} primaryOwnership={primaryOwnership} />
    </>
  );
};

export default EditDevicePage;
