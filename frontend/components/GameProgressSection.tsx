import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import type {
  GameProgress,
  LibraryItem,
  PlatformResponse,
  PlaySession,
  PlayStatus,
} from "../api/types";
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
import {
  EmptyLine,
  Facts,
  ListRow,
  Panel,
  PlatformBadge,
  RowAction,
  Section,
  SectionAction,
} from "./Detail";
import PlaySessionDialog, { type PlaySessionFormValues } from "./PlaySessionDialog";
import ProgressDialog, { type ProgressFormValues } from "./ProgressDialog";
import { showUndoToast } from "./UndoToast";

interface GameProgressSectionProps {
  gameId: number;
  libraryItems: LibraryItem[] | undefined;
  platforms: PlatformResponse[] | undefined;
  // The game's overall play status (its most advanced platform's), for the summary.
  playStatus: PlayStatus | null;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
}

const PLAY_STATUS_CHIP: Record<PlayStatus, "default" | "info" | "success" | "error"> = {
  none: "default",
  backlog: "default",
  playing: "info",
  completed: "success",
  abandoned: "error",
};

// A game's Progress (a summary, then one row per platform you track) and Play sessions
// sections. Rows open their dialog; Remove on a row has an Undo.
const GameProgressSection = ({
  gameId,
  libraryItems,
  platforms,
  playStatus,
}: GameProgressSectionProps) => {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;

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
  const badgeFor = (platformId: number | null, platformName: string | null) =>
    platforms?.find((platform) => platform.id === platformId)?.abbreviation ||
    platformName?.split(" ")[0] ||
    "?";

  const statusLabels: Record<PlayStatus, string> = {
    none: t("progress.statusOptions.none"),
    backlog: t("progress.statusOptions.backlog"),
    playing: t("progress.statusOptions.playing"),
    completed: t("progress.statusOptions.completed"),
    abandoned: t("progress.statusOptions.abandoned"),
  };
  const formatDay = (date: string | null) =>
    date
      ? new Date(`${date}T00:00:00`).toLocaleDateString(language, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;
  const formatMoment = (date: string) =>
    new Date(date).toLocaleString(language, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
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

  const visibleProgress = (progressRows ?? []).filter((row) => !isProgressPending(row.id!));
  const visibleSessions = (sessions ?? []).filter((session) => !isSessionPending(session.id));

  // The summary across every tracked platform.
  const totalMinutes = visibleProgress.reduce((total, row) => total + row.playtimeMinutes, 0);
  const ratings = visibleProgress
    .map((row) => row.rating)
    .filter((rating): rating is number => rating !== null);
  const averageRating = ratings.length
    ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
    : null;
  const lastPlayed = visibleProgress
    .map((row) => row.lastPlayedAt)
    .filter((date): date is string => date !== null)
    .sort()
    .at(-1);

  const handleAddProgressClick = () => {
    setEditingProgress(null);
    setProgressDialogOpen(true);
  };

  const handleEditProgressClick = (row: GameProgress) => {
    setEditingProgress(row);
    setProgressDialogOpen(true);
  };

  const handleRemoveProgress = (row: GameProgress) => {
    const { undo } = scheduleProgressRemoval([row]);
    showUndoToast(t("progress.removedToast", { count: 1 }), undo, 5000);
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

  const handleEditSessionClick = (session: PlaySession) => {
    setEditingSession(session);
    setSessionDialogOpen(true);
  };

  const handleRemoveSession = (session: PlaySession) => {
    const { undo } = scheduleSessionRemoval([session]);
    showUndoToast(t("playSessions.removedToast", { count: 1 }), undo, 5000);
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

  const removeAction = (onClick: () => void) => (
    <RowAction
      title={t("common.remove")}
      icon={<DeleteOutlineOutlinedIcon fontSize="small" />}
      onClick={onClick}
    />
  );

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

      <Section
        id="progress"
        title={t("progress.title")}
        action={
          <SectionAction
            icon={<AddIcon />}
            label={t("progress.addAction")}
            onClick={handleAddProgressClick}
          />
        }
      >
        <Facts
          facts={[
            [
              t("progress.statusLabel"),
              playStatus && playStatus !== "none" ? statusLabels[playStatus] : t("progress.notSet"),
            ],
            [t("progress.playtimeColumn"), totalMinutes ? formatDuration(totalMinutes) : "—"],
            [
              t("progress.ratingColumn"),
              averageRating !== null
                ? t("progress.ratingValue", { rating: Math.round(averageRating * 10) / 10 })
                : "—",
            ],
            [t("progress.lastPlayedColumn"), formatDay(lastPlayed ?? null) ?? "—"],
          ]}
        />
        {visibleProgress.length ? (
          <Box sx={{ mt: 1.25 }}>
            <Panel>
              {visibleProgress.map((row) => (
                <ListRow
                  key={row.id}
                  label={row.platformName ?? t("games.about.unknownPlatform")}
                  onClick={() => handleEditProgressClick(row)}
                  leading={
                    <PlatformBadge>{badgeFor(row.platformId, row.platformName)}</PlatformBadge>
                  }
                  title={row.platformName ?? t("games.about.unknownPlatform")}
                  subtitle={
                    [
                      row.playtimeMinutes ? formatDuration(row.playtimeMinutes) : null,
                      row.rating !== null
                        ? t("progress.ratingValue", { rating: row.rating })
                        : null,
                      row.lastPlayedAt
                        ? t("progress.lastPlayedOn", { date: formatDay(row.lastPlayedAt) })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                  trailing={
                    <Chip
                      size="small"
                      variant="outlined"
                      color={PLAY_STATUS_CHIP[row.playStatus]}
                      label={statusLabels[row.playStatus]}
                    />
                  }
                  actions={removeAction(() => handleRemoveProgress(row))}
                />
              ))}
            </Panel>
          </Box>
        ) : null}
      </Section>

      <Section
        id="play-sessions"
        title={t("playSessions.title")}
        action={
          <SectionAction
            icon={<AddIcon />}
            label={t("playSessions.addAction")}
            onClick={handleAddSessionClick}
          />
        }
      >
        {visibleSessions.length === 0 ? (
          <EmptyLine>{t("playSessions.empty")}</EmptyLine>
        ) : (
          <Panel>
            {visibleSessions.map((session) => (
              <ListRow
                key={session.id}
                label={`${session.platformName ?? ""} ${formatMoment(session.startedAt)}`.trim()}
                onClick={() => handleEditSessionClick(session)}
                leading={
                  <PlatformBadge>
                    {badgeFor(session.platformId, session.platformName)}
                  </PlatformBadge>
                }
                title={formatMoment(session.startedAt)}
                subtitle={
                  [
                    session.endedAt
                      ? t("playSessions.endedAt", { date: formatMoment(session.endedAt) })
                      : null,
                    session.notes,
                  ]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
                trailing={
                  session.durationMinutes !== null ? (
                    <Box
                      component="span"
                      sx={{
                        fontSize: 13,
                        color: "text.secondary",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatDuration(session.durationMinutes)}
                    </Box>
                  ) : null
                }
                actions={removeAction(() => handleRemoveSession(session))}
              />
            ))}
          </Panel>
        )}
      </Section>

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
    </>
  );
};

export default GameProgressSection;
