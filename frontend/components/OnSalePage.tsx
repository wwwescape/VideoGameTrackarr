import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import Page from "./Page";
import OnSaleSection from "./OnSaleSection";

const OnSalePage = () => {
  const { t } = useTranslation();

  return (
    <Page>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("insights.onSale.description")}
      </Typography>
      <OnSaleSection />
    </Page>
  );
};

export default OnSalePage;
