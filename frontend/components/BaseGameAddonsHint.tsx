import { useState } from "react";
import AddLinkIcon from "@mui/icons-material/AddLink";
import CloseIcon from "@mui/icons-material/Close";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import { useTranslation } from "react-i18next";
import { useBaseGameAddons } from "../hooks/useAddonLinks";

interface BaseGameAddonsHintProps {
  gameId: number;
  // Only an IGDB game with no manual links yet asks IGDB at all.
  enabled: boolean;
  onOpenPicker: () => void;
}

const dismissedKey = (gameId: number) => `vgt.baseGameAddonsHint.dismissed.${gameId}`;

// Remembered per game in this browser only: a convenience, so storage failing (private
// windows, blocked site data) just shows the hint again.
const readDismissed = (gameId: number) => {
  try {
    return window.localStorage.getItem(dismissedKey(gameId)) === "1";
  } catch {
    return false;
  }
};

// One line in an edition's Add-ons section when IGDB lists add-ons under its base game that
// aren't linked here, e.g. "Forza Horizon 5 has 18 add-ons. Link the ones that work with this
// edition." It opens the link picker (whose top group is those add-ons) and goes away once
// any add-on is linked by hand, or when dismissed.
const BaseGameAddonsHint = ({ gameId, enabled, onOpenPicker }: BaseGameAddonsHintProps) => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => readDismissed(gameId));
  const { data } = useBaseGameAddons(gameId, enabled && !dismissed);

  const unlinked = (data?.addons ?? []).filter((addon) => !addon.linked).length;
  if (!enabled || dismissed || !data?.baseGame || unlinked === 0) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(dismissedKey(gameId), "1");
    } catch {
      // See readDismissed.
    }
  };

  return (
    <Alert
      severity="info"
      icon={<AddLinkIcon fontSize="inherit" />}
      sx={{ mb: 2, alignItems: "center" }}
      action={
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <Button color="inherit" size="small" onClick={onOpenPicker}>
            {t("games.addonLinks.hintAction")}
          </Button>
          <IconButton color="inherit" size="small" aria-label={t("games.addonLinks.hintDismiss")} onClick={dismiss}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      }
    >
      {t("games.addonLinks.hint", { name: data.baseGame.name, count: unlinked })}
    </Alert>
  );
};

export default BaseGameAddonsHint;
