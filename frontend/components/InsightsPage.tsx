import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import GameStatsSection from "./GameStatsSection";
import HardwareStatsSection from "./HardwareStatsSection";
import Page from "./Page";

const InsightsPage = () => {
  const { t } = useTranslation();

  return (
    <Page>

      <Typography variant="h5" component="h2" gutterBottom>
        {t("insights.page.gamesHeading")}
      </Typography>
      <GameStatsSection />

      <Divider sx={{ my: 3 }} />

      <Typography variant="h5" component="h2" gutterBottom>
        {t("insights.page.hardwareHeading")}
      </Typography>
      <HardwareStatsSection />
    </Page>
  );
};

export default InsightsPage;
