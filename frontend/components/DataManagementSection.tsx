import { useRef, useState } from "react";
import DownloadIcon from "@mui/icons-material/Download";
import RestoreIcon from "@mui/icons-material/Restore";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { BackupFileOptions } from "../api/importExport";
import ConfirmDialog from "./ConfirmDialog";
import { useExportBackup, useRestoreBackup, useRestoreStatus } from "../hooks/useImportExport";
import { TOAST_OPTIONS } from "../utils/toastOptions";

const FILE_OPTIONS: { key: keyof BackupFileOptions; labelKey: string }[] = [
  { key: "roms", labelKey: "settings.dataManagement.includeRomsLabel" },
  { key: "bios", labelKey: "settings.dataManagement.includeBiosLabel" },
  { key: "images", labelKey: "settings.dataManagement.includeImagesLabel" },
];

// Settings → General → Data: one Backup (a .json, or a .zip when files are picked to go
// with it) and Restore, which takes either.
const DataManagementSection = () => {
  const { t } = useTranslation();
  const exportBackup = useExportBackup();
  const restoreBackup = useRestoreBackup();
  const restoreStatus = useRestoreStatus();
  const restoreInProgress = restoreBackup.isPending || restoreStatus.data?.status === "running";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [files, setFiles] = useState<BackupFileOptions>({ roms: false, bios: false, images: false });
  const asZip = files.roms || files.bios || files.images;

  const handleExportBackup = async () => {
    try {
      await exportBackup.mutateAsync(files);
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
          {t("settings.dataManagement.backupHeading")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t("settings.dataManagement.backupDescription")}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {t("settings.dataManagement.includeFilesHeading")}
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} sx={{ flexWrap: "wrap", columnGap: 2 }}>
          {FILE_OPTIONS.map((option) => (
            <FormControlLabel
              key={option.key}
              control={
                <Checkbox
                  checked={files[option.key]}
                  onChange={(event) => setFiles((prev) => ({ ...prev, [option.key]: event.target.checked }))}
                />
              }
              label={t(option.labelKey)}
            />
          ))}
        </Stack>
        <FormHelperText sx={{ mt: 0, mb: 1.5 }}>{t("settings.dataManagement.includeFilesHelp")}</FormHelperText>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportBackup} disabled={exportBackup.isPending}>
          {asZip ? t("settings.dataManagement.downloadBackupZip") : t("settings.dataManagement.downloadBackupJson")}
        </Button>
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
            accept=".json,application/json,.zip,application/zip"
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
        busy={restoreBackup.isPending}
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
