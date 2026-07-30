import { useState } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { TOAST_OPTIONS } from "../utils/toastOptions";

// Minimal shape this component needs — both the game-specific `Note` and the
// device-specific `DeviceNote` types satisfy this structurally, so no shared type is needed.
export interface NoteLike {
  id: number;
  body: string;
  updatedAt: string;
}

interface NotesSectionProps {
  notes: NoteLike[] | undefined;
  onCreate: (body: string) => Promise<unknown>;
  onUpdate: (noteId: number, body: string) => Promise<unknown>;
  onDelete: (noteId: number) => Promise<unknown>;
  isCreating?: boolean;
  subheader?: string;
}

const NoteRow = ({
  note,
  onUpdate,
  onDelete,
}: {
  note: NoteLike;
  onUpdate: (noteId: number, body: string) => Promise<unknown>;
  onDelete: (noteId: number) => Promise<unknown>;
}) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);

  const handleSave = async () => {
    if (!draft.trim()) return;
    try {
      await onUpdate(note.id, draft.trim());
      setEditing(false);
    } catch (error) {
      console.error("Error updating note:", error);
      toast.error(t("notes.updateError"), TOAST_OPTIONS);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(note.id);
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error(t("notes.deleteError"), TOAST_OPTIONS);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      {editing ? (
        <Stack spacing={1}>
          <TextField multiline minRows={2} fullWidth value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus />
          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            <Button size="small" onClick={() => { setDraft(note.body); setEditing(false); }}>
              {t("common.cancel")}
            </Button>
            <Button size="small" variant="contained" onClick={handleSave}>
              {t("common.save")}
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
              {note.body}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {new Date(note.updatedAt).toLocaleString()}
            </Typography>
          </Box>
          <Tooltip title={t("common.edit")}>
            <IconButton size="small" onClick={() => setEditing(true)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("common.delete")}>
            <IconButton size="small" onClick={handleDelete}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )}
    </Paper>
  );
};

// Entity-agnostic — the parent owns how create/update/delete are scoped (to a game, a
// device, ...).
const NotesSection = ({
  notes,
  onCreate,
  onUpdate,
  onDelete,
  isCreating,
  subheader,
}: NotesSectionProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const resolvedSubheader = subheader ?? t("notes.defaultSubheader");

  const handleAdd = async () => {
    if (!draft.trim()) return;
    try {
      await onCreate(draft.trim());
      setDraft("");
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error(t("notes.addError"), TOAST_OPTIONS);
    }
  };

  return (
    <>
      <CardHeader title={t("notes.title")} subheader={resolvedSubheader} />
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1}>
            <TextField
              placeholder={t("notes.addPlaceholder")}
              fullWidth
              multiline
              minRows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button variant="contained" onClick={() => void handleAdd()} disabled={!draft.trim() || isCreating}>
              {t("common.add")}
            </Button>
          </Stack>
          {!notes || notes.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t("notes.empty")}
            </Typography>
          ) : (
            notes.map((note) => <NoteRow key={note.id} note={note} onUpdate={onUpdate} onDelete={onDelete} />)
          )}
        </Stack>
      </CardContent>
    </>
  );
};

export default NotesSection;
