import { useState } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import Button from "@mui/material/Button";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useCreatePlaySession, useDeletePlaySession, usePlaySessions } from "../hooks/usePlaySessions";
import { TOAST_OPTIONS } from "../utils/toastOptions";

interface PlaySessionsSectionProps {
  gameId: number;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "-";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
}

const PlaySessionsSection = ({ gameId }: PlaySessionsSectionProps) => {
  const { t } = useTranslation();
  const { data: sessions } = usePlaySessions(gameId);
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");
  const [notes, setNotes] = useState("");
  const createSession = useCreatePlaySession(gameId);
  const deleteSession = useDeletePlaySession(gameId);

  const handleAdd = async () => {
    if (!startedAt) {
      toast.error(t("playSessions.startRequiredError"), TOAST_OPTIONS);
      return;
    }
    try {
      await createSession.mutateAsync({
        startedAt: new Date(startedAt).toISOString(),
        endedAt: endedAt ? new Date(endedAt).toISOString() : null,
        notes: notes.trim() || null,
      });
      setStartedAt("");
      setEndedAt("");
      setNotes("");
    } catch (error) {
      console.error("Error logging play session:", error);
      toast.error(t("playSessions.addError"), TOAST_OPTIONS);
    }
  };

  const handleDelete = async (sessionId: number) => {
    try {
      await deleteSession.mutateAsync(sessionId);
    } catch (error) {
      console.error("Error deleting play session:", error);
      toast.error(t("playSessions.deleteError"), TOAST_OPTIONS);
    }
  };

  return (
    <>
      <CardHeader title={t("playSessions.title")} subheader={t("playSessions.subtitle")} />
      <CardContent>
        <Stack spacing={1.5}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label={t("playSessions.startedLabel")}
                type="datetime-local"
                fullWidth
                value={startedAt}
                onChange={(event) => setStartedAt(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label={t("playSessions.endedLabel")}
                type="datetime-local"
                fullWidth
                value={endedAt}
                onChange={(event) => setEndedAt(event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label={t("playSessions.notesLabel")}
                fullWidth
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Grid>
          </Grid>
          <Button variant="contained" onClick={handleAdd} disabled={createSession.isPending} sx={{ alignSelf: "flex-start" }}>
            {t("playSessions.logButton")}
          </Button>

          {!sessions || sessions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t("playSessions.noSessions")}
            </Typography>
          ) : (
            sessions.map((session) => (
              <Paper key={session.id} variant="outlined" sx={{ p: 1.5 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Stack sx={{ flexGrow: 1 }}>
                    <Typography variant="body2">
                      {new Date(session.startedAt).toLocaleString()}
                      {session.endedAt ? ` – ${new Date(session.endedAt).toLocaleString()}` : ""}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDuration(session.durationMinutes)}
                      {session.notes ? ` · ${session.notes}` : ""}
                    </Typography>
                  </Stack>
                  <Tooltip title={t("common.delete")}>
                    <IconButton size="small" onClick={() => handleDelete(session.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Paper>
            ))
          )}
        </Stack>
      </CardContent>
    </>
  );
};

export default PlaySessionsSection;
