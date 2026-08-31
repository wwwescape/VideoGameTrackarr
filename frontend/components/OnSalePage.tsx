import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import InsightsSubNav from "./InsightsSubNav";
import OnSaleSection from "./OnSaleSection";

const OnSalePage = () => {
  const { t } = useTranslation();

  return (
    <>
      <InsightsSubNav />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t("nav.onSale")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("insights.onSale.description")}
        </Typography>
      </Box>
      <OnSaleSection />
    </>
  );
};

export default OnSalePage;
