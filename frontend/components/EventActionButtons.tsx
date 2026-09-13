import { useState } from "react";
import { isAxiosError } from "axios";
import RefreshIcon from "@mui/icons-material/Refresh";
import Backdrop from "@mui/material/Backdrop";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useResyncEvent } from "../hooks/useEvents";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import ConfirmDialog from "./ConfirmDialog";

interface EventActionButtonsProps {
  eventId: number;
}

// Trimmed GameActionButtons copy — events have no add/edit/remove (IGDB-sourced only), just
// a per-event Resync that re-fetches fresh data from IGDB by id.
const EventActionButtons = ({ eventId }: EventActionButtonsProps) => {
  const { t } = useTranslation();
  const resyncEventMutation = useResyncEvent(eventId);
  const [resyncDialogOpen, setResyncDialogOpen] = useState(false);

  const handleResync = async () => {
    try {
      await resyncEventMutation.mutateAsync();
      setResyncDialogOpen(false);
      toast.success(t("events.actions.resyncSuccessToast"), TOAST_OPTIONS);
    } catch (error) {
      console.error("Error resyncing event:", error);
      const message =
        isAxiosError(error) && error.response?.status === 503
          ? t("events.actions.igdbNotConfiguredError")
          : t("events.actions.resyncErrorToast");
      toast.error(message, TOAST_OPTIONS);
    }
  };

  return (
    <>
      {resyncEventMutation.isPending && (
        <Backdrop
          sx={{ color: "#fff", zIndex: (t) => t.zIndex.modal + 1 }}
          open={resyncEventMutation.isPending}
        >
          <CircularProgress color="inherit" />
        </Backdrop>
      )}
      <Stack spacing={1.5}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<RefreshIcon />}
          onClick={() => setResyncDialogOpen(true)}
          fullWidth
        >
          {t("events.actions.resyncButton")}
        </Button>
        <ConfirmDialog
          open={resyncDialogOpen}
          title={t("events.actions.resyncConfirmTitle")}
          description={t("events.actions.resyncConfirmDescription")}
          confirmLabel={t("events.actions.resyncConfirmLabel")}
          onClose={() => setResyncDialogOpen(false)}
          onConfirm={() => void handleResync()}
        />
      </Stack>
    </>
  );
};

export default EventActionButtons;
