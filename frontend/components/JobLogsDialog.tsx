import { useState } from "react";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import type { ChipProps } from "@mui/material/Chip";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { JobRunLogLine, JobRunLogStatus, JobRunLogSummary } from "../api/types";
import { useClearJobLogs, useJobLog, useJobLogs } from "../hooks/useJobs";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";

const STATUS_COLOR: Record<JobRunLogStatus, ChipProps["color"]> = {
  running: "info",
  completed: "success",
  failed: "error",
};

const LINE_COLOR: Record<string, string> = {
  WARNING: "warning.main",
  ERROR: "error.main",
  CRITICAL: "error.main",
};

function formatDuration(startedAt: string, finishedAt: string | null): string | null {
  if (!finishedAt) return null;
  const seconds = Math.max(0, (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000);
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// "total 42, succeeded 40, failed 2" from whatever numeric counts the job's result has.
function resultCounts(result: Record<string, unknown> | null): string | null {
  if (!result) return null;
  const parts = Object.entries(result)
    .filter(([, value]) => typeof value === "number")
    .map(([key, value]) => `${key} ${value as number}`);
  return parts.length ? parts.join(" · ") : null;
}

function RunMeta({ log }: { log: JobRunLogSummary }) {
  const { t } = useTranslation();
  const duration = formatDuration(log.startedAt, log.finishedAt);
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
      <Chip size="small" color={STATUS_COLOR[log.status]} label={t(`settings.jobs.logs.status.${log.status}`)} />
      <Chip size="small" variant="outlined" label={t(`settings.jobs.logs.trigger.${log.trigger}`)} />
      {duration && (
        <Typography variant="caption" color="text.secondary">
          {duration}
        </Typography>
      )}
    </Stack>
  );
}

function LogLines({ lines }: { lines: JobRunLogLine[] }) {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 1.5,
        borderRadius: 1,
        bgcolor: "action.hover",
        fontFamily: "monospace",
        fontSize: 12,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        overflowX: "auto",
      }}
    >
      {lines.map((line, index) => (
        <Box key={index} component="div" sx={{ color: LINE_COLOR[line.level] ?? "text.primary" }}>
          <Box component="span" sx={{ color: "text.secondary" }}>
            {new Date(line.t).toLocaleTimeString()}{" "}
          </Box>
          {line.msg}
        </Box>
      ))}
    </Box>
  );
}

function LogDetail({ jobId, logId }: { jobId: string; logId: number }) {
  const { t } = useTranslation();
  const { data: log, isLoading, isError } = useJobLog(jobId, logId);

  if (isLoading) return <CircularProgress size={24} sx={{ display: "block", mx: "auto", my: 3 }} />;
  if (isError || !log) return <Alert severity="error">{t("settings.jobs.logs.loadError")}</Alert>;

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="subtitle2">{new Date(log.startedAt).toLocaleString()}</Typography>
        <Box sx={{ mt: 0.5 }}>
          <RunMeta log={log} />
        </Box>
      </Box>
      {log.error && <Alert severity="error">{log.error}</Alert>}
      {log.lines.length > 0 ? (
        <LogLines lines={log.lines} />
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t("settings.jobs.logs.noLines")}
        </Typography>
      )}
    </Stack>
  );
}

interface JobLogsDialogProps {
  jobId: string;
  jobName: string;
  open: boolean;
  onClose: () => void;
}

const JobLogsDialog = ({ jobId, jobName, open, onClose }: JobLogsDialogProps) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { data: logs, isLoading, isError } = useJobLogs(jobId, open);
  const clearLogs = useClearJobLogs();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClose = () => {
    setSelectedId(null);
    onClose();
  };

  const handleClear = async () => {
    try {
      await clearLogs.mutateAsync(jobId);
      setConfirmClear(false);
      setSelectedId(null);
    } catch (error) {
      console.error(`Error clearing logs for job ${jobId}:`, error);
      toast.error(t("settings.jobs.logs.clearError"), TOAST_OPTIONS);
    }
  };

  const hasFinishedLogs = Boolean(logs?.some((log) => log.status !== "running"));

  return (
    <>
      <Dialog open={open} onClose={handleClose} fullScreen={fullScreen} fullWidth maxWidth="md" scroll="paper" aria-labelledby={`job-logs-${jobId}`}>
        <DialogTitle id={`job-logs-${jobId}`} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {selectedId !== null && (
            <IconButton size="small" edge="start" aria-label={t("common.back")} onClick={() => setSelectedId(null)}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          )}
          <Box sx={{ minWidth: 0 }}>
            {t("settings.jobs.logs.title")}
            <Typography variant="body2" color="text.secondary" noWrap>
              {jobName}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedId !== null ? (
            <LogDetail jobId={jobId} logId={selectedId} />
          ) : isLoading ? (
            <CircularProgress size={24} sx={{ display: "block", mx: "auto", my: 3 }} />
          ) : isError ? (
            <Alert severity="error">{t("settings.jobs.logs.loadError")}</Alert>
          ) : !logs || logs.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
              {t("settings.jobs.logs.empty")}
            </Typography>
          ) : (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                {t("settings.jobs.logs.retention", { count: 25 })}
              </Typography>
              <List disablePadding>
                {logs.map((log) => {
                  const counts = resultCounts(log.result);
                  return (
                    <ListItemButton
                      key={log.id}
                      divider
                      onClick={() => setSelectedId(log.id)}
                      sx={{ display: "block", px: 1, py: 1.25 }}
                    >
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={{ xs: 0.75, sm: 2 }}
                        sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {new Date(log.startedAt).toLocaleString()}
                        </Typography>
                        <RunMeta log={log} />
                      </Stack>
                      {(log.error || counts) && (
                        <Typography
                          variant="caption"
                          color={log.error ? "error.main" : "text.secondary"}
                          sx={{ display: "block", mt: 0.5 }}
                          noWrap
                        >
                          {log.error ?? counts}
                        </Typography>
                      )}
                    </ListItemButton>
                  );
                })}
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
          <Button
            color="error"
            startIcon={<DeleteSweepIcon />}
            disabled={!hasFinishedLogs || selectedId !== null}
            onClick={() => setConfirmClear(true)}
          >
            {t("settings.jobs.logs.clear")}
          </Button>
          <Button onClick={handleClose}>{t("common.close")}</Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog
        open={confirmClear}
        title={t("settings.jobs.logs.clearTitle")}
        description={t("settings.jobs.logs.clearDescription", { name: jobName })}
        confirmLabel={t("settings.jobs.logs.clear")}
        confirmColor="error"
        busy={clearLogs.isPending}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => void handleClear()}
      />
    </>
  );
};

export default JobLogsDialog;
