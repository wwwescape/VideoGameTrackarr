import type { ReactNode } from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { useTranslation } from "react-i18next";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  confirmColor?: "primary" | "error";
  confirmDisabled?: boolean;
  // The confirmed action is running (a resync, a delete): the confirm button spins, and the
  // dialog can't be confirmed again, cancelled or closed (Escape, a click outside) until it's done.
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

// One shared confirm/cancel dialog, replacing what used to be 4 near-identical inline
// <Dialog> blocks in GameDetails (remove library item, move, remove game, resync game).
const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel,
  confirmColor = "primary",
  confirmDisabled = false,
  busy = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} aria-busy={busy}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" disabled={busy}>
          {t("common.cancel")}
        </Button>
        <Button
          onClick={onConfirm}
          color={confirmColor}
          variant="contained"
          disabled={confirmDisabled || busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" aria-label={t("common.working")} /> : undefined}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
