import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { useTranslation } from "react-i18next";

interface MessageDialogProps {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

// One-button info/error dialog — for cases like ConfirmDialog where there's nothing to
// confirm, just a message to acknowledge.
const MessageDialog = ({ open, title, message, onClose }: MessageDialogProps) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          {t("dialogs.message.ok")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MessageDialog;
