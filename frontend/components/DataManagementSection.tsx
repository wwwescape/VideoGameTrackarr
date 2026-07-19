import { useRef, useState } from "react";
import DownloadIcon from "@mui/icons-material/Download";
import RestoreIcon from "@mui/icons-material/Restore";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { toast } from "react-toastify";
import ConfirmDialog from "./ConfirmDialog";
import {
  useExportBackup,
  useExportCsv,
  useExportHardwareCsv,
  useRestoreBackup,
  useRestoreStatus,
} from "../hooks/useImportExport";
import { TOAST_OPTIONS } from "../utils/toastOptions";

const DataManagementSection = () => {
  const exportCsv = useExportCsv();
  const exportHardwareCsv = useExportHardwareCsv();
  const exportBackup = useExportBackup();
  const restoreBackup = useRestoreBackup();
  const restoreStatus = useRestoreStatus();
  const restoreInProgress = restoreBackup.isPending || restoreStatus.data?.status === "running";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleExportCsv = async () => {
    try {
      await exportCsv.mutateAsync();
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Error exporting CSV. Please try again.", TOAST_OPTIONS);
    }
  };

  const handleExportHardwareCsv = async () => {
    try {
      await exportHardwareCsv.mutateAsync();
    } catch (error) {
      console.error("Error exporting hardware CSV:", error);
      toast.error("Error exporting hardware CSV. Please try again.", TOAST_OPTIONS);
    }
  };

  const handleExportBackup = async () => {
    try {
      await exportBackup.mutateAsync();
    } catch (error) {
      console.error("Error exporting backup:", error);
      toast.error("Error exporting backup. Please try again.", TOAST_OPTIONS);
    }
  };

  const handleRestoreConfirmed = async () => {
    if (!pendingFile) return;
    try {
      // This only resolves once the restore *starts* (202) - it no longer carries a
      // result to toast, since the job hasn't finished yet. A failure caught here means
      // the job never started (bad file, already-running restore, etc); once it's running,
      // RestoreGuard (mounted in AppShell) owns showing progress, success, and any
      // in-job failure.
      await restoreBackup.mutateAsync(pendingFile);
    } catch (error) {
      console.error("Error starting restore:", error);
      toast.error("Could not start the restore. Please try again.", TOAST_OPTIONS);
    } finally {
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Export
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportCsv} disabled={exportCsv.isPending}>
            Library (CSV)
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportHardwareCsv}
            disabled={exportHardwareCsv.isPending}
          >
            Hardware (CSV)
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportBackup}
            disabled={exportBackup.isPending}
          >
            Full backup (JSON)
          </Button>
        </Stack>
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Restore
        </Typography>
        <Button
          component="label"
          variant="outlined"
          color="error"
          startIcon={<RestoreIcon />}
          disabled={restoreInProgress}
        >
          Restore from backup
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            disabled={restoreInProgress}
            onChange={(event) => setPendingFile(event.target.files?.[0] ?? null)}
          />
        </Button>
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          Restoring replaces your entire library with the contents of the backup file. A safety
          snapshot of the current data is saved on the server first, but this still isn&apos;t
          something to do by accident.
        </Alert>
      </Box>

      <ConfirmDialog
        open={Boolean(pendingFile)}
        title="Restore from backup?"
        description={`This will permanently replace your entire library with the contents of "${pendingFile?.name}". A safety snapshot of what's there now will be saved on the server first, but this action itself cannot be undone from here.`}
        confirmLabel="Replace my library"
        confirmColor="error"
        confirmDisabled={restoreInProgress}
        onClose={() => {
          setPendingFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
        onConfirm={handleRestoreConfirmed}
      />
    </Stack>
  );
};

export default DataManagementSection;
