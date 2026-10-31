import { useState } from "react";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import {
  GAME_FILTER_FIELD_KEYS,
  GAME_FILTER_FIELD_LABEL_KEYS,
  useGameFilterPreferences,
  type GameFilterFieldKey,
} from "../hooks/useGameFilterPreferences";
import { useViewEditor } from "./GameListPresets";
import { SettingRow } from "./SettingsLayout";

interface CustomizeFilterFieldsDialogProps {
  hidden: ReadonlySet<GameFilterFieldKey>;
  saving: boolean;
  onClose: () => void;
  onSave: (hidden: Set<GameFilterFieldKey>) => void;
}

// Switch Filter dialog fields on and off. Nothing changes until Save; mounted only while open,
// so each opening starts from what's saved.
const CustomizeFilterFieldsDialog = ({ hidden, saving, onClose, onSave }: CustomizeFilterFieldsDialogProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => new Set(hidden));

  const toggle = (key: GameFilterFieldKey) =>
    setDraft((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("settings.gameFilters.customizeTitle")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t("settings.gameFilters.customizeDescription")}
        </Typography>
        <Box sx={{ display: "grid" }}>
          {GAME_FILTER_FIELD_KEYS.map((key) => (
            <FormControlLabel
              key={key}
              control={<Switch size="small" checked={!draft.has(key)} onChange={() => toggle(key)} />}
              label={t(GAME_FILTER_FIELD_LABEL_KEYS[key])}
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between" }}>
        <Button onClick={() => setDraft(new Set())} disabled={saving}>
          {t("settings.gameFilters.showAll")}
        </Button>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="contained" onClick={() => onSave(draft)} disabled={saving}>
            {t("common.save")}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

// Settings rows for the game lists' Filter dialog: which fields it shows, and the views saved
// from the lists' Views button (made and applied there; renamed or deleted from either place).
const GameFilterSettings = () => {
  const { t } = useTranslation();
  const [customizing, setCustomizing] = useState(false);
  const { hiddenFields, setHiddenFields, savedFilters, saving } = useGameFilterPreferences();
  const { edit, dialog: editDialog } = useViewEditor();
  const shownCount = GAME_FILTER_FIELD_KEYS.length - hiddenFields.size;

  return (
    <>
      <SettingRow
        name={t("settings.gameFilters.fields")}
        description={t("settings.gameFilters.fieldsHelp", { shown: shownCount, total: GAME_FILTER_FIELD_KEYS.length })}
      >
        <Button variant="outlined" startIcon={<TuneIcon />} onClick={() => setCustomizing(true)}>
          {t("settings.gameFilters.customizeButton")}
        </Button>
      </SettingRow>
      <SettingRow name={t("settings.gameFilters.saved")} description={t("settings.gameFilters.savedHelp")}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, justifyContent: "flex-end" }}>
          {savedFilters.length ? (
            savedFilters.map((saved) => (
              <Button
                key={saved.name}
                size="small"
                variant="outlined"
                endIcon={<EditOutlinedIcon />}
                aria-label={t("games.savedViews.editAria", { name: saved.name })}
                onClick={() => edit(saved)}
              >
                {saved.name}
              </Button>
            ))
          ) : (
            <Typography variant="body2" sx={{ color: "vgt.text3" }}>
              {t("games.savedViews.empty")}
            </Typography>
          )}
        </Box>
      </SettingRow>
      {customizing ? (
        <CustomizeFilterFieldsDialog
          hidden={hiddenFields}
          saving={saving}
          onClose={() => setCustomizing(false)}
          onSave={(hidden) => {
            setHiddenFields(hidden);
            setCustomizing(false);
          }}
        />
      ) : null}
      {editDialog}
    </>
  );
};

export default GameFilterSettings;
