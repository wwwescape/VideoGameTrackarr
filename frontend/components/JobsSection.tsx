import { useEffect, useState } from "react";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
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
  useJobsList,
  useRunJob,
  useUpdateJobSchedule,
} from "../hooks/useJobs";
import { TOAST_OPTIONS } from "../utils/toastOptions";

// Registering a future job means adding one entry here — job ids on their own aren't good
// UI copy, so a small static display-name lookup is the one manual step the "reusable
// registry" design accepts (see backend/app/services/job_definitions.py's docstring).
const JOB_DISPLAY_KEYS: Record<string, { nameKey: string; descriptionKey: string }> = {
  resync_all: {
    nameKey: "settings.jobs.jobs.resyncAll.name",
    descriptionKey: "settings.jobs.jobs.resyncAll.description",
  },
  resync_games: {
    nameKey: "settings.jobs.jobs.resyncGames.name",
    descriptionKey: "settings.jobs.jobs.resyncGames.description",
  },
  resync_collections: {
    nameKey: "settings.jobs.jobs.resyncCollections.name",
    descriptionKey: "settings.jobs.jobs.resyncCollections.description",
  },
  resync_series: {
    nameKey: "settings.jobs.jobs.resyncSeries.name",
    descriptionKey: "settings.jobs.jobs.resyncSeries.description",
  },
  steam_import: {
    nameKey: "settings.jobs.jobs.steamImport.name",
    descriptionKey: "settings.jobs.jobs.steamImport.description",
  },
};

const STATUS_CHIP_COLOR: Record<JobRunStatus, ChipProps["color"]> = {
  idle: "default",
  running: "info",
  completed: "success",
  failed: "error",
};

function JobCard({ job }: { job: JobSummary }) {
  const { t } = useTranslation();
  const runJob = useRunJob();
  const acknowledge = useAcknowledgeJobStatus();
  const updateSchedule = useUpdateJobSchedule();

  const displayKeys = JOB_DISPLAY_KEYS[job.id];
  const [scheduleEnabled, setScheduleEnabled] = useState(job.schedule.enabled);
  const [cronExpression, setCronExpression] = useState(job.schedule.cronExpression ?? "");
  const [showFailures, setShowFailures] = useState(false);

  useEffect(() => {
    setScheduleEnabled(job.schedule.enabled);
    setCronExpression(job.schedule.cronExpression ?? "");
  }, [job.schedule.enabled, job.schedule.cronExpression]);

  const isRunning = job.run.status === "running";
  const result = job.run.result as ResyncJobResult | null;

  const handleRun = async () => {
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

  return (
    <Box>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="subtitle2">{displayKeys ? t(displayKeys.nameKey) : job.id}</Typography>
        <Chip
          size="small"
          color={STATUS_CHIP_COLOR[job.run.status]}
          label={t(`settings.jobs.status.${job.run.status}`)}
        />
      </Stack>
      {displayKeys && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t(displayKeys.descriptionKey)}
        </Typography>
      )}

      <Button
        variant="outlined"
        size="small"
        startIcon={<PlayArrowIcon />}
        sx={{ mt: 1.5 }}
        disabled={isRunning}
        onClick={handleRun}
      >
        {t("settings.jobs.runNow")}
      </Button>

      {result && (
        <Box sx={{ mt: 1.5 }}>
          <Alert
            severity={
              job.run.status === "failed" ? "error" : result.failed > 0 ? "warning" : "success"
            }
            action={
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                {result.failed > 0 && (
                  <IconButton size="small" onClick={() => setShowFailures((prev) => !prev)}>
                    {showFailures ? (
                      <ExpandLessIcon fontSize="small" />
                    ) : (
                      <ExpandMoreIcon fontSize="small" />
                    )}
                  </IconButton>
                )}
                <Button size="small" onClick={handleDismiss}>
                  {t("settings.jobs.dismiss")}
                </Button>
              </Stack>
            }
          >
            {t("settings.jobs.resultSummary", {
              succeeded: result.succeeded,
              failed: result.failed,
              total: result.total,
            })}
          </Alert>
          <Collapse in={showFailures}>
            <Stack spacing={0.5} sx={{ mt: 1, pl: 2 }}>
              {result.failures.map((failure) => (
                <Typography key={failure.gameId} variant="body2" color="text.secondary">
                  {failure.gameName}: {failure.error}
                </Typography>
              ))}
            </Stack>
          </Collapse>
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
}

const JobsSection = () => {
  const { data: jobs } = useJobsList();

  if (!jobs || jobs.length === 0) return null;

  return (
    <Stack spacing={3}>
      {jobs.map((job, index) => (
        <Box key={job.id}>
          {index > 0 && <Divider sx={{ mb: 3 }} />}
          <JobCard job={job} />
        </Box>
      ))}
    </Stack>
  );
};

export default JobsSection;
