import { useEffect, useRef } from "react";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import SyncIcon from "@mui/icons-material/Sync";
import Chip from "@mui/material/Chip";
import { useMutationState } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { TOAST_OPTIONS } from "../utils/toastOptions";

// Mutations made while offline just sit pending (networkMode: 'online' pauses them and
// mutateAsync's promise simply never settles until reconnect) - components that
// await mutateAsync() and toast on success/failure (most of them) would otherwise show no
// feedback at all until whenever connectivity happens to return, possibly much later. One
// app-wide transition toast here covers every mutation site without touching each of them.
const OfflineStatusIndicator = () => {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const pausedMutationCount = useMutationState({
    filters: { predicate: (mutation) => mutation.state.isPaused },
  }).length;

  const wasOnline = useRef(isOnline);
  const hadPendingSync = useRef(false);

  useEffect(() => {
    if (wasOnline.current && !isOnline) {
      toast.warning(t("offline.wentOfflineToast"), TOAST_OPTIONS);
    }
    wasOnline.current = isOnline;
  }, [isOnline, t]);

  useEffect(() => {
    if (pausedMutationCount > 0) {
      hadPendingSync.current = true;
    } else if (hadPendingSync.current) {
      hadPendingSync.current = false;
      toast.success(t("offline.backOnlineToast"), TOAST_OPTIONS);
    }
  }, [pausedMutationCount, t]);

  if (!isOnline) {
    return (
      <Chip
        icon={<CloudOffIcon />}
        label={
          pausedMutationCount > 0
            ? t("offline.changesPending", { count: pausedMutationCount })
            : t("offline.offline")
        }
        color="warning"
        size="small"
        sx={{ mr: 1 }}
      />
    );
  }

  if (pausedMutationCount > 0) {
    return (
      <Chip
        icon={<SyncIcon />}
        label={t("offline.syncingChanges", { count: pausedMutationCount })}
        color="info"
        size="small"
        sx={{ mr: 1 }}
      />
    );
  }

  return null;
};

export default OfflineStatusIndicator;
