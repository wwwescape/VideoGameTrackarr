import { useState, type DragEvent } from "react";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_OVERVIEW_LAYOUT,
  type OverviewSection,
  type OverviewSectionKey,
} from "../hooks/useOverviewLayout";

interface CustomizeOverviewDialogProps {
  layout: OverviewSection[];
  labels: Record<OverviewSectionKey, string>;
  saving: boolean;
  onClose: () => void;
  onSave: (layout: OverviewSection[]) => void;
}

// Show/hide and reorder the Overview's sections: drag a row by its handle, or use the arrows
// (keyboard and touch). Nothing changes until Save. Mounted only while open, so each opening
// starts from the saved layout.
const CustomizeOverviewDialog = ({
  layout,
  labels,
  saving,
  onClose,
  onSave,
}: CustomizeOverviewDialogProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(layout);
  const [dragKey, setDragKey] = useState<OverviewSectionKey | null>(null);

  const moveTo = (key: OverviewSectionKey, index: number) =>
    setDraft((current) => {
      const from = current.findIndex((section) => section.key === key);
      if (from < 0 || index < 0 || index >= current.length || from === index) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });

  const handleDragOver = (event: DragEvent, overKey: OverviewSectionKey) => {
    if (!dragKey) return;
    event.preventDefault();
    if (dragKey !== overKey)
      moveTo(
        dragKey,
        draft.findIndex((section) => section.key === overKey)
      );
  };

  const toggle = (key: OverviewSectionKey) =>
    setDraft((current) =>
      current.map((section) =>
        section.key === key ? { ...section, hidden: !section.hidden } : section
      )
    );

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("overview.customize.title")}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t("overview.customize.description")}
        </Typography>
        <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gap: 0.75 }}>
          {draft.map((section, index) => {
            const label = labels[section.key];
            return (
              <Box
                component="li"
                key={section.key}
                draggable
                onDragStart={(event: DragEvent) => {
                  event.dataTransfer.effectAllowed = "move";
                  // Firefox only starts a drag when some data is set.
                  event.dataTransfer.setData("text/plain", section.key);
                  setDragKey(section.key);
                }}
                onDragOver={(event: DragEvent) => handleDragOver(event, section.key)}
                onDrop={(event: DragEvent) => event.preventDefault()}
                onDragEnd={() => setDragKey(null)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  pl: 0.5,
                  pr: 0.25,
                  py: 0.25,
                  border: 1,
                  borderColor: dragKey === section.key ? "primary.main" : "divider",
                  borderRadius: 2,
                  bgcolor: "background.paper",
                  opacity: dragKey === section.key ? 0.6 : 1,
                }}
              >
                <DragIndicatorIcon
                  fontSize="small"
                  sx={{ color: "vgt.text3", cursor: "grab" }}
                  aria-hidden
                />
                <Box
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 14,
                    color: section.hidden ? "vgt.text3" : "text.primary",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </Box>
                <IconButton
                  size="small"
                  onClick={() => moveTo(section.key, index - 1)}
                  disabled={index === 0}
                  aria-label={t("overview.customize.moveUp", { name: label })}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => moveTo(section.key, index + 1)}
                  disabled={index === draft.length - 1}
                  aria-label={t("overview.customize.moveDown", { name: label })}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
                <Switch
                  size="small"
                  checked={!section.hidden}
                  onChange={() => toggle(section.key)}
                  slotProps={{
                    input: { "aria-label": t("overview.customize.show", { name: label }) },
                  }}
                />
              </Box>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between" }}>
        <Button onClick={() => setDraft(DEFAULT_OVERVIEW_LAYOUT)} disabled={saving}>
          {t("overview.customize.reset")}
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

export default CustomizeOverviewDialog;
