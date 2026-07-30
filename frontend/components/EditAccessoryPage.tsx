import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import CloseIcon from "@mui/icons-material/Close";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { toast } from "react-toastify";
import { resolveAssetUrl } from "../api/client";
import type { AccessoryDetail, HardwareCondition, LibraryStatus, RatingBoard, UserAccessory } from "../api/types";
import { useAccessoryItem, useAccessoryList, useUpdateAccessory } from "../hooks/useAccessories";
import { useDeviceList } from "../hooks/useDevice";
import { useColors, useManufacturers } from "../hooks/useHardwareLookups";
import { useHardwareReferenceEntries } from "../hooks/useHardwareReference";
import { useUploadAccessoryImage } from "../hooks/useUploads";
import { useAddUserAccessory, useUpdateUserAccessory, useUserAccessoryList } from "../hooks/useUserAccessories";
import { CONDITION_LABELS, EXTRA_CUSTOM_ACCESSORY_TYPES, RATING_BOARD_LABELS } from "../utils/hardwareLabels";
import { hardwareIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import AutocompleteSelect from "./AutocompleteSelect";
import FreeSoloLookupField from "./FreeSoloLookupField";

interface StatusOption {
  value: LibraryStatus;
  label: string;
}

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

function unique(values: (string | null)[]): string[] {
  return Array.from(new Set(values.filter((value): value is string => !!value))).sort();
}

interface EditAccessoryFormProps {
  accessory: AccessoryDetail;
  primaryOwnership: UserAccessory | null;
}

// Mirrors AddAccessoryForm.tsx's field set. Predefined accessories (linked to a
// HardwareReferenceEntry) lock Brand/Console/Accessory read-only, same as
// EditDevicePage.tsx locks Brand/Console/Variant. Custom accessories keep those identity
// fields editable, since they were never resolved from the reference cascade to begin with.
const EditAccessoryForm = ({ accessory, primaryOwnership }: EditAccessoryFormProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const updateAccessory = useUpdateAccessory(accessory.id);
  const addUserAccessory = useAddUserAccessory(accessory.id);
  const updateUserAccessory = useUpdateUserAccessory(accessory.id);
  const uploadAccessoryImage = useUploadAccessoryImage();
  const { data: manufacturers } = useManufacturers();
  const { data: accessoryReferenceEntries } = useHardwareReferenceEntries("Accessory");
  const { data: colors } = useColors();
  const { data: deviceList } = useDeviceList();
  const { data: accessoryList } = useAccessoryList();

  const isPredefined = !!accessory.hardwareReference;

  const [officialName, setOfficialName] = useState(accessory.officialName);
  const [model, setModel] = useState(accessory.model ?? "");

  // Custom-mode-only fields.
  const [manufacturer, setManufacturer] = useState(accessory.manufacturerName);
  const [accessoryType, setAccessoryType] = useState(accessory.accessoryTypeName);
  const [releaseYear, setReleaseYear] = useState(accessory.releaseDate ? String(accessory.releaseDate) : "");
  const [imageUrl, setImageUrl] = useState(accessory.imageUrl ?? "");
  const [summary, setSummary] = useState(accessory.summary ?? "");

  // Shared by both modes.
  const [edition, setEdition] = useState(accessory.edition ?? "");
  const [color, setColor] = useState(accessory.colorName ?? "");
  const [revision, setRevision] = useState(accessory.revision ?? "");
  const [ratingBoard, setRatingBoard] = useState<RatingBoard | null>(accessory.ratingBoard);
  const [serialNumber, setSerialNumber] = useState(primaryOwnership?.serialNumber ?? "");
  const [price, setPrice] = useState(primaryOwnership?.purchasePrice != null ? String(primaryOwnership.purchasePrice) : "");
  const [status, setStatus] = useState<LibraryStatus>(primaryOwnership?.status ?? "owned");
  const [condition, setCondition] = useState<HardwareCondition | null>(primaryOwnership?.condition ?? null);
  const [notes, setNotes] = useState(primaryOwnership?.notes ?? "");
  const [linkedDeviceIds, setLinkedDeviceIds] = useState<number[]>(accessory.linkedDevices.map((item) => item.id));
  const [linkedAccessoryIds, setLinkedAccessoryIds] = useState<number[]>(
    accessory.linkedAccessories.map((item) => item.id)
  );

  const isSubmitting =
    updateAccessory.isPending || addUserAccessory.isPending || updateUserAccessory.isPending;

  const STATUS_OPTIONS: StatusOption[] = [
    { value: "owned", label: t("hardware.accessoryForm.statusOwned") },
    { value: "wishlist", label: t("hardware.accessoryForm.statusWishlist") },
  ];

  const RATING_BOARD_OPTIONS: RatingBoardOption[] = [
    { value: null, label: t("common.none") },
    ...Object.entries(RATING_BOARD_LABELS).map(([value, label]) => ({ value: value as RatingBoard, label })),
  ];

  const handleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const { url } = await uploadAccessoryImage.mutateAsync(file);
      setImageUrl(url);
    } catch (error) {
      console.error("Error uploading accessory image:", error);
      toast.error(t("hardware.accessoryForm.imageUploadError"), TOAST_OPTIONS);
    }
  };

  const handleSubmit = async () => {
    if (!officialName.trim() || (!isPredefined && (!manufacturer.trim() || !accessoryType.trim()))) {
      toast.error(t("hardware.accessoryForm.requiredFieldsCustom"), TOAST_OPTIONS);
      return;
    }
    try {
      await updateAccessory.mutateAsync({
        ...(isPredefined ? {} : { manufacturer: manufacturer.trim(), accessoryType: accessoryType.trim() }),
        officialName: officialName.trim(),
        model: model.trim() || null,
        edition: isPredefined ? null : edition.trim() || null,
        releaseDate: isPredefined ? null : releaseYear.trim() ? Number(releaseYear) : null,
        summary: isPredefined ? null : summary.trim() || null,
        color: color.trim() || null,
        revision: revision.trim() || null,
        ratingBoard,
        imageUrl: isPredefined ? null : imageUrl || null,
        deviceIds: linkedDeviceIds,
        accessoryIds: linkedAccessoryIds,
      });
      const ownershipInput = {
        status,
        condition,
        serialNumber: serialNumber.trim() || null,
        purchasePrice: price.trim() ? Number(price) : null,
        notes: notes.trim() || null,
      };
      if (primaryOwnership) {
        await updateUserAccessory.mutateAsync({ itemId: primaryOwnership.id, input: ownershipInput });
      } else {
        await addUserAccessory.mutateAsync(ownershipInput);
      }
      toast.success(t("hardware.editAccessory.updateSuccess"), TOAST_OPTIONS);
      navigate(`/hardware/accessory/${hardwareIdentifier(officialName.trim(), accessory.uuid)}`);
    } catch (error) {
      console.error("Error updating accessory:", error);
      toast.error(t("hardware.editAccessory.updateError"), TOAST_OPTIONS);
    }
  };

  return (
    <Paper sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2 }}>
      <Grid container spacing={2.5}>
        {isPredefined ? (
          <>
            <Grid size={12}>
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label={t("hardware.accessoryForm.brandLabel")}
                    fullWidth
                    disabled
                    value={accessory.manufacturerName}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label={t("hardware.editAccessory.consoleLabel")}
                    fullWidth
                    disabled
                    value={accessory.compatiblePlatforms[0]?.name ?? ""}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label={t("hardware.editAccessory.accessoryReadOnlyLabel")}
                    fullWidth
                    disabled
                    value={accessory.hardwareReference?.artefact ?? ""}
                  />
                </Grid>
              </Grid>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={t("hardware.accessoryForm.officialNameLabel")}
                required
                fullWidth
                value={officialName}
                onChange={(event) => setOfficialName(event.target.value)}
                helperText={t("hardware.accessoryForm.officialNameHelperText")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={t("hardware.accessoryForm.editionLabel")}
                fullWidth
                disabled
                value=""
                helperText={t("hardware.accessoryForm.editionComingSoonHelperText")}
              />
            </Grid>
          </>
        ) : (
          <>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FreeSoloLookupField
                label={t("hardware.accessoryForm.brandLabel")}
                options={manufacturers ?? []}
                value={manufacturer}
                onChange={setManufacturer}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <AutocompleteSelect<string>
                label={t("hardware.accessoryForm.accessoryTypeLabel")}
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
                label={t("hardware.accessoryForm.officialNameLabel")}
                required
                fullWidth
                value={officialName}
                onChange={(event) => setOfficialName(event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={t("hardware.accessoryForm.editionLabel")}
                fullWidth
                value={edition}
                onChange={(event) => setEdition(event.target.value)}
                helperText={t("hardware.accessoryForm.editionHelperText")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={t("hardware.accessoryForm.releaseYearLabel")}
                fullWidth
                value={releaseYear}
                onChange={(event) => setReleaseYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder={t("hardware.accessoryForm.releaseYearPlaceholder")}
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
                  {imageUrl
                    ? t("hardware.accessoryForm.replaceImageButton")
                    : t("hardware.accessoryForm.uploadImageButton")}
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
                      alt={t("hardware.accessoryForm.imagePreviewAlt")}
                      sx={{ height: 56, width: "auto", borderRadius: 1, border: "1px solid", borderColor: "divider" }}
                    />
                    <IconButton
                      size="small"
                      aria-label={t("hardware.accessoryForm.removeImageAriaLabel")}
                      onClick={() => setImageUrl("")}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </>
                ) : null}
              </Stack>
            </Grid>
            <Grid size={12}>
              <TextField
                label={t("hardware.accessoryForm.summaryLabel")}
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
                label={t("hardware.accessoryForm.linkedDevicesLabel")}
                helperText={t("hardware.accessoryForm.linkedDevicesHelperText")}
              />
            )}
          />
        </Grid>
        <Grid size={12}>
          <Autocomplete
            multiple
            options={(accessoryList ?? []).filter((item) => item.id !== accessory.id)}
            getOptionLabel={(option) => option.officialName}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={(accessoryList ?? []).filter((item) => linkedAccessoryIds.includes(item.id))}
            onChange={(_event, newValue) => setLinkedAccessoryIds(newValue.map((item) => item.id))}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("hardware.accessoryForm.linkedAccessoriesLabel")}
                helperText={t("hardware.accessoryForm.linkedAccessoriesHelperText")}
              />
            )}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label={t("hardware.accessoryForm.modelNumberLabel")}
            fullWidth
            value={model}
            onChange={(event) => setModel(event.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label={t("hardware.accessoryForm.serialNumberLabel")}
            fullWidth
            value={serialNumber}
            onChange={(event) => setSerialNumber(event.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FreeSoloLookupField
            label={t("hardware.accessoryForm.colorLabel")}
            options={colors ?? []}
            value={color}
            onChange={setColor}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }} />
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label={t("hardware.accessoryForm.revisionLabel")}
            fullWidth
            value={revision}
            onChange={(event) => setRevision(event.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <AutocompleteSelect<RatingBoardOption>
            label={t("hardware.accessoryForm.ratingsBoardLabel")}
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
            label={t("hardware.accessoryForm.priceLabel")}
            fullWidth
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }} />
        <Grid size={{ xs: 12, sm: 6 }}>
          <AutocompleteSelect<StatusOption>
            label={t("hardware.accessoryForm.statusLabel")}
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
              label={t("hardware.accessoryForm.conditionLabel")}
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
            label={t("hardware.accessoryForm.notesLabel")}
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
              {t("hardware.editAccessory.saveButton")}
            </Button>
            <Button
              variant="text"
              onClick={() =>
                navigate(`/hardware/accessory/${hardwareIdentifier(accessory.officialName, accessory.uuid)}`)
              }
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );
};

const EditAccessoryPage = () => {
  const { t } = useTranslation();
  const { identifier } = useParams<{ identifier: string }>();

  const { data: accessory, isLoading: isAccessoryLoading } = useAccessoryItem(identifier);
  const { data: ownershipRows, isLoading: isOwnershipLoading } = useUserAccessoryList(accessory?.id ?? NaN);

  if (isAccessoryLoading || isOwnershipLoading || !accessory) {
    return <Paper sx={{ p: 3, textAlign: "center" }}>{t("common.loading")}</Paper>;
  }

  const primaryOwnership = ownershipRows?.find((row) => row.status === "owned") ?? ownershipRows?.[0] ?? null;

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("hardware.editAccessory.title")}
        </Typography>
      </Box>
      <EditAccessoryForm accessory={accessory} primaryOwnership={primaryOwnership} />
    </>
  );
};

export default EditAccessoryPage;
