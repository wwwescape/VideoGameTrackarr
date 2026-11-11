import { useState } from "react";
import HideImageIcon from "@mui/icons-material/HideImageOutlined";
import SlideshowIcon from "@mui/icons-material/SlideshowOutlined";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { GameSummary } from "../api/types";
import { useSetScreensaverExcludedBulk } from "../hooks/useScreensaver";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import { ToolbarButton } from "./Page";
import { showUndoToast } from "./UndoToast";

// How long the Undo stays offered.
const UNDO_MS = 8000;

// The Games list's selection-mode Screensaver button (Screensaver lab): hide the selected games
// from the screensaver or show them in it again. Applied at once (nothing is lost, unlike
// Remove), with an Undo that puts back exactly the games it changed.
const ScreensaverBulkButton = ({ selected }: { selected: GameSummary[] }) => {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const bulk = useSetScreensaverExcludedBulk();

  // Only the games each choice would actually change.
  const toHide = selected.filter((game) => !game.screensaverExcluded).map((game) => game.id);
  const toShow = selected.filter((game) => game.screensaverExcluded).map((game) => game.id);

  const apply = (gameIds: number[], excluded: boolean) => {
    setAnchor(null);
    if (gameIds.length === 0) return;
    bulk.mutate(
      { gameIds, excluded },
      {
        onSuccess: () => {
          const message = excluded
            ? t("games.listToolbar.screensaverHiddenToast", { count: gameIds.length })
            : t("games.listToolbar.screensaverShownToast", { count: gameIds.length });
          showUndoToast(
            message,
            () =>
              bulk.mutate(
                { gameIds, excluded: !excluded },
                { onError: () => toast.error(t("games.listToolbar.screensaverFailed"), TOAST_OPTIONS) }
              ),
            UNDO_MS
          );
        },
        onError: () => toast.error(t("games.listToolbar.screensaverFailed"), TOAST_OPTIONS),
      }
    );
  };

  return (
    <>
      <ToolbarButton
        icon={<SlideshowIcon />}
        label={t("games.listToolbar.screensaverButton")}
        onClick={(event) => setAnchor(event.currentTarget)}
        disabled={selected.length === 0 || bulk.isPending}
        aria-haspopup="menu"
        aria-expanded={anchor ? true : undefined}
      />
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => apply(toHide, true)} disabled={toHide.length === 0}>
          <ListItemIcon>
            <HideImageIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("games.listToolbar.screensaverHide", { count: toHide.length })}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => apply(toShow, false)} disabled={toShow.length === 0}>
          <ListItemIcon>
            <SlideshowIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("games.listToolbar.screensaverShow", { count: toShow.length })}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default ScreensaverBulkButton;
