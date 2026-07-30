import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useHardwareStats } from "../hooks/useHardwareStats";
import { useCurrency } from "../theme/CurrencyProvider";
import { formatCurrency } from "../utils/currency";

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

const HardwareStatsSection = () => {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useHardwareStats();
  const { currency } = useCurrency();

  if (isLoading || !stats) {
    return null;
  }

  const hasBreakdownData = stats.manufacturerDistribution.length > 0 || stats.platformDistribution.length > 0;

  return (
    <Stack spacing={2} sx={{ mb: 3 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label={t("hardware.stats.ownedConsoles")} value={String(stats.ownedConsoles)} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label={t("hardware.stats.ownedAccessories")} value={String(stats.ownedAccessories)} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label={t("hardware.stats.wishlistHardware")} value={String(stats.wishlistHardware)} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            label={t("hardware.stats.collectionValue")}
            value={formatCurrency(stats.collectionValue, currency, { maximumFractionDigits: 0 })}
          />
        </Grid>
      </Grid>

      {hasBreakdownData ? (
        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>
            {stats.manufacturerDistribution.length > 0 ? (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t("hardware.stats.byManufacturer")}
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {stats.manufacturerDistribution.map((entry) => (
                    <Chip key={entry.name} label={`${entry.name}: ${entry.count}`} variant="outlined" />
                  ))}
                </Box>
              </Box>
            ) : null}
            {stats.platformDistribution.length > 0 ? (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {t("hardware.stats.byPlatform")}
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {stats.platformDistribution.map((entry) => (
                    <Chip key={entry.name} label={`${entry.name}: ${entry.count}`} variant="outlined" />
                  ))}
                </Box>
              </Box>
            ) : null}
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
};

export default HardwareStatsSection;
