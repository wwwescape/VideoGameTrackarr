import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import ReleaseCalendarSection from "./ReleaseCalendarSection";

const DashboardPage = () => {
  const { t } = useTranslation();

  return (
    <>
      <Typography variant="h5" component="h2" gutterBottom>
        {t("insights.dashboard.gamesCalendarHeading")}
      </Typography>
      <ReleaseCalendarSection scope="games" />

      <Divider sx={{ my: 3 }} />

      <Typography variant="h5" component="h2" gutterBottom>
        {t("insights.dashboard.hardwareCalendarHeading")}
      </Typography>
      <ReleaseCalendarSection scope="hardware" />
    </>
  );
};

export default DashboardPage;
