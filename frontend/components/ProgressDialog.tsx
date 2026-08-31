import { useEffect, useMemo, useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import Rating from "@mui/material/Rating";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import type { GameProgress, PlatformResponse, PlayStatus } from "../api/types";
import AutocompleteSelect from "./AutocompleteSelect";

interface PlatformOption {
  id: number;
  name: string;
}

interface PlayStatusOption {
  value: PlayStatus;
  label: string;
}

export interface ProgressFormValues {
  platformId: number;
  playStatus: PlayStatus;
  playtimeMinutes: number;
  rating: number | null;
  review: string | null;
  startedAt: string | null;
  completedAt: string | null;
  lastPlayedAt: string | null;
}

interface ProgressDialogProps {
  open: boolean;
  // The row being edited, or null when adding a new one — drives the title and whether
  // the platform field is locked (an existing row's platform can't be changed, since
  // that would just be a roundabout way of creating a duplicate/orphaning history).
  editing: GameProgress | null;
  // Owned platforms this game doesn't already have a progress row for — the only ones
  // selectable when adding. Ignored (the locked platform is shown instead) when editing.
  eligiblePlatforms: PlatformResponse[];
  onClose: () => void;
  onSubmit: (values: ProgressFormValues) => void;
  isSubmitting: boolean;
}

function toFormState(
  progress: GameProgress | null
): Omit<ProgressFormValues, "platformId" | "playtimeMinutes"> {
  return {
    playStatus: progress?.playStatus ?? "none",
    rating: progress?.rating ?? null,
    review: progress?.review ?? null,
    startedAt: progress?.startedAt ?? null,
    completedAt: progress?.completedAt ?? null,
    lastPlayedAt: progress?.lastPlayedAt ?? null,
  };
}

const ProgressDialog = ({
  open,
  editing,
  eligiblePlatforms,
  onClose,
  onSubmit,
  isSubmitting,
}: ProgressDialogProps) => {
  const { t } = useTranslation();
  const [platformId, setPlatformId] = useState<number | null>(editing?.platformId ?? null);
  const [playtimeInput, setPlaytimeInput] = useState("0");
  const [rest, setRest] = useState(() => toFormState(editing));
  const [platformError, setPlatformError] = useState(false);
  const [playtimeError, setPlaytimeError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlatformId(editing?.platformId ?? null);
    setPlaytimeInput(String(editing?.playtimeMinutes ?? 0));
    setRest(toFormState(editing));
    setPlatformError(false);
    setPlaytimeError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const playStatusOptions: PlayStatusOption[] = useMemo(
    () => [
      { value: "none", label: t("progress.statusOptions.none") },
      { value: "backlog", label: t("progress.statusOptions.backlog") },
      { value: "playing", label: t("progress.statusOptions.playing") },
      { value: "completed", label: t("progress.statusOptions.completed") },
      { value: "abandoned", label: t("progress.statusOptions.abandoned") },
    ],
    [t]
  );

  const platformOptions: PlatformOption[] = editing
    ? [{ id: editing.platformId!, name: editing.platformName ?? "-" }]
    : eligiblePlatforms.map((platform) => ({ id: platform.id, name: platform.name }));

  const handleSubmit = () => {
    const playtimeMinutes = Number(playtimeInput);
    const hasValidPlaytime = Number.isFinite(playtimeMinutes) && playtimeMinutes >= 0;
    setPlatformError(platformId === null);
    setPlaytimeError(!hasValidPlaytime);
    if (platformId === null || !hasValidPlaytime) return;

    onSubmit({ platformId, playtimeMinutes, ...rest });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {editing ? t("progress.updateDialogTitle") : t("progress.addDialogTitle")}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
          <Grid size={12}>
            <AutocompleteSelect<PlatformOption>
              label={t("progress.platformLabel")}
              fullWidth
              required
              disabled={editing !== null || platformOptions.length === 0}
              options={platformOptions}
              value={platformOptions.find((option) => option.id === platformId) ?? null}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(option) => setPlatformId(option?.id ?? null)}
              helperText={
                platformError
                  ? t("progress.platformRequiredError")
                  : !editing && platformOptions.length === 0
                    ? t("progress.noPlatformsAvailableMessage")
                    : undefined
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <AutocompleteSelect<PlayStatusOption>
              label={t("progress.statusLabel")}
              fullWidth
              disableClearable
              options={playStatusOptions}
              value={playStatusOptions.find((option) => option.value === rest.playStatus) ?? null}
              getOptionLabel={(option) => option.label}
              isOptionEqualToValue={(option, value) => option.value === value.value}
              onChange={(option) => setRest((prev) => ({ ...prev, playStatus: option!.value }))}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label={t("progress.playtimeLabel")}
              type="number"
              fullWidth
              value={playtimeInput}
              onChange={(event) => setPlaytimeInput(event.target.value)}
              slotProps={{ htmlInput: { min: 0 } }}
              error={playtimeError}
              helperText={
                playtimeError
                  ? t("progress.playtimeError")
                  : Number.isFinite(Number(playtimeInput))
                    ? t("progress.playtimeHelperText", {
                        hours: (Number(playtimeInput) / 60).toFixed(1),
                      })
                    : undefined
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", height: "100%" }}>
              <Typography component="legend" variant="body2" color="text.secondary">
                {t("progress.ratingLabel")}
              </Typography>
              <Rating
                value={rest.rating !== null ? rest.rating / 2 : null}
                precision={0.5}
                onChange={(_event, value) =>
                  setRest((prev) => ({ ...prev, rating: value !== null ? value * 2 : null }))
                }
              />
              <Typography variant="body2" color="text.secondary">
                {rest.rating !== null
                  ? t("progress.ratingValue", { rating: rest.rating })
                  : t("progress.unrated")}
              </Typography>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }} />
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label={t("progress.startedLabel")}
              type="date"
              fullWidth
              value={rest.startedAt ?? ""}
              onChange={(event) =>
                setRest((prev) => ({ ...prev, startedAt: event.target.value || null }))
              }
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label={t("progress.completedLabel")}
              type="date"
              fullWidth
              value={rest.completedAt ?? ""}
              onChange={(event) =>
                setRest((prev) => ({ ...prev, completedAt: event.target.value || null }))
              }
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label={t("progress.lastPlayedLabel")}
              type="date"
              fullWidth
              value={rest.lastPlayedAt ?? ""}
              onChange={(event) =>
                setRest((prev) => ({ ...prev, lastPlayedAt: event.target.value || null }))
              }
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label={t("progress.reviewLabel")}
              fullWidth
              multiline
              minRows={3}
              value={rest.review ?? ""}
              onChange={(event) =>
                setRest((prev) => ({ ...prev, review: event.target.value || null }))
              }
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

export default ProgressDialog;
