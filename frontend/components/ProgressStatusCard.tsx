import { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Grid from "@mui/material/Grid";
import Rating from "@mui/material/Rating";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { toast } from "react-toastify";
import type { GameProgress, PlayStatus } from "../api/types";
import { useUpdateGameProgress } from "../hooks/useProgress";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import AutocompleteSelect from "./AutocompleteSelect";

interface PlayStatusOption {
  value: PlayStatus;
  label: string;
}

const PLAY_STATUS_OPTIONS: PlayStatusOption[] = [
  { value: "none", label: "Not started" },
  { value: "backlog", label: "Backlog" },
  { value: "playing", label: "Playing" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
];

interface ProgressStatusCardProps {
  gameId: number;
  progress: GameProgress;
}

interface FormState {
  playStatus: PlayStatus;
  playtimeMinutes: string;
  rating: number | null;
  review: string;
  startedAt: string;
  completedAt: string;
  lastPlayedAt: string;
}

function toFormState(progress: GameProgress): FormState {
  return {
    playStatus: progress.playStatus,
    playtimeMinutes: String(progress.playtimeMinutes),
    rating: progress.rating,
    review: progress.review ?? "",
    startedAt: progress.startedAt ?? "",
    completedAt: progress.completedAt ?? "",
    lastPlayedAt: progress.lastPlayedAt ?? "",
  };
}

const ProgressStatusCard = ({ gameId, progress }: ProgressStatusCardProps) => {
  const [form, setForm] = useState<FormState>(() => toFormState(progress));
  const updateProgress = useUpdateGameProgress(gameId);

  useEffect(() => {
    setForm(toFormState(progress));
  }, [progress]);

  const handleSave = async () => {
    const playtimeMinutes = Number(form.playtimeMinutes);
    if (!Number.isFinite(playtimeMinutes) || playtimeMinutes < 0) {
      toast.error("Playtime must be a non-negative number of minutes.", TOAST_OPTIONS);
      return;
    }

    try {
      await updateProgress.mutateAsync({
        playStatus: form.playStatus,
        playtimeMinutes,
        rating: form.rating,
        review: form.review || null,
        startedAt: form.startedAt || null,
        completedAt: form.completedAt || null,
        lastPlayedAt: form.lastPlayedAt || null,
      });
      toast.success("Progress saved!", TOAST_OPTIONS);
    } catch (error) {
      console.error("Error saving progress:", error);
      toast.error("Error saving progress. Please try again.", TOAST_OPTIONS);
    }
  };

  return (
    <>
      <CardHeader title="Progress" subheader="Status, playtime, and your own rating/review" />
      <CardContent>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <AutocompleteSelect<PlayStatusOption>
              label="Status"
              fullWidth
              options={PLAY_STATUS_OPTIONS}
              value={PLAY_STATUS_OPTIONS.find((option) => option.value === form.playStatus) ?? null}
              getOptionLabel={(option) => option.label}
              isOptionEqualToValue={(option, val) => option.value === val.value}
              disableClearable
              onChange={(newValue) => setForm((prev) => ({ ...prev, playStatus: newValue!.value }))}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Playtime (minutes)"
              type="number"
              fullWidth
              value={form.playtimeMinutes}
              onChange={(event) => setForm((prev) => ({ ...prev, playtimeMinutes: event.target.value }))}
              slotProps={{ htmlInput: { min: 0 } }}
              helperText={
                Number.isFinite(Number(form.playtimeMinutes))
                  ? `≈ ${(Number(form.playtimeMinutes) / 60).toFixed(1)} hours`
                  : undefined
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", height: "100%" }}>
              <Typography component="legend" variant="body2" color="text.secondary">
                Your rating
              </Typography>
              <Rating
                value={form.rating !== null ? form.rating / 2 : null}
                precision={0.5}
                onChange={(_event, value) => setForm((prev) => ({ ...prev, rating: value !== null ? value * 2 : null }))}
              />
              <Typography variant="body2" color="text.secondary">
                {form.rating !== null ? `${form.rating}/10` : "Unrated"}
              </Typography>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }} />
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Started"
              type="date"
              fullWidth
              value={form.startedAt}
              onChange={(event) => setForm((prev) => ({ ...prev, startedAt: event.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Completed"
              type="date"
              fullWidth
              value={form.completedAt}
              onChange={(event) => setForm((prev) => ({ ...prev, completedAt: event.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              label="Last played"
              type="date"
              fullWidth
              value={form.lastPlayedAt}
              onChange={(event) => setForm((prev) => ({ ...prev, lastPlayedAt: event.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label="Review"
              fullWidth
              multiline
              minRows={3}
              value={form.review}
              onChange={(event) => setForm((prev) => ({ ...prev, review: event.target.value }))}
            />
          </Grid>
          <Grid size={12}>
            <Button variant="contained" onClick={handleSave} disabled={updateProgress.isPending}>
              Save progress
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </>
  );
};

export default ProgressStatusCard;
