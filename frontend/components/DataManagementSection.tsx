import { useRef, useState } from "react";
import DownloadIcon from "@mui/icons-material/Download";
import RestoreIcon from "@mui/icons-material/Restore";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      toast.error(t("settings.dataManagement.exportCsvError"), TOAST_OPTIONS);
    }
  };

  const handleExportHardwareCsv = async () => {
    try {
      await exportHardwareCsv.mutateAsync();
    } catch (error) {
      console.error("Error exporting hardware CSV:", error);
      toast.error(t("settings.dataManagement.exportHardwareCsvError"), TOAST_OPTIONS);
    }
  };

  const handleExportBackup = async () => {
    try {
      await exportBackup.mutateAsync();
    } catch (error) {
      console.error("Error exporting backup:", error);
      toast.error(t("settings.dataManagement.exportBackupError"), TOAST_OPTIONS);
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
      toast.error(t("settings.dataManagement.restoreStartError"), TOAST_OPTIONS);
    } finally {
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {t("settings.dataManagement.exportHeading")}
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportCsv} disabled={exportCsv.isPending}>
            {t("settings.dataManagement.exportLibraryCsv")}
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportHardwareCsv}
            disabled={exportHardwareCsv.isPending}
          >
            {t("settings.dataManagement.exportHardwareCsv")}
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportBackup}
            disabled={exportBackup.isPending}
          >
            {t("settings.dataManagement.exportFullBackup")}
          </Button>
        </Stack>
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {t("settings.dataManagement.restoreHeading")}
        </Typography>
        <Button
          component="label"
          variant="outlined"
          color="error"
          startIcon={<RestoreIcon />}
          disabled={restoreInProgress}
        >
          {t("settings.dataManagement.restoreButton")}
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
          {t("settings.dataManagement.restoreWarning")}
        </Alert>
      </Box>

      <ConfirmDialog
        open={Boolean(pendingFile)}
        title={t("settings.dataManagement.restoreConfirmTitle")}
        description={t("settings.dataManagement.restoreConfirmDescription", { fileName: pendingFile?.name })}
        confirmLabel={t("settings.dataManagement.restoreConfirmButton")}
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
