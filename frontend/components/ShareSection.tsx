import { useState } from "react";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
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
import {
  useDisableShareLink,
  useEnableShareLink,
  useRegenerateShareLink,
  useShareLink,
} from "../hooks/useShareLink";
import { copyText } from "../utils/clipboard";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";

const ShareSection = () => {
  const { t } = useTranslation();
  const { data: token, isPending } = useShareLink();
  const enable = useEnableShareLink();
  const disable = useDisableShareLink();
  const regenerate = useRegenerateShareLink();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  const gamesUrl = token ? `${window.location.origin}/public/${token}/games` : "";
  const hardwareUrl = token ? `${window.location.origin}/public/${token}/hardware` : "";

  const handleCopy = async (url: string) => {
    try {
      await copyText(url);
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

  const handleEnable = async () => {
    try {
      await enable.mutateAsync();
      toast.success(t("settings.share.enableSuccess"), TOAST_OPTIONS);
    } catch (error) {
      console.error("Error turning sharing on:", error);
      toast.error(t("settings.share.enableError"), TOAST_OPTIONS);
    }
  };

  const handleDisable = async () => {
    try {
      await disable.mutateAsync();
      toast.success(t("settings.share.disableSuccess"), TOAST_OPTIONS);
    } catch (error) {
      console.error("Error turning sharing off:", error);
      toast.error(t("settings.share.disableError"), TOAST_OPTIONS);
    } finally {
      setDisableOpen(false);
    }
  };

  // Sharing is off until it's turned on here: opening Settings publishes nothing.
  if (!token) {
    return (
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {t("settings.share.description")}
        </Typography>
        <Typography variant="body2">{t("settings.share.offDescription")}</Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<LinkIcon />}
            onClick={handleEnable}
            disabled={isPending || enable.isPending}
          >
            {t("settings.share.enableButton")}
          </Button>
        </Box>
      </Stack>
    );
  }

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
          <IconButton onClick={() => handleCopy(gamesUrl)}>
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
          <IconButton onClick={() => handleCopy(hardwareUrl)}>
            <ContentCopyIcon />
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        <Button
          variant="outlined"
          color="error"
          startIcon={<RefreshIcon />}
          onClick={() => setConfirmOpen(true)}
        >
          {t("settings.share.regenerateButton")}
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<LinkOffIcon />}
          onClick={() => setDisableOpen(true)}
        >
          {t("settings.share.disableButton")}
        </Button>
      </Box>

      <ConfirmDialog
        open={confirmOpen}
        title={t("settings.share.regenerateConfirmTitle")}
        description={t("settings.share.regenerateConfirmDescription")}
        confirmLabel={t("settings.share.regenerateButton")}
        confirmColor="error"
        busy={regenerate.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleRegenerate}
      />
      <ConfirmDialog
        open={disableOpen}
        title={t("settings.share.disableConfirmTitle")}
        description={t("settings.share.disableConfirmDescription")}
        confirmLabel={t("settings.share.disableButton")}
        confirmColor="error"
        busy={disable.isPending}
        onClose={() => setDisableOpen(false)}
        onConfirm={handleDisable}
      />
    </Stack>
  );
};

export default ShareSection;
