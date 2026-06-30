import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { toast, type ToastContentProps } from "react-toastify";

interface UndoToastContentProps extends Partial<ToastContentProps> {
  message: string;
  onUndo: () => void;
}

const UndoToastContent = ({ message, onUndo, closeToast }: UndoToastContentProps) => (
  <Stack direction="row" spacing={2} sx={{ alignItems: "center", width: "100%" }}>
    <Typography variant="body2" sx={{ flexGrow: 1 }}>
      {message}
    </Typography>
    <Button
      size="small"
      color="inherit"
      onClick={() => {
        onUndo();
        closeToast?.();
      }}
    >
      Undo
    </Button>
  </Stack>
);

// A toast offering a single grace-period "Undo" — pairs with useUndoableAction, whose
// `delayMs` should match `autoClose` here so the toast's lifetime communicates the actual
// window the user has to change their mind.
export function showUndoToast(message: string, onUndo: () => void, autoClose: number) {
  toast(({ closeToast }) => <UndoToastContent message={message} onUndo={onUndo} closeToast={closeToast} />, {
    autoClose,
    closeOnClick: false,
  });
}
