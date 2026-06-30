import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import { useMissingDlc } from "../hooks/useInsights";
import { gameIdentifier } from "../utils/identifiers";
import GameCard from "./GameCard";
import VirtualList from "./VirtualList";

const MissingDlcSection = () => {
  const { data: entries } = useMissingDlc();
  const navigate = useNavigate();

  if (!entries || entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No missing DLC found — you have everything that&apos;s been imported for the games you own.
      </Typography>
    );
  }

  return (
    <VirtualList
      items={entries}
      getKey={(entry) => entry.game.id}
      estimateSize={() => 280}
      gap={24}
      renderItem={(entry) => (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            {entry.game.name}
          </Typography>
          <Grid container spacing={{ xs: 1.5, sm: 2 }}>
            {entry.missingAddons.map((addon) => (
              <Grid key={addon.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                <GameCard
                  game={addon}
                  context="addon"
                  contextFunction={() => navigate(`/addon/${gameIdentifier(addon)}`)}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    />
  );
};

export default MissingDlcSection;
