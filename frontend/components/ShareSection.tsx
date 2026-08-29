import { useState } from "react";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useRegenerateShareLink, useShareLink } from "../hooks/useShareLink";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";

const ShareSection = () => {
  const { t } = useTranslation();
  const { data: token } = useShareLink();
  const regenerate = useRegenerateShareLink();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const gamesUrl = token ? `${window.location.origin}/public/${token}/games` : "";
  const hardwareUrl = token ? `${window.location.origin}/public/${token}/hardware` : "";

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("settings.share.copySuccess"), TOAST_OPTIONS);
    } catch (error) {
      console.error("Error copying share link:", error);
      toast.error(t("settings.share.copyError"), TOAST_OPTIONS);
    }
  };

  const handleRegenerate = async () => {
    try {
      await regenerate.mutateAsync();
      toast.success(t("settings.share.regenerateSuccess"), TOAST_OPTIONS);
    } catch (error) {
      console.error("Error regenerating share link:", error);
      toast.error(t("settings.share.regenerateError"), TOAST_OPTIONS);
    } finally {
      setConfirmOpen(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {t("settings.share.description")}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <TextField
          label={t("settings.share.gamesLabel")}
          value={gamesUrl}
          slotProps={{ input: { readOnly: true } }}
          fullWidth
        />
        <Tooltip title={t("settings.share.copyButton")}>
          <IconButton onClick={() => handleCopy(gamesUrl)} disabled={!token}>
            <ContentCopyIcon />
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <TextField
          label={t("settings.share.hardwareLabel")}
          value={hardwareUrl}
          slotProps={{ input: { readOnly: true } }}
          fullWidth
        />
        <Tooltip title={t("settings.share.copyButton")}>
          <IconButton onClick={() => handleCopy(hardwareUrl)} disabled={!token}>
            <ContentCopyIcon />
          </IconButton>
        </Tooltip>
      </Box>
      <Box>
        <Button
          variant="outlined"
          color="error"
          startIcon={<RefreshIcon />}
          onClick={() => setConfirmOpen(true)}
          disabled={!token}
        >
          {t("settings.share.regenerateButton")}
        </Button>
      </Box>

      <ConfirmDialog
        open={confirmOpen}
        title={t("settings.share.regenerateConfirmTitle")}
        description={t("settings.share.regenerateConfirmDescription")}
        confirmLabel={t("settings.share.regenerateButton")}
        confirmColor="error"
        confirmDisabled={regenerate.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleRegenerate}
      />
    </Stack>
  );
};

export default ShareSection;
