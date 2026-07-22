import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { toast } from "react-toastify";
import ConfirmDialog from "./ConfirmDialog";
import FieldRow from "./FieldRow";
import HardwareCoverCard from "./HardwareCoverCard";
import NotesSection from "./NotesSection";
import TagsSection from "./TagsSection";
import { useAccessoryItem, useDeleteAccessory } from "../hooks/useAccessories";
import {
  useCreateAccessoryNote,
  useDeleteAccessoryNote,
  useAccessoryNotes,
  useUpdateAccessoryNote,
} from "../hooks/useAccessoryNotes";
import { useAttachAccessoryTag, useDetachAccessoryTag } from "../hooks/useTags";
import { useCurrency } from "../theme/CurrencyProvider";
import { formatCurrency } from "../utils/currency";
import { useUserAccessoryList } from "../hooks/useUserAccessories";
import { CONDITION_LABELS, RATING_BOARD_LABELS } from "../utils/hardwareLabels";
import { hardwareIdentifier } from "../utils/identifiers";
import { TOAST_OPTIONS } from "../utils/toastOptions";

const sectionCardSx = { borderRadius: 2, overflow: "hidden" } as const;

const AccessoryDetails = () => {
  const { identifier } = useParams<{ identifier: string }>();
  const navigate = useNavigate();

  const { data: accessory, isLoading } = useAccessoryItem(identifier);
  const accessoryId = accessory?.id ?? NaN;
  const { currency } = useCurrency();
  const deleteAccessory = useDeleteAccessory();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { data: ownershipRows } = useUserAccessoryList(accessoryId);

  const attachTag = useAttachAccessoryTag(accessoryId);
  const detachTag = useDetachAccessoryTag(accessoryId);

  const { data: accessoryNotes } = useAccessoryNotes(accessoryId);
  const createNote = useCreateAccessoryNote(accessoryId);
  const updateNote = useUpdateAccessoryNote(accessoryId);
  const deleteNote = useDeleteAccessoryNote(accessoryId);

  if (isLoading || !accessory) {
    return <Paper sx={{ p: 3, textAlign: "center" }}>Loading...</Paper>;
  }

  // An accessory can technically have multiple owned/wishlisted UserAccessory rows, but Add
  // Accessory always creates exactly one alongside the catalog row — this page shows that one
  // record rather than a list, preferring an owned copy over a wishlisted one if both exist.
  const primaryOwnership = ownershipRows?.find((row) => row.status === "owned") ?? ownershipRows?.[0] ?? null;
  const isCustom = !accessory.hardwareReference;
  const releaseDate = accessory.releaseDate ?? accessory.hardwareReference?.releaseDate ?? null;
  const summaryText = accessory.hardwareReference?.summary ?? accessory.summary;

  const handleDelete = async () => {
    try {
      await deleteAccessory.mutateAsync(accessoryId);
      toast.success("Accessory removed.", TOAST_OPTIONS);
      navigate("/hardware");
    } catch (error) {
      console.error("Error deleting accessory:", error);
      toast.error("Error deleting accessory. Please try again.", TOAST_OPTIONS);
    }
  };

  return (
    <Grid container spacing={{ xs: 2, md: 3 }} sx={{ alignItems: "flex-start" }}>
      <Grid size={{ xs: 12, md: 3 }}>
        <Stack spacing={2}>
          <HardwareCoverCard
            name={accessory.officialName}
            imageUrl={accessory.imageUrl}
            owned={accessory.owned}
            wishlisted={accessory.wishlisted}
          />
          <Stack spacing={1.5}>
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() =>
                navigate(`/hardware/accessory/${hardwareIdentifier(accessory.officialName, accessory.uuid)}/edit`)
              }
              fullWidth
            >
              Edit Accessory
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteConfirmOpen(true)}
              fullWidth
            >
              Remove Accessory
            </Button>
          </Stack>
        </Stack>
      </Grid>

      <Grid size={{ xs: 12, md: 9 }}>
        <Stack spacing={3}>
          <Card sx={sectionCardSx}>
            <CardContent>
              {isCustom ? (
                <Tooltip title="Added by hand, not linked to a reference catalog entry.">
                  <Chip label="Custom" size="small" variant="outlined" sx={{ mb: 1 }} />
                </Tooltip>
              ) : null}
              <Typography variant="h4" component="h1">
                {accessory.officialName}
                {releaseDate ? (
                  <Typography variant="subtitle2" color="text.secondary" component="span">
                    {" "}
                    ({releaseDate})
                  </Typography>
                ) : null}
              </Typography>
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                <FieldRow label="Brand" value={accessory.manufacturerName} />
              </Stack>
              {summaryText ? (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                    {summaryText}
                  </Typography>
                </>
              ) : null}
              <Divider sx={{ my: 1.5 }} />
              <Stack spacing={0.5}>
                <FieldRow label="Model Number" value={accessory.model} />
                <FieldRow label="Serial Number" value={primaryOwnership?.serialNumber} />
                <FieldRow label="Color" value={accessory.colorName} />
                <FieldRow label="Revision" value={accessory.revision} />
                <FieldRow
                  label="Ratings Board"
                  value={accessory.ratingBoard ? RATING_BOARD_LABELS[accessory.ratingBoard] : null}
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
              tags={accessory.tags}
              onAttach={(tagId) => attachTag.mutateAsync(tagId)}
              onDetach={(tagId) => detachTag.mutateAsync(tagId)}
              subheader="Organize your own way — modded, for sale, project console, whatever fits"
            />
          </Card>

          <Card sx={sectionCardSx}>
            <NotesSection
              notes={accessoryNotes}
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
            <CardHeader title="Linked Devices" />
            <CardContent>
              {accessory.linkedDevices.length === 0 ? (
                <Typography color="text.secondary">No devices linked yet.</Typography>
              ) : (
                <Stack spacing={1.5}>
                  {accessory.linkedDevices.map((linkedDevice) => (
                    <Paper
                      key={linkedDevice.id}
                      variant="outlined"
                      sx={{ p: 1.5, cursor: "pointer" }}
                      onClick={() =>
                        navigate(`/hardware/device/${hardwareIdentifier(linkedDevice.officialName, linkedDevice.uuid)}`)
                      }
                    >
                      <Typography variant="subtitle2">{linkedDevice.officialName}</Typography>
                    </Paper>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card sx={sectionCardSx}>
            <CardHeader title="Linked Accessories" />
            <CardContent>
              {accessory.linkedAccessories.length === 0 ? (
                <Typography color="text.secondary">No accessories linked yet.</Typography>
              ) : (
                <Stack spacing={1.5}>
                  {accessory.linkedAccessories.map((linkedAccessory) => (
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
        title="Delete this accessory?"
        description={`This permanently removes "${accessory.officialName}" and its inventory/tag/note records.`}
        confirmLabel="Delete"
        confirmColor="error"
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </Grid>
  );
};

export default AccessoryDetails;
