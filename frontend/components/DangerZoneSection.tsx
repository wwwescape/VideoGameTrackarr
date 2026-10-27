import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { DangerZoneAction } from "../api/dangerZone";
import { useDangerZoneAction } from "../hooks/useDangerZone";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";
import { SettingRow, SettingsGroup } from "./SettingsLayout";

// Clear actions take one kind of your data; resets need RESET typed and save a safety
// snapshot on the server first. Keys under settings.dangerZone.actions.<key>.
const ACTIONS: { action: DangerZoneAction; key: string; reset?: boolean }[] = [
  { action: "clear_progress", key: "clearProgress" },
  { action: "clear_ratings", key: "clearRatings" },
  { action: "clear_notes", key: "clearNotes" },
  { action: "clear_tags", key: "clearTags" },
  { action: "clear_sync_caches", key: "clearSyncCaches" },
  { action: "reset_library", key: "resetLibrary", reset: true },
  { action: "reset_hardware", key: "resetHardware", reset: true },
  { action: "reset_everything", key: "resetEverything", reset: true },
];

const CONFIRMATION = "RESET";

// Settings → General → Danger Zone. Your account, settings and integration setup are never
// touched by any of these.
const DangerZoneSection = () => {
  const { t } = useTranslation();
  const runAction = useDangerZoneAction();
  const [pending, setPending] = useState<(typeof ACTIONS)[number] | null>(null);
  const [typed, setTyped] = useState("");

  const close = () => {
    if (runAction.isPending) return;
    setPending(null);
    setTyped("");
  };

  const handleConfirm = async () => {
    if (!pending) return;
    const label = t(`settings.dangerZone.actions.${pending.key}.name`);
    try {
      await runAction.mutateAsync({ action: pending.action, confirmation: pending.reset ? typed : undefined });
      toast.success(
        pending.reset ? t("settings.dangerZone.resetDoneToast", { action: label }) : t("settings.dangerZone.doneToast", { action: label }),
        TOAST_OPTIONS
      );
      setPending(null);
      setTyped("");
    } catch (error) {
      console.error(`Error running ${pending.action}:`, error);
      toast.error(t("settings.dangerZone.errorToast", { action: label }), TOAST_OPTIONS);
    }
  };

  const pendingText = (part: "name" | "removes" | "keeps") =>
    pending ? t(`settings.dangerZone.actions.${pending.key}.${part}`) : "";

  return (
    <SettingsGroup title={t("settings.dangerZone.heading")} lead={t("settings.dangerZone.lead")}>
      {ACTIONS.map((item) => (
        <SettingRow
          key={item.action}
          name={t(`settings.dangerZone.actions.${item.key}.name`)}
          description={`${t(`settings.dangerZone.actions.${item.key}.removes`)} ${t(`settings.dangerZone.actions.${item.key}.keeps`)}`}
        >
          <Button
            variant={item.reset ? "contained" : "outlined"}
            color="error"
            onClick={() => setPending(item)}
            disabled={runAction.isPending}
            sx={{ justifySelf: { md: "end" } }}
          >
            {t(`settings.dangerZone.actions.${item.key}.button`)}
          </Button>
        </SettingRow>
      ))}

      <ConfirmDialog
        open={Boolean(pending && !pending.reset)}
        title={t("settings.dangerZone.clearConfirmTitle", { action: pendingText("name") })}
        description={`${pendingText("removes")} ${pendingText("keeps")}`}
        confirmLabel={pendingText("name")}
        confirmColor="error"
        busy={runAction.isPending}
        onClose={close}
        onConfirm={() => void handleConfirm()}
      />

      <Dialog open={Boolean(pending?.reset)} onClose={close} maxWidth="xs" fullWidth>
        <DialogTitle>{t("settings.dangerZone.resetConfirmTitle", { action: pendingText("name") })}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            {pendingText("removes")} {pendingText("keeps")}
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>{t("settings.dangerZone.snapshotNote")}</DialogContentText>
          <TextField
            label={t("settings.dangerZone.typeToConfirm", { word: CONFIRMATION })}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            fullWidth
            autoFocus
            autoComplete="off"
            disabled={runAction.isPending}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={runAction.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void handleConfirm()}
            disabled={typed !== CONFIRMATION || runAction.isPending}
            startIcon={runAction.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {pendingText("name")}
          </Button>
        </DialogActions>
      </Dialog>
    </SettingsGroup>
  );
};

export default DangerZoneSection;
