import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Backdrop from "@mui/material/Backdrop";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { toast } from "react-toastify";
import { useAcknowledgeRestoreStatus, useRestoreStatus } from "../hooks/useImportExport";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import type { RestoreJobStatus } from "../api/types";

// Mounted once in AppShell, so it's on screen for every authenticated route — not just the
// Settings page a restore was started from. Polls restore status continuously (see
// useRestoreStatus) so a refresh, a route change, or the tab being closed and reopened
// mid-restore all land back on this same blocking overlay, driven entirely by server-side
// job state rather than any client-side "am I mid-mutation" flag.
const RestoreGuard = () => {
  const { data } = useRestoreStatus();
  const queryClient = useQueryClient();
  const acknowledgeMutation = useAcknowledgeRestoreStatus();
  const previousStatus = useRef<RestoreJobStatus | undefined>(undefined);

  useEffect(() => {
    if (previousStatus.current === "running" && data?.status === "completed") {
      queryClient.invalidateQueries();
      toast.success(
        `Restored ${data.result?.restoredGames ?? 0} game(s). A safety copy of what was there before was saved server-side.`,
        TOAST_OPTIONS
      );
    }
    previousStatus.current = data?.status;
  }, [data?.status, data?.result, queryClient]);

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
            Have patience while restore is in progress.
          </Typography>
          <Typography sx={{ textAlign: "center" }}>
            This may take several minutes depending on the size of the restore.
          </Typography>
        </>
      ) : (
        <Paper sx={{ p: 3, maxWidth: 420, color: "text.primary" }}>
          <Typography variant="h6" color="error" gutterBottom>
            Restore failed
          </Typography>
          <Typography sx={{ mb: 2 }}>{data.error ?? "An unknown error occurred."}</Typography>
          <Button variant="contained" fullWidth onClick={() => acknowledgeMutation.mutate()}>
            Dismiss
          </Button>
        </Paper>
      )}
    </Backdrop>
  );
};

export default RestoreGuard;
