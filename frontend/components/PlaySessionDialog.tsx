import { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import { useTranslation } from "react-i18next";
import type { PlatformResponse, PlaySession } from "../api/types";
import AutocompleteSelect from "./AutocompleteSelect";

interface PlatformOption {
  id: number;
  name: string;
}

export interface PlaySessionFormValues {
  platformId: number;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
}

interface PlaySessionDialogProps {
  open: boolean;
  editing: PlaySession | null;
  // Platforms this game is owned on — a session can be logged against any of them,
  // repeatedly, unlike Progress which allows only one row per platform.
  ownedPlatforms: PlatformResponse[];
  onClose: () => void;
  onSubmit: (values: PlaySessionFormValues) => void;
  isSubmitting: boolean;
}

// datetime-local inputs need "YYYY-MM-DDTHH:mm" with no timezone suffix, while the API
// exchanges full ISO instants — same conversion PlaySessionsSection.tsx used inline.
function toLocalInputValue(isoString: string | null): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const PlaySessionDialog = ({
  open,
  editing,
  ownedPlatforms,
  onClose,
  onSubmit,
  isSubmitting,
}: PlaySessionDialogProps) => {
  const { t } = useTranslation();
  const [platformId, setPlatformId] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [platformError, setPlatformError] = useState(false);
  const [startError, setStartError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlatformId(editing?.platformId ?? null);
    setStartedAt(toLocalInputValue(editing?.startedAt ?? null));
    setEndedAt(toLocalInputValue(editing?.endedAt ?? null));
    setNotes(editing?.notes ?? "");
    setPlatformError(false);
    setStartError(false);
  }, [open, editing]);

  const platformOptions: PlatformOption[] = ownedPlatforms.map((platform) => ({
    id: platform.id,
    name: platform.name,
  }));

  const handleSubmit = () => {
    setPlatformError(platformId === null);
    setStartError(!startedAt);
    if (platformId === null || !startedAt) return;

    onSubmit({
      platformId,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: endedAt ? new Date(endedAt).toISOString() : null,
      notes: notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {editing ? t("playSessions.updateDialogTitle") : t("playSessions.addDialogTitle")}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
          <Grid size={12}>
            <AutocompleteSelect<PlatformOption>
              label={t("playSessions.platformLabel")}
              fullWidth
              required
              disabled={platformOptions.length === 0}
              options={platformOptions}
              value={platformOptions.find((option) => option.id === platformId) ?? null}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(option) => setPlatformId(option?.id ?? null)}
              helperText={
                platformError
                  ? t("playSessions.platformRequiredError")
                  : platformOptions.length === 0
                    ? t("playSessions.noOwnedPlatformsMessage")
                    : undefined
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t("playSessions.startedLabel")}
              type="datetime-local"
              fullWidth
              required
              value={startedAt}
              onChange={(event) => setStartedAt(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              error={startError}
              helperText={startError ? t("playSessions.startRequiredError") : undefined}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t("playSessions.endedLabel")}
              type="datetime-local"
              fullWidth
              value={endedAt}
              onChange={(event) => setEndedAt(event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label={t("playSessions.notesLabel")}
              fullWidth
              multiline
              minRows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSubmit} color="primary" disabled={isSubmitting}>
          {editing ? t("common.save") : t("common.add")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlaySessionDialog;
