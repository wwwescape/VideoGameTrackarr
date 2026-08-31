import { useState } from "react";
import HistoryIcon from "@mui/icons-material/History";
import TimelineIcon from "@mui/icons-material/Timeline";
import Backdrop from "@mui/material/Backdrop";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import type { GameProgress, LibraryItem, PlatformResponse, PlaySession } from "../api/types";
import {
  useCreateGameProgress,
  useDeleteGameProgress,
  useGameProgressList,
  useUpdateGameProgress,
} from "../hooks/useProgress";
import {
  useCreatePlaySession,
  useDeletePlaySession,
  usePlaySessions,
  useUpdatePlaySession,
} from "../hooks/usePlaySessions";
import { useUndoableAction } from "../hooks/useUndoableAction";
import { TOAST_OPTIONS } from "../utils/toastOptions";
import EnhancedTable, { type HeadCell } from "./EnhancedTable";
import PlaySessionDialog, { type PlaySessionFormValues } from "./PlaySessionDialog";
import ProgressDialog, { type ProgressFormValues } from "./ProgressDialog";
import { showUndoToast } from "./UndoToast";

interface GameProgressSectionProps {
  gameId: number;
  libraryItems: LibraryItem[] | undefined;
  platforms: PlatformResponse[] | undefined;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "-";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
}

