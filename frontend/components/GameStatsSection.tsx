import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { PlayStatus } from "../api/types";
import { useDashboardStats } from "../hooks/useDashboard";

function formatPlaytime(minutes: number, t: TFunction): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return t("games.stats.playtimeMinutesShort", { minutes: remainder });
  return remainder === 0
    ? t("games.stats.playtimeHoursShort", { hours })
    : t("games.stats.playtimeHoursMinutesShort", { hours, minutes: remainder });
}

interface StatCardProps {
  label: string;
  value: string;
}

const StatCard = ({ label, value }: StatCardProps) => (
  <Paper sx={{ p: 2, textAlign: "center" }}>
    <Typography variant="h4" component="div">
      {value}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {label}
    </Typography>
  </Paper>
);

// Games half of Insights' stats — moved here from the Dashboard, which now shows only the
// release calendar. "Recently added"/"Recently played" aren't relocated alongside it; Insights
// isn't a card-browsing page, so they're just gone, not moved.
const GameStatsSection = () => {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useDashboardStats();

  const playStatusLabels: Record<PlayStatus, string> = {
    none: t("games.stats.playStatusNotStarted"),
    backlog: t("games.stats.playStatusBacklog"),
    playing: t("games.stats.playStatusPlaying"),
    completed: t("games.stats.playStatusCompleted"),
    abandoned: t("games.stats.playStatusAbandoned"),
  };

  if (isLoading) {
    return <Typography color="text.secondary">{t("games.stats.loading")}</Typography>;
  }

  if (!stats) {
    return null;
  }

  const hasBreakdownData =
    Object.keys(stats.playStatusBreakdown).length > 0 ||
    stats.platformBreakdown.length > 0 ||
    stats.genreBreakdown.length > 0;

  return (
    <Stack spacing={3}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label={t("games.stats.ownedLabel")} value={String(stats.totalOwned)} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label={t("games.stats.wishlistedLabel")} value={String(stats.totalWishlisted)} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label={t("games.stats.totalTrackedLabel")} value={String(stats.totalTracked)} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard
            label={t("games.stats.playtimeLoggedLabel")}
            value={formatPlaytime(stats.totalPlaytimeMinutes, t)}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard
            label={t("games.stats.averageRatingLabel")}
            value={stats.averageRating === null ? "-" : stats.averageRating.toFixed(1)}
          />
        </Grid>
      </Grid>

      {hasBreakdownData && (
        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>
            {Object.keys(stats.playStatusBreakdown).length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t("games.stats.byPlayStatusTitle")}
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {Object.entries(stats.playStatusBreakdown).map(([status, count]) => (
                    <Chip
                      key={status}
                      label={t("games.stats.breakdownCountLabel", {
                        name: playStatusLabels[status as PlayStatus],
                        count,
                      })}
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}
            {stats.platformBreakdown.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t("games.stats.byPlatformTitle")}
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {stats.platformBreakdown.map((entry) => (
                    <Chip
                      key={entry.name}
                      label={t("games.stats.breakdownCountLabel", { name: entry.name, count: entry.count })}
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}
            {stats.genreBreakdown.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t("games.stats.byGenreTitle")}
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {stats.genreBreakdown.map((entry) => (
                    <Chip
                      key={entry.name}
                      label={t("games.stats.breakdownCountLabel", { name: entry.name, count: entry.count })}
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};

export default GameStatsSection;
