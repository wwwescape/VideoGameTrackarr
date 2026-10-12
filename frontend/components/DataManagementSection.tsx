import { useRef, useState } from "react";
import DownloadIcon from "@mui/icons-material/Download";
import RestoreIcon from "@mui/icons-material/Restore";
import UploadIcon from "@mui/icons-material/Upload";
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
import ConfirmDialog from "./ConfirmDialog";
import { CSV_IMPORT_COLUMNS, type CsvImportResult } from "../api/importExport";
import {
  useExportBackup,
  useExportCsv,
  useExportHardwareCsv,
  useImportCsv,
  useRestoreBackup,
  useRestoreStatus,
} from "../hooks/useImportExport";
import { downloadBlob } from "../utils/download";
import { TOAST_OPTIONS } from "../utils/toastOptions";

const DataManagementSection = () => {
  const { t } = useTranslation();
  const exportCsv = useExportCsv();
  const exportHardwareCsv = useExportHardwareCsv();
  const exportBackup = useExportBackup();
  const restoreBackup = useRestoreBackup();
  const restoreStatus = useRestoreStatus();
  const restoreInProgress = restoreBackup.isPending || restoreStatus.data?.status === "running";
  const importCsv = useImportCsv();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null);
  const [includeFiles, setIncludeFiles] = useState(false);

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
      await exportBackup.mutateAsync({ includeFiles });
    } catch (error) {
      console.error("Error exporting backup:", error);
      toast.error(t("settings.dataManagement.exportBackupError"), TOAST_OPTIONS);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([`${CSV_IMPORT_COLUMNS}\n`], { type: "text/csv" });
    downloadBlob(blob, "videogametrackarr-import-template.csv");
  };

  const handleCsvFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    try {
      const result = await importCsv.mutateAsync(file);
      setImportResult(result);
    } catch (error) {
      console.error("Error importing CSV:", error);
      toast.error(t("settings.dataManagement.importCsvError"), TOAST_OPTIONS);
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = "";
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
            {includeFiles
              ? t("settings.dataManagement.exportFullBackupWithFiles")
              : t("settings.dataManagement.exportFullBackup")}
          </Button>
        </Stack>
        <FormControlLabel
          sx={{ mt: 1 }}
          control={<Checkbox checked={includeFiles} onChange={(event) => setIncludeFiles(event.target.checked)} />}
          label={t("settings.dataManagement.includeFilesLabel")}
        />
        <FormHelperText sx={{ mt: 0 }}>{t("settings.dataManagement.includeFilesHelp")}</FormHelperText>
      </Box>

      <Divider />

      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {t("settings.dataManagement.importHeading")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t("settings.dataManagement.importCsvDescription")}
        </Typography>
        <Typography
          variant="body2"
          sx={{ mb: 1, fontFamily: "monospace", fontSize: "0.8rem", wordBreak: "break-all" }}
        >
          {CSV_IMPORT_COLUMNS}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t("settings.dataManagement.importCsvValuesHelp")}
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownloadTemplate}>
            {t("settings.dataManagement.downloadCsvTemplate")}
          </Button>
          <Button
            component="label"
            variant="outlined"
            startIcon={<UploadIcon />}
            disabled={importCsv.isPending}
          >
            {t("settings.dataManagement.importCsvButton")}
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              disabled={importCsv.isPending}
              onChange={(event) => void handleCsvFileSelected(event)}
            />
          </Button>
        </Stack>
        {importResult && (
          <Alert
            severity={importResult.errors.length > 0 ? "warning" : "success"}
            sx={{ mt: 1.5 }}
          >
            {t("settings.dataManagement.importCsvResult", {
              imported: importResult.imported,
              skipped: importResult.skipped,
            })}
            {importResult.errors.slice(0, 5).map((error) => (
              <Typography key={error.row} variant="body2">
                {t("settings.dataManagement.importCsvRowError", {
                  row: error.row,
                  message: error.message,
                })}
              </Typography>
            ))}
            {importResult.errors.length > 5 &&
              t("settings.dataManagement.importCsvMoreErrors", {
                count: importResult.errors.length - 5,
              })}
          </Alert>
        )}
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