const GameProgressSection = ({ gameId, libraryItems, platforms }: GameProgressSectionProps) => {
  const { t } = useTranslation();

  const { data: progressRows } = useGameProgressList(gameId);
  const createProgress = useCreateGameProgress(gameId);
  const updateProgress = useUpdateGameProgress(gameId);
  const deleteProgress = useDeleteGameProgress(gameId);

  const { data: sessions } = usePlaySessions(gameId);
  const createSession = useCreatePlaySession(gameId);
  const updateSession = useUpdatePlaySession(gameId);
  const deleteSession = useDeletePlaySession(gameId);

  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [editingProgress, setEditingProgress] = useState<GameProgress | null>(null);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<PlaySession | null>(null);

  // Owned platforms, deduped — two copies on the same platform still share one Progress
  // row and can log sessions against the same platform entry either way.
  const ownedPlatformIds = new Set(
    (libraryItems ?? [])
      .filter((item) => item.status === "owned" && item.platformId !== null)
      .map((item) => item.platformId)
  );
  const ownedPlatforms = (platforms ?? []).filter((platform) => ownedPlatformIds.has(platform.id));
  const trackedProgressPlatformIds = new Set((progressRows ?? []).map((row) => row.platformId));
  const eligibleProgressPlatforms = ownedPlatforms.filter(
    (platform) => !trackedProgressPlatformIds.has(platform.id)
  );

  const progressHeadCells: HeadCell[] = [
    {
      id: "platformName",
      numeric: false,
      disablePadding: false,
      label: t("progress.platformColumn"),
      disableHeader: false,
    },
    {
      id: "statusLabel",
      numeric: false,
      disablePadding: false,
      label: t("progress.statusColumn"),
      disableHeader: false,
    },
    {
      id: "playtimeLabel",
      numeric: false,
      disablePadding: false,
      label: t("progress.playtimeColumn"),
      disableHeader: false,
    },
    {
      id: "ratingLabel",
      numeric: false,
      disablePadding: false,
      label: t("progress.ratingColumn"),
      disableHeader: false,
    },
    {
      id: "lastPlayedLabel",
      numeric: false,
      disablePadding: false,
      label: t("progress.lastPlayedColumn"),
      disableHeader: false,
    },
    {
      id: "actions",
      numeric: false,
      disablePadding: true,
      label: "",
      disableHeader: true,
      width: 100,
    },
  ];

  const sessionHeadCells: HeadCell[] = [
    {
      id: "platformName",
      numeric: false,
      disablePadding: false,
      label: t("playSessions.platformColumn"),
      disableHeader: false,
    },
    {
      id: "startedLabel",
      numeric: false,
      disablePadding: false,
      label: t("playSessions.startedColumn"),
      disableHeader: false,
    },
    {
      id: "endedLabel",
      numeric: false,
      disablePadding: false,
      label: t("playSessions.endedColumn"),
      disableHeader: false,
    },
    {
      id: "durationLabel",
      numeric: false,
      disablePadding: false,
      label: t("playSessions.durationColumn"),
      disableHeader: false,
    },
    {
      id: "actions",
      numeric: false,
      disablePadding: true,
      label: "",
      disableHeader: true,
      width: 100,
    },
  ];

  const statusLabels: Record<GameProgress["playStatus"], string> = {
    none: t("progress.statusOptions.none"),
    backlog: t("progress.statusOptions.backlog"),
    playing: t("progress.statusOptions.playing"),
    completed: t("progress.statusOptions.completed"),
    abandoned: t("progress.statusOptions.abandoned"),
  };

  const progressRow = (row: GameProgress) => ({
    id: row.id!,
    platformName: row.platformName ?? "-",
    statusLabel: statusLabels[row.playStatus],
    playtimeLabel: formatDuration(row.playtimeMinutes),
    ratingLabel: row.rating !== null ? t("progress.ratingValue", { rating: row.rating }) : "-",
    lastPlayedLabel: row.lastPlayedAt ?? "-",
  });

  const sessionRow = (session: PlaySession) => ({
    id: session.id,
    platformName: session.platformName ?? "-",
    startedLabel: new Date(session.startedAt).toLocaleString(),
    endedLabel: session.endedAt ? new Date(session.endedAt).toLocaleString() : "-",
    durationLabel: formatDuration(session.durationMinutes),
  });

  const { schedule: scheduleProgressRemoval, isPending: isProgressPending } =
    useUndoableAction<GameProgress>({
      getId: (row) => row.id!,
      onCommit: async (rows) => {
        await Promise.all(rows.map((row) => deleteProgress.mutateAsync(row.id!)));
      },
    });

  const { schedule: scheduleSessionRemoval, isPending: isSessionPending } =
    useUndoableAction<PlaySession>({
      getId: (session) => session.id,
      onCommit: async (items) => {
        await Promise.all(items.map((item) => deleteSession.mutateAsync(item.id)));
      },
    });

  const progressTableRows = (progressRows ?? [])
    .filter((row) => !isProgressPending(row.id!))
    .map(progressRow);
  const sessionTableRows = (sessions ?? [])
    .filter((session) => !isSessionPending(session.id))
    .map(sessionRow);

  const handleAddProgressClick = () => {
    setEditingProgress(null);
    setProgressDialogOpen(true);
  };

  const handleEditProgressClick = (rowId: number) => {
    const row = progressRows?.find((candidate) => candidate.id === rowId);
    if (!row) return;
    setEditingProgress(row);
    setProgressDialogOpen(true);
  };

  const handleDeleteProgressClick = (selectedIds: number[]) => {
    const rowsToRemove = (progressRows ?? []).filter((row) => selectedIds.includes(row.id!));
    if (rowsToRemove.length === 0) return;
    const { undo } = scheduleProgressRemoval(rowsToRemove);
    showUndoToast(t("progress.removedToast", { count: rowsToRemove.length }), undo, 5000);
  };

  const handleProgressSubmit = async (values: ProgressFormValues) => {
    try {
      if (editingProgress) {
        await updateProgress.mutateAsync({ progressId: editingProgress.id!, input: values });
        toast.success(t("progress.updateSuccessToast"), TOAST_OPTIONS);
      } else {
        await createProgress.mutateAsync(values);
        toast.success(t("progress.addSuccessToast"), TOAST_OPTIONS);
      }
      setProgressDialogOpen(false);
    } catch (error) {
      console.error("Error saving progress:", error);
      toast.error(
        editingProgress ? t("progress.updateErrorToast") : t("progress.addErrorToast"),
        TOAST_OPTIONS
      );
    }
  };

  const handleAddSessionClick = () => {
    setEditingSession(null);
    setSessionDialogOpen(true);
  };

  const handleEditSessionClick = (rowId: number) => {
    const session = sessions?.find((candidate) => candidate.id === rowId);
    if (!session) return;
    setEditingSession(session);
    setSessionDialogOpen(true);
  };

  const handleDeleteSessionClick = (selectedIds: number[]) => {
    const itemsToRemove = (sessions ?? []).filter((session) => selectedIds.includes(session.id));
    if (itemsToRemove.length === 0) return;
    const { undo } = scheduleSessionRemoval(itemsToRemove);
    showUndoToast(t("playSessions.removedToast", { count: itemsToRemove.length }), undo, 5000);
  };

  const handleSessionSubmit = async (values: PlaySessionFormValues) => {
    try {
      if (editingSession) {
        await updateSession.mutateAsync({ sessionId: editingSession.id, input: values });
        toast.success(t("playSessions.updateSuccessToast"), TOAST_OPTIONS);
      } else {
        await createSession.mutateAsync(values);
        toast.success(t("playSessions.addSuccessToast"), TOAST_OPTIONS);
      }
      setSessionDialogOpen(false);
    } catch (error) {
      console.error("Error saving play session:", error);
      toast.error(
        editingSession ? t("playSessions.updateErrorToast") : t("playSessions.addErrorToast"),
        TOAST_OPTIONS
      );
    }
  };

  const isMutating =
    createProgress.isPending ||
    updateProgress.isPending ||
    deleteProgress.isPending ||
    createSession.isPending ||
    updateSession.isPending ||
    deleteSession.isPending;

  return (
    <>
      {isMutating && (
        <Backdrop
          sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.modal + 1 }}
          open={isMutating}
        >
          <CircularProgress color="inherit" />
        </Backdrop>
      )}
      <CardHeader title={t("progress.title")} subheader={t("progress.subheader")} />
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <EnhancedTable
          rows={progressTableRows}
          headCells={progressHeadCells}
          tableName={t("progress.tableName")}
          tableIcon={<TimelineIcon color="secondary" />}
          onAddClick={handleAddProgressClick}
          onDeleteClick={handleDeleteProgressClick}
          onEditClick={handleEditProgressClick}
          moveDirection="up"
        />
        <EnhancedTable
          rows={sessionTableRows}
          headCells={sessionHeadCells}
          tableName={t("playSessions.tableName")}
          tableIcon={<HistoryIcon color="secondary" />}
          onAddClick={handleAddSessionClick}
          onDeleteClick={handleDeleteSessionClick}
          onEditClick={handleEditSessionClick}
          moveDirection="up"
        />

        <ProgressDialog
          open={progressDialogOpen}
          editing={editingProgress}
          eligiblePlatforms={eligibleProgressPlatforms}
          onClose={() => setProgressDialogOpen(false)}
          onSubmit={handleProgressSubmit}
          isSubmitting={createProgress.isPending || updateProgress.isPending}
        />
        <PlaySessionDialog
          open={sessionDialogOpen}
          editing={editingSession}
          ownedPlatforms={ownedPlatforms}
          onClose={() => setSessionDialogOpen(false)}
          onSubmit={handleSessionSubmit}
          isSubmitting={createSession.isPending || updateSession.isPending}
        />
      </CardContent>
    </>
  );
};

export default GameProgressSection;
