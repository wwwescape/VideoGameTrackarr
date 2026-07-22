import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { toast } from "react-toastify";
import ConfirmDialog from "./ConfirmDialog";
import FieldRow from "./FieldRow";
import HardwareCoverCard from "./HardwareCoverCard";
import NotesSection from "./NotesSection";
import TagsSection from "./TagsSection";
import { useDeleteDevice, useDeviceItem } from "../hooks/useDevice";
import {
  useCreateDeviceNote,
  useDeleteDeviceNote,
  useDeviceNotes,
  useUpdateDeviceNote,
} from "../hooks/useDeviceNotes";
import { useAttachDeviceTag, useDetachDeviceTag } from "../hooks/useTags";
import { useCurrency } from "../theme/CurrencyProvider";
import { formatCurrency } from "../utils/currency";
import { useUserDeviceList } from "../hooks/useUserDevice";
import { CONDITION_LABELS, RATING_BOARD_LABELS } from "../utils/hardwareLabels";
import { hardwareIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";

const sectionCardSx = { borderRadius: 2, overflow: "hidden" } as const;

const DeviceDetails = () => {
  const { identifier } = useParams<{ identifier: string }>();
  const navigate = useNavigate();

  const { data: device, isLoading } = useDeviceItem(identifier);
  const deviceId = device?.id ?? NaN;
  const { currency } = useCurrency();
  const deleteDevice = useDeleteDevice();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data: ownershipRows } = useUserDeviceList(deviceId);

  const attachTag = useAttachDeviceTag(deviceId);
  const detachTag = useDetachDeviceTag(deviceId);

  const { data: deviceNotes } = useDeviceNotes(deviceId);
  const createNote = useCreateDeviceNote(deviceId);
  const updateNote = useUpdateDeviceNote(deviceId);
  const deleteNote = useDeleteDeviceNote(deviceId);

  if (isLoading || !device) {
    return <Paper sx={{ p: 3, textAlign: "center" }}>Loading...</Paper>;
  }

  // A device can technically have multiple owned/wishlisted UserDevice rows, but Add Device
  // always creates exactly one alongside the catalog row — this page shows that one record
  // rather than a list, preferring an owned copy over a wishlisted one if both exist.
  const primaryOwnership = ownershipRows?.find((row) => row.status === "owned") ?? ownershipRows?.[0] ?? null;

  const handleDelete = async () => {
    try {
      await deleteDevice.mutateAsync(deviceId);
      toast.success("Device removed.", TOAST_OPTIONS);
      navigate("/hardware");
    } catch (error) {
      console.error("Error deleting device:", error);
      toast.error("Error deleting device. Please try again.", TOAST_OPTIONS);
    }
  };

  return (
    <Grid container spacing={{ xs: 2, md: 3 }} sx={{ alignItems: "flex-start" }}>
      <Grid size={{ xs: 12, md: 3 }}>
        <Stack spacing={2}>
          <HardwareCoverCard
            name={device.officialName}
            imageUrl={device.imageUrl}
            owned={device.owned}
            wishlisted={device.wishlisted}
          />
          <Stack spacing={1.5}>
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/hardware/device/${hardwareIdentifier(device.officialName, device.uuid)}/edit`)}
              fullWidth
            >
              Edit Device
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteConfirmOpen(true)}
              fullWidth
            >
              Remove Device
            </Button>
          </Stack>
        </Stack>
      </Grid>

      <Grid size={{ xs: 12, md: 9 }}>
        <Stack spacing={3}>
          <Card sx={sectionCardSx}>
            <CardContent>
              <Typography variant="h4" component="h1">
                {device.officialName}
                {device.hardwareReference?.releaseDate ? (
                  <Typography variant="subtitle2" color="text.secondary" component="span">
                    {" "}
                    ({device.hardwareReference.releaseDate})
                  </Typography>
                ) : null}
              </Typography>
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                <FieldRow label="Brand" value={device.manufacturerName} />
                <FieldRow label="Console" value={device.hardwarePlatformName} />
                <FieldRow label="Variant" value={device.hardwareReference?.artefact} />
              </Stack>
              {device.hardwareReference?.summary ? (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                    {device.hardwareReference.summary}
                  </Typography>
                </>
              ) : null}
              <Divider sx={{ my: 1.5 }} />
              <Stack spacing={0.5}>
                <FieldRow label="Model Number" value={device.model} />
                <FieldRow label="Serial Number" value={primaryOwnership?.serialNumber} />
                <FieldRow label="Color" value={device.colorName} />
                <FieldRow label="Storage" value={device.storageVariantName} />
                <FieldRow label="Revision" value={device.revision} />
                <FieldRow
                  label="Ratings Board"
                  value={device.ratingBoard ? RATING_BOARD_LABELS[device.ratingBoard] : null}
                />
              </Stack>
            </CardContent>
          </Card>

          <Card sx={sectionCardSx}>
            <CardHeader title="Price" />
            <CardContent>
              <Typography variant="body2">
                {primaryOwnership?.purchasePrice != null
                  ? formatCurrency(primaryOwnership.purchasePrice, currency)
                  : "Not set"}
              </Typography>
            </CardContent>
          </Card>

          <Card sx={sectionCardSx}>
            <TagsSection
              tags={device.tags}
              onAttach={(tagId) => attachTag.mutateAsync(tagId)}
              onDetach={(tagId) => detachTag.mutateAsync(tagId)}
              subheader="Organize your own way — modded, for sale, project console, whatever fits"
            />
          </Card>

          <Card sx={sectionCardSx}>
            <NotesSection
              notes={deviceNotes}
              isCreating={createNote.isPending}
              subheader="Maintenance history, where you bought it, anything worth remembering"
              onCreate={(body) => createNote.mutateAsync(body)}
              onUpdate={(noteId, body) => updateNote.mutateAsync({ noteId, body })}
              onDelete={(noteId) => deleteNote.mutateAsync(noteId)}
            />
          </Card>

          <Card sx={sectionCardSx}>
            <CardHeader title="Your inventory" />
            <CardContent>
              {primaryOwnership ? (
                <Stack spacing={0.5}>
                  <FieldRow label="Status" value={primaryOwnership.status === "owned" ? "Owned" : "Wishlist"} />
                  <FieldRow
                    label="Condition"
                    value={primaryOwnership.condition ? CONDITION_LABELS[primaryOwnership.condition] : null}
                  />
                </Stack>
              ) : (
                <Typography color="text.secondary">Not tracked yet.</Typography>
              )}
            </CardContent>
          </Card>

          <Card sx={sectionCardSx}>
            <CardHeader title="Linked Accessories" />
            <CardContent>
              {device.linkedAccessories.length === 0 ? (
                <Typography color="text.secondary">
                  No accessories linked yet — link one from the Accessory&apos;s own Add/Edit form.
                </Typography>
              ) : (
                <Stack spacing={1.5}>
                  {device.linkedAccessories.map((linkedAccessory) => (
                    <Paper
                      key={linkedAccessory.id}
                      variant="outlined"
                      sx={{ p: 1.5, cursor: "pointer" }}
                      onClick={() =>
                        navigate(
                          `/hardware/accessory/${hardwareIdentifier(linkedAccessory.officialName, linkedAccessory.uuid)}`
                        )
                      }
                    >
                      <Typography variant="subtitle2">{linkedAccessory.officialName}</Typography>
                    </Paper>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Grid>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete this device?"
        description={`This permanently removes "${device.officialName}" and its inventory/tag/note records.`}
        confirmLabel="Delete"
        confirmColor="error"
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </Grid>
  );
};

export default DeviceDetails;
