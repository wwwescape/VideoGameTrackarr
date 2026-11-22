import { useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import ReplayIcon from "@mui/icons-material/Replay";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import type { GogDownload } from "../api/integrations";
import {
  useDeleteGogDownload,
  useGogDownloads,
  useRetryGogDownload,
} from "../hooks/useIntegrations";
import { saveGogDownloadToDevice } from "../utils/gogDownloads";
import { formatFileSize } from "../utils/roms";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";

const STATUS_COLOR: Record<GogDownload["status"], "default" | "info" | "success" | "error"> = {
  queued: "default",
  downloading: "info",
  completed: "success",
  failed: "error",
};

// Everything queued, downloading, finished or failed on this server, across games, with what
// the finished installers take up. Hidden until something has been downloaded.
const GogDownloadsPanel = () => {
  const { t } = useTranslation();
  const { data } = useGogDownloads();
  const retry = useRetryGogDownload();
  const remove = useDeleteGogDownload();
  const [removeTarget, setRemoveTarget] = useState<GogDownload | null>(null);

  if (!data || data.downloads.length === 0) return null;

  const handleRetry = async (download: GogDownload) => {
    try {
      await retry.mutateAsync(download.id);
    } catch (error) {
      console.error(`Error retrying GOG download ${download.id}:`, error);
      toast.error(t("insights.gogSync.downloads.retryErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleSave = async (download: GogDownload) => {
    try {
      await saveGogDownloadToDevice(download.id);
    } catch (error) {
      console.error(`Error saving GOG download ${download.id}:`, error);
      toast.error(t("games.gogInstallers.saveErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      await remove.mutateAsync(removeTarget.id);
    } catch (error) {
      console.error(`Error removing GOG download ${removeTarget.id}:`, error);
      toast.error(t("insights.gogSync.downloads.removeErrorToast"), TOAST_OPTIONS);
    } finally {
      setRemoveTarget(null);
    }
  };

  const action = (title: string, icon: React.ReactNode, onClick: () => void) => (
    <Tooltip title={title}>
      <IconButton size="small" aria-label={title} onClick={onClick}>
        {icon}
      </IconButton>
    </Tooltip>
  );

  const isRunning = (download: GogDownload) =>
    download.status === "queued" || download.status === "downloading";

  return (
    <Paper sx={{ width: "100%", borderRadius: 2, mt: 3, p: 2 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={0.5}
        sx={{ justifyContent: "space-between", alignItems: { sm: "baseline" }, mb: 1.5 }}
      >
        <Typography variant="h6">{t("insights.gogSync.downloads.heading")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("insights.gogSync.downloads.diskUse", { size: formatFileSize(data.bytesOnDisk) })}
        </Typography>
      </Stack>
      <Stack spacing={1.25}>
        {data.downloads.map((download) => {
          const progress =
            download.totalSize > 0
              ? Math.min(100, (download.downloadedBytes / download.totalSize) * 100)
              : 0;
          return (
            <Box key={download.id}>
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                    {download.gameSlug ? (
                      <Link to={`/game/${download.gameSlug}`}>{download.gameName}</Link>
                    ) : (
                      download.gameName
                    )}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ overflowWrap: "anywhere" }}
                  >
                    {[
                      download.filename ?? download.fileId,
                      formatFileSize(download.totalSize),
                    ].join(" · ")}
                    {download.status === "failed" && download.error ? ` · ${download.error}` : ""}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", flexShrink: 0 }}>
                  <Chip
                    size="small"
                    color={STATUS_COLOR[download.status]}
                    label={t(`games.gogInstallers.state.${download.status}`)}
                  />
                  {download.status === "completed" &&
                    action(
                      t("games.gogInstallers.saveButton"),
                      <SaveAltIcon fontSize="small" />,
                      () => void handleSave(download)
                    )}
                  {download.status === "failed" &&
                    action(
                      t("games.gogInstallers.retryButton"),
                      <ReplayIcon fontSize="small" />,
                      () => void handleRetry(download)
                    )}
                  {isRunning(download)
                    ? action(
                        t("insights.gogSync.downloads.cancelButton"),
                        <CloseIcon fontSize="small" />,
                        () => setRemoveTarget(download)
                      )
                    : action(
                        t("insights.gogSync.downloads.removeButton"),
                        <DeleteOutlineOutlinedIcon fontSize="small" />,
                        () => setRemoveTarget(download)
                      )}
                </Stack>
              </Stack>
              {download.status === "downloading" && (
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{ mt: 0.5 }}
                  aria-label={t("games.gogInstallers.progressLabel")}
                />
              )}
            </Box>
          );
        })}
      </Stack>

      <ConfirmDialog
        open={removeTarget !== null}
        title={
          removeTarget && isRunning(removeTarget)
            ? t("insights.gogSync.downloads.cancelConfirmTitle")
            : t("insights.gogSync.downloads.removeConfirmTitle")
        }
        description={
          removeTarget && isRunning(removeTarget)
            ? t("insights.gogSync.downloads.cancelConfirmDescription", {
                name: removeTarget.filename ?? removeTarget.fileId,
              })
            : t("insights.gogSync.downloads.removeConfirmDescription", {
                name: removeTarget?.filename ?? removeTarget?.fileId ?? "",
              })
        }
        confirmLabel={
          removeTarget && isRunning(removeTarget)
            ? t("insights.gogSync.downloads.cancelButton")
            : t("insights.gogSync.downloads.removeButton")
        }
        confirmColor="error"
        busy={remove.isPending}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => void handleRemove()}
      />
    </Paper>
  );
};

export default GogDownloadsPanel;
