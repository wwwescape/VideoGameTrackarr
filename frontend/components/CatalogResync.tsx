import { useEffect, useRef } from "react";
import SyncIcon from "@mui/icons-material/Sync";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { CatalogResyncJobStatus, CatalogResyncKind } from "../api/types";
import {
  useAcknowledgeCatalogResyncStatus,
  useCatalogResyncStatus,
  useStartCollectionResync,
  useStartFranchiseResync,
} from "../hooks/useCatalogResync";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import { ToolbarButton } from "./Page";

interface CatalogResyncOptions {
  kind: CatalogResyncKind;
  // Undefined (a Platform page, or before the page's slug is known): no button and no status.
  slug: string | undefined;
  label: string;
}

// A Collection/Series page's "resync just this one" action: the toolbar button, and the status
// (progress, failure and partial-failure alerts) shown at the top of the page. Polls the same
// single global job slot as every other page, so it only shows progress/failure UI for the job
// it started (see the isMine check below); any other page's resync just disables the button
// until that job finishes.
export function useCatalogResync({ kind, slug, label }: CatalogResyncOptions) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: status } = useCatalogResyncStatus();
  const startCollectionMutation = useStartCollectionResync();
  const startFranchiseMutation = useStartFranchiseResync();
  const acknowledgeMutation = useAcknowledgeCatalogResyncStatus();
  const previousStatus = useRef<CatalogResyncJobStatus | undefined>(undefined);

  const isMine = slug !== undefined && status?.kind === kind && status?.refSlug === slug;

  useEffect(() => {
    if (isMine && previousStatus.current === "running" && status?.status === "completed") {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({
        queryKey: [kind === "collection" ? "collections" : "franchises", slug],
      });
      // Skip the success toast when anything failed — the warning Alert below (driven by
      // the same status.result) says so and stays on screen until dismissed, rather than
      // sending a mixed "success!" + warning combo where the toast fades in a few seconds.
      if (!status.result?.failures.length) {
        toast.success(
          t("catalogResync.completedToast", {
            added: status.result?.added ?? 0,
            skipped: status.result?.skippedExisting ?? 0,
          }),
          TOAST_OPTIONS
        );
      }
    }
    if (isMine) {
      previousStatus.current = status?.status;
    }
  }, [isMine, status?.status, status?.result, queryClient, kind, slug, t]);

  const handleClick = () => {
    if (!slug) return;
    if (kind === "collection") {
      startCollectionMutation.mutate(slug);
    } else {
      startFranchiseMutation.mutate(slug);
    }
  };

  const isRunning = isMine && status?.status === "running";
  const isFailed = isMine && status?.status === "failed";
  const isBlockedByAnotherJob = !isMine && status?.status === "running";
  const completedWithFailures =
    isMine && status?.status === "completed" && (status.result?.failures.length ?? 0) > 0;

  const button = slug ? (
    <ToolbarButton
      icon={<SyncIcon />}
      label={label}
      onClick={handleClick}
      disabled={
        isRunning || isBlockedByAnotherJob || startCollectionMutation.isPending || startFranchiseMutation.isPending
      }
    />
  ) : null;

  const statusBlock =
    isRunning || isFailed || completedWithFailures ? (
      <Stack spacing={1} sx={{ mb: 2, maxWidth: 640 }}>
        {isRunning ? (
          <Box sx={{ maxWidth: 320 }}>
            <LinearProgress
              variant={status?.progress ? "determinate" : "indeterminate"}
              value={
                status?.progress && status.progress.total > 0
                  ? (status.progress.current / status.progress.total) * 100
                  : undefined
              }
            />
            {status?.progress ? (
              <Typography variant="caption" color="text.secondary">
                {t("catalogResync.progressLabel", {
                  current: status.progress.current,
                  total: status.progress.total,
                })}
              </Typography>
            ) : null}
          </Box>
        ) : null}
        {isFailed ? (
          <Alert severity="error" onClose={() => acknowledgeMutation.mutate()}>
            {status?.error ?? t("catalogResync.unknownError")}
          </Alert>
        ) : null}
        {completedWithFailures ? (
          <Alert severity="warning" onClose={() => acknowledgeMutation.mutate()}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {t("catalogResync.partialFailureTitle", { count: status?.result?.failures.length ?? 0 })}
            </Typography>
            <Stack spacing={0.5}>
              {status?.result?.failures.map((failure) => (
                <Typography key={failure.igdbId} variant="caption" component="div">
                  IGDB {failure.igdbId}: {failure.error}
                </Typography>
              ))}
            </Stack>
          </Alert>
        ) : null}
      </Stack>
    ) : null;

  return { button, status: statusBlock };
}

