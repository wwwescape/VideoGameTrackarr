import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import GameStatsSection from "./GameStatsSection";
import HardwareStatsSection from "./HardwareStatsSection";
import InsightsSubNav from "./InsightsSubNav";

const InsightsPage = () => {
  return (
    <>
      <InsightsSubNav />

      <Typography variant="h5" component="h2" gutterBottom>
        Games
      </Typography>
      <GameStatsSection />

      <Divider sx={{ my: 3 }} />

      <Typography variant="h5" component="h2" gutterBottom>
        Hardware
      </Typography>
      <HardwareStatsSection />
    </>
  );
};

export default InsightsPage;
