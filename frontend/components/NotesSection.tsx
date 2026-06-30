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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);

  const handleSave = async () => {
    if (!draft.trim()) return;
    try {
      await onUpdate(note.id, draft.trim());
      setEditing(false);
    } catch (error) {
      console.error("Error updating note:", error);
      toast.error("Error updating note. Please try again.", TOAST_OPTIONS);
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete(note.id);
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Error deleting note. Please try again.", TOAST_OPTIONS);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      {editing ? (
        <Stack spacing={1}>
          <TextField multiline minRows={2} fullWidth value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus />
          <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
            <Button size="small" onClick={() => { setDraft(note.body); setEditing(false); }}>
              Cancel
            </Button>
            <Button size="small" variant="contained" onClick={handleSave}>
              Save
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
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => setEditing(true)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
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
  subheader = "Spoiler-free tips, where you left off, anything worth remembering",
}: NotesSectionProps) => {
  const [draft, setDraft] = useState("");

  const handleAdd = async () => {
    if (!draft.trim()) return;
    try {
      await onCreate(draft.trim());
      setDraft("");
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error("Error adding note. Please try again.", TOAST_OPTIONS);
    }
  };

  return (
    <>
      <CardHeader title="Notes" subheader={subheader} />
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1}>
            <TextField
              placeholder="Add a note..."
              fullWidth
              multiline
              minRows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button variant="contained" onClick={() => void handleAdd()} disabled={!draft.trim() || isCreating}>
              Add
            </Button>
          </Stack>
          {!notes || notes.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No notes yet.
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
