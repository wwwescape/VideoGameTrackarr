import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PlayStatus } from "../api/types";
import { useDashboardStats } from "../hooks/useDashboard";

const PLAY_STATUS_LABELS: Record<PlayStatus, string> = {
  none: "Not started",
  backlog: "Backlog",
  playing: "Playing",
  completed: "Completed",
  abandoned: "Abandoned",
};

function formatPlaytime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}m`;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
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
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return <Typography color="text.secondary">Loading stats...</Typography>;
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
          <StatCard label="Owned" value={String(stats.totalOwned)} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label="Wishlisted" value={String(stats.totalWishlisted)} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label="Total tracked" value={String(stats.totalTracked)} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label="Playtime logged" value={formatPlaytime(stats.totalPlaytimeMinutes)} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
          <StatCard label="Average rating" value={stats.averageRating === null ? "-" : stats.averageRating.toFixed(1)} />
        </Grid>
      </Grid>

      {hasBreakdownData && (
        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>
            {Object.keys(stats.playStatusBreakdown).length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  By play status
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {Object.entries(stats.playStatusBreakdown).map(([status, count]) => (
                    <Chip
                      key={status}
                      label={`${PLAY_STATUS_LABELS[status as PlayStatus]}: ${count}`}
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}
            {stats.platformBreakdown.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  By platform
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {stats.platformBreakdown.map((entry) => (
                    <Chip key={entry.name} label={`${entry.name}: ${entry.count}`} variant="outlined" />
                  ))}
                </Box>
              </Box>
            )}
            {stats.genreBreakdown.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  By genre
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {stats.genreBreakdown.map((entry) => (
                    <Chip key={entry.name} label={`${entry.name}: ${entry.count}`} variant="outlined" />
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
