import { useState } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import ImageNotSupportedIcon from "@mui/icons-material/ImageNotSupported";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { saveStateScreenshotPath } from "../api/library";
import type { SaveState } from "../api/types";
import { useAuthedObjectUrl } from "../hooks/useAuthedObjectUrl";
import { useDeleteSaveState, useSaveStates } from "../hooks/useLibrary";
import { formatFileSize } from "../utils/roms";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";

interface SaveStatePickerDialogProps {
  open: boolean;
  romId: number | null;
  title: string;
  // "Load" over the running player, or "Resume" to start the player from a state.
  loadLabel: string;
  onLoad: (state: SaveState) => void;
  onClose: () => void;
}

const SaveStateThumbnail = ({ romId, state }: { romId: number; state: SaveState }) => {
  const { t } = useTranslation();
  const url = useAuthedObjectUrl(
    state.hasScreenshot ? saveStateScreenshotPath(romId, state.id) : null
  );
  return (
    <Box
      sx={{
        aspectRatio: "4 / 3",
        bgcolor: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {url ? (
        <Box
          component="img"
          src={url}
          alt={t("games.play.saveStateScreenshotAlt")}
          sx={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated" }}
        />
      ) : state.hasScreenshot ? (
        <CircularProgress size={24} />
      ) : (
        <ImageNotSupportedIcon sx={{ color: "grey.600" }} />
      )}
    </Box>
  );
};

// A ROM's server-side save states, newest first, each with its screenshot and a Load +
// Delete action. Shared by the in-game Load State button (over the running player) and the
// Play Game dialog's Resume… button.
const SaveStatePickerDialog = ({
  open,
  romId,
  title,
  loadLabel,
  onLoad,
  onClose,
}: SaveStatePickerDialogProps) => {
  const { t, i18n } = useTranslation();
  const { data: states, isLoading } = useSaveStates(open ? romId : null);
  const deleteState = useDeleteSaveState(romId ?? 0);
  const [pendingDelete, setPendingDelete] = useState<SaveState | null>(null);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, { dateStyle: "medium", timeStyle: "short" });

  const handleDelete = async () => {
    const state = pendingDelete;
    setPendingDelete(null);
    if (!state) return;
    try {
      await deleteState.mutateAsync(state.id);
    } catch (error) {
      console.error("Error deleting save state:", error);
      toast.error(t("games.play.deleteStateErrorToast"), TOAST_OPTIONS);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle>{title}</DialogTitle>
        <DialogContent dividers>
          {isLoading || romId == null ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : !states || states.length === 0 ? (
            <Typography sx={{ py: 2 }}>{t("games.play.noSaveStates")}</Typography>
          ) : (
            <Grid container spacing={2}>
              {states.map((state) => (
                <Grid key={state.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card variant="outlined">
                    <SaveStateThumbnail romId={romId} state={state} />
                    <CardContent sx={{ pb: 0 }}>
                      <Typography variant="body2">{formatDate(state.createdAt)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(state.sizeBytes)}
                      </Typography>
                    </CardContent>
                    <CardActions sx={{ justifyContent: "space-between" }}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<PlayArrowIcon />}
                        onClick={() => onLoad(state)}
                        aria-label={`${loadLabel} ${formatDate(state.createdAt)}`}
                      >
                        {loadLabel}
                      </Button>
                      <Tooltip title={t("common.delete")}>
                        <IconButton
                          size="small"
                          onClick={() => setPendingDelete(state)}
                          aria-label={t("games.play.deleteStateAria", {
                            date: formatDate(state.createdAt),
                          })}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t("common.close")}</Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        open={pendingDelete != null}
        title={t("games.play.deleteStateTitle")}
        description={t("games.play.deleteStateDescription", {
          date: pendingDelete ? formatDate(pendingDelete.createdAt) : "",
        })}
        confirmLabel={t("common.delete")}
        confirmColor="error"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
};

export default SaveStatePickerDialog;
