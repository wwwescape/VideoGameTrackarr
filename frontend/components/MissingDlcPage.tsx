import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import InsightsSubNav from "./InsightsSubNav";
import MissingDlcSection from "./MissingDlcSection";

const MissingDlcPage = () => {
  const { t } = useTranslation();

  return (
    <>
      <InsightsSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("nav.missingDlc")}
        </Typography>
      </Box>
      <MissingDlcSection />
    </>
  );
};

export default MissingDlcPage;
