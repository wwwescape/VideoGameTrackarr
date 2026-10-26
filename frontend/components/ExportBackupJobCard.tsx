import { useEffect, useState } from "react";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { ChipProps } from "@mui/material/Chip";
import type { JobRunStatus, JobSummary, ResyncJobResult } from "../api/types";
import {
  useAcknowledgeJobStatus,
  useRunJob,
  useUpdateJobSchedule,
} from "../hooks/useJobs";
import {
  useExportJobConfig,
  useTestExportJobConnection,
  useUpdateExportJobConfig,
} from "../hooks/useExportJob";
import { TOAST_OPTIONS } from "../utils/toastOptions";

const STATUS_CHIP_COLOR: Record<JobRunStatus, ChipProps["color"]> = {
  idle: "default",
  running: "info",
  completed: "success",
  failed: "error",
};

interface ExportJobResult extends ResyncJobResult {
  filename?: string;
  deleted?: number;
}

const ExportBackupJobCard = ({ job }: { job: JobSummary }) => {
  const { t } = useTranslation();
  const runJob = useRunJob();
  const acknowledge = useAcknowledgeJobStatus();
  const updateSchedule = useUpdateJobSchedule();

  const { data: config } = useExportJobConfig();
  const updateConfig = useUpdateExportJobConfig();
  const testConnection = useTestExportJobConnection();

  // Schedule state (mirrors JobCard)
  const [scheduleEnabled, setScheduleEnabled] = useState(job.schedule.enabled);
  const [cronExpression, setCronExpression] = useState(job.schedule.cronExpression ?? "");

  // Export config state
  const [smbPath, setSmbPath] = useState("");
  const [smbUsername, setSmbUsername] = useState("");
  const [smbPassword, setSmbPassword] = useState("");
  const [retentionCount, setRetentionCount] = useState("5");
  const [includeFiles, setIncludeFiles] = useState(false);
  const [touched, setTouched] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    setScheduleEnabled(job.schedule.enabled);
    setCronExpression(job.schedule.cronExpression ?? "");
  }, [job.schedule.enabled, job.schedule.cronExpression]);

  useEffect(() => {
    if (!touched && config) {
      setSmbPath(config.smbPath ?? "");
      setSmbUsername(config.smbUsername ?? "");
      setRetentionCount(String(config.retentionCount ?? 5));
      setIncludeFiles(config.includeFiles);
    }
  }, [config, touched]);

  const isRunning = job.run.status === "running";
  const result = job.run.result as ExportJobResult | null;
  const configured = !!config?.smbPath;

  const handleRun = async () => {
    if (!configured) {
      toast.error(t("settings.jobs.exportBackup.notConfigured"), TOAST_OPTIONS);
      return;
    }
    try {
      await runJob.mutateAsync(job.id);
    } catch (error) {
      console.error(`Error running job ${job.id}:`, error);
      toast.error(t("settings.jobs.runError"), TOAST_OPTIONS);
    }
  };

  const handleDismiss = async () => {
    try {
      await acknowledge.mutateAsync(job.id);
    } catch (error) {
      console.error(`Error dismissing job ${job.id} status:`, error);
    }
  };

  const handleSaveSchedule = async () => {
    try {
      await updateSchedule.mutateAsync({
        jobId: job.id,
        enabled: scheduleEnabled,
        cronExpression: scheduleEnabled ? cronExpression.trim() : null,
      });
    } catch (error) {
      console.error(`Error saving schedule for job ${job.id}:`, error);
      toast.error(t("settings.jobs.scheduleSaveError"), TOAST_OPTIONS);
    }
  };

  const handleTest = async () => {
    setTestResult(null);
    try {
      const result = await testConnection.mutateAsync({
        smbPath: smbPath.trim() === "" ? null : smbPath.trim(),
        smbUsername: smbUsername.trim() === "" ? null : smbUsername.trim(),
        smbPassword: smbPassword === "" ? null : smbPassword,
      });
      setTestResult(result);
    } catch {
      setTestResult({ ok: false, message: t("settings.jobs.exportBackup.testError") });
    }
  };

  const handleSaveConfig = async () => {
    const retention = parseInt(retentionCount, 10);
    if (isNaN(retention) || retention < 1) {
      toast.error(t("settings.jobs.exportBackup.retentionError"), TOAST_OPTIONS);
      return;
    }
    try {
      await updateConfig.mutateAsync({
        smbPath: smbPath.trim() === "" ? null : smbPath.trim(),
        smbUsername: smbUsername.trim() === "" ? null : smbUsername.trim(),
        smbPassword: smbPassword === "" ? null : smbPassword,
        retentionCount: retention,
        includeFiles,
      });
      setSmbPassword("");
      setTouched(false);
      toast.success(t("settings.jobs.exportBackup.saved"), TOAST_OPTIONS);
    } catch {
      toast.error(t("settings.jobs.exportBackup.saveError"), TOAST_OPTIONS);
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="subtitle2">{t("settings.jobs.jobs.exportBackup.name")}</Typography>
        <Chip
          size="small"
          color={STATUS_CHIP_COLOR[job.run.status]}
          label={t(`settings.jobs.status.${job.run.status}`)}
        />
        <Chip
          size="small"
          variant="outlined"
          color={configured ? "success" : "default"}
          label={
            configured
              ? t("settings.jobs.exportBackup.configured")
              : t("settings.jobs.exportBackup.notConfiguredLabel")
          }
        />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {t("settings.jobs.jobs.exportBackup.description")}
      </Typography>

      <Divider sx={{ my: 2 }} />

      <Typography variant="body2" color="text.secondary" gutterBottom>
        {t("settings.jobs.exportBackup.destinationHeading")}
      </Typography>
      <Stack spacing={2} sx={{ maxWidth: 500, mt: 1 }}>
        <TextField
          size="small"
          label={t("settings.jobs.exportBackup.pathLabel")}
          placeholder={t("settings.jobs.exportBackup.pathPlaceholder")}
          value={smbPath}
          onChange={(e) => {
            setSmbPath(e.target.value);
            setTouched(true);
          }}
          helperText={t("settings.jobs.exportBackup.pathHelper")}
          fullWidth
        />
        <TextField
          size="small"
          label={t("settings.jobs.exportBackup.usernameLabel")}
          value={smbUsername}
          onChange={(e) => {
            setSmbUsername(e.target.value);
            setTouched(true);
          }}
          helperText={t("settings.jobs.exportBackup.usernameHelper")}
          fullWidth
        />
        <TextField
          size="small"
          label={t("settings.jobs.exportBackup.passwordLabel")}
          type="password"
          value={smbPassword}
          onChange={(e) => {
            setSmbPassword(e.target.value);
            setTouched(true);
          }}
          helperText={
            config?.hasPassword
              ? t("settings.jobs.exportBackup.passwordSet")
              : t("settings.jobs.exportBackup.passwordHelper")
          }
          fullWidth
        />
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
          <TextField
            size="small"
            label={t("settings.jobs.exportBackup.retentionLabel")}
            type="number"
            value={retentionCount}
            onChange={(e) => {
              setRetentionCount(e.target.value);
              setTouched(true);
            }}
            helperText={t("settings.jobs.exportBackup.retentionHelper")}
            slotProps={{ htmlInput: { min: 1 } }}
            sx={{ maxWidth: 200 }}
          />
        </Stack>
        <FormControlLabel
          control={
            <Checkbox
              checked={includeFiles}
              onChange={(e) => {
                setIncludeFiles(e.target.checked);
                setTouched(true);
              }}
            />
          }
          label={t("settings.jobs.exportBackup.includeFilesLabel")}
        />
        <Typography variant="caption" color="text.secondary">
          {t("settings.jobs.exportBackup.includeFilesHelper")}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button variant="contained" size="small" onClick={handleSaveConfig} disabled={updateConfig.isPending}>
            {t("common.save")}
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={handleTest}
            disabled={testConnection.isPending || smbPath.trim() === ""}
          >
            {t("settings.jobs.exportBackup.testButton")}
          </Button>
        </Box>
        {testResult && (
          <Alert severity={testResult.ok ? "success" : "error"}>
            {testResult.message}
          </Alert>
        )}
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Button
        variant="outlined"
        size="small"
        startIcon={<PlayArrowIcon />}
        sx={{ mt: 0.5 }}
        disabled={isRunning}
        onClick={handleRun}
      >
        {t("settings.jobs.runNow")}
      </Button>

      {isRunning && (
        <Box sx={{ mt: 1.5 }}>
          <LinearProgress
            variant={job.run.progress ? "determinate" : "indeterminate"}
            value={
              job.run.progress && job.run.progress.total > 0
                ? (job.run.progress.current / job.run.progress.total) * 100
                : undefined
            }
          />
          {job.run.progress && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              {t("settings.jobs.progress", {
                current: job.run.progress.current,
                total: job.run.progress.total,
              })}
            </Typography>
          )}
        </Box>
      )}

      {result && (
        <Box sx={{ mt: 1.5 }}>
          <Alert
            severity={
              job.run.status === "failed" ? "error" : result.failed > 0 ? "warning" : "success"
            }
            action={
              <Button size="small" onClick={handleDismiss}>
                {t("settings.jobs.dismiss")}
              </Button>
            }
          >
            {result.filename
              ? t("settings.jobs.exportBackup.resultSummary", {
                  filename: result.filename,
                  deleted: result.deleted ?? 0,
                })
              : t("settings.jobs.resultSummary", {
                  succeeded: result.succeeded,
                  failed: result.failed,
                  total: result.total,
                })}
          </Alert>
        </Box>
      )}
      {job.run.status === "failed" && !result && (
        <Alert
          severity="error"
          sx={{ mt: 1.5 }}
          action={
            <Button size="small" onClick={handleDismiss}>
              {t("settings.jobs.dismiss")}
            </Button>
          }
        >
          {job.run.error}
        </Alert>
      )}

      <Divider sx={{ my: 2 }} />

      <Typography variant="body2" color="text.secondary" gutterBottom>
        {t("settings.jobs.scheduleHeading")}
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={scheduleEnabled}
            onChange={(event) => setScheduleEnabled(event.target.checked)}
          />
        }
        label={t("settings.jobs.scheduleEnabledLabel")}
      />
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "flex-start", flexWrap: "wrap", mt: 1 }}
      >
        <TextField
          size="small"
          label={t("settings.jobs.cronExpressionLabel")}
          helperText={t("settings.jobs.cronExpressionHelp")}
          value={cronExpression}
          disabled={!scheduleEnabled}
          onChange={(event) => setCronExpression(event.target.value)}
          sx={{ minWidth: 220 }}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={handleSaveSchedule}
          disabled={updateSchedule.isPending}
        >
          {t("settings.jobs.saveSchedule")}
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        {job.schedule.nextRunAt
          ? t("settings.jobs.nextRun", { date: new Date(job.schedule.nextRunAt).toLocaleString() })
          : t("settings.jobs.neverScheduled")}
      </Typography>
    </Box>
  );
};

export default ExportBackupJobCard;
