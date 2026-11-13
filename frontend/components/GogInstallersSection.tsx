import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { GogInstallerFile } from "../api/integrations";
import {
  useGogInstallerFileLink,
  useGogInstallers,
  useQueueGogInstallerDownload,
} from "../hooks/useIntegrations";
import { formatFileSize } from "../utils/roms";
import { TOAST_OPTIONS } from "../utils/toastOptions";

interface GogInstallersSectionProps {
  gameId: number;
  // Only GOG-imported games have installers — the dialog only mounts this section
  // (and fires the query) when a library item carries the GOG storefront, so every
  // other dialog skips the request entirely.
  hasGogItem: boolean;
}

// Offline installers for a GOG-imported game: the NAS downloads each file in the
// background (uploads/gog-installers, never part of backups), and once a file is on
// the NAS the button serves it to this device instead. The section stays hidden
// whenever GOG has no installers for the game (e.g. a GOG Connect key that has no
// offline installer).
const GogInstallersSection = ({ gameId, hasGogItem }: GogInstallersSectionProps) => {
  const { t } = useTranslation();
  const { data: installers, isError } = useGogInstallers(gameId, hasGogItem);
  const queueDownload = useQueueGogInstallerDownload(gameId);
  const fileLink = useGogInstallerFileLink();

  if (!hasGogItem || isError || !installers || installers.groups.length === 0) return null;

  const handleQueue = async (installerId: string, fileId: string) => {
    try {
      await queueDownload.mutateAsync({ installerId, fileId });
    } catch (error) {
      console.error(`Error queueing GOG installer file ${fileId}:`, error);
      toast.error(t("games.gogInstallers.queueErrorToast"), TOAST_OPTIONS);
    }
  };

  const handleDownload = async (fileId: string) => {
    try {
      const url = await fileLink.mutateAsync({ gameId, fileId });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(`Error fetching GOG installer download link for ${fileId}:`, error);
      toast.error(t("games.gogInstallers.linkErrorToast"), TOAST_OPTIONS);
    }
  };

  const renderFileAction = (installerId: string, file: GogInstallerFile) => {
    switch (file.downloadState) {
      case "queued":
      case "downloading":
        return (
          <Box sx={{ minWidth: 160 }}>
            <LinearProgress
              variant="determinate"
              value={file.size > 0 ? Math.min(100, (file.downloadedBytes / file.size) * 100) : 0}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              {t("games.gogInstallers.downloadingLabel", {
                downloaded: formatFileSize(file.downloadedBytes),
                total: formatFileSize(file.size),
              })}
            </Typography>
          </Box>
        );
      case "completed":
        return (
          <Button
            variant="outlined"
            size="small"
            onClick={() => void handleDownload(file.id)}
            disabled={fileLink.isPending}
          >
            {t("games.gogInstallers.downloadButton")}
          </Button>
        );
      case "failed":
        return (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            {file.downloadError && (
              <Typography variant="caption" color="error">
                {file.downloadError}
              </Typography>
            )}
            <Button
              variant="outlined"
              size="small"
              onClick={() => void handleQueue(installerId, file.id)}
              disabled={queueDownload.isPending}
            >
              {t("games.gogInstallers.retryButton")}
            </Button>
          </Stack>
        );
      case "not_downloaded":
      default:
        return (
          <Button
            variant="outlined"
            size="small"
            onClick={() => void handleQueue(installerId, file.id)}
            disabled={queueDownload.isPending}
          >
            {t("games.gogInstallers.cacheDownloadButton")}
          </Button>
        );
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        {t("games.gogInstallers.heading")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("games.gogInstallers.description")}
      </Typography>
      {installers.groups.map((group) => (
        <Box key={group.productId} sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            {group.title}
          </Typography>
          {group.installers.map((installer) => (
            <Box key={installer.id} sx={{ mb: 1.5, pl: 1 }}>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                {t("games.gogInstallers.installerLabel", {
                  os: installer.os,
                  language: installer.language,
                  version: installer.version ?? "",
                  size: formatFileSize(installer.totalSize),
                })}
              </Typography>
              {installer.files.map((file) => (
                <Stack
                  key={file.id}
                  direction="row"
                  spacing={1}
                  sx={{ alignItems: "center", justifyContent: "space-between", pl: 1, py: 0.5 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {t("games.gogInstallers.fileLabel", { size: formatFileSize(file.size) })}
                  </Typography>
                  {renderFileAction(installer.id, file)}
                </Stack>
              ))}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
};

export default GogInstallersSection;
