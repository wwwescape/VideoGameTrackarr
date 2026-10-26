import { useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { toast } from "react-toastify";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useTranslation } from "react-i18next";
import { useChangePassword } from "../hooks/useAuth";
import { TOAST_OPTIONS } from "../utils/toastOptions";

// Same minimum as the first-run form (backend SetupRequest / ChangePasswordRequest).
const MIN_LENGTH = 8;

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

// Settings → Account → Change password. The server checks the current password, signs every
// other session out, and hands this one fresh tokens, so you stay signed in here.
const ChangePasswordDialog = ({ open, onClose }: ChangePasswordDialogProps) => {
  const { t } = useTranslation();
  const changePassword = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const tooShort = next.length > 0 && next.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit =
    current.length > 0 &&
    next.length >= MIN_LENGTH &&
    next === confirm &&
    !changePassword.isPending;

  const close = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
    changePassword.reset();
    onClose();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      await changePassword.mutateAsync({ currentPassword: current, newPassword: next });
      toast.success(t("settings.account.passwordChanged"), TOAST_OPTIONS);
      close();
    } catch (submitError) {
      setError(
        isAxiosError(submitError) && submitError.response?.status === 400
          ? t("settings.account.wrongPassword")
          : isAxiosError(submitError) && submitError.response?.status === 429
            ? t("auth.tooManyAttempts")
            : t("settings.account.changePasswordError")
      );
    }
  };

  return (
    <Dialog open={open} onClose={changePassword.isPending ? undefined : close} fullWidth maxWidth="xs">
      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        <DialogTitle>{t("settings.account.changePassword")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField
              label={t("settings.account.currentPassword")}
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              autoFocus
              required
            />
            <TextField
              label={t("settings.account.newPassword")}
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              error={tooShort}
              helperText={t("auth.setupAdmin.passwordHelper")}
              required
            />
            <TextField
              label={t("settings.account.confirmPassword")}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              error={mismatch}
              helperText={mismatch ? t("settings.account.passwordsDontMatch") : " "}
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={changePassword.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="contained" disabled={!canSubmit}>
            {changePassword.isPending
              ? t("settings.account.changing")
              : t("settings.account.changePassword")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ChangePasswordDialog;
