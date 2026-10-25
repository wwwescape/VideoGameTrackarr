import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import { EmptyLine, ListRow, Panel, RowAction, Section, SectionAction } from "./Detail";

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
}

// A note being written or edited: the text and Cancel/Save.
const NoteEditor = ({
  initial,
  saveLabel,
  disabled,
  onCancel,
  onSave,
}: {
  initial: string;
  saveLabel: string;
  disabled?: boolean;
  onCancel: () => void;
  onSave: (body: string) => void;
}) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initial);
  return (
    <Stack spacing={1} sx={{ p: 1.5 }}>
      <TextField
        multiline
        minRows={2}
        fullWidth
        autoFocus
        placeholder={t("notes.addPlaceholder")}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        slotProps={{ htmlInput: { "aria-label": t("notes.title") } }}
      />
      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
        <Button size="small" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!draft.trim() || disabled}
          onClick={() => onSave(draft.trim())}
        >
          {saveLabel}
        </Button>
      </Stack>
    </Stack>
  );
};

// A detail page's Notes section: "Add note" on the section, then the notes as rows with their
// date, Edit and Delete. Entity-agnostic — the parent owns how create/update/delete are
// scoped (to a game, a device, ...).
const NotesSection = ({ notes, onCreate, onUpdate, onDelete, isCreating }: NotesSectionProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const handleAdd = async (body: string) => {
    try {
      await onCreate(body);
      setAdding(false);
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error(t("notes.addError"), TOAST_OPTIONS);
    }
  };

  const handleUpdate = async (noteId: number, body: string) => {
    try {
      await onUpdate(noteId, body);
      setEditingId(null);
    } catch (error) {
      console.error("Error updating note:", error);
      toast.error(t("notes.updateError"), TOAST_OPTIONS);
    }
  };

  const handleDelete = async (noteId: number) => {
    try {
      await onDelete(noteId);
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error(t("notes.deleteError"), TOAST_OPTIONS);
    }
  };

  const hasNotes = Boolean(notes && notes.length);

  return (
    <Section
      id="notes"
      title={t("notes.title")}
      action={
        <SectionAction
          icon={<AddIcon />}
          label={t("notes.addAction")}
          onClick={() => setAdding(true)}
        />
      }
    >
      {!hasNotes && !adding ? (
        <EmptyLine>{t("notes.empty")}</EmptyLine>
      ) : (
        <Panel>
          <Box sx={{ "& > * + *": { borderTop: 1, borderColor: "divider" } }}>
            {adding ? (
              <NoteEditor
                initial=""
                saveLabel={t("common.add")}
                disabled={isCreating}
                onCancel={() => setAdding(false)}
                onSave={(body) => void handleAdd(body)}
              />
            ) : null}
            {(notes ?? []).map((note) =>
              editingId === note.id ? (
                <Box key={note.id}>
                  <NoteEditor
                    initial={note.body}
                    saveLabel={t("common.save")}
                    onCancel={() => setEditingId(null)}
                    onSave={(body) => void handleUpdate(note.id, body)}
                  />
                </Box>
              ) : (
                <ListRow
                  key={note.id}
                  title={
                    <Box
                      component="span"
                      sx={{ fontWeight: 400, whiteSpace: "pre-wrap", display: "block" }}
                    >
                      {note.body}
                    </Box>
                  }
                  subtitle={new Date(note.updatedAt).toLocaleString(language, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  actions={
                    <>
                      <RowAction
                        title={t("common.edit")}
                        icon={<EditOutlinedIcon fontSize="small" />}
                        onClick={() => setEditingId(note.id)}
                      />
                      <RowAction
                        title={t("common.delete")}
                        icon={<DeleteOutlineOutlinedIcon fontSize="small" />}
                        onClick={() => void handleDelete(note.id)}
                      />
                    </>
                  }
                />
              )
            )}
          </Box>
        </Panel>
      )}
    </Section>
  );
};

export default NotesSection;
