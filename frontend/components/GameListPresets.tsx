import { useState } from "react";
import CheckIcon from "@mui/icons-material/Check";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useTranslation } from "react-i18next";
import type { SavedGameFilter } from "../api/types";
import { useGameFilterPreferences } from "../hooks/useGameFilterPreferences";
import type { GameListState, PresetField } from "../hooks/useGameListState";
import { showUndoToast } from "./UndoToast";

const MAX_NAME_LENGTH = 60;
const UNDO_DELAY_MS = 5000;

interface ViewNameDialogProps {
  title: string;
  initialName: string;
  takenNames: string[];
  onClose: () => void;
  onSave: (name: string) => void;
  // Only when editing an existing view.
  onDelete?: () => void;
}

// Name a new view, or rename/delete one. Mounted only while open, so it starts from
// initialName each time.
export const ViewNameDialog = ({ title, initialName, takenNames, onClose, onSave, onDelete }: ViewNameDialogProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();
  const replaces = trimmed !== initialName && takenNames.includes(trimmed);
  const save = () => {
    if (trimmed) onSave(trimmed);
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          margin="dense"
          label={t("games.savedViews.nameLabel")}
          helperText={replaces ? t("games.savedViews.replaceHelp") : undefined}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
          }}
          slotProps={{ htmlInput: { maxLength: MAX_NAME_LENGTH } }}
        />
      </DialogContent>
      <DialogActions sx={{ justifyContent: onDelete ? "space-between" : "flex-end" }}>
        {onDelete ? (
          <Button color="error" onClick={onDelete}>
            {t("common.delete")}
          </Button>
        ) : null}
        <span>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="contained" onClick={save} disabled={!trimmed}>
            {t("common.save")}
          </Button>
        </span>
      </DialogActions>
    </Dialog>
  );
};

// Edit (rename or delete) a view, then confirm a delete with an Undo toast rather than a
// dialog: the view is gone at once and Undo saves it back. Shared by the Views menu and
// Settings.
export function useViewEditor(onRenamed?: (from: string, to: string) => void) {
  const { t } = useTranslation();
  const { savedFilters, renameFilter, deleteFilter, restoreFilter } = useGameFilterPreferences();
  const [editing, setEditing] = useState<SavedGameFilter | null>(null);

  const dialog = editing ? (
    <ViewNameDialog
      title={t("games.savedViews.editTitle")}
      initialName={editing.name}
      takenNames={savedFilters.map((saved) => saved.name)}
      onClose={() => setEditing(null)}
      onSave={(name) => {
        renameFilter(editing.name, name);
        onRenamed?.(editing.name, name);
        setEditing(null);
      }}
      onDelete={() => {
        const deleted = editing;
        deleteFilter(deleted.name);
        setEditing(null);
        showUndoToast(t("games.savedViews.deleted", { name: deleted.name }), () => restoreFilter(deleted), UNDO_DELAY_MS);
      }}
    />
  ) : null;

  return { edit: setEditing, dialog };
}

interface GameListPresetsOptions {
  // Off while the Filter Presets lab is: no menu, no chip.
  enabled: boolean;
  // Nothing to save while no filter is set.
  canSave: boolean;
  // Fields this page fixes itself (no field or chip for them here): presets leave them alone.
  fixedFields?: readonly PresetField[];
}

// A game list's presets: the menu that the Filter button's caret (and the active preset's chip)
// opens — put a saved preset back, save the current filters as one, update the preset in use
// once its filters have been changed, and edit one (the pencil: rename or delete) — plus the
// preset in use, if any, for the chip row.
export function useGameListPresets(
  state: GameListState,
  { enabled, canSave, fixedFields = [] }: GameListPresetsOptions
) {
  const { t } = useTranslation();
  const { savedFilters, saveFilter } = useGameFilterPreferences();
  const { edit, dialog: editDialog } = useViewEditor((from, to) => {
    if (state.activeView === from) state.setActiveView(to);
  });
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [naming, setNaming] = useState(false);

  // Clearing every filter leaves the preset rather than "modifying" it.
  const active = enabled && canSave ? (savedFilters.find((saved) => saved.name === state.activeView) ?? null) : null;
  const modified = active !== null && !state.matchesFilters(active.filters, fixedFields);

  const close = () => setAnchor(null);
  const apply = (saved: SavedGameFilter) => {
    state.applyFilters(saved.filters, fixedFields);
    state.setActiveView(saved.name);
    close();
  };

  const elements = enabled ? (
    <>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={close}>
        {savedFilters.length ? (
          savedFilters.map((saved) => (
            <MenuItem key={saved.name} selected={saved.name === active?.name} onClick={() => apply(saved)} sx={{ pr: 0.5 }}>
              <ListItemIcon>{saved.name === active?.name ? <CheckIcon fontSize="small" /> : null}</ListItemIcon>
              <ListItemText primary={saved.name} />
              <IconButton
                size="small"
                edge="end"
                sx={{ ml: 2 }}
                aria-label={t("games.savedViews.editAria", { name: saved.name })}
                onClick={(event) => {
                  event.stopPropagation();
                  close();
                  edit(saved);
                }}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </MenuItem>
          ))
        ) : (
          <MenuItem disabled>
            <ListItemText primary={t("games.savedViews.empty")} />
          </MenuItem>
        )}
        <Divider />
        {modified ? (
          <MenuItem
            onClick={() => {
              saveFilter(active.name, state.snapshotFilters(fixedFields));
              close();
            }}
          >
            <ListItemText primary={t("games.savedViews.update", { name: active.name })} />
          </MenuItem>
        ) : null}
        <MenuItem
          disabled={!canSave}
          onClick={() => {
            close();
            setNaming(true);
          }}
        >
          <ListItemText primary={modified ? t("games.savedViews.saveAsNew") : t("games.savedViews.saveCurrent")} />
        </MenuItem>
      </Menu>
      {naming ? (
        <ViewNameDialog
          title={t("games.savedViews.saveTitle")}
          initialName=""
          takenNames={savedFilters.map((saved) => saved.name)}
          onClose={() => setNaming(false)}
          onSave={(name) => {
            saveFilter(name, state.snapshotFilters(fixedFields));
            state.setActiveView(name);
            setNaming(false);
          }}
        />
      ) : null}
      {editDialog}
    </>
  ) : null;

  return {
    menuOpen: anchor !== null,
    openMenu: (target: HTMLElement) => setAnchor(target),
    // The preset in use, for the chip row: its label says when the filters have drifted from it.
    activeLabel: active ? (modified ? t("games.savedViews.modifiedLabel", { name: active.name }) : active.name) : null,
    // The chip's ×: back to no filters (the page's own fixed ones stay) and no preset.
    clearActive: () => {
      state.applyFilters({}, fixedFields);
      state.setActiveView(null);
    },
    elements,
  };
}
