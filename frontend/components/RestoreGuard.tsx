import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useAcknowledgeRestoreStatus, useRestoreStatus } from "../hooks/useImportExport";
import { useRunJob } from "../hooks/useJobs";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import type { BackupRestoreResult, RestoreJobStatus } from "../api/types";

// The job that brings back what a backup doesn't carry: each game's IGDB details (genres,
// media, release dates, Collections, Series).
const RESYNC_ALL_JOB_ID = "resync_all";

// Mounted once in AppShell, so it's on screen for every authenticated route — not just the
// Settings page a restore was started from. Polls restore status continuously (see
// useRestoreStatus) so a refresh, a route change, or the tab being closed and reopened
// mid-restore all land back on this same blocking overlay, driven entirely by server-side
// job state rather than any client-side "am I mid-mutation" flag.
const RestoreGuard = () => {
  const { t } = useTranslation();
  const { data } = useRestoreStatus();
  const queryClient = useQueryClient();
  const acknowledgeMutation = useAcknowledgeRestoreStatus();
  const runJob = useRunJob();
  const previousStatus = useRef<RestoreJobStatus | undefined>(undefined);
  // What the restore just brought back, shown until dismissed.
  const [finished, setFinished] = useState<BackupRestoreResult | null>(null);

  useEffect(() => {
    if (previousStatus.current === "running" && data?.status === "completed") {
      queryClient.invalidateQueries();
      if (data.result) setFinished(data.result);
    }
    previousStatus.current = data?.status;
  }, [data?.status, data?.result, queryClient]);

  const handleResyncAll = async () => {
    try {
      await runJob.mutateAsync(RESYNC_ALL_JOB_ID);
      toast.info(t("restore.resyncStartedToast"), TOAST_OPTIONS);
      setFinished(null);
    } catch (error) {
      console.error("Error starting Resync all:", error);
      toast.error(t("restore.resyncStartError"), TOAST_OPTIONS);
    }
  };

  if (finished) {
    const lines = [
      t("restore.summaryGames", { count: finished.restoredGames, copies: finished.restoredLibraryItems }),
      t("restore.summaryHardware", { devices: finished.restoredDevices, accessories: finished.restoredAccessories }),
      finished.restoredRoms ? t("restore.summaryRoms", { count: finished.restoredRoms }) : null,
      finished.restoredBiosFiles ? t("restore.summaryBios", { count: finished.restoredBiosFiles }) : null,
      finished.restoredImages ? t("restore.summaryImages", { count: finished.restoredImages }) : null,
    ].filter((line): line is string => line !== null);
    return (
      <Dialog open onClose={() => setFinished(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("restore.completedTitle")}</DialogTitle>
        <DialogContent>
          <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 2 }}>
            {lines.map((line) => (
              <li key={line}>
                <Typography variant="body2">{line}</Typography>
              </li>
            ))}
          </Box>
          <Typography variant="body2" color="text.secondary">
            {t("restore.resyncPrompt")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFinished(null)}>{t("restore.resyncLater")}</Button>
          <Button variant="contained" onClick={() => void handleResyncAll()} disabled={runJob.isPending}>
            {t("restore.resyncNow")}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  if (!data || data.status === "idle" || data.status === "completed") {
    return null;
  }

  return (
    <Backdrop
      open
      sx={{
        zIndex: (theme) => theme.zIndex.modal + 1,
        flexDirection: "column",
        gap: 2,
        color: "common.white",
        p: 3,
      }}
    >
      {data.status === "running" ? (
        <>
          <CircularProgress color="inherit" />
          <Typography variant="h6" sx={{ textAlign: "center" }}>
            {t("restore.inProgressTitle")}
          </Typography>
          <Typography sx={{ textAlign: "center" }}>{t("restore.inProgressSubtitle")}</Typography>
        </>
      ) : (
        <Paper sx={{ p: 3, maxWidth: 420, color: "text.primary" }}>
          <Typography variant="h6" color="error" gutterBottom>
            {t("restore.failedTitle")}
          </Typography>
          <Typography sx={{ mb: 2 }}>{data.error ?? t("restore.unknownError")}</Typography>
          <Button variant="contained" fullWidth onClick={() => acknowledgeMutation.mutate()}>
            {t("restore.dismissButton")}
          </Button>
        </Paper>
      )}
    </Backdrop>
  );
};

export default RestoreGuard;
